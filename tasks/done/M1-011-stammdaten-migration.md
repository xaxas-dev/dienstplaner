# Task M1-011: Stammdaten-UI auf Atelier-Look migrieren

## Ziel
Bestehende Stammdaten-Pages auf den Atelier-Look bringen. Ärzte werden 
zu einem 3-spaltigen Karten-Grid. Restliche Listen (Bereiche, 
Schichttypen, Qualifikationen, Sonderregelungen) behalten ihre 
Table-Komponente, bekommen aber den neuen Frame und die CommandBar. 
Einstellungen-Page wird formell angepasst (Frame + CommandBar, kein 
Redesign der Felder).

Beendet die Übergangsphase nach M1-010, in der die Shell neu, aber 
die Page-Inhalte noch alt waren. Nach dieser Aufgabe ist die gesamte 
App optisch konsistent.

## Kontext
Lies vor Beginn in dieser Reihenfolge:
1. `CLAUDE.md`
2. `docs/design-implementation.md` §9 (Ärzte-Karten), §10 (restliche 
   Listen), §14 (Form-Dialoge nur Tokens, kein Redesign). 
   Source of Truth.
3. `handoff/ACCEPTANCE.md` für die Done-Definitionen der 
   entsprechenden Schritte (vermutlich §7, §8 oder ähnlich)
4. `design-reference/variants/variant-a.jsx` (`VariantA_Doctors` 
   für die Karten-Optik)
5. `frontend/src/features/doctors/DoctorListPage.tsx` (aktueller 
   Stand, Tabelle)
6. `frontend/src/features/doctors/DoctorForm.tsx` (Form-Dialog, 
   nur Tokens prüfen)
7. Restliche Stammdaten-Pages: 
   `frontend/src/features/departments/`, `shift-types/`, 
   `qualifications/`, `rule-overrides/`, `settings/`
8. `frontend/src/components/dp/` (Chip, ShiftChip, Avatar, 
   CommandBar aus M1-009/M1-010)
9. `frontend/src/components/ui/badge.tsx` (shadcn-Badge, wird 
   erweitert)
10. `frontend/src/lib/design/tokens.ts` (Farben, Radien)

**Wichtige Regeln aus der Anleitung (Wiederholung):**
- Keine Hex-Codes außerhalb von `tokens.ts` und `shift-palette.ts`. 
  Anleitung §9 nennt `bg-[#F3ECD8]` für Quals-Pills - dieser Wert 
  muss als Token ergänzt werden (siehe Sub-Schritt 1.4).
- Keine neuen UI-Libraries
- Bestehende shadcn-Komponenten erweitern, nicht ersetzen
- Form-Dialoge nicht redesignen, nur Tokens prüfen
- Bei Unklarheit: zuerst Anleitung lesen, sonst stoppen und fragen

## Entscheidungen für M1-011

Vor Schreiben des Briefings festgelegt:
- **Datenquelle:** echte Hooks, leere Zustände wo noch nichts da 
  ist. Die "Nächste 14 Tage"-Heatmap auf DoctorCards zeigt leere 
  Boxen, solange keine Schicht-Daten existieren (Solver fehlt). 
  Die Heatmap-Komponente erwartet ein Array, DoctorCard übergibt 
  erstmal `[]`. Ein echter `useDoctorShifts`-Hook kann später ohne 
  UI-Änderung ergänzt werden.
- **Karten-Edit:** keine Edit-Buttons auf den Karten. Edit läuft 
  weiter über die bestehende Detail-Page (`/aerzte/:id` oder 
  äquivalenter Pfad). Footer-Link "Details →" springt dorthin.
- **Form-Dialoge:** kein Redesign, nur Token-Sanity-Check 
  (§14). Falls in einem Dialog ein Hex-Wert auftaucht, der nicht 
  aus tokens stammt, ersetzen.
- **Einstellungen-Page:** kein 3-Spalten-Grid und keine Tabelle 
  (passt nicht ins §9/§10-Schema). Stattdessen: CommandBar mit 
  Titel "Einstellungen" + Formular in einer Card 
  (`rounded-2xl bg-card border border-line p-5`).

## Anforderungen

### Sub-Schritt 1: Ärzte-Liste auf Karten-Grid (§9)

