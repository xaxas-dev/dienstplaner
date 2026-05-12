from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.absence import Absence
from app.models.ina_exclusion import INAExclusion, INAExclusionReason
from app.models.rotation_assignment import RotationAssignment


@dataclass
class INAAvailability:
    available: bool
    reasons: list[str] = field(default_factory=list)


def get_ina_availability(db: Session, doctor_id: int, target_date: date) -> INAAvailability:
    is_weekend = target_date.weekday() >= 5
    reasons: list[str] = []

    rotations = (
        db.query(RotationAssignment)
        .options(selectinload(RotationAssignment.department))
        .filter(
            RotationAssignment.doctor_id == doctor_id,
            RotationAssignment.valid_from <= target_date,
            RotationAssignment.valid_to >= target_date,
        )
        .all()
    )

    for ra in rotations:
        dept = ra.department
        if is_weekend:
            if dept.blocks_ina_weekends:
                reasons.append(f"Rotation auf {dept.name}")
        else:
            if dept.blocks_ina_weekdays:
                reasons.append(f"Rotation auf {dept.name}")
        if ra.is_einarbeitung:
            reasons.append(f"Einarbeitung in {dept.name}")

    exclusions = (
        db.query(INAExclusion)
        .filter(
            INAExclusion.doctor_id == doctor_id,
            INAExclusion.valid_from <= target_date,
            or_(INAExclusion.valid_to.is_(None), INAExclusion.valid_to >= target_date),
        )
        .all()
    )

    for excl in exclusions:
        if excl.reason == INAExclusionReason.SCHWANGERSCHAFT:
            reasons.append("Schwangerschaft")
        elif excl.reason == INAExclusionReason.EINARBEITUNG:
            reasons.append("Einarbeitung")
        else:
            reasons.append(excl.notes or "Manuell ausgeschlossen")

    absences = (
        db.query(Absence)
        .filter(
            Absence.doctor_id == doctor_id,
            Absence.valid_from <= target_date,
            Absence.valid_to >= target_date,
        )
        .all()
    )

    for absence in absences:
        reasons.append(f"Abwesenheit: {absence.absence_type}")

    return INAAvailability(available=len(reasons) == 0, reasons=reasons)


def get_ina_availability_for_period(
    db: Session, doctor_id: int, start_date: date, end_date: date
) -> dict[date, INAAvailability]:
    rotations = (
        db.query(RotationAssignment)
        .options(selectinload(RotationAssignment.department))
        .filter(
            RotationAssignment.doctor_id == doctor_id,
            RotationAssignment.valid_from <= end_date,
            RotationAssignment.valid_to >= start_date,
        )
        .all()
    )

    exclusions = (
        db.query(INAExclusion)
        .filter(
            INAExclusion.doctor_id == doctor_id,
            INAExclusion.valid_from <= end_date,
            or_(INAExclusion.valid_to.is_(None), INAExclusion.valid_to >= start_date),
        )
        .all()
    )

    absences = (
        db.query(Absence)
        .filter(
            Absence.doctor_id == doctor_id,
            Absence.valid_from <= end_date,
            Absence.valid_to >= start_date,
        )
        .all()
    )

    result: dict[date, INAAvailability] = {}
    current = start_date
    while current <= end_date:
        reasons: list[str] = []
        is_weekend = current.weekday() >= 5

        for ra in rotations:
            if ra.valid_from <= current <= ra.valid_to:
                dept = ra.department
                if is_weekend:
                    if dept.blocks_ina_weekends:
                        reasons.append(f"Rotation auf {dept.name}")
                else:
                    if dept.blocks_ina_weekdays:
                        reasons.append(f"Rotation auf {dept.name}")
                if ra.is_einarbeitung:
                    reasons.append(f"Einarbeitung in {dept.name}")

        for excl in exclusions:
            if excl.valid_from <= current and (excl.valid_to is None or excl.valid_to >= current):
                if excl.reason == INAExclusionReason.SCHWANGERSCHAFT:
                    reasons.append("Schwangerschaft")
                elif excl.reason == INAExclusionReason.EINARBEITUNG:
                    reasons.append("Einarbeitung")
                else:
                    reasons.append(excl.notes or "Manuell ausgeschlossen")

        for absence in absences:
            if absence.valid_from <= current <= absence.valid_to:
                reasons.append(f"Abwesenheit: {absence.absence_type}")

        result[current] = INAAvailability(available=len(reasons) == 0, reasons=reasons)
        current = current + timedelta(days=1)

    return result
