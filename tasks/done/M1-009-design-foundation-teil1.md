# Task M1-009: Design-Foundation Teil 1 (Tokens, Primitives, Mock-Daten)

## Ziel
Design-System-Grundlage etablieren: Design-Tokens, Schichtfarben, 
UI-Primitives und eine Playground-Route zum Validieren. Plus 
Anpassung der Mock-Daten an unsere echten Schichttypen (V, T, N, T1).

Das ist Schritt 1+2 aus `handoff/ACCEPTANCE.md`. Die App ändert sich
optisch noch wenig (nur Hintergrund und Schriften). Die wesentliche
Investition ist in die Foundation, auf der M1-010 (Shell) und M2-003 
(Plan) bauen.

## Kontext
Lies vor Beginn in dieser Reihenfolge:
1. `CLAUDE.md`
2. `docs/design-implementation.md` (komplette Designanleitung)
3. `handoff/ACCEPTANCE.md` (Done-Definitionen, Stop-Gates)
4. `handoff/tokens.ts`, `handoff/shift-palette.ts`, `handoff/tailwind.merge.ts`
5. `handoff/primitives.tsx`, `handoff/mock-data.ts`
6. `design-reference/Dienstplaner_Redesign.html` (zur visuellen Referenz)
7. `frontend/src/App.tsx`, `frontend/src/components/layout/AppShell.tsx`,
   `frontend/src/index.css`, `frontend/tailwind.config.ts`

**Wichtige Regeln aus der Anleitung:**
- Keine Hex-Codes außerhalb von `tokens.ts` und `shift-palette.ts`
- Keine neuen UI-Libraries (außer cmdk später)
- Bestehende shadcn-Komponenten erweitern, nicht ersetzen
- Bei Unklarheit: fragen, nicht raten

## Anforderungen

### Sub-Schritt 1: Tokens und Fonts (ACCEPTANCE §1)

**1.1 Design-Token-Dateien anlegen**

Kopiere die Handoff-Dateien in den Quellbaum:
- `handoff/tokens.ts` → `frontend/src/lib/design/tokens.ts`
- `handoff/shift-palette.ts` → `frontend/src/lib/design/shift-palette.ts`

Inhalte unverändert übernehmen. Diese Dateien sind die Source of Truth.

**1.2 Tailwind-Konfiguration mergen**

In `frontend/tailwind.config.ts` die Werte aus `handoff/tailwind.merge.ts`
in `theme.extend` einfügen. Bestehende shadcn-Konfiguration nicht 
überschreiben.

Konkret zu ergänzen (alle aus tailwind.merge.ts):
- `colors`: paper, card, ink (DEFAULT, 2, 3), line (DEFAULT, 2),
  accent (DEFAULT, 2), ok, warn (DEFAULT, bg, line, ink), today, weekend
- `fontFamily`: sans (Geist), serif (Newsreader)
- `borderRadius`: cell (7px), tile (14px), rail (12px)

**1.3 Google-Fonts-Import**

In `frontend/src/index.css` ganz oben (vor `@tailwind`-Direktiven):

```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&display=swap');
```

Dann in `@layer base` ergänzen:

```css
@layer base {
  html, body { 
    background: theme(colors.paper); 
    color: theme(colors.ink.DEFAULT);
  }
  body { 
    font-family: theme(fontFamily.sans);
  }
  .dp-h1 { 
    font-family: theme(fontFamily.serif); 
    font-weight: 400; 
    letter-spacing: -0.01em;
  }
  .dp-num { 
    font-variant-numeric: tabular-nums;
  }
}
```

**1.4 Bestehendes Frontend muss noch funktionieren**

Wenn du dich an die Schritte hältst, sollte die existierende Ärzte-Liste 
nun einen warm-papierfarbigen Hintergrund haben, Geist als UI-Font 
verwenden, aber sonst unverändert aussehen. Keine bestehenden Inline-
Hex-Werte umstellen - das passiert schrittweise in M1-010/M1-011.

**Stop-Gate nach Sub-Schritt 1:**
- ACCEPTANCE.md §1 abhaken
- Commit: `feat: M1-009/1 design tokens and fonts`
- Warten auf Review (User prüft Screenshot)