**1.1 DoctorCard-Komponente**

`frontend/src/features/doctors/DoctorCard.tsx`.

Aufbau (von oben nach unten, in `rounded-2xl bg-card border 
border-line p-5`):
- **Header:** Avatar (44px) links, Name (Newsreader, 19px) rechts 
  daneben, Sub-Zeile mit Rolle und Soll-Prozent (z.B. "Fachärztin · 
  100 %") in `text-ink-2 text-xs`. Leave-Badge rechts oben (falls 
  Arzt aktuell im Urlaub - bedingt rendern).
- **Quals-Reihe:** kleine Pastell-Pills für die Qualifikationen 
  des Arztes. Verwendet Chip-Primitive aus M1-009 mit einer neuen 
  Variante `soft` (siehe 1.4). Falls keine Quals: Reihe weglassen 
  oder Platzhalter "—".
- **"Nächste 14 Tage"-Mini-Heatmap:** 14 schmale Boxen nebeneinander 
  (siehe 1.2). Bei leerem Daten-Array: 14 leere Boxen 
  (`bg-line/30`, gestrichelter Rand). Caption darüber: "Nächste 14 
  Tage" in `text-ink-3 text-[10px] uppercase tracking-wide`.
- **Footer:** links "N Dienste · M Urlaub" in `text-ink-2 text-xs`, 
  rechts Link "Details →" in `text-accent`. Klick führt auf 
  bestehende Detail-Page.

Werte für "N Dienste" und "M Urlaub": aus aktuellen Doctor-Daten 
ableiten falls möglich. Wenn keine Hooks für Counts existieren: 
"—" anzeigen, kein Mock-Wert. Klar im Code kommentieren.

Avatar verwendet das Primitive aus M1-009 mit oklch-Hue 
(deterministisch aus Doctor-ID).

**1.2 ShiftHeatmap14-Komponente**

`frontend/src/features/doctors/ShiftHeatmap14.tsx` oder als 
Primitive `frontend/src/components/dp/ShiftHeatmap14.tsx` (entscheidet 
Claude Code je nachdem, ob die Komponente nur in DoctorCard oder 
auch sonst verwendet wird).

Props:
```typescript
interface ShiftHeatmap14Props {
  shifts: Array<{
    date: string          // ISO-Datum
    shiftType?: ShiftType // wenn undefined = freier Tag oder leer
  }>
  // bei leerem Array werden 14 leere Boxen gerendert
}
```

Layout:
- `grid grid-cols-14 gap-0.5` (oder flex mit fixer Box-Breite)
- Jede Box: ca 12px breit, 16px hoch, `rounded-sm`
- Mit Schichttyp: Hintergrund aus SHIFT_PALETTE
- Ohne Schichttyp (freier Tag oder leer): `bg-line/30`, evtl. 
  gestrichelter Rand
- Falls weniger als 14 Elemente: bis 14 mit leeren Boxen auffüllen

Empty-State (`shifts.length === 0`): 14 leere Boxen mit minimal 
sichtbarem Rahmen.

**1.3 Filter-Chips über dem Grid**

Anleitung §9: "Alle / Fachärzte / WBA / Extern".

Verwendet Chip-Primitive (aktive Variante `active`, inaktive 
`default`).

Filter-Logik (basiert auf bestehenden Doctor-Feldern, Claude Code 
prüft beim Lesen der Types):
- **Alle:** alle Ärzte
- **Fachärzte:** Rolle == Facharzt (oder ähnliches Enum-Wert)
- **WBA:** Rolle == Weiterbildungsassistent
- **Extern:** Flag `is_extern` oder ähnlich

Falls die Feldnamen nicht exakt passen oder mehrere Rollen 
existieren, im Briefing-Kommentar dokumentieren und mit dem User 
abstimmen, bevor neue Kategorien erfunden werden.

State-Management: lokaler `useState<FilterKey>('all')`, kein 
URL-Param nötig.

**1.4 Token "soft" für Pastell-Pills ergänzen**

Anleitung §9 verwendet `bg-[#F3ECD8]` für Quals-Pills. Dieser Wert 
ist ein sandiger Beige-Ton zwischen `line` und `line-2`. Statt 
Hex-Inline:

