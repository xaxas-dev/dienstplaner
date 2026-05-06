"""initial master data tables

Revision ID: 0001
Revises:
Create Date: 2026-05-06

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op  # noqa: E402

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "doctors",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("short_name", sa.String(50), nullable=True),
        sa.Column(
            "doctor_type",
            sa.String(50),
            nullable=False,
            server_default="INTERNAL",
        ),
        sa.Column("weiterbildungsjahr", sa.Integer(), nullable=True),
        sa.Column("is_facharzt", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "doctor_type IN ('INTERNAL', 'EXTERNAL')",
            name="ck_doctors_doctor_type",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_doctors_name", "doctors", ["name"])

    op.create_table(
        "qualifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("short_name", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_qualifications_name"),
    )

    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("short_name", sa.String(50), nullable=True),
        sa.Column("is_external", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_shift_relevant", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_departments_name"),
    )
    op.create_index("ix_departments_name", "departments", ["name"])

    op.create_table(
        "shift_types",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("short_name", sa.String(20), nullable=False),
        sa.Column("applies_on_weekdays", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("applies_on_weekend", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_shift_types_name"),
        sa.UniqueConstraint("short_name", name="uq_shift_types_short_name"),
    )

    op.create_table(
        "employment_periods",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("employment_percentage", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "valid_to IS NULL OR valid_from < valid_to",
            name="ck_employment_period_valid_from_before_valid_to",
        ),
        sa.CheckConstraint(
            "employment_percentage >= 1 AND employment_percentage <= 100",
            name="ck_employment_period_percentage_range",
        ),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employment_periods_doctor_id", "employment_periods", ["doctor_id"])

    op.create_table(
        "rule_overrides",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("rule_key", sa.String(100), nullable=False),
        sa.Column("scope", sa.String(50), nullable=False, server_default="GLOBAL"),
        sa.Column("doctor_id", sa.Integer(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("override_value", sa.String(500), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "scope IN ('GLOBAL', 'DOCTOR')",
            name="ck_rule_overrides_scope",
        ),
        sa.CheckConstraint(
            "(scope = 'DOCTOR' AND doctor_id IS NOT NULL) OR "
            "(scope = 'GLOBAL' AND doctor_id IS NULL)",
            name="ck_rule_override_scope_doctor_consistency",
        ),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rule_overrides_doctor_id", "rule_overrides", ["doctor_id"])

    op.create_table(
        "doctor_qualifications",
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("qualification_id", sa.Integer(), nullable=False),
        sa.Column("acquired_at", sa.Date(), nullable=True),
        sa.Column("expires_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["qualification_id"], ["qualifications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("doctor_id", "qualification_id"),
    )


def downgrade() -> None:
    op.drop_table("doctor_qualifications")
    op.drop_index("ix_rule_overrides_doctor_id", table_name="rule_overrides")
    op.drop_table("rule_overrides")
    op.drop_index("ix_employment_periods_doctor_id", table_name="employment_periods")
    op.drop_table("employment_periods")
    op.drop_table("shift_types")
    op.drop_index("ix_departments_name", table_name="departments")
    op.drop_table("departments")
    op.drop_table("qualifications")
    op.drop_index("ix_doctors_name", table_name="doctors")
    op.drop_table("doctors")
