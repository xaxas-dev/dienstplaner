"""Seed-Skript: Initiale Schichttypen anlegen und Uhrzeiten setzen (idempotent).

Aufruf: uv run python scripts/seed_shift_types.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import time  # noqa: E402

from sqlalchemy.orm import Session  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.models import ShiftType  # noqa: E402
from app.models import __all__ as _  # noqa: F401 – stellt sicher dass alle Modelle registriert sind

SHIFT_TYPES: list[dict] = [
    {
        "name": "V-Dienst",
        "short_name": "V",
        "applies_on_weekdays": True,
        "applies_on_weekend": False,
        "start_time": time(15, 0),
        "end_time": time(20, 15),
        "display_order": 1,
    },
    {
        "name": "Tagdienst",
        "short_name": "T",
        "applies_on_weekdays": False,
        "applies_on_weekend": True,
        "start_time": time(7, 30),
        "end_time": time(19, 30),
        "display_order": 2,
    },
    {
        "name": "Nachtdienst",
        "short_name": "N",
        "applies_on_weekdays": True,
        "applies_on_weekend": True,
        "start_time": time(19, 30),
        "end_time": time(7, 30),
        "display_order": 3,
    },
    {
        "name": "Tagdienst INA",
        "short_name": "T1",
        "applies_on_weekdays": True,
        "applies_on_weekend": False,
        "start_time": time(7, 30),
        "end_time": time(16, 0),
        "display_order": 4,
        "active": True,
        "notes": "Tagdienst Interdisziplinäre Notaufnahme (Mo-Fr)",
    },
]


def apply_seed(session: Session) -> tuple[int, int]:
    """Schichttypen einfügen oder Uhrzeiten setzen. Gibt (inserted, updated) zurück."""
    existing: dict[str, ShiftType] = {
        st.name: st for st in session.query(ShiftType).all()
    }
    inserted = 0
    updated = 0
    for st_data in SHIFT_TYPES:
        name = st_data["name"]
        if name not in existing:
            shift_type = ShiftType(**st_data)
            session.add(shift_type)
            inserted += 1
        else:
            st = existing[name]
            # Uhrzeiten nur setzen wenn beide null sind (Idempotenz)
            if st.start_time is None and st.end_time is None:
                st.start_time = st_data.get("start_time")
                st.end_time = st_data.get("end_time")
                updated += 1
    session.commit()
    return inserted, updated


def seed() -> None:
    from app.database import Base

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as session:
        inserted, updated = apply_seed(session)
        skipped = len(session.query(ShiftType).all()) - updated
        print(
            f"{inserted} Schichttypen eingefügt, "
            f"{updated} Uhrzeiten gesetzt, "
            f"{skipped} bereits vollständig."
        )


if __name__ == "__main__":
    seed()
