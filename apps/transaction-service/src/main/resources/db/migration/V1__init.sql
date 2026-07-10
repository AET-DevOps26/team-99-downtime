CREATE TABLE IF NOT EXISTS transactions (
    id            UUID         NOT NULL,
    user_id       VARCHAR(255) NOT NULL,
    category_id   UUID         NOT NULL,
    amount        NUMERIC(12, 2) NOT NULL,
    currency      VARCHAR(255) NOT NULL,
    description   VARCHAR(255) NOT NULL,
    date          DATE         NOT NULL,
    created_at    TIMESTAMP    NOT NULL,
    PRIMARY KEY (id)
);
