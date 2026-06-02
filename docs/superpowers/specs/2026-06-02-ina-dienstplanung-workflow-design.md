# Design: INA-Dienstplanung — Workflow-Konzept (Phase A)

Stand: 2026-06-02. Phase A (manueller Planungsassistent, ohne Solver).

## Kontext & Problem

Beobachtung eines realen Planungsmonats hat einen grundlegenden Mismatch
zwischen dem Arbeitsablauf der Planerin und dem Programm aufgedeckt: Es gibt
**zwei getrennte Planungsrollen**, die das Programm heute als gleichrangig
editierbar behandelt.

- **Besetzungsplanung** (wer ist auf welcher Station, Springer-Zuteilung,
  Urlaub, INA-Nachtdienstwochen) wird von **jemand anderem** gemacht und kommt
  als **fertiges Monats-Excel** als Input zur Planerin.
- **INA-Dienstplanung** (V/T/N/T1 — die „peripheren" Notaufnahme-Dienste, die
  zusätzlich zur Stationsarbeit anfallen) ist **ihre** Aufgabe. Die Besetzung
  ist für sie nur **Kontext/Lesehilfe**, kein Editierobjekt. Rücksprache mit der
  Besetzungsplanung ist möglich, aber sie *baut* die Besetzung nicht.

Das Datenmodell trennt Rotation (monatsweise Besetzung) und Shift (täglicher
Dienst) bereits sauber (Hybrid-Modell, ADR-011). Der Mismatch liegt im **UX**:
beide Layer sind gleichrangig editierbar, und mehrere Werkzeuge für ihren realen
Arbeitsablauf fehlen.

### Realer Workflow (beobachtet)

0. **Input:** Monats-Excel mit Besetzungsplan (Arzt→Station), Springer-Zuteilung
   (tage- bis wochenweise), Urlaubsmarkierungen, INA-Nachtdienstwochen (immer
   5 aufeinanderfolgende Tage So–Do).
1. **Wünsche** der Ärzte eintragen (kD = kein Dienst, kV = kein V-Dienst,
   kN = kein Nachtdienst, Wunschdienst). Start der Planung der peripheren
   INA-Dienste. Die Notaufnahme muss durchgehend ausreichend besetzt sein.
2. **Nachtdienste:** Lücken zwischen den Nachtdienstwochen (Fr+Sa) füllen.
   Beachten: manche Ärzte machen keine Nachtdienste / ihre Station lässt es
   nicht zu; möglichst keine Dienste am WE direkt vor/nach Urlaub.
3. **Tagdienste:** Wochenenden und Feiertage.
4. **V-Dienste:** zuletzt; Fairness — z. B. jeder max. 3 Dienste. Ausnahmen
   sind die Regel.

### Workflow → Programm-Mapping (Ist-Stand)

| Schritt | Im Programm | Lücke |
|---|---|---|
| 0. Besetzung | `RotationAssignment` ✓ | nur manuell per DnD, kein Import |
| 0. Springer | `RotationAssignment` auf Bereich „Springer" ✓ | — |
| 0. Urlaub | `Absence` ✓ | nur manuell |
| 0. INA-Nachtdienstwochen | — | nicht modelliert |
| 1. Wünsche | `Wish` ✓ (Modell passt) | kein Wünsche-CRUD-UI (M4 ausgelassen) |
| 2. Nachtdienste | `N`-Shift ✓; `blocks_ina_*` ✓ | kein WE-vor/nach-Urlaub-Hinweis |
| 3. Tagdienste | `T`-Shift (`applies_on_weekend`) ✓ | kein Feiertagskalender |
| 4. V-Dienste | `V`-Shift ✓ | kein Live-Dienstzähler pro Arzt |

## Entscheidungen (aus Brainstorming 2026-06-02)

- **Besetzungsplanung als eigenes Modul = Zukunft.** Jetzt nur die Schnittstelle
  dorthin: Besetzungsdaten kommen per Excel-Import **oder** manuell und dienen
  der INA-Dienstplanung als read-only Kontext.
- **INA-Nachtdienstwochen = Input** (5-Tage-Blöcke So–Do, gesperrt); die Planerin
  füllt nur Fr+Sa.
