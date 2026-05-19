"""Unit-Tests für solver/solver_service.py: solve_plan direkt (Sub-Schritt E).

Kein HTTP-Client — ruft solve_plan(db, plan_id) direkt auf.
JVM-Guard wie in den anderen Solver-Tests.
"""
from datetime import date

import pytest
from sqlalchemy.orm import Session

_JVM_OK = False
_JVM_SKIP_REASON = "JVM-Check noch nicht ausgeführt"

try:
    import app.models  # noqa: F401 – alle Modelle registrieren
    import app.solver.solver_service as solver_service
    from app.models.doctor import Doctor
    from app.models.plan import Plan, PlanStatus
    from app.models.shift import Shift
    from app.models.shift_type import ShiftType
    from app.solver.domain import SolverShift  # noqa: F401 – JVM-Trigger

    _JVM_OK = True
except Exception as exc:
    _JVM_SKIP_REASON = f"Requires Java 17+ JVM: {exc}"

pytestmark = pytest.mark.skipif(not _JVM_OK, reason=_JVM_SKIP_REASON)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def shift_type_v(db: Session) -> "ShiftType":
    st = ShiftType(name="V-Solver", short_name="VS", display_order=1, active=True)
    db.add(st)
    db.flush()
    return st


@pytest.fixture
def shift_type_n(db: Session) -> "ShiftType":
    st = ShiftType(name="N-Solver", short_name="NS", display_order=2, active=True)
    db.add(st)
    db.flush()
    return st


@pytest.fixture
def plan(db: Session) -> "Plan":
    p = Plan(
        name="SolveTest",
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 1),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def doctor_alice(db: Session) -> "Doctor":
    d = Doctor(name="Dr. Alice", active=True)
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def doctor_bob(db: Session) -> "Doctor":
    d = Doctor(name="Dr. Bob", active=True)
    db.add(d)
    db.flush()
    return d


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_solve_plan_gibt_solve_result_zurueck(
    db: Session,
    plan: "Plan",
    shift_type_v: "ShiftType",
    shift_type_n: "ShiftType",
    doctor_alice: "Doctor",
    doctor_bob: "Doctor",
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """solve_plan liefert ein gültiges SolveResult ohne DB-Write."""
    monkeypatch.setattr(solver_service, "TERMINATION_SECONDS", 2)

    open_shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
        doctor_id=None,
        is_pinned=False,
    )
    pinned_shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_n.id,
        doctor_id=doctor_alice.id,
        is_pinned=True,
    )
    db.add_all([open_shift, pinned_shift])
    db.flush()

    result = solver_service.solve_plan(db, plan.id)

    assert result.plan_id == plan.id
    assert isinstance(result.hard_score, int)
    assert isinstance(result.soft_score, int)
    assert isinstance(result.feasible, bool)
    assert result.hard_score == 0, "Kein DOUBLE_BOOKED bei zwei Shifts mit versch. Ärzten"


def test_solve_plan_gepinnter_shift_nicht_im_diff(
    db: Session,
    plan: "Plan",
    shift_type_v: "ShiftType",
    shift_type_n: "ShiftType",
    doctor_alice: "Doctor",
    doctor_bob: "Doctor",
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Gepinnter Shift erscheint nicht in proposed_assignments."""
    monkeypatch.setattr(solver_service, "TERMINATION_SECONDS", 2)

    open_shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
        doctor_id=None,
        is_pinned=False,
    )
    pinned_shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_n.id,
        doctor_id=doctor_alice.id,
        is_pinned=True,
    )
    db.add_all([open_shift, pinned_shift])
    db.flush()

    result = solver_service.solve_plan(db, plan.id)

    # Gepinnter Shift darf nicht im Diff erscheinen
    diff_shift_ids = {pa.shift_id for pa in result.proposed_assignments}
    assert pinned_shift.id not in diff_shift_ids
