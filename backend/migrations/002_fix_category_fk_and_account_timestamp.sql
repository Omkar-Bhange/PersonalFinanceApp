-- 1. Drop existing composite foreign key on (user_id, category_id) that prevented referencing global categories
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS transactions_category_fk;

-- 2. Add foreign key referencing categories(id) with ON DELETE SET NULL
ALTER TABLE transactions
    ADD CONSTRAINT transactions_category_fk
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON DELETE SET NULL;

-- 3. Add updated_at column to accounts table
ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
