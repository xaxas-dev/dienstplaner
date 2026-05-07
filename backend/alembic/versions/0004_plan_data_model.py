"""Plan-Datenmodell: plans, plan_versions, shifts, rotation_assignments, absences, wishes

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-07
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="DRAFT"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'RELEASED', 'ARCHIVED')",
            name="ck_plans_status",
        ),
        sa.CheckConstraint("valid_from <= valid_to", name="ck_plans_valid_from_before_valid_to"),
        sa.CheckConstraint("length(name) > 0", name="ck_plans_name_not_empty"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "plan_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("snapshot_json", sa.Text(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.CheckConstraint("version_number >= 1", name="ck_plan_versions_version_number_positive"),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "version_number", name="uq_plan_versions_plan_version"),
    )
    op.create_index("ix_plan_versions_plan_id", "plan_versions", ["plan_id"])

    op.create_table(
        "shifts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("shift_date", sa.Date(), nullable=False),
        sa.Column("shift_type_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shift_type_id"], ["shift_types.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "plan_id", "shift_date", "shift_type_id", name="uq_shifts_plan_date_type"
        ),
    )
    op.create_index("ix_shifts_plan_id", "shifts", ["plan_id"])
    op.create_index("ix_shifts_shift_date", "shifts", ["shift_date"])
    op.create_index("ix_shifts_doctor_id", "shifts", ["doctor_id"])

    op.create_table(
        "rotation_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "valid_from <= valid_to",
            name="ck_rotation_assignments_valid_from_before_valid_to",
        ),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rotation_assignments_plan_id", "rotation_assignments", ["plan_id"])
    op.create_index("ix_rotation_assignments_doctor_id", "rotation_assignments", ["doctor_id"])
    op.create_index(
        "ix_rotation_assignments_department_id", "rotation_assignments", ["department_id"]
    )

    op.create_table(
        "absences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("absence_type", sa.String(50), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint("valid_from <= valid_to", name="ck_absences_valid_from_before_valid_to"),
        sa.CheckConstraint(
            "absence_type IN ("
            "'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES'"
            ")",
            name="ck_absences_absence_type",
        ),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_absences_doctor_id", "absences", ["doctor_id"])

    op.create_table(
        "wishes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("doctor_id", sa.Integer(), nullable=False),
        sa.Column("wish_date", sa.Date(), nullable=False),
        sa.Column("wish_type", sa.String(50), nullable=False),
        sa.Column("shift_type_id", sa.Integer(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint("priority >= 1 AND priority <= 3", name="ck_wishes_priority_range"),
        sa.CheckConstraint(
            "wish_type IN ('AVOID_DAY', 'AVOID_SHIFT', 'REQUIRE_SHIFT')",
            name="ck_wishes_wish_type",
        ),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["shift_type_id"], ["shift_types.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_wishes_doctor_id", "wishes", ["doctor_id"])
    op.create_index("ix_wishes_wish_date", "wishes", ["wish_date"])


def downgrade() -> None:
    op.drop_index("ix_wishes_wish_date", table_name="wishes")
    op.drop_index("ix_wishes_doctor_id", table_name="wishes")
    op.drop_table("wishes")

    op.drop_index("ix_absences_doctor_id", table_name="absences")
    op.drop_table("absences")

    op.drop_index("ix_rotation_assignments_department_id", table_name="rotation_assignments")
    op.drop_index("ix_rotation_assignments_doctor_id", table_name="rotation_assignments")
    op.drop_index("ix_rotation_assignments_plan_id", table_name="rotation_assignments")
    op.drop_table("rotation_assignments")

    op.drop_index("ix_shifts_doctor_id", table_name="shifts")
    op.drop_index("ix_shifts_shift_date", table_name="shifts")
    op.drop_index("ix_shifts_plan_id", table_name="shifts")
    op.drop_table("shifts")

    op.drop_index("ix_plan_versions_plan_id", table_name="plan_versions")
    op.drop_table("plan_versions")

    op.drop_table("plans")
