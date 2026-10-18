BEGIN;

CREATE TABLE IF NOT EXISTS budgets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- Format 'YYYY-MM', e.g. '2026-10'
    amount_limit NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT budgets_amount_positive CHECK (amount_limit > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_category_month 
    ON budgets(user_id, category_id, month) 
    WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_overall_month 
    ON budgets(user_id, month) 
    WHERE category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_user_month_lookup 
    ON budgets(user_id, month);

COMMIT;
