"""Seed-Skript: Test-Aerzte anhand der vorhandenen Bereiche anlegen (idempotent).

Aufruf: uv run python scripts/seed_doctors.py
"""

import sys
from datetime import date, timedelta
from math import ceil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import app.models  # noqa: F401, E402 - alle Modelle registrieren
from app.database import SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    Department,
    Doctor,
    DoctorType,
    EmploymentPeriod,
    INAExclusion,
    INAExclusionReason,
)

MAX_ENTRY_AGE_DAYS = 8 * 365
PART_TIME_PERCENTAGES = (50, 60, 80)

DOCTOR_NAMES = [
    "Anna Berger",
    "Ben Conrad",
    "Clara Dietrich",
    "David Engel",
    "Eva Fischer",
    "Felix Graf",
    "Greta Hoffmann",
    "Hannes Jung",
    "Ida Keller",
    "Jonas Lange",
    "Klara Meier",
    "Lukas Neumann",
    "Miriam Otto",
    "Nils Peters",
    "Olivia Richter",
    "Paul Schuster",
    "Rosa Thiel",
    "Simon Ulrich",
    "Theresa Vogel",
    "Uwe Wagner",
    "Valerie Zimmer",
    "Wilhelm Brandt",
    "Xenia Kraus",
    "Yara Lorenz",
    "Zoe Martin",
    "Aaron Stein",
    "Beate Wolff",
    "Cem Albrecht",
    "Diana Busch",
    "Emil Franke",
    "Frieda Hahn",
    "Georg Kramer",
]


def _entry_date_for_index(today: date, index: int, total: int) -> date:
    if total <= 1:
        return today - timedelta(days=MAX_ENTRY_AGE_DAYS)
    age_days = round(MAX_ENTRY_AGE_DAYS - (MAX_ENTRY_AGE_DAYS * index / (total - 1)))
    return today - timedelta(days=age_days)


def _name_for_index(index: int) -> str:
    if index < len(DOCTOR_NAMES):
        return DOCTOR_NAMES[index]
    return f"Test Arzt {index + 1:02d}"


def _short_name_for_name(name: str, used_short_names: set[str]) -> str:
    parts = name.split()
    base = "".join(part[0].upper() for part in parts[:2])
    short_name = base
    suffix = 2
    while short_name in used_short_names:
        short_name = f"{base}{suffix}"
        suffix += 1
    used_short_names.add(short_name)
    return short_name


def _part_time_indices(total: int) -> set[int]:
    part_time_count = ceil(total * 0.10)
    if part_time_count == 0:
        return set()
    if part_time_count == 1:
        return {0}
    step = (total - 1) / part_time_count
    return {min(total - 1, round(step * (idx + 0.5))) for idx in range(part_time_count)}


def _employment_periods_for_doctor(
    doctor: Doctor,
    *,
    index: int,
    today: date,
    part_time_indices: set[int],
) -> list[EmploymentPeriod]:
    if doctor.entry_date is None:
        raise RuntimeError(f"Seed-Arzt {doctor.name} hat kein Eintrittsdatum.")

    if not doctor.active:
        valid_to = min(today - timedelta(days=90), doctor.entry_date + timedelta(days=730))
        if valid_to <= doctor.entry_date:
            valid_to = doctor.entry_date + timedelta(days=30)
        return [
            EmploymentPeriod(
                doctor_id=doctor.id,
                valid_from=doctor.entry_date,
                valid_to=valid_to,
                employment_percentage=100,
                notes="Seed: ehemaliger Beschaeftigungszeitraum",
            )
        ]

    if index not in part_time_indices:
        return [
            EmploymentPeriod(
                doctor_id=doctor.id,
                valid_from=doctor.entry_date,
                valid_to=None,
                employment_percentage=100,
                notes="Seed: Vollzeit",
            )
        ]

    percentage_index = sorted(part_time_indices).index(index)
    percentage = PART_TIME_PERCENTAGES[percentage_index % len(PART_TIME_PERCENTAGES)]
    part_time_start = max(doctor.entry_date + timedelta(days=180), today - timedelta(days=365))
    if part_time_start <= doctor.entry_date:
        part_time_start = doctor.entry_date + timedelta(days=30)

    return [
        EmploymentPeriod(
            doctor_id=doctor.id,
            valid_from=doctor.entry_date,
            valid_to=part_time_start - timedelta(days=1),
            employment_percentage=100,
            notes="Seed: Vollzeit vor Teilzeit",
        ),
        EmploymentPeriod(
            doctor_id=doctor.id,
            valid_from=part_time_start,
            valid_to=None,
            employment_percentage=percentage,
            notes="Seed: Teilzeit",
        ),
    ]


