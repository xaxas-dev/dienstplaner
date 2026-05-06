from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DoctorQualification(Base):
    __tablename__ = "doctor_qualifications"

    __table_args__ = (PrimaryKeyConstraint("doctor_id", "qualification_id"),)

    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    qualification_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("qualifications.id", ondelete="CASCADE"), nullable=False
    )
    acquired_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    doctor: Mapped["Doctor"] = relationship(  # noqa: F821
        "Doctor", back_populates="doctor_qualifications"
    )
    qualification: Mapped["Qualification"] = relationship(  # noqa: F821
        "Qualification", back_populates="doctor_qualifications"
    )
