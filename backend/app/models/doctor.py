import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DoctorType(enum.StrEnum):
    INTERNAL = "INTERNAL"
    EXTERNAL = "EXTERNAL"


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    doctor_type: Mapped[DoctorType] = mapped_column(
        Enum(DoctorType, native_enum=False, length=50),
        nullable=False,
        default=DoctorType.INTERNAL,
    )
    weiterbildungsjahr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_facharzt: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    employment_periods: Mapped[list["EmploymentPeriod"]] = relationship(  # noqa: F821
        "EmploymentPeriod", back_populates="doctor", cascade="all, delete-orphan"
    )
    doctor_qualifications: Mapped[list["DoctorQualification"]] = relationship(  # noqa: F821
        "DoctorQualification", back_populates="doctor", cascade="all, delete-orphan"
    )
    rule_overrides: Mapped[list["RuleOverride"]] = relationship(  # noqa: F821
        "RuleOverride", back_populates="doctor"
    )
