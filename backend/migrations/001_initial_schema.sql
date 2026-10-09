
BEGIN;

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_id_unique UNIQUE (id)
);

CREATE TABLE accounts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT accounts_type_check
        CHECK (account_type IN ('CASH', 'BANK', 'WALLET', 'OTHER')),

    CONSTRAINT accounts_user_name_unique
        UNIQUE (user_id, name),

    CONSTRAINT accounts_user_id_id_unique
        UNIQUE (user_id, id)
);

CREATE TABLE categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    category_type VARCHAR(20) NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT categories_type_check
        CHECK (category_type IN ('INCOME', 'EXPENSE')),

    CONSTRAINT categories_user_name_type_unique
        UNIQUE NULLS NOT DISTINCT (user_id, name, category_type),

    CONSTRAINT categories_user_id_id_unique
        UNIQUE (user_id, id)
);

CREATE TABLE transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    account_id BIGINT NOT NULL,
    category_id BIGINT,
    transaction_type VARCHAR(20) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description VARCHAR(255),
    merchant VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transactions_amount_positive
        CHECK (amount > 0),

    CONSTRAINT transactions_type_check
        CHECK (transaction_type IN ('INCOME', 'EXPENSE')),

    CONSTRAINT transactions_account_owner_fk
        FOREIGN KEY (user_id, account_id)
        REFERENCES accounts(user_id, id),

    CONSTRAINT transactions_category_fk
        FOREIGN KEY (user_id, category_id)
        REFERENCES categories(user_id, id)
);

CREATE INDEX transactions_user_date_idx
    ON transactions(user_id, transaction_date DESC);

CREATE INDEX transactions_account_idx
    ON transactions(user_id, account_id);

CREATE INDEX transactions_category_idx
    ON transactions(user_id, category_id);

COMMIT;