In `frontend/src/lib/design/tokens.ts` ergänzen:
```typescript
// Beige-sand für Pills, Quals etc.
sand: '#F3ECD8'
```

In `tailwind.config.ts` ergänzen:
```typescript
sand: 'var(--dp-sand)' // oder direkter Hex via Tokens
```

In `index.css`:
```css
--dp-sand: #F3ECD8;
```

In Chip-Primitive eine neue Variante `soft`:
```typescript
soft: 'bg-sand text-ink-2 border-line'
```

**1.5 DoctorListPage umbauen**

`frontend/src/features/doctors/DoctorListPage.tsx` komplett umbauen:
- Alten Page-Header und Tabelle entfernen
- CommandBar oben:
  - title: "Team"
  - titleAccent: "Team" (italic, accent-Farbe für "Team")
  - oder title nach Pattern aus VariantA_Doctors: "Team · 12 Ärzte" 
    mit "Team" als titleAccent
  - filters: Filter-Chips wie 1.3
  - primaryAction: "+ Neuer Arzt" → bestehende Create-Route
  - showSearch: true
- 3-Spalten-Grid: `grid grid-cols-3 gap-3.5`
- Pro Doctor eine DoctorCard
- Loading-State: Skeleton-Karten (oder einfacher Spinner)
- Empty-State: Hinweis "Noch keine Ärzte angelegt. Mit + Neuer 
  Arzt starten."

**1.6 Akzeptanzkriterien für Sub-Schritt 1**

- [ ] `DoctorCard.tsx` existiert mit Header, Quals, Heatmap, Footer
- [ ] `ShiftHeatmap14` rendert 14 Boxen, leerer Zustand funktioniert
- [ ] Filter-Chips "Alle / Fachärzte / WBA / Extern" funktionieren
- [ ] Token `sand` in tokens.ts, tailwind.config.ts, index.css 
      ergänzt
- [ ] Chip-Variante `soft` ergänzt und in Quals verwendet
- [ ] DoctorListPage: CommandBar oben, 3-Spalten-Grid darunter
- [ ] "Details →"-Link springt auf bestehende Detail-Page
- [ ] Loading- und Empty-State funktionieren
- [ ] Keine neuen Hex-Werte außerhalb tokens.ts / shift-palette.ts
- [ ] `pnpm type-check` grün

**Stop-Gate nach Sub-Schritt 1:**
- Commit: `feat: M1-011/1 doctor cards grid`
- Warten auf Review (User klickt Filter-Chips, scrollt Karten, 
  testet Details-Link)

### Sub-Schritt 2: Schichttypen-Liste (§10, mit ShiftChip)

**2.1 Badge-Varianten in shadcn ergänzen**

`frontend/src/components/ui/badge.tsx`:

Neue Varianten (oder bestehende anpassen):
```typescript
ok:     'bg-ok/15 text-ok border border-ok/30'      // grün
muted:  'bg-line text-ink-3 border border-line-2'   // grau
```

Vorhandene Varianten prüfen: wenn `default` aktuell schwarz-gefüllt 
ist (laut Anleitung: "Keine schwarz-gefüllten Pills mehr"), 
überprüfen, ob das geändert werden muss. Mindestens `ok` und 
`muted` müssen existieren.

**2.2 Schichttypen-Page umbauen**

`frontend/src/features/shift-types/ShiftTypeListPage.tsx`:
- CommandBar oben:
  - title: "Schichttypen"
  - keine titleAccent oder "Schicht" als titleAccent
  - keine Filter (oder einfache Aktiv/Inaktiv-Filter wenn Feld 
    existiert)
  - primaryAction: "+ Neuer Schichttyp"
- Tabellen-Container: `rounded-2xl border border-line bg-card 
  overflow-hidden`
- Spalte "Name": ShiftChip mit Code + Name als Klartext rechts 
  daneben
- Spalte "Status" (falls vorhanden): Badge `ok` oder `muted`
- Restliche Spalten unverändert (Schichtzeiten, Beschreibung, etc.)

**2.3 Akzeptanzkriterien für Sub-Schritt 2**

