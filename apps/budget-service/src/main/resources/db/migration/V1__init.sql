CREATE TABLE IF NOT EXISTS categories (
    id            UUID           NOT NULL,
    user_id       VARCHAR(255)   NOT NULL,
    name          VARCHAR(255)   NOT NULL,
    monthly_limit NUMERIC(12, 2) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_categories_user_name UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS threshold_flags (
    id          UUID         NOT NULL,
    user_id     VARCHAR(255) NOT NULL,
    category_id UUID         NOT NULL,
    month       VARCHAR(255) NOT NULL,
    threshold   INTEGER      NOT NULL,
    fired_at    TIMESTAMP    NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_threshold_flags UNIQUE (user_id, category_id, month, threshold)
);
