import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class INAExclusionReason(enum.StrEnum):
    SCHWANGERSCHAFT = "SCHWANGERSCHAFT"
    EINARBEITUNG = "EINARBEITUNG"
    SONSTIGES = "SONSTIGES"


class INAExclusion(Base):
    __tablename__ = "ina_exclusions"

    __table_args__ = (
        CheckConstraint(
            "valid_to IS NULL OR valid_from <= valid_to",
            name="ck_ina_exclusions_valid_from_before_valid_to",
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
    reason: Mapped[INAExclusionReason] = mapped_column(
        Enum(INAExclusionReason, native_enum=False, length=50), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    doctor: Mapped["Doctor"] = relationship("Doctor")  # noqa: F821
