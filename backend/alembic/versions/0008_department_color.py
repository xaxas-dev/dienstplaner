"""Department color column for unified plan grid

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-26
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("departments") as batch_op:
        batch_op.add_column(sa.Column("color", sa.String(9), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("departments") as batch_op:
        batch_op.drop_column("color")
