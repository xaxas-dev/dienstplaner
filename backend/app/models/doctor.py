import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DoctorType(enum.StrEnum):
    INTERNAL = "INTERNAL"
    EXTERNAL = "EXTERNAL"


class DoctorRank(enum.StrEnum):
    ASSISTENT = "ASSISTENT"
    FACHARZT = "FACHARZT"
    FUNKTIONSOBERARZT = "FUNKTIONSOBERARZT"
    OBERARZT = "OBERARZT"
    CHEFARZT = "CHEFARZT"


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    salutation: Mapped[str | None] = mapped_column(String(10), nullable=True)

    @property
    def name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    title: Mapped[str | None] = mapped_column(String(50), nullable=True)
    short_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    doctor_type: Mapped[DoctorType] = mapped_column(
        Enum(DoctorType, native_enum=False, length=50),
        nullable=False,
        default=DoctorType.INTERNAL,
    )
    rank: Mapped[DoctorRank | None] = mapped_column(
        Enum(DoctorRank, native_enum=False, length=50),
        nullable=True,
        default=None,
    )
    entry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    virtual_entry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    opt_out_bd_level: Mapped[int | None] = mapped_column(Integer, nullable=True)

    employment_periods: Mapped[list["EmploymentPeriod"]] = relationship(  # noqa: F821
        "EmploymentPeriod", back_populates="doctor", cascade="all, delete-orphan"
    )
    doctor_qualifications: Mapped[list["DoctorQualification"]] = relationship(  # noqa: F821
        "DoctorQualification", back_populates="doctor", cascade="all, delete-orphan"
    )
    qualifications: Mapped[list["Qualification"]] = relationship(  # noqa: F821
        "Qualification",
        secondary="doctor_qualifications",
        viewonly=True,
        overlaps="doctor_qualifications,qualification",
    )
    rule_overrides: Mapped[list["RuleOverride"]] = relationship(  # noqa: F821
        "RuleOverride", back_populates="doctor"
    )
