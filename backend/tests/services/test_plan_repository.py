from datetime import date, datetime

import pytest
from sqlalchemy.orm import Session

from app.models.plan import Plan
from app.repositories import plan_repository as plan_repo


def _make_plan(db: Session, name: str, valid_from: date, valid_to: date, created_at: datetime | None = None) -> Plan:
    plan = Plan(name=name, valid_from=valid_from, valid_to=valid_to)
    if created_at is not None:
        plan.created_at = created_at
    db.add(plan)
    db.flush()
    return plan


class TestGetCurrentPlan:
    def test_found_when_today_in_range(self, db: Session) -> None:
        plan = _make_plan(db, "Mai 2026", date(2026, 5, 1), date(2026, 5, 31))
        result = plan_repo.get_current_plan(db, date(2026, 5, 15))
        assert result is not None
        assert result.id == plan.id

    def test_found_on_first_day(self, db: Session) -> None:
        plan = _make_plan(db, "Mai 2026", date(2026, 5, 1), date(2026, 5, 31))
        result = plan_repo.get_current_plan(db, date(2026, 5, 1))
        assert result is not None
        assert result.id == plan.id

    def test_found_on_last_day(self, db: Session) -> None:
        plan = _make_plan(db, "Mai 2026", date(2026, 5, 1), date(2026, 5, 31))
        result = plan_repo.get_current_plan(db, date(2026, 5, 31))
        assert result is not None
        assert result.id == plan.id

    def test_not_found_when_today_before_range(self, db: Session) -> None:
        _make_plan(db, "Mai 2026", date(2026, 5, 1), date(2026, 5, 31))
        result = plan_repo.get_current_plan(db, date(2026, 4, 30))
        assert result is None

    def test_not_found_when_today_after_range(self, db: Session) -> None:
        _make_plan(db, "Mai 2026", date(2026, 5, 1), date(2026, 5, 31))
        result = plan_repo.get_current_plan(db, date(2026, 6, 1))
        assert result is None

    def test_returns_newest_when_multiple_match(self, db: Session) -> None:
        _make_plan(db, "Plan Alt", date(2026, 5, 1), date(2026, 5, 31), datetime(2026, 5, 1, 10, 0))
        plan_new = _make_plan(db, "Plan Neu", date(2026, 5, 1), date(2026, 5, 31), datetime(2026, 5, 10, 10, 0))
        result = plan_repo.get_current_plan(db, date(2026, 5, 20))
        assert result is not None
        assert result.id == plan_new.id
