"""shift_type filter_group hinzugefügt

Revision ID: 0016
Revises: 0015
"""
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("shift_types") as batch_op:
        batch_op.add_column(sa.Column("filter_group", sa.String(50), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("shift_types") as batch_op:
        batch_op.drop_column("filter_group")
