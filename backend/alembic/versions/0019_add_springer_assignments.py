"""add springer_assignments

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-15
"""

from alembic import op
import sqlalchemy as sa

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'springer_assignments',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.Column('plan_id', sa.Integer, sa.ForeignKey('plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shift_date', sa.Date, nullable=False),
        sa.Column('doctor_id', sa.Integer, sa.ForeignKey('doctors.id'), nullable=False),
        sa.Column('target_department_id', sa.Integer, sa.ForeignKey('departments.id'), nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.UniqueConstraint('plan_id', 'shift_date', 'doctor_id', name='uq_springer_plan_date_doctor'),
    )


def downgrade() -> None:
    op.drop_table('springer_assignments')
