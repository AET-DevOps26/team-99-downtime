-- Create a separate database per microservice.
-- Each service connects only to its own database (no cross-service queries).
CREATE DATABASE transaction_db;
CREATE DATABASE budget_db;
CREATE DATABASE auth_db;
