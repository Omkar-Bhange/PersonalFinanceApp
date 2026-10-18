const xlsx = require("xlsx");
const { cleanMerchantName } = require("./categorizationEngine");

/**
 * Parse an Excel (.xlsx, .xls) or CSV statement into structured transactions
 */
function parseExcelOrCsvStatement(buffer, originalFilename = "") {
  try {
    const workbook = xlsx.read(buffer, {
      type: "buffer",
      cellDates: true,
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error("No readable sheets found in spreadsheet.");
    }

    // Pick first non-empty sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rows || rows.length < 2) {
      throw new Error("The spreadsheet is empty or has insufficient rows.");
    }

    // 1. Scan metadata (Bank Name, Account Number) from the top rows
    const detectedAccount = extractAccountMetadata(rows);

    // 2. Locate header row
    const headerInfo = locateHeaderRow(rows);
    if (!headerInfo) {
      throw new Error(
        "Could not detect transaction table headers (e.g. Date, Narration, Debit, Credit) in the spreadsheet."
      );
    }

    const { headerRowIndex, colMap } = headerInfo;

    // 3. Extract transaction rows
    const transactions = [];
    let closingBalance = null;
    let openingBalance = null;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const dateRaw = row[colMap.dateIndex];
      const parsedDate = parseDateValue(dateRaw);
      if (!parsedDate) continue; // Skip non-data or footer rows

      const narrationRaw = String(row[colMap.narrationIndex] || "").trim();
      const refNo = colMap.refIndex !== -1 ? String(row[colMap.refIndex] || "").trim() : "";

      let debit = 0;
      let credit = 0;

      if (colMap.debitIndex !== -1) {
        debit = parseNumeric(row[colMap.debitIndex]);
      }
      if (colMap.creditIndex !== -1) {
        credit = parseNumeric(row[colMap.creditIndex]);
      }

      // Handle single amount column with Dr/Cr indicator if separate columns not present
      if (colMap.debitIndex === -1 && colMap.creditIndex === -1 && colMap.amountIndex !== -1) {
        const amt = parseNumeric(row[colMap.amountIndex]);
        const typeStr = colMap.typeIndex !== -1 ? String(row[colMap.typeIndex] || "").toUpperCase() : "";

        if (typeStr.includes("CR") || typeStr.includes("DEP") || amt < 0) {
          credit = Math.abs(amt);
        } else {
          debit = Math.abs(amt);
        }
      }

      // Skip rows with neither debit nor credit
      if (debit <= 0 && credit <= 0) continue;

      const isExpense = debit > 0;
      const amount = isExpense ? debit : credit;
      const transactionType = isExpense ? "EXPENSE" : "INCOME";

      // Extract balance if present
      let rowBalance = null;
      if (colMap.balanceIndex !== -1) {
        const balVal = parseNumeric(row[colMap.balanceIndex]);
        if (!isNaN(balVal) && balVal !== 0) {
          rowBalance = balVal;
          closingBalance = balVal;
          if (openingBalance === null) {
            openingBalance = isExpense ? balVal + amount : balVal - amount;
          }
        }
      }

      const merchant = cleanMerchantName(narrationRaw);

      transactions.push({
        transaction_date: parsedDate,
        raw_narration: narrationRaw,
        merchant: merchant || (isExpense ? "Expense" : "Income"),
        amount: Math.round(amount * 100) / 100,
        transaction_type: transactionType,
        ref_no: refNo || null,
        balance_after: rowBalance,
        notes: refNo ? `Ref: ${refNo}` : null,
      });
    }

    if (transactions.length === 0) {
      throw new Error("No transaction rows found under the detected table headers.");
    }

    return {
      success: true,
      detected_account: detectedAccount,
      statement_closing_balance: closingBalance,
      statement_opening_balance: openingBalance,
      count: transactions.length,
      transactions,
    };
  } catch (err) {
    throw new Error(`Excel statement parsing failed: ${err.message}`);
  }
}

