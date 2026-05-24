"""Zentrale Constraint-Registry: IDs und Klassifizierung.

Drei Sektionen:
  1. Logisch-hart (nie overridebar): DOUBLE_BOOKED, ABSENT_DOCTOR
  2. Regulatorisch-hart (overridebar A/B/C): (leer — Folge-Milestones)
  3. Soft (Optimierungsziele): (leer — Folge-Milestones)

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

    # --- Regulatorisch-hart (overridebar) --- Folge-Milestones
    # --- Soft (Optimierungsziele) ---          Folge-Milestones


# Klassifizierungs-Sets — für Override-Logik und Reporting.
LOGISCH_HART: frozenset[ConstraintId] = frozenset(
    [ConstraintId.DOUBLE_BOOKED, ConstraintId.ABSENT_DOCTOR]
)
REGULATORISCH_HART: frozenset[ConstraintId] = frozenset()
SOFT: frozenset[ConstraintId] = frozenset()


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