- [ ] Badge hat Varianten `ok` und `muted`
- [ ] Schichttypen-Page hat CommandBar
- [ ] Tabelle ist im neuen Container (rounded-2xl bg-card border)
- [ ] Name-Spalte zeigt ShiftChip + Klartext
- [ ] Status-Spalte verwendet Badge-Varianten (falls Feld existiert)
- [ ] Schwarz-gefüllte Pills sind weg

**Stop-Gate nach Sub-Schritt 2:**
- Commit: `feat: M1-011/2 shift types list new frame`
- Warten auf Review (User prüft visuell, klickt Aktionen)

### Sub-Schritt 3: Restliche Listen (Bereiche, Qualifikationen, Regeln)

Pro Page der gleiche Umbau wie Schichttypen:
- CommandBar oben mit page-spezifischem Titel und primaryAction
- Tabelle im neuen Container
- Badge-Varianten für Status-Spalten
- Bestehende Logik und Spalten unverändert

**3.1 Bereiche / Stationen-Page**

`frontend/src/features/departments/DepartmentListPage.tsx` (Pfad 
anpassen falls anders):
- title: "Stationen" oder "Bereiche" (was im Code steht)
- primaryAction: "+ Neue Station/Bereich"

**3.2 Qualifikationen-Page**

`frontend/src/features/qualifications/QualificationListPage.tsx`:
- title: "Qualifikationen"
- primaryAction: "+ Neue Qualifikation"

**3.3 Sonderregelungen / Regeln-Page**

`frontend/src/features/rule-overrides/RuleOverrideListPage.tsx`:
- title: "Sonderregelungen" oder "Regeln" (was im Code steht)
- primaryAction: "+ Neue Regel"

**3.4 Akzeptanzkriterien für Sub-Schritt 3**

- [ ] Drei Pages migriert (Bereiche, Qualifikationen, Regeln)
- [ ] Jede mit CommandBar, neuem Tabellen-Container, Badge-Varianten
- [ ] CRUD-Funktionen weiterhin funktional

**Stop-Gate nach Sub-Schritt 3:**
- Commit: `feat: M1-011/3 remaining lists new frame`
- Warten auf Review

### Sub-Schritt 4: Einstellungen-Page und Form-Dialog-Sanity-Check

**4.1 Einstellungen-Page**

`frontend/src/features/settings/SettingsPage.tsx`:
- CommandBar oben:
  - title: "Einstellungen"
  - keine Filter, keine primaryAction (oder "Speichern" als 
    primaryAction, je nach aktueller Logik)
  - showSearch: false (Einstellungen brauchen keine Suche)
- Formular-Inhalt in einer Card: 
  `rounded-2xl bg-card border border-line p-5`
- Bestehende Felder unverändert, nur in den Card-Container packen

**4.2 Form-Dialoge sanity-checken (§14)**

Pro Form-Dialog (DoctorForm, ShiftTypeFormDialog, etc.) öffnen und 
prüfen:
- Keine Hex-Codes im Component-Code (außer aus tokens)
- Hintergründe verwenden `bg-card` oder `bg-paper`
- Buttons verwenden `accent` oder `default`-Variante
- Borders verwenden `border-line`

Bei Funden: ersetzen mit Token-Klassen. Keine Layout- oder 
Feldänderungen.

**4.3 Akzeptanzkriterien für Sub-Schritt 4**

- [ ] Einstellungen-Page hat CommandBar und Card-Container
- [ ] Alle Form-Dialoge sind frei von Hex-Codes außerhalb tokens
- [ ] Form-Dialoge sehen optisch konsistent mit dem Rest aus

**Stop-Gate nach Sub-Schritt 4:**
- Commit: `feat: M1-011/4 settings page and form dialog token cleanup`
- Warten auf Review

### Sub-Schritt 5: Tests, Cleanup, Doku

**5.1 Tests ergänzen**

- `DoctorCard.test.tsx`: rendert mit Mock-Doctor, Heatmap leer
- `ShiftHeatmap14.test.tsx`: 14 Boxen mit Daten, 14 Boxen leer
- `DoctorListPage.test.tsx`: Filter-Chip ändert sichtbare Karten 
  (mit gemockten Doctor-Daten)
- Pro migrierter Listen-Page mindestens ein Smoke-Test (rendert ohne 
  Crash)