### Sub-Schritt 2: Mock-Daten an UKSH-Schichttypen anpassen

**Vor Sub-Schritt 3 (Primitives) muss Mock-Data zu unseren Daten passen.**

Übernimm `handoff/mock-data.ts` als `frontend/src/lib/mock/dp-mock.ts`.

Aber: ändere die `MOCK_SHIFT_TYPES`-Liste auf unsere UKSH-Schichten:

```typescript
export const MOCK_SHIFT_TYPES: DPShiftType[] = [
  { id: 1, code: 'V',  name: 'V-Dienst',     start: '15:00', end: '20:15', 
    color: 'peach', weekday: true,  weekend: false },
  { id: 2, code: 'T',  name: 'Tagdienst',    start: '07:30', end: '19:30', 
    color: 'sage',  weekday: false, weekend: true  },
  { id: 3, code: 'N',  name: 'Nachtdienst',  start: '19:30', end: '07:30', 
    color: 'plum',  weekday: true,  weekend: true  },
  { id: 4, code: 'T1', name: 'Tagdienst INA', start: '07:30', end: '16:00', 
    color: 'sky',   weekday: true,  weekend: false },
]
```

Außerdem `MOCK_DEPARTMENTS` an unsere echte Bereichsliste anpassen
(Auszug der häufigsten Bereiche, Coverage als Mock-Wert):

```typescript
export const MOCK_DEPARTMENTS: DPDepartment[] = [
  { id: 1, name: 'Stroke Unit',           short: 'SU',     coverage: 0.85 },
  { id: 2, name: 'ITS',                    short: 'ITS',    coverage: 0.95 },
  { id: 3, name: '511',                    short: '511',    coverage: 1.0  },
  { id: 4, name: 'Forschung',              short: 'Fo',     coverage: 0.88 },
  { id: 5, name: 'Tagesklinik',            short: 'TK',     coverage: 0.92 },
  { id: 6, name: 'Curschmann Klinik',      short: 'CK',     coverage: 1.0  },
]
```

`MOCK_DOCTORS` kann weitgehend bleiben, aber `qualifications` an 
unsere echten Qualifikationen anpassen (falls schon welche definiert
sind, sonst neutrale Platzhalter wie `['Stroke-Berechtigt']`).

`buildMockAssignments`: codes-Array auf `[1, 2, 3, 4]` aktualisieren
(V, T, N, T1). Die Urlaub/Frei-Status-Codes (id 6, 7 aus Vorlage)
sind keine ShiftTypes mehr, sondern werden über Absences abgebildet.
Erstmal weglassen oder als kommentierter Hinweis behalten.

`SHIFT_TYPE_COLOR_MAP` in `shift-palette.ts` mit echten IDs ergänzen:

```typescript
export const SHIFT_TYPE_COLOR_MAP: Record<number, ShiftColorToken> = {
  1: 'peach',   // V-Dienst
  2: 'sage',    // Tagdienst
  3: 'plum',    // Nachtdienst
  4: 'sky',     // T1 Tagdienst INA
}
```

Anmerkung: IDs werden aus dem realen Backend kommen. Die Map ist 
Übergangslösung bis ShiftType.colorToken-Feld existiert.

**Stop-Gate nach Sub-Schritt 2:**
- Commit: `feat: M1-009/2 mock data adapted to UKSH shift types`
- Kein Review nötig, kann direkt in Sub-Schritt 3

### Sub-Schritt 3: Primitives + Playground (ACCEPTANCE §2)

**3.1 Primitives einzeln anlegen**

`handoff/primitives.tsx` enthält alle sechs Primitives in einer Datei.
Aufsplitten in einzelne Dateien unter `frontend/src/components/dp/`:

- `frontend/src/components/dp/Chip.tsx`
- `frontend/src/components/dp/ShiftChip.tsx`
- `frontend/src/components/dp/ShiftCell.tsx`
- `frontend/src/components/dp/Avatar.tsx`
- `frontend/src/components/dp/KpiTile.tsx`
- `frontend/src/components/dp/Sparkline.tsx`