- **Architektur: Layer + Fokus.** Unified Grid behalten, Besetzung als read-only
  Layer, fokussierter Dienst-Editor darüber.
- **Fokus statt Zwang:** freie Fokus-Filter (Nacht/Tag/V), kein geführter Wizard
  („Ausnahmen sind die Regel").
- **Feiertage:** SH-Feiertage automatisch + manuell überschreibbar.
- **Fairness-Zähler:** pro Arzt + je Schichtart, live.
- **Stations-Tagdienst-Ruhezeit-Konflikt:** bewusst außen vor (OQ-011).
- **Sequenzierung: Ansatz A (workflow-treu)** — erst Kontext-Fundament, dann
  Editor-Werkzeuge in Workflow-Reihenfolge 0→4.

## Architektur: Layer-Modell

Ein Plan bekommt zwei **konzeptionelle** Layer (kein neues Plan-Objekt,
ADR-011 bleibt unangetastet):

| Layer | Inhalt | Editierbar? | Gespeist durch |
|---|---|---|---|
| **Besetzungs-Layer** (Kontext) | RotationAssignment (Station + Springer), Absence (Urlaub), INA-Nachtdienstwochen | read-only, wenn gesperrt | manuell ODER Excel-Import (später) |
| **Dienst-Layer** (Arbeit) | Shifts V/T/N/T1 (außer gesperrte INA-Nachtwochen) | voll editierbar | Planerin, im Editor |

UX-Konsequenzen:

- **Lock-Schalter „Besetzung gesperrt"** am Plan. Gesperrt ⇒ Rotation-DnD
  deaktiviert, Besetzung nur Kontext. Entsperren möglich, bis das künftige
  Besetzungs-Modul die Pflege übernimmt. Persistiert als `Plan.besetzung_locked`.
- **Fokus-Filter** im Dienst-Layer (siehe Werkzeuge).
- Kein harter Schreibpfad-Block — die Sperre ist UI-seitig (Phase-A-Prinzip
  „weiche Validierung", CLAUDE.md).

## Datenmodell-Ergänzungen

1. **`Plan.besetzung_locked: bool`** (Default `false`, gesetzt sobald Besetzung
   steht). Steuert nur die UI-Sperre, keine DB-Validierung.

2. **`Shift.is_locked: bool`** (Default `false`). Markiert vom Input gelieferte,
   für die Planerin nicht editierbare Shifts. Eine INA-Nachtdienstwoche = 5
   vorbelegte `N`-Shifts (So–Do) für einen Arzt mit `is_locked=True`:
   read-only im Editor, visuell abgesetzt (grauer Block). Die Fr+Sa-Lücken
   bleiben normale editierbare `N`-Shifts. Reuse von `Shift` statt neuer
   Entität — passt zum Hybrid-Modell.
   - Abgrenzung zu `is_pinned`: `is_pinned` ist das **Solver**-Konzept (Solver
     überschreibt nicht). `is_locked` ist das **Editor**-Konzept (Input, nicht
     ihr Job, nicht manuell editierbar). Ein Input-Shift ist typischerweise
     beides; die Felder bleiben getrennt, weil sie unterschiedliche Konsumenten
     adressieren.

3. **Neue Tabelle `Holiday`:**
   ```
   Holiday:
     date    Date (PK)
     name    str
     source  enum HolidaySource (AUTO | MANUAL)
   ```
   SH-Feiertage werden auto-befüllt (`source=AUTO`); die Planerin kann Tage
   manuell ergänzen/entfernen (`source=MANUAL`, z. B. Brückentage). Die
   „Tagdienst-gilt-heute"-Logik wird zu **Wochenende ODER Feiertag** — reine
   Service-Logik, `ShiftType` bleibt unverändert.

4. **Kein Schema-Change** für: Wünsche (`Wish` existiert bereits),
   Fairness-Zähler (Frontend-Aggregation über Shifts), WE-vor/nach-Urlaub-Hinweis
   (neue Read-only-Regel).

## Werkzeuge im Dienst-Layer

| Werkzeug | Beschreibung | Workflow-Schritt |
|---|---|---|
| **Wünsche-UI** | CRUD für `Wish` (kD = AVOID_DAY, kV/kN = AVOID_SHIFT, Wunschdienst = REQUIRE_SHIFT); weicher Hint im Grid (analog Availability-Amber) | 1 |
| **Fokus-Filter** | Buttons Nacht / Tag / V / Alle; dimmt Nicht-Fokus-Zellen + Drag-Bar; baut auf bestehendem `focusMode` auf | 2–4 |
| **Fairness-Sidebar** | Pro Arzt laufende Dienstzahl, aufgeschlüsselt (gesamt + V/T/N), live beim Zuweisen | 4 |
| **WE-vor/nach-Urlaub-Hinweis** | Read-only weiche Warnung, wenn ein Dienst aufs WE direkt vor/nach einer `Absence`(Urlaub) fällt | 2 |

Alle Hinweise sind weich — kein Schreibpfad-Block (Phase-A-Prinzip).

## Milestone-Decomposition (Ansatz A)

Reihenfolge spiegelt den realen Workflow 0→4. Jeder Milestone = eine
Kernfunktion, eng geschnitten, einzeln reviewbar (CLAUDE.md-Konvention).

| ID | Titel | Kernfunktion | Schema |
|---|---|---|---|
| M12-001 | Besetzungs-Layer read-only | `Plan.besetzung_locked`; Rotation-DnD sperren; Kontext-Optik | Plan-Feld + Migration |
| M12-002 | INA-Nachtdienstwochen als Input | `Shift.is_locked`; 5-Tage-Nachtwoche-Setzwerkzeug (So–Do, 1 Arzt → 5 gesperrte N-Shifts); read-only-Optik | Shift-Feld + Migration |
| M12-003 | Feiertagskalender | `Holiday`-Tabelle, SH-Auto-Seed + manuell; T-Logik „WE ODER Feiertag" | neue Tabelle + Migration |
| M12-004 | Wünsche-Erfassung UI | CRUD für `Wish`; Grid-Hint | kein |
| M12-005 | Fokus-Filter Dienst-Phasen | Nacht/Tag/V/Alle-Filter | kein |
| M12-006 | Fairness-Zähler-Sidebar | Live-Dienstzähler pro Arzt + Schichtart | kein |
| M12-007 | Hinweis WE vor/nach Urlaub | Read-only-Regel in Tarif-/Konflikt-Pipeline | kein |
| M13-001 *(später)* | Excel-Import Besetzung | Parser Monats-Excel → Rotation/Absence/INA-Wochen | kein (nutzt vorhandene Tabellen) |

## Out-of-Scope / offene Fragen

- **Besetzungsplanungs-Modul** (eigenständiges Planen der Besetzung statt nur
  Schnittstelle) — Zukunft, eigener Strang.
- **Stations-Tagdienst-Ruhezeit-Konflikt** (implizite Stationspräsenz aus aktiver
  Rotation; „Fr-Nachtdienst ⇒ kein Stations-Tagdienst") — bewusst außen vor.
  → neue **OQ-011**.
- **Excel-Import-Layout** — genaues Spalten-/Sheet-Format der Besetzungs-Excel
  ungeklärt; blockiert M13-001. → neue **OQ-012**.
- **Holiday-Quelle** — statische Jahresliste vs. Oster-Algorithmus für bewegliche
  Feiertage; Detailfrage für M12-003.

## Testbarkeit (pro Milestone, CLAUDE.md-Konvention)

- M12-001: Service/Repo-Test für `besetzung_locked`-Persistenz; Frontend-Test
  Rotation-DnD bei Sperre deaktiviert.
- M12-002: Service-Test „Nachtwoche erzeugt 5 gesperrte N-Shifts So–Do";
  Editor-Test gesperrte Shifts nicht editierbar.
- M12-003: Service-Test „WE ODER Feiertag" für T-Dienst-Logik; SH-Auto-Seed-Test.
- M12-004–007: jeweils positiver + negativer Test pro neuer Regel/Hook
  (Frontend vitest, Backend pytest).
