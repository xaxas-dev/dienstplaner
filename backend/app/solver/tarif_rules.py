"""Zentrale Constraint-Registry: IDs und Klassifizierung.

Drei Sektionen:
  1. Logisch-hart (nie overridebar): DOUBLE_BOOKED, ABSENT_DOCTOR
  2. Regulatorisch-hart (overridebar A/B/C): MAX_BD_PER_MONTH, MAX_WEEKENDS_PER_MONTH, MIN_REST_TIME
  3. Soft (Optimierungsziele): FAIR_DISTRIBUTION

ConstraintId als StrEnum: Wert = String, der an timefold als Constraint-Name übergeben wird.
Keine erfundenen Tarif-Werte; alle regulatorischen Constraints kommen erst in Folge-Milestones.

TarifRule-Protocol: Plug-in-Schnittstelle für Phase-A-Validierungsregeln.
REGISTERED_RULES bleibt leer im Prod-Code — konkrete Regeln kommen nach Domänenklärung.
"""
from __future__ import annotations

import enum
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.schemas.tarif_warning import TarifWarning


class ConstraintId(enum.StrEnum):
    # --- Logisch-hart (nie overridebar) ---
    DOUBLE_BOOKED = "double-booked"
    ABSENT_DOCTOR = "absent-doctor"

    # --- Regulatorisch-hart (overridebar A/B/C) ---
    MAX_BD_PER_MONTH = "max-bd-per-month"
    MAX_WEEKENDS_PER_MONTH = "max-weekends-per-month"
    MIN_REST_TIME = "min-rest-time"
    MAX_WEEKLY_HOURS = "max-weekly-hours"

    # --- Soft (Optimierungsziele) ---
    FAIR_DISTRIBUTION = "fair-distribution"


# Klassifizierungs-Sets — für Override-Logik und Reporting.
LOGISCH_HART: frozenset[ConstraintId] = frozenset(
    [ConstraintId.DOUBLE_BOOKED, ConstraintId.ABSENT_DOCTOR]
)
REGULATORISCH_HART: frozenset[ConstraintId] = frozenset(
    [
        ConstraintId.MAX_BD_PER_MONTH,
        ConstraintId.MAX_WEEKENDS_PER_MONTH,
        ConstraintId.MIN_REST_TIME,
        ConstraintId.MAX_WEEKLY_HOURS,
    ]
)
SOFT: frozenset[ConstraintId] = frozenset([ConstraintId.FAIR_DISTRIBUTION])

# Tarif-Werte TV-Ärzte/TdL i.d.F. 9. ÄnderungsTV (OQ-006, Option A hardcoded)
MAX_BD_PER_MONAT: int = 4  # § 7 Abs. 5a Satz 1
# M8-006: Wochenend-Limit (Platzhalter — exakter TV-Ärzte/TdL-Wert noch zu bestätigen)
MAX_WEEKEND_SHIFTS_PER_MONTH: int = 2  # max. Wochenend-Dienste pro Arzt/Monat
MIN_REST_HOURS: int = 11  # ArbZG §5 Abs. 1: Mindestruhezeit 11 Stunden
# M8-007: Wochenstunden-Limit ArbZG §3 Abs. 1 Standard (48 h); Opt-out M8-007+
MAX_WEEKLY_HOURS_MINUTES: int = 48 * 60


class TarifRule(Protocol):
    """Plug-in-Schnittstelle für Phase-A-Tarif-Validierungsregeln.

    Implementierungen geben eine Liste von TarifWarning-Objekten zurück.
    Leere Liste = keine Verletzung. Kein Schreibpfad-Eingriff (ADR-033).
    """

    id: str
    severity: str

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]: ...


# Prod-Registry — leer bis Domänenklärung (Folge-Milestones).
# Tests registrieren lokale Test-Rules per monkeypatch, nie global.
REGISTERED_RULES: list[TarifRule] = []
