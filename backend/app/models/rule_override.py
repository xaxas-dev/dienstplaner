import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OverrideScope(enum.StrEnum):
    GLOBAL = "GLOBAL"
    DOCTOR = "DOCTOR"


class RuleOverride(Base):
    __tablename__ = "rule_overrides"

    __table_args__ = (
        CheckConstraint(
            "(scope = 'DOCTOR' AND doctor_id IS NOT NULL) OR "
            "(scope = 'GLOBAL' AND doctor_id IS NULL)",
            name="ck_rule_override_scope_doctor_consistency",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    rule_key: Mapped[str] = mapped_column(String(100), nullable=False)
    scope: Mapped[OverrideScope] = mapped_column(
        Enum(OverrideScope, native_enum=False, length=50),
        nullable=False,
        default=OverrideScope.GLOBAL,
    )
    doctor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    override_value: Mapped[str] = mapped_column(String(500), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    doctor: Mapped["Doctor | None"] = relationship("Doctor", back_populates="rule_overrides")  # noqa: F821
