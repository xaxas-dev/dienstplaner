"""add einarbeitung and unbesetzt absence types

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-16
"""


revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # AbsenceType stored as VARCHAR (native_enum=False, length=50).
    # New values: EINARBEITUNG, EINARBEITUNG_INA, UNBESETZT — no DDL change needed.
    pass


def downgrade() -> None:
    pass
