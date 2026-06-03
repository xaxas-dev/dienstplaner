from datetime import date
import pytest
from app.repositories import wish_repository as repo
from app.models.wish import Wish, WishType


def _make_doctor(db):
    from app.models.doctor import Doctor, DoctorType
    d = Doctor(name="Test Arzt", short_name="TA", doctor_type=DoctorType.INTERNAL, active=True)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def _make_plan(db, valid_from=date(2026, 3, 1), valid_to=date(2026, 3, 31)):
    from app.models.plan import Plan, PlanStatus
    p = Plan(name="TestPlan", valid_from=valid_from, valid_to=valid_to, status=PlanStatus.DRAFT)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_rotation(db, plan_id, doctor_id):
    from app.models.rotation_assignment import RotationAssignment
    from app.models.department import Department
    dept = Department(name="INA-Test", display_order=99)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    r = RotationAssignment(
        plan_id=plan_id, doctor_id=doctor_id, department_id=dept.id,
        valid_from=date(2026, 3, 1), valid_to=date(2026, 3, 31),
    )
    db.add(r)
    db.commit()


def _make_wish(db, doctor_id, wish_date=None, day_of_week=None,
               wish_type=WishType.AVOID_DAY, shift_type_id=None):
    w = Wish(
        doctor_id=doctor_id, wish_date=wish_date, day_of_week=day_of_week,
        wish_type=wish_type, shift_type_id=shift_type_id, priority=1,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


def test_get_by_doctor_returns_only_that_doctor(db):
    d1 = _make_doctor(db)
    d2 = _make_doctor(db)
    _make_wish(db, d1.id, wish_date=date(2026, 3, 15))
    _make_wish(db, d2.id, wish_date=date(2026, 3, 16))
    result = repo.get_wishes_by_doctor(db, d1.id)
    assert len(result) == 1
    assert result[0].doctor_id == d1.id


def test_get_for_plan_period_date_in_range(db):
    d = _make_doctor(db)
    p = _make_plan(db)
    _make_rotation(db, p.id, d.id)
    _make_wish(db, d.id, wish_date=date(2026, 3, 15))   # in range
    _make_wish(db, d.id, wish_date=date(2026, 4, 1))    # out of range
    result = repo.get_wishes_for_plan_period(db, p.id)
    assert len(result) == 1
    assert result[0].wish_date == date(2026, 3, 15)


def test_get_for_plan_period_weekday_always_included(db):
    d = _make_doctor(db)
    p = _make_plan(db)
    _make_rotation(db, p.id, d.id)
    _make_wish(db, d.id, day_of_week=4)
    result = repo.get_wishes_for_plan_period(db, p.id)
    assert len(result) == 1


def test_get_for_plan_period_general_always_included(db):
    d = _make_doctor(db)
    p = _make_plan(db)
    _make_rotation(db, p.id, d.id)
    _make_wish(db, d.id)  # wish_date=None, day_of_week=None
    result = repo.get_wishes_for_plan_period(db, p.id)
    assert len(result) == 1


def test_get_for_plan_period_doctor_without_rotation_excluded(db):
    d_in = _make_doctor(db)
    d_out = _make_doctor(db)
    p = _make_plan(db)
    _make_rotation(db, p.id, d_in.id)
    _make_wish(db, d_out.id, wish_date=date(2026, 3, 10))
    result = repo.get_wishes_for_plan_period(db, p.id)
    assert len(result) == 0


def test_delete_returns_true_when_found(db):
    d = _make_doctor(db)
    w = _make_wish(db, d.id, wish_date=date(2026, 3, 15))
    ok = repo.delete_wish(db, w.id)
    assert ok is True
    db.commit()
    assert db.get(Wish, w.id) is None


def test_delete_returns_false_when_not_found(db):
    assert repo.delete_wish(db, 99999) is False
