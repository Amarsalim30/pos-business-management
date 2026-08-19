import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)


def run_startup_migrations():
    """
    Ensure newly added columns and constraints exist in PostgreSQL tables.
    Executes safely with IF NOT EXISTS checks.
    """
    migration_statements = [
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS quoted_amount NUMERIC(12, 2) DEFAULT 0.00;",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'external';",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'labor';",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2);",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS unit_sold VARCHAR(20);",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2);",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2);",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(12, 2);",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS vendor VARCHAR(200);",
        "ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(100);",
        "ALTER TABLE project_incomes ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'client_payment';",
        "ALTER TABLE project_incomes ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';",
        "ALTER TABLE project_incomes ADD COLUMN IF NOT EXISTS reference VARCHAR(100);"
    ]

    with engine.connect() as conn:
        for stmt in migration_statements:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                logger.warning(f"Schema migration statement failed or already applied: {stmt} - {e}")
        conn.commit()
    logger.info("Startup schema migrations completed successfully.")