Bestehende Tests, die alte Tabellen-Struktur prüften, anpassen oder 
löschen.

**5.2 Lint, Type-Check, Test-Run**

```
cd frontend
pnpm type-check
pnpm lint
pnpm vitest run
```

Alles grün.

**5.3 Dokumentation aktualisieren**

`docs/decisions.md` ergänzen:
- ADR: Ärzte als 3-Spalten-Karten-Grid statt Tabelle (§9)
- ADR: Restliche Listen behalten Tabelle, kommen in neuen Container
- ADR: Token `sand` für Pastell-Pills (§9)
- ADR: Heatmap erwartet Daten-Array, zeigt 14 leere Boxen bei 
  leerem Zustand. Hook-Anbindung erst nach Solver.

`README.md` aktualisieren:
- Hinweis dass die Stammdaten-Migration abgeschlossen ist
- App ist optisch konsistent, nächste Schritte sind ⌘K (M1-012) und 
  Plan-Frontend (M2-003)

**Stop-Gate nach Sub-Schritt 5:**
- Commit: `chore: M1-011/5 tests docs and cleanup`
- Final-Review durch User
- Merge in main (Standard-Sequenz)

## Akzeptanzkriterien (Gesamtaufgabe)

- [ ] `DoctorCard.tsx` und `ShiftHeatmap14.tsx` existieren
- [ ] DoctorListPage: 3-Spalten-Karten-Grid, CommandBar, Filter-Chips
- [ ] Token `sand` ergänzt, Chip-Variante `soft` verwendet
- [ ] Badge-Varianten `ok` und `muted` ergänzt
- [ ] Vier Listen-Pages migriert (Bereiche, Schichttypen, 
      Qualifikationen, Regeln) mit CommandBar und neuem 
      Tabellen-Container
- [ ] Schichttypen-Page zeigt ShiftChip in Name-Spalte
- [ ] Einstellungen-Page hat CommandBar und Card-Container
- [ ] Form-Dialoge frei von Hex-Codes außerhalb tokens
- [ ] Tests für DoctorCard, ShiftHeatmap14, DoctorListPage 
      geschrieben, Smoke-Tests für migrierte Listen
- [ ] `pnpm type-check`, `pnpm lint`, `pnpm vitest run` grün
- [ ] `docs/decisions.md` und `README.md` aktualisiert
- [ ] App ist optisch konsistent: keine alten 
      Page-Header/Tabellen-Looks mehr

## Out of Scope

- ⌘K Command Palette (M1-012)
- Plan-Frontend Dashboard und PlanGrid (M2-003)
- Redesign der Form-Dialoge selbst (nur Token-Check, kein Layout)
- Edit-Buttons auf DoctorCards (Edit läuft über Detail-Page)
- `useDoctorShifts`-Hook implementieren (leeres Array reicht)
- Detail-Pages umbauen (separate Aufgabe, falls nötig)
- Backend-Änderungen (alles Frontend-only)
- Mobile-Layout (Desktop-only)
- Sortier- und Such-Funktionen in den Tabellen (sofern nicht schon 
  vorhanden, kommen nicht neu hinzu)
- Pagination (existiert aktuell vermutlich nicht, kommt nicht neu 
  hinzu)

## Bekannte Stolperfallen

- **Heatmap leerer Zustand:** 14 leere Boxen mit gestricheltem 
  Rand können visuell wie ein Fehler aussehen. Lieber dezent 
  (`bg-line/20`, `border-line/40`, sehr leichter Rand). Subtil 
  bleiben, nicht aufdringlich.
- **Filter-Logik auf Doctor-Feldern:** Rolle-Enum prüfen. Wenn der 
  Code "Facharzt", "Oberarzt", "WBA" als separate Werte hat, 
  zusammen mappen. Wenn die Anleitung-Kategorien nicht exakt auf 
  die Daten passen, dokumentieren und mit User abstimmen.
- **"N Dienste · M Urlaub" im Footer:** ohne Hook keine Daten. 
  Lieber "—" anzeigen oder die Zeile weglassen statt 0 oder Mock-
  Werte zu zeigen.
