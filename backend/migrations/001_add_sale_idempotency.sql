-- Apply this migration to existing staging/production databases before deploy.
ALTER TABLE sales ADD COLUMN idempotency_key VARCHAR(100) NULL;
CREATE UNIQUE INDEX uq_sales_business_idempotency
    ON sales (business_id, idempotency_key);
