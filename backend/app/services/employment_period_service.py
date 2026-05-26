from __future__ import annotations

from datetime import date

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.employment_period import EmploymentPeriod


def get_fte_for_period(
    db: Session,
    doctor_id: int,
    start: date,
    end: date,
) -> int:
    periods = (
        db.query(EmploymentPeriod)
        .filter(
            EmploymentPeriod.doctor_id == doctor_id,
            EmploymentPeriod.valid_from <= end,
            or_(
                EmploymentPeriod.valid_to.is_(None),
                EmploymentPeriod.valid_to >= start,
            ),
        )
        .all()
    )

    if not periods:
        return 100

    total_days = (end - start).days + 1
    if total_days == 0:
        return 100

    weighted_sum = 0
    for p in periods:
        overlap_start = max(p.valid_from, start)
        # open-ended period: treat valid_to as end of query range
        overlap_end = min(p.valid_to if p.valid_to is not None else end, end)
        days = (overlap_end - overlap_start).days + 1
        weighted_sum += p.employment_percentage * days

    return int(round(weighted_sum / total_days))
