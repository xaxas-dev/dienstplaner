"""wish_date nullable, day_of_week hinzugefügt

Revision ID: 0015
Revises: 0014
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("wishes") as batch_op:
        batch_op.alter_column("wish_date", existing_type=sa.Date(), nullable=True)
        batch_op.add_column(sa.Column("day_of_week", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("wishes") as batch_op:
        batch_op.drop_column("day_of_week")
        batch_op.alter_column("wish_date", existing_type=sa.Date(), nullable=False)
