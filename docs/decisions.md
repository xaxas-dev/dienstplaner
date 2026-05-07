# Architektur-Entscheidungen

| ID | Entscheidung | Begründung | Datum |
|----|-------------|------------|-------|
| ADR-001 | SQLite als Datenbank | Single-User, lokal, kein Server-Overhead | 2026-05-05 |
| ADR-002 | uv als Python-Paketmanager | Schnell, reproduzierbar, lockfile-basiert | 2026-05-05 |
| ADR-003 | pnpm als Node-Paketmanager | Effizient, strikte Abhängigkeitsauflösung | 2026-05-05 |
| ADR-004 | weiterbildungsjahr ohne oberes Limit | Weiterbildungen am UKSH dauern real bis ca. 10 Jahre; das ursprünglich angenommene Maximum von 6 ist falsch. Validierung: nur >= 1 in Pydantic, kein DB-Constraint. | 2026-05-07 |
| ADR-005 | virtual_entry_date manuell gepflegt (vorerst) | Das virtuelle Eintrittsdatum ergibt sich aus Eintrittsdatum plus Anrechnungszeiten. Berechnung wird in einem späteren Meilenstein automatisiert. Erste Version: manuelles Feld, nullable. | 2026-05-07 |
| ADR-006 | T1 als globaler Schichttyp (nicht bereichsgebunden im Schema) | T1 (Tagdienst INA) ist fachlich nur für die Interdisziplinäre Notaufnahme relevant, wird aber als globaler ShiftType modelliert. Die Eingrenzung auf den Bereich INA erfolgt als Solver-Constraint in M8, nicht als Schema-Beziehung. | 2026-05-07 |
| ADR-007 | Bestehender "Tagdienst" (T) bleibt unverändert; T1 kommt als neue Entität dazu | Variante a gewählt: "Tagdienst" (short_name=T) ist im Klinikalltag als eigenständiger Dienst bekannt und bleibt unverändert. T1 ist ein separater Schichttyp. Umbenennung des bestehenden zu T2 wurde nicht vorgenommen (unnötige Datenmigration). | 2026-05-07 |
| ADR-008 | Sollbesetzung mit min/max statt Zielwert | Eine einzelne Zielzahl würde die Planungsrealität verfälschen. min/max bildet den akzeptablen Bereich ab: z.B. SU 6–8 bedeutet, dass 6, 7 oder 8 Stellen alle gültig sind. max=null bedeutet keine Obergrenze; max=0 bedeutet "nicht besetzbar". Werte aus Excel-Stichprobe als Seed-Defaults, manuell anpassbar ohne Überschreiben durch erneutes Seeden. | 2026-05-07 |
| ADR-009 | weiterbildungsjahr als computed property statt gespeichertes Feld | Gespeicherte Werte veralten bei Beschäftigungsunterbrechungen, Elternzeit oder schlicht wenn kein Adminzugriff erfolgt. Da entry_date vorhanden ist, kann WBJ immer korrekt berechnet werden: `floor((heute - entry_date).days / 365.25) + 1`. Fachärzte und Ärzte ohne entry_date erhalten null. Das Feld erscheint weiterhin in der API (Pydantic v2 @computed_field), ist für den Frontend-Typen transparent. | 2026-05-07 |
| ADR-010 | Zwei neue externe Bereiche Intensiv (NCH) und Intensiv extern | In den ersten Excel-Auswertungen nicht vollständig erfasst. Beide sind externe Rotationen (is_external=True, is_shift_relevant=False). Sollbesetzung jeweils 1–1. | 2026-05-07 |
