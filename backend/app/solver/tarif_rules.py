"""Zentrale Constraint-Registry: IDs und Klassifizierung.

Drei Sektionen:
  1. Logisch-hart (nie overridebar): DOUBLE_BOOKED
  2. Regulatorisch-hart (overridebar A/B/C): (leer — Folge-Milestones)
  3. Soft (Optimierungsziele): (leer — Folge-Milestones)

ConstraintId als StrEnum: Wert = String, der an timefold als Constraint-Name übergeben wird.
Keine erfundenen Tarif-Werte; alle regulatorischen Constraints kommen erst in Folge-Milestones.
"""
from __future__ import annotations

import enum


class ConstraintId(enum.StrEnum):
    # --- Logisch-hart (nie overridebar) ---
    DOUBLE_BOOKED = "double-booked"
    # Folge-Milestones: ABSENT_DOCTOR = "absent-doctor"

    # --- Regulatorisch-hart (overridebar) --- Folge-Milestones
    # --- Soft (Optimierungsziele) ---          Folge-Milestones


# Klassifizierungs-Sets — für Override-Logik und Reporting.
LOGISCH_HART: frozenset[ConstraintId] = frozenset([ConstraintId.DOUBLE_BOOKED])
REGULATORISCH_HART: frozenset[ConstraintId] = frozenset()
SOFT: frozenset[ConstraintId] = frozenset()
