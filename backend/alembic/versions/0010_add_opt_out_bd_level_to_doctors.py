"""add opt_out_bd_level to doctors

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-30
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.add_column(
            sa.Column("opt_out_bd_level", sa.Integer(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("opt_out_bd_level")
