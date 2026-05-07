"""Seed-Skript: Initiale Bereiche anlegen (idempotent).

Aufruf: uv run python scripts/seed_departments.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import app.models  # noqa: F401, E402 – alle Modelle registrieren
from app.database import SessionLocal, engine  # noqa: E402
from app.models import Department  # noqa: E402

_I = {"is_external": False, "is_shift_relevant": True}
_E = {"is_external": True, "is_shift_relevant": False}

DEPARTMENTS: list[dict] = [
    {"name": "511/LBEST", "short_name": "LBEST", "display_order": 1, **_I},
    {"name": "511", "short_name": "511", "display_order": 2, **_I},
    {"name": "ITS", "short_name": "ITS", "display_order": 3, **_I},
    {"name": "SU-Stationsarzt", "short_name": "SU-SA", "display_order": 4, **_I},
    {"name": "SU", "short_name": "SU", "display_order": 5, **_I},
    {"name": "Duplex", "short_name": "Du", "display_order": 6, **_I},
    {"name": "Poli", "short_name": "Poli", "display_order": 7, **_I},
    {"name": "Poli/EMG", "short_name": "Poli/EMG", "display_order": 8, **_I},
    {"name": "EMG", "short_name": "EMG", "display_order": 9, **_I},
    {"name": "Springer", "short_name": "Spr", "display_order": 10, **_I},
    {"name": "Parkinson Komplextherapie", "short_name": "ParkiKomp", "display_order": 11, **_I},
    {"name": "Tagesklinik", "short_name": "TK", "display_order": 12, **_I},
    {"name": "Neuromotorik-TK", "short_name": "NM-TK", "display_order": 13, **_I},
    {"name": "Poli/Botox/THS", "short_name": None, "display_order": 14, **_I},
    {"name": "Poli/Botox", "short_name": None, "display_order": 15, **_I},
    {"name": "MS-Sprechstunde/Konsile", "short_name": "MS", "display_order": 16, **_I},
    {"name": "Forschung", "short_name": "Fo", "display_order": 17, **_I},
    {
        "name": "Curschmann Klinik",
        "short_name": "CK",
        "display_order": 18,
        "requires_full_time": True,
        **_I,
    },
    {"name": "Intensiv Innere", "short_name": None, "display_order": 19, **_E},
    {"name": "Psychiatrie", "short_name": None, "display_order": 20, **_E},
    {"name": "ZIP", "short_name": None, "display_order": 21, **_E},
]


def seed() -> None:
    from app.database import Base

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as session:
        existing: dict[str, Department] = {row.name: row for row in session.query(Department).all()}
        inserted = 0
        updated = 0
        for dept_data in DEPARTMENTS:
            if dept_data["name"] in existing:
                dept = existing[dept_data["name"]]
                # Idempotent: requires_full_time korrekt setzen falls abweichend
                new_rft = dept_data.get("requires_full_time", False)
                if dept.requires_full_time != new_rft:
                    dept.requires_full_time = new_rft
                    updated += 1
            else:
                dept = Department(**dept_data)
                session.add(dept)
                inserted += 1
        session.commit()
        print(
            f"{inserted} Bereiche eingefügt, {updated} aktualisiert, "
            f"{len(existing) - updated} bereits korrekt."
        )


if __name__ == "__main__":
    seed()
