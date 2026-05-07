import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WishType(enum.StrEnum):
    AVOID_DAY = "AVOID_DAY"
    AVOID_SHIFT = "AVOID_SHIFT"
    REQUIRE_SHIFT = "REQUIRE_SHIFT"


class Wish(Base):
    __tablename__ = "wishes"

    __table_args__ = (
        CheckConstraint("priority >= 1 AND priority <= 3", name="ck_wishes_priority_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    wish_date: Mapped[date] = mapped_column(Date, nullable=False)
    wish_type: Mapped[WishType] = mapped_column(
        Enum(WishType, native_enum=False, length=50), nullable=False
    )
    shift_type_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("shift_types.id", ondelete="SET NULL"), nullable=True
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    doctor: Mapped["Doctor"] = relationship("Doctor")  # noqa: F821
    shift_type: Mapped["ShiftType | None"] = relationship("ShiftType")  # noqa: F821
