"""INA-Verfügbarkeitsmodell: department-Flags, rotation is_einarbeitung, ina_exclusions

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-09
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "departments",
        sa.Column("blocks_ina_weekdays", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "departments",
        sa.Column("blocks_ina_weekends", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.add_column(
        "rotation_assignments",
        sa.Column("is_einarbeitung", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "ina_exclusions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "valid_to IS NULL OR valid_from <= valid_to",
            name="ck_ina_exclusions_valid_from_before_valid_to",
        ),
        sa.CheckConstraint(
            "reason IN ('SCHWANGERSCHAFT', 'EINARBEITUNG', 'SONSTIGES')",
            name="ck_ina_exclusions_reason",
        ),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ina_exclusions_doctor_id", "ina_exclusions", ["doctor_id"])


def downgrade() -> None:
    op.drop_index("ix_ina_exclusions_doctor_id", table_name="ina_exclusions")
    op.drop_table("ina_exclusions")

    with op.batch_alter_table("rotation_assignments") as batch_op:
        batch_op.drop_column("is_einarbeitung")

    with op.batch_alter_table("departments") as batch_op:
        batch_op.drop_column("blocks_ina_weekdays")
        batch_op.drop_column("blocks_ina_weekends")