function extractAccountMetadata(rows) {
  let bankName = null;
  let accountNumber = null;
  let accountHolder = null;

  const topLimit = Math.min(rows.length, 25);
  const textBlob = rows
    .slice(0, topLimit)
    .map((r) => (Array.isArray(r) ? r.join(" ") : ""))
    .join("\n");

  // Bank detection
  if (/state bank of india|\bsbi\b/i.test(textBlob)) {
    bankName = "State Bank of India";
  } else if (/hdfc/i.test(textBlob)) {
    bankName = "HDFC Bank";
  } else if (/icici/i.test(textBlob)) {
    bankName = "ICICI Bank";
  } else if (/axis bank/i.test(textBlob)) {
    bankName = "Axis Bank";
  } else if (/kotak/i.test(textBlob)) {
    bankName = "Kotak Mahindra Bank";
  } else if (/punjab national|pnb/i.test(textBlob)) {
    bankName = "Punjab National Bank";
  } else if (/bank of baroda|\bbob\b/i.test(textBlob)) {
    bankName = "Bank of Baroda";
  }

  // Account Number
  const accMatch = textBlob.match(/(?:Account|A\/c|Acct)\s*(?:Number|No|#)?[:\s]+([0-9X\*\s-]{6,25})/i);
  if (accMatch && accMatch[1]) {
    const rawAcc = accMatch[1].replace(/[\s-]/g, "");
    if (rawAcc.length >= 4) {
      accountNumber = rawAcc;
    }
  }

  const last4 = accountNumber ? accountNumber.slice(-4) : null;
  const suggestedName = bankName
    ? `${bankName}${last4 ? ` (...${last4})` : ""}`
    : last4
    ? `Bank Account (...${last4})`
    : "Primary Bank Account";

  return {
    bank_name: bankName,
    account_number_last4: last4,
    suggested_account_name: suggestedName,
    matched_account_id: null,
  };
}

function locateHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    let dateIndex = -1;
    let narrationIndex = -1;
    let debitIndex = -1;
    let creditIndex = -1;
    let amountIndex = -1;
    let balanceIndex = -1;
    let refIndex = -1;
    let typeIndex = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || "").toLowerCase().trim();
      if (!cell) continue;

      if (dateIndex === -1 && /^(?:txn|trans(?:action)?|value)?\s*date$/i.test(cell)) {
        dateIndex = c;
      } else if (dateIndex === -1 && /\bdate\b/i.test(cell) && !/statement|birth/i.test(cell)) {
        dateIndex = c;
      }

      if (narrationIndex === -1 && /narration|description|particulars|remarks|details/i.test(cell)) {
        narrationIndex = c;
      }

      if (debitIndex === -1 && /debit|withdrawal|dr\b/i.test(cell) && !/credit/i.test(cell)) {
        debitIndex = c;
      }

      if (creditIndex === -1 && /credit|deposit|cr\b/i.test(cell) && !/debit/i.test(cell)) {
        creditIndex = c;
      }

      if (amountIndex === -1 && /^amount\b/i.test(cell)) {
        amountIndex = c;
      }

      if (balanceIndex === -1 && /balance|closing\s*bal/i.test(cell)) {
        balanceIndex = c;
      }

      if (refIndex === -1 && /ref(?:\s*no|\s*number)?|chq|cheque|utr/i.test(cell)) {
        refIndex = c;
      }

      if (typeIndex === -1 && /^type|dr\s*\/\s*cr/i.test(cell)) {
        typeIndex = c;
      }
    }

    // Must at least have Date AND Narration AND (Debit or Credit or Amount)
    if (dateIndex !== -1 && narrationIndex !== -1 && (debitIndex !== -1 || creditIndex !== -1 || amountIndex !== -1)) {
      return {
        headerRowIndex: r,
        colMap: {
          dateIndex,
          narrationIndex,
          debitIndex,
          creditIndex,
          amountIndex,
          balanceIndex,
          refIndex,
          typeIndex,
        },
      };
    }
  }

  return null;
}

function parseDateValue(val) {
  if (!val) return null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }

  if (typeof val === "number" && val > 20000 && val < 60000) {
    // Excel serial number
    try {
      const parsed = xlsx.SSF.parse_date_code(val);
      if (parsed) {
        const y = String(parsed.y).padStart(4, "2000");
        const m = String(parsed.m).padStart(2, "0");
        const d = String(parsed.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    } catch {
      // ignore
    }
  }

  const str = String(val).trim();

  // Pattern: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Pattern: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    let year = dmyMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // Pattern: DD-Mon-YYYY (e.g. 01-Oct-2026)
  const monMatch = str.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})/);
  if (monMatch) {
    const months = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const day = monMatch[1].padStart(2, "0");
    const mStr = monMatch[2].toLowerCase();
    const month = months[mStr];
    let year = monMatch[3];
    if (year.length === 2) year = `20${year}`;
    if (month) return `${year}-${month}-${day}`;
  }

  return null;
}

function parseNumeric(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  const clean = String(val)
    .replace(/[₹$,]/g, "")
    .replace(/\s+/g, "")
    .trim();

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

module.exports = {
  parseExcelOrCsvStatement,
};

