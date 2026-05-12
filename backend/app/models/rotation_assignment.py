from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RotationAssignment(Base):
    __tablename__ = "rotation_assignments"

    __table_args__ = (
        CheckConstraint(
            "valid_from <= valid_to",
            name="ck_rotation_assignments_valid_from_before_valid_to",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date] = mapped_column(Date, nullable=False)
    is_einarbeitung: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan: Mapped["Plan"] = relationship("Plan", back_populates="rotation_assignments")  # noqa: F821
    doctor: Mapped["Doctor"] = relationship("Doctor")  # noqa: F821
    department: Mapped["Department"] = relationship("Department")  # noqa: F821
