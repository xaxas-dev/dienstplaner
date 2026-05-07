from datetime import datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanVersion(Base):
    __tablename__ = "plan_versions"

    __table_args__ = (
        UniqueConstraint("plan_id", "version_number", name="uq_plan_versions_plan_version"),
        CheckConstraint("version_number >= 1", name="ck_plan_versions_version_number_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan: Mapped["Plan"] = relationship("Plan", back_populates="plan_versions")  # noqa: F821
