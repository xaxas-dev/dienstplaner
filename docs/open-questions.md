# Offene Fragen

Bevor eine Annahme getroffen wird, hier nachsehen ob sie bereits entschieden ist.

| ID | Frage | Status | Entschieden am |
|----|-------|--------|----------------|
| OQ-001 | Welche Java-Version ist für Timefold Solver erforderlich? | **Entschieden:** Eclipse Temurin JDK 21 (LTS). JDK 8 unzureichend (`Runtime.version()` fehlt). JDK 25 technisch ≥ 17, aber gegen timefold 1.24.0b0 ungetestet — nicht empfohlen. | 2026-05-19 |
| OQ-002 | Muss JAVA_HOME in der Systemumgebung gesetzt sein? | **Entschieden:** Eclipse Temurin 21 installiert unter `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\`. `java` ist nach Installation nicht automatisch im System-PATH — JAVA_HOME muss manuell in den Windows-Systemumgebungsvariablen gesetzt werden (oder per Session: `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"`). Für den Produktivbetrieb empfiehlt sich Eintrag in `System > Environment Variables`. | 2026-05-19 |
| OQ-003 | Heatmap-Ansicht: Verfügbarkeit pro Arzt über ganzen Monat als eigene View? | **Offen:** Wurde in M4-001 als Out of Scope definiert. Umsetzung als separater Folge-Milestone möglich (z. B. M4-002). Anforderung: Monats-Übersicht aller Ärzte × Tage, farbcodiert nach Verfügbarkeit. | — |
| OQ-004 | Bulk-Availability-Endpoint für effiziente Mehrfach-Abfragen im DoctorAssignPopover? | **Offen:** In M4-001 (Schritt E) wurde `useQueries` mit per-Doctor-Requests verwendet (React-Query-Deduplication). Bei Performance-Problemen bei vielen Ärzten wäre ein einzelner `GET /api/plans/{id}/shifts/{date}/availability`-Endpoint (alle Ärzte für ein Datum) die saubere Lösung. Folge-Optimierung, kein Scope für M4. | — |
| OQ-005 | DatePicker-Komponente: shadcn/react-day-picker vs. HTML `<input type="date">`? | **Entschieden (M4-001, ADR-057):** HTML `<input type="date">` bleibt Standard für lokale Single-User-Desktop-App. Kein extra Paket. Konsistentes Pattern in AbsenceFormDialog, INAExclusionFormDialog, EmploymentPeriodForm. | 2026-05-21 |
