import enum
from datetime import date

from sqlalchemy import Date, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class HolidaySource(enum.StrEnum):
    AUTO = "AUTO"
    MANUAL = "MANUAL"


class Holiday(Base):
    __tablename__ = "holidays"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source: Mapped[HolidaySource] = mapped_column(
        Enum(HolidaySource, native_enum=False, length=20),
        nullable=False,
        default=HolidaySource.MANUAL,
    )
