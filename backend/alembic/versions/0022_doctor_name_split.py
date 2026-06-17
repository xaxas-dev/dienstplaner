"""split Doctor.name into first_name + last_name, add salutation

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-17
"""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns — server_default needed for NOT NULL on existing rows
    op.add_column("doctors", sa.Column("first_name", sa.String(100), nullable=False, server_default=""))
    op.add_column("doctors", sa.Column("last_name", sa.String(100), nullable=False, server_default=""))
    op.add_column("doctors", sa.Column("salutation", sa.String(10), nullable=True))
    # Migrate: existing name goes to last_name; first_name stays empty (user corrects manually)
    op.execute("UPDATE doctors SET last_name = name")
    # Drop index on name before batch alter (SQLite would try to re-create it)
    op.drop_index("ix_doctors_name", table_name="doctors")
    # Drop old column (batch required for SQLite)
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("name")


def downgrade() -> None:
    op.add_column("doctors", sa.Column("name", sa.String(200), nullable=False, server_default=""))
    op.execute(
        "UPDATE doctors SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))"
    )
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("first_name")
        batch_op.drop_column("last_name")
        batch_op.drop_column("salutation")
    op.create_index("ix_doctors_name", "doctors", ["name"])
