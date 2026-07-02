"""fix ck_absences_absence_type to include new absence types

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-17

Migration 0004 created ck_absences_absence_type with only the original 6 values.
Migration 0020 added EINARBEITUNG/EINARBEITUNG_INA/UNBESETZT to the Python enum
but incorrectly stated no DDL change was needed. This migration drops the old
constraint and adds a new one with all 9 values.
"""

from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None

_OLD_VALUES = (
    "'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES'"
)
_NEW_VALUES = (
    "'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES',"
    " 'EINARBEITUNG', 'EINARBEITUNG_INA', 'UNBESETZT'"
)


def upgrade() -> None:
    with op.batch_alter_table("absences", recreate="always") as batch_op:
        batch_op.drop_constraint("ck_absences_absence_type", type_="check")
        batch_op.create_check_constraint(
            "ck_absences_absence_type",
            f"absence_type IN ({_NEW_VALUES})",
        )


def downgrade() -> None:
    with op.batch_alter_table("absences", recreate="always") as batch_op:
        batch_op.drop_constraint("ck_absences_absence_type", type_="check")
        batch_op.create_check_constraint(
            "ck_absences_absence_type",
            f"absence_type IN ({_OLD_VALUES})",
        )
