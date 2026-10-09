BEGIN;

CREATE TABLE lending_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL,
    direction VARCHAR(10) NOT NULL,
    person_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    principal_amount NUMERIC(14,2) NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT lending_records_direction_check
        CHECK (direction IN ('LENT', 'BORROWED')),

    CONSTRAINT lending_records_principal_amount_positive
        CHECK (principal_amount > 0),

    CONSTRAINT lending_records_user_id_id_unique
        UNIQUE (user_id, id),

    CONSTRAINT lending_records_account_owner_fk
        FOREIGN KEY (user_id, account_id)
        REFERENCES accounts(user_id, id)
);

CREATE TABLE repayments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lending_id BIGINT NOT NULL,
    account_id BIGINT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    repayment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT repayments_amount_positive
        CHECK (amount > 0),

    CONSTRAINT repayments_user_id_id_unique
        UNIQUE (user_id, id),

    CONSTRAINT repayments_lending_owner_fk
        FOREIGN KEY (user_id, lending_id)
        REFERENCES lending_records(user_id, id)
        ON DELETE CASCADE,

    CONSTRAINT repayments_account_owner_fk
        FOREIGN KEY (user_id, account_id)
        REFERENCES accounts(user_id, id)
);

CREATE INDEX lending_records_user_date_idx
    ON lending_records(user_id, start_date DESC);

CREATE INDEX lending_records_account_idx
    ON lending_records(user_id, account_id);

CREATE INDEX repayments_lending_idx
    ON repayments(lending_id);

CREATE INDEX repayments_user_account_idx
    ON repayments(user_id, account_id);

COMMIT;

