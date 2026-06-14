"""add doctor rank, remove is_facharzt

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.add_column(sa.Column("rank", sa.String(50), nullable=True))
    op.execute("UPDATE doctors SET rank = 'FACHARZT' WHERE is_facharzt = 1")
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("is_facharzt")


def downgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.add_column(
            sa.Column("is_facharzt", sa.Boolean(), nullable=False, server_default="0")
        )
    op.execute("UPDATE doctors SET is_facharzt = 1 WHERE rank = 'FACHARZT'")
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("rank")