- **`grid-cols-3` bei wenigen Ärzten:** wenn nur 1-2 Ärzte 
  existieren, sehen die Karten links aneinandergeklemmt aus. 
  Akzeptabel - in der Realität gibt es 10+ Ärzte. Alternativ 
  `grid-cols-3 justify-items-start` plus max-width pro Karte.
- **CommandBar-Title-Pattern:** Anleitung schlägt "Team · 12 
  Ärzte" mit "Team" als Italic-Akzent vor. Den Count "12 Ärzte" 
  dynamisch aus den geladenen Daten. Solange Daten noch laden: 
  nur "Team" als Title.
- **shadcn-Badge-Varianten:** beim Hinzufügen die `variants`-
  Definition in `badgeVariants` ergänzen, nicht eine neue Datei. 
  TypeScript-Inferenz für `variant`-Prop muss funktionieren.
- **Tabellen-Container `overflow-hidden`:** wenn die Tabelle sehr 
  breit ist, kann das horizontal scrollen verhindern. Falls 
  Probleme: `overflow-hidden rounded-2xl` außen, Tabelle innen mit 
  eigenem `overflow-x-auto`.
- **Token-Reihenfolge:** beim Hinzufügen von `sand` an alle drei 
  Stellen denken: `tokens.ts`, `tailwind.config.ts`, `index.css`. 
  Bei nur einer Stelle bricht entweder Build oder Runtime.
- **Detail-Page-Route:** "Details →"-Link braucht den korrekten 
  Pfad. Aktueller Code-Stand prüfen, nicht annehmen.
- **Settings-Page primaryAction:** wenn die aktuelle Page einen 
  Speichern-Button hat, der inline ist (nicht im Header), könnte 
  ein zusätzlicher primaryAction-Button in der CommandBar doppelt 
  wirken. Entweder weglassen oder den alten Button entfernen. 
  Entscheidung beim Umbau dokumentieren.
- **Form-Dialog-Check:** "frei von Hex-Codes" meint nicht "perfekt 
  redesignt". Wenn ein Dialog noch leicht alt aussieht (z.B. enge 
  Padding, kleinere Schrift), das ist in M1-011 OK. Refactor nur 
  bei Token-Verstößen.

## Annahmen die ich treffe

OK-Annahmen:
- Bestehende Pfade (`/aerzte`, `/bereiche` etc. oder englische 
  Äquivalente) bleiben unverändert
- Doctor-Model hat ein Feld für Rolle (Enum) und ein Flag für 
  Extern. Genaue Namen prüft Claude Code beim Lesen der Types
- ShiftType-Model hat möglicherweise ein "aktiv"-Feld. Falls nicht: 
  Status-Spalte überspringen
- Avatar-Primitive aus M1-009 hat oklch-Hue-Logik (entweder 
  per Doctor-ID oder als Prop)
- Quals werden pro Doctor als Liste von Qualifikations-Namen 
  geliefert (oder als IDs, die UI muss dann auflösen)
- Form-Dialoge sind alle bereits in einer halbwegs sauberen 
  shadcn-Struktur, kein massiver Refactor nötig
- DoctorCount für CommandBar-Titel kommt aus dem bereits geladenen 
  Doctor-Array (nicht extra API-Call)
- Bestehende Detail-Page für Ärzte funktioniert (`/aerzte/:id` oder 
  ähnlich), nur Footer-Link muss korrekten Pfad haben

Bei Unklarheit: zuerst `docs/design-implementation.md` §9, §10, §14 
lesen, dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:
```powershell
cd D:\Softwareprojekte\Dienstplaner
git status                  # sauber?
git checkout main
git pull origin main
git checkout -b task/M1-011-stammdaten-migration
```

Briefing nach `tasks\open\M1-011-stammdaten-migration.md` kopieren.

Nach Abschluss aller Sub-Schritte:
```powershell
git push origin task/M1-011-stammdaten-migration

git checkout main
git pull origin main
git merge task/M1-011-stammdaten-migration
git push origin main

move tasks\open\M1-011-stammdaten-migration.md tasks\done\
git add .
git commit -m "chore: archive completed task M1-011"
git push
```

`pnpm generate-api` nicht nötig, M1-011 hat keine Backend-Änderungen.