def _create_ina_exclusion(
    doctor: Doctor, *, reason: INAExclusionReason, today: date
) -> INAExclusion:
    return INAExclusion(
        doctor_id=doctor.id,
        valid_from=today - timedelta(days=30),
        valid_to=None,
        reason=reason,
        notes="Seed: INA-Ausschluss fuer Testdaten",
    )


def apply_seed(session) -> tuple[int, int, int]:
    """Seed-Aerzte einfuegen. Gibt (inserted, skipped, target_total) zurueck."""
    department_count = session.query(Department).count()
    if department_count == 0:
        raise RuntimeError(
            "Keine Bereiche vorhanden. Bitte zuerst uv run python scripts/seed_departments.py "
            "ausfuehren."
        )

    target_total = department_count + 2
    today = date.today()
    external_indices = set(range(max(0, target_total - 4), target_total))
    inactive_index = 2 if target_total > 4 else 0
    part_time_indices = _part_time_indices(target_total) - {inactive_index}
    while len(part_time_indices) < ceil(target_total * 0.10):
        candidate = len(part_time_indices) * 3 + 1
        if candidate != inactive_index and candidate < target_total:
            part_time_indices.add(candidate)
        else:
            part_time_indices.add(max(0, target_total - len(part_time_indices) - 5))

    used_short_names: set[str] = set()
    seed_doctors = []
    for index in range(target_total):
        name = _name_for_index(index)
        seed_doctors.append(
            {
                "last_name": name,
                "title": "Dr.",
                "short_name": _short_name_for_name(name, used_short_names),
                "doctor_type": (
                    DoctorType.EXTERNAL if index in external_indices else DoctorType.INTERNAL
                ),
                "rank": "FACHARZT" if index % 4 == 0 else None,
                "active": index != inactive_index,
                "entry_date": _entry_date_for_index(today, index, target_total),
                "virtual_entry_date": _entry_date_for_index(today, index, target_total),
                "notes": "Seed: Testarzt",
            }
        )

    existing_names = {doctor.name for doctor in session.query(Doctor).all()}
    inserted = 0
    skipped = 0
    doctors_by_name: dict[str, Doctor] = {}

    for index, doctor_data in enumerate(seed_doctors):
        if doctor_data["last_name"] in existing_names:
            skipped += 1
            continue

        doctor = Doctor(**doctor_data)
        session.add(doctor)
        session.flush()
        doctors_by_name[doctor.name] = doctor
        for period in _employment_periods_for_doctor(
            doctor, index=index, today=today, part_time_indices=part_time_indices
        ):
            session.add(period)
        inserted += 1

    ina_indices = [index for index in range(target_total) if index != inactive_index][:2]
    ina_targets = [
        (seed_doctors[ina_indices[0]]["last_name"], INAExclusionReason.EINARBEITUNG),
        (seed_doctors[ina_indices[1]]["last_name"], INAExclusionReason.SONSTIGES),
    ]
    for name, reason in ina_targets:
        doctor = doctors_by_name.get(name)
        if doctor is not None:
            session.add(_create_ina_exclusion(doctor, reason=reason, today=today))

    session.commit()
    return inserted, skipped, target_total


def seed() -> None:
    from app.database import Base

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as session:
        inserted, skipped, target_total = apply_seed(session)
        print(
            f"{inserted} Aerzte eingefuegt, {skipped} Seed-Aerzte bereits vorhanden, "
            f"Zielbestand {target_total}."
        )


if __name__ == "__main__":
    seed()
