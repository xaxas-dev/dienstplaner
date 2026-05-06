from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EmploymentPeriod(Base):
    __tablename__ = "employment_periods"

    __table_args__ = (
        CheckConstraint(
            "valid_to IS NULL OR valid_from < valid_to",
            name="ck_employment_period_valid_from_before_valid_to",
        ),
        CheckConstraint(
            "employment_percentage >= 1 AND employment_percentage <= 100",
            name="ck_employment_period_percentage_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    employment_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="employment_periods")  # noqa: F821
