import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanStatus(enum.StrEnum):
    DRAFT = "DRAFT"
    RELEASED = "RELEASED"
    ARCHIVED = "ARCHIVED"


class Plan(Base):
    __tablename__ = "plans"

    __table_args__ = (
        CheckConstraint("valid_from <= valid_to", name="ck_plans_valid_from_before_valid_to"),
        CheckConstraint("length(name) > 0", name="ck_plans_name_not_empty"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PlanStatus] = mapped_column(
        Enum(PlanStatus, native_enum=False, length=50),
        nullable=False,
        default=PlanStatus.DRAFT,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan_versions: Mapped[list["PlanVersion"]] = relationship(  # noqa: F821
        "PlanVersion", back_populates="plan", cascade="all, delete-orphan"
    )
    shifts: Mapped[list["Shift"]] = relationship(  # noqa: F821
        "Shift", back_populates="plan", cascade="all, delete-orphan"
    )
    rotation_assignments: Mapped[list["RotationAssignment"]] = relationship(  # noqa: F821
        "RotationAssignment", back_populates="plan", cascade="all, delete-orphan"
    )
