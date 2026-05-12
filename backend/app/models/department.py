from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_external: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_shift_relevant: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    requires_full_time: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    min_headcount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_headcount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    blocks_ina_weekdays: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    blocks_ina_weekends: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
