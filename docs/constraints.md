# Constraints

> Platzhalter – wird mit der Solver-Integration ausgebaut.

Constraint-Klassen: logisch hart (nie overridebar), regulatorisch hart
(overridebar per Override-Mechanismus A/B/C), soft (Optimierungsziele).
Alle Tarifregeln sind zentral in `backend/app/solver/tarif_rules.py` definiert.
Details folgen in Meilenstein M2 (Solver-Integration).

## Read-only Konflikt-Engine (M2-005, vor dem Solver)

Vor der Solver-Integration existiert eine read-only Konflikt-Engine mit zwei Typen:

- **NOT_AVAILABLE** — Arzt ist einer Schicht zugewiesen, aber laut
  `get_ina_availability` nicht INA-verfügbar (blockierende Rotation,
  Abwesenheit, INAExclusion).
- **DOUBLE_BOOKED** — Arzt ist am selben Kalendertag mehreren Schichten
  zugewiesen.

Konflikte blockieren nichts (weiche Philosophie). Sie werden read-only über
`GET /api/plans/{plan_id}/conflicts` und eingebettet in
`GET /api/plans/{plan_id}/shifts` zurückgegeben.

Tarif-/Ruhezeiten-/Wochenstunden-Constraints kommen mit der
Solver-Integration (Phase B).
