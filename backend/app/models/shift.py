from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Shift(Base):
    __tablename__ = "shifts"

    __table_args__ = (
        UniqueConstraint("plan_id", "shift_date", "shift_type_id", name="uq_shifts_plan_date_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False
    )
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shift_types.id", ondelete="RESTRICT"), nullable=False
    )
    doctor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan: Mapped["Plan"] = relationship("Plan", back_populates="shifts")  # noqa: F821
    shift_type: Mapped["ShiftType"] = relationship("ShiftType")  # noqa: F821
    doctor: Mapped["Doctor | None"] = relationship("Doctor")  # noqa: F821
