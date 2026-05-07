"""Department headcount columns + remove doctor.weiterbildungsjahr

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-07
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("min_headcount", sa.Integer(), nullable=True))
    op.add_column("departments", sa.Column("max_headcount", sa.Integer(), nullable=True))
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("weiterbildungsjahr")


def downgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.add_column(sa.Column("weiterbildungsjahr", sa.Integer(), nullable=True))
    op.drop_column("departments", "max_headcount")
    op.drop_column("departments", "min_headcount")