Jede Datei exportiert eine Komponente. Imports anpassen 
(`@/lib/utils`, `@/lib/design/tokens`, `@/lib/design/shift-palette`).

Plus ein `index.ts`:
```typescript
export { Chip } from './Chip'
export { ShiftChip } from './ShiftChip'
export { ShiftCell } from './ShiftCell'
export { Avatar } from './Avatar'
export { KpiTile } from './KpiTile'
export { Sparkline } from './Sparkline'
```

**3.2 Playground-Route anlegen**

Neue Route nur in dev verfügbar: `/playground`.

Implementierung: `frontend/src/features/playground/PlaygroundPage.tsx`.

Inhalt: alle Primitives mit ihren Varianten:

- **Chip:** alle 5 Varianten (default, active, accent, muted, ok)
  nebeneinander, mit und ohne dot
- **ShiftChip:** mindestens fünf Varianten mit unterschiedlichen codes
  (V, T, N, T1, X für fallback) in beiden Größen (sm, md)
- **ShiftCell:** leere Zelle, gefüllte Zelle, Konflikt-Zelle, 
  Wochenende-Zelle, Heute-Zelle (jeweils ca 40x40)
- **Avatar:** 6 verschiedene Namen/IDs in verschiedenen Größen
  (24, 32, 44)
- **KpiTile:** drei Varianten (default, warn, ok) mit verschiedenen 
  Werten und Sub-Texten
- **Sparkline:** mit Werten unter und über Threshold, verschiedene
  Höhen

Layout: einfache Grid- oder Flex-Anordnung, mit kleinen Headlines 
("Chip", "ShiftChip", ...) pro Sektion. Zweck ist Validierung, nicht
Schönheit.

Routing-Setup: nur in dev anzeigen. Beispiel:
```typescript
const isDev = import.meta.env.DEV
{isDev && <Route path="/playground" element={<PlaygroundPage />} />}
```

Auch der MiniRail (kommt in M1-010) soll später keinen Nav-Eintrag 
für Playground haben. Bis dahin erreichbar nur per Direktaufruf
`http://localhost:5173/playground`.

**3.3 Akzeptanzkriterien für Primitives**

Aus `handoff/ACCEPTANCE.md` §2:
- [ ] Chip hat 5 visuell unterscheidbare Varianten
- [ ] ShiftChip mit code='V' rendert Pfirsich (peach), mit code='N' 
      Pflaume (plum) - Farben aus Palette, nicht hardcoded
- [ ] Avatar mit name='Lena Hartmann' zeigt "LH", deterministisch
      dieselbe Hue über Reloads
- [ ] Sparkline mit values=[...] rendert N Balken, Werte < 0.8 sind 
      rot (warn)

**Stop-Gate nach Sub-Schritt 3:**
- Commit: `feat: M1-009/3 ui primitives with playground route`
- ACCEPTANCE.md §2 abhaken
- Warten auf Review (User öffnet /playground und prüft visuell)

### Sub-Schritt 4: Aufräumen und Abschluss

**4.1 Lint und Type-Check**

```
cd frontend
pnpm type-check
pnpm lint  # falls vorhanden
```

Alles muss grün sein.

**4.2 Dokumentation aktualisieren**

`docs/decisions.md` ergänzen:
- ADR: Design-System nach Atelier-Look übernommen
- ADR: Token-basiert, keine Hex-Codes außerhalb tokens.ts
- ADR: Primitives in src/components/dp/, separat von shadcn/ui

`README.md` ergänzen unter "Entwicklung":
- Hinweis auf `src/lib/design/` als Design-System
- Hinweis auf `/playground`-Route in dev für Komponenten-Vorschau

**4.3 Mock-Daten-Hinweis**

Kommentar oben in `src/lib/mock/dp-mock.ts`:
"Mock-Daten für UI-Entwicklung vor Backend-Integration. 
Sobald die Plan-Hooks die echten Daten liefern, kann diese Datei 
gelöscht werden. Die ShiftType-IDs entsprechen den Werten in 
SHIFT_TYPE_COLOR_MAP."

