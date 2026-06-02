"""add is_locked to shifts

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-02
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("shifts") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_locked",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("shifts") as batch_op:
        batch_op.drop_column("is_locked")
