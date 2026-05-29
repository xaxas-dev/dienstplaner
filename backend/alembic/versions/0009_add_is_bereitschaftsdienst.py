"""Add is_bereitschaftsdienst to shift_types

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-29
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("shift_types") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_bereitschaftsdienst",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("shift_types") as batch_op:
        batch_op.drop_column("is_bereitschaftsdienst")