## Akzeptanzkriterien (gesamtaufgabe)

- [ ] `frontend/src/lib/design/tokens.ts` existiert
- [ ] `frontend/src/lib/design/shift-palette.ts` existiert mit
      UKSH-spezifischen IDs
- [ ] `tailwind.config.ts` extended mit Farben, Fonts, Radien
- [ ] `index.css` enthält Google-Fonts-Imports
- [ ] body rendert mit bg-paper, font-sans, text-ink
- [ ] Bestehende Ärzte-Liste sieht aus wie vorher, nur mit 
      warm-papierfarbigen Hintergrund und Geist-UI-Font
- [ ] Alle sechs Primitives als eigene Dateien in 
      `src/components/dp/` mit Index-Export
- [ ] `/playground`-Route nur in dev erreichbar, zeigt alle Varianten
- [ ] Mock-Daten an V/T/N/T1 angepasst
- [ ] `pnpm type-check` grün
- [ ] Bestehende Tests laufen weiter
- [ ] `pnpm vitest run` grün
- [ ] docs/decisions.md und README.md aktualisiert
- [ ] Keine Hex-Codes außerhalb tokens.ts und shift-palette.ts neu 
      eingeführt

## Out of Scope

- MiniRail (kommt in M1-010)
- CommandBar / KpiBar (kommt in M1-010)
- Plan-Page (kommt in M2-003)
- Dashboard (kommt in M2-003)
- DoctorList-Umstellung auf Karten (kommt in M1-011)
- ⌘K Command Palette (kommt in M1-012)
- Restliche Listen migrieren (kommt in M1-011)
- Cleanup alter Layouts (kommt in M1-013)
- Storybook (Playground reicht als leichtgewichtige Alternative)

## Bekannte Stolperfallen

- **Tailwind-Merge:** `theme.extend` in `tailwind.config.ts` muss 
  bestehende shadcn-Werte ergänzen, nicht überschreiben. Vor und 
  nach dem Mergen einmal testen, dass shadcn-Komponenten noch korrekt
  aussehen (Button, Dialog, etc.).
- **Google-Fonts-Imports** vor `@tailwind base` einbinden, sonst gibt
  es Flash-of-Unstyled-Text bei jedem Reload.
- **dp-Namespace:** Komponenten heißen `Chip`, `Avatar` etc., nicht
  `DpChip`, `DpAvatar`. Der Ordner-Namespace reicht.
- **shadcn-Konflikt:** Es gibt vermutlich schon ein shadcn-`Avatar` 
  oder `Badge`. Unsere `Avatar`-Komponente liegt in `components/dp/`,
  ist separat zu shadcn. Imports klar trennen, beim Konsumieren 
  bewusst importieren.
- **cn-Helper:** wird aus `@/lib/utils` importiert. Wenn er noch
  nicht existiert: aus shadcn-Setup übernehmen (clsx + tailwind-merge).
- **Mock-Daten-Codes:** Nicht 'F' oder 'S' verwenden in Beispielen,
  sondern unsere 'V', 'T', 'N', 'T1'.
- **Playground-Route in Production-Build:** muss raus, sonst sind die
  Mock-Daten im Production-Bundle. Über import.meta.env.DEV-Guard
  lösen.
- **Tabular-nums:** ohne CSS-Class wirken Zahlen unschön in
  unterschiedlichen Breiten. Die `.dp-num` Klasse muss überall 
  angewendet werden, wo Zahlen wichtig sind (kommt in späteren Aufgaben
  konsequent, hier nur in KpiTile).

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

OK-Annahmen:
- Bestehende shadcn-Komponenten bleiben unverändert
- Hex-Werte in handoff/-Dateien sind verbindlich, nicht zur Diskussion
- Playground ist temporär und kann nach Migration entfernt werden
- Mock-Daten sind Übergangslösung, werden durch echte Backend-Hooks 
  ersetzt sobald M2-003 fertig ist
- Bestehende Ärzte/Stationen/etc-Seiten bleiben optisch wie vorher,
  nur die Foundation ändert sich
