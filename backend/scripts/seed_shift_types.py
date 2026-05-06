"""Seed-Skript: Initiale Schichttypen anlegen (idempotent).

Aufruf: uv run python scripts/seed_shift_types.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine
from app.models import ShiftType
from app.models import __all__ as _  # noqa: F401 – stellt sicher dass alle Modelle registriert sind

SHIFT_TYPES: list[dict] = [
    {
        "name": "V-Dienst",
        "short_name": "V",
        "applies_on_weekdays": True,
        "applies_on_weekend": False,
        "display_order": 1,
    },
    {
        "name": "Tagdienst",
        "short_name": "T",
        "applies_on_weekdays": False,
        "applies_on_weekend": True,
        "display_order": 2,
    },
    {
        "name": "Nachtdienst",
        "short_name": "N",
        "applies_on_weekdays": True,
        "applies_on_weekend": True,
        "display_order": 3,
    },
]


def seed() -> None:
    from app.database import Base

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as session:
        existing_names = {row[0] for row in session.query(ShiftType.name).all()}
        inserted = 0
        for st_data in SHIFT_TYPES:
            if st_data["name"] in existing_names:
                continue
            shift_type = ShiftType(**st_data)
            session.add(shift_type)
            inserted += 1
        session.commit()
        print(f"{inserted} Schichttypen eingefügt, {len(existing_names)} bereits vorhanden.")


if __name__ == "__main__":
    seed()
