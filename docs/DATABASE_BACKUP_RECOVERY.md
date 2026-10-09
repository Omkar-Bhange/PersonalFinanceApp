# PostgreSQL Database Backup, Restoration & Disaster Recovery Runbook

**Target Systems**: PostgreSQL 18+  
**Application**: PersonalFinanceApp (Node.js + Express Backend)  
**Primary Database**: `personal_finance_db`  
**Test Database**: `personal_finance_test_db`  

---

## 1. Safety Principles & Pre-Flight Checks

> [!IMPORTANT]
> - Never restore a backup directly over `personal_finance_db` or `personal_finance_test_db` without prior isolated testing.
> - Always perform test restores into a dedicated, isolated temporary database (e.g., `personal_finance_restore_test_db`).
> - Verify that database user credentials have `CREATEDB` permissions when creating test databases.

---

## 2. Creating a Database Backup

Execute `pg_dump` with custom compressed archive format (`-F c`), including large objects (`-b`) and verbose progress (`-v`).

```powershell
# Set environment variables for the session
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGUSER = "postgres"
$BACKUP_DATE = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "backups/personal_finance_db_${BACKUP_DATE}.dump"

# Create backups directory if missing
if (!(Test-Path "backups")) { New-Item -ItemType Directory -Path "backups" }

# Execute custom format dump
pg_dump -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d personal_finance_db -F c -b -v -f $BACKUP_FILE
```

### Validating Backup File Integrity
Verify the generated backup file exists and inspect its internal table of contents using `pg_restore -l`:

```powershell
# Inspect table of contents
pg_restore -l $BACKUP_FILE | Select-String -Pattern "TABLE|CONSTRAINT|INDEX|schema_migrations"
```

---

## 3. Isolated Restoration & Verification Procedure

Follow this safe 5-step workflow to verify a backup without touching production/development data:

### Step 1: Create a Dedicated Temporary Database
```powershell
createdb -h localhost -p 5432 -U postgres personal_finance_restore_test_db
```

### Step 2: Restore the Dump Archive
```powershell
pg_restore -h localhost -p 5432 -U postgres -d personal_finance_restore_test_db -v --no-owner --no-privileges $BACKUP_FILE
```

### Step 3: Verify Schema & Migration State
Run migration inspection to confirm that all schema migrations (`001`, `002`, `003`) are recognized:

```powershell
$env:DB_NAME = "personal_finance_restore_test_db"
node backend/src/utils/run-migration.js
```

*Expected Output*:
```
Migration already applied: 001_initial_schema.sql
Migration already applied: 002_fix_category_fk_and_account_timestamp.sql
Migration already applied: 003_create_lending_and_repayments.sql
```

### Step 4: Verify Sample Data Integrity
Execute an integrity query via Node or psql to check account balances and user counts:

```sql
SELECT 
    (SELECT COUNT(*) FROM users) AS user_count,
    (SELECT COUNT(*) FROM accounts) AS account_count,
    (SELECT COUNT(*) FROM transactions) AS transaction_count,
    (SELECT COUNT(*) FROM lending_records) AS lending_count,
    (SELECT COUNT(*) FROM repayments) AS repayment_count;
```

### Step 5: Clean Up the Temporary Test Database
After verification is complete, drop the temporary database:

```powershell
dropdb -h localhost -p 5432 -U postgres personal_finance_restore_test_db
```

---

## 4. Disaster Recovery & Application Reconfiguration

If switching the active application to a restored database:

1. Update the `.env` configuration file in `backend/`:
   ```dotenv
   DB_NAME=personal_finance_restored_db
   ```
2. Run database connection pre-flight check:
   ```powershell
   npm run test:db
   ```
3. Restart the backend service:
   ```powershell
   npm run start
   ```

