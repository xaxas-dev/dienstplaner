# Offene Fragen

Bevor eine Annahme getroffen wird, hier nachsehen ob sie bereits entschieden ist.

| ID | Frage | Status | Entschieden am |
|----|-------|--------|----------------|
| OQ-001 | Welche Java-Version ist für Timefold Solver erforderlich? | **Entschieden:** Eclipse Temurin JDK 21 (LTS). JDK 8 unzureichend (`Runtime.version()` fehlt). JDK 25 technisch ≥ 17, aber gegen timefold 1.24.0b0 ungetestet — nicht empfohlen. | 2026-05-19 |
| OQ-002 | Muss JAVA_HOME in der Systemumgebung gesetzt sein? | **Entschieden:** Eclipse Temurin 21 installiert unter `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\`. `java` ist nach Installation nicht automatisch im System-PATH — JAVA_HOME muss manuell in den Windows-Systemumgebungsvariablen gesetzt werden (oder per Session: `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"`). Für den Produktivbetrieb empfiehlt sich Eintrag in `System > Environment Variables`. | 2026-05-19 |
