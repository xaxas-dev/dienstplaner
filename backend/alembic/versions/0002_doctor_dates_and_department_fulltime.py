"""doctor entry dates and department requires_full_time

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-07

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op  # noqa: E402

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("doctors", sa.Column("entry_date", sa.Date(), nullable=True))
    op.add_column("doctors", sa.Column("virtual_entry_date", sa.Date(), nullable=True))
    op.add_column(
        "departments",
        sa.Column(
            "requires_full_time",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("departments", "requires_full_time")
    op.drop_column("doctors", "virtual_entry_date")
    op.drop_column("doctors", "entry_date")
