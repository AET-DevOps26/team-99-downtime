CREATE TABLE IF NOT EXISTS notifications (
    id            UUID           NOT NULL,
    user_id       VARCHAR(255)   NOT NULL,
    category_id   UUID           NOT NULL,
    category_name VARCHAR(255)   NOT NULL,
    threshold     INTEGER        NOT NULL,
    percent_used  NUMERIC(12, 2) NOT NULL,
    amount_left   NUMERIC(12, 2) NOT NULL,
    created_at    TIMESTAMP      NOT NULL,
    read_at       TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
