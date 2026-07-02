# Implementierungsanleitung — Dienstplaner Redesign

> Briefing für Claude / Claude Code, um das Redesign aus `Dienstplaner Redesign.html`
> in den bestehenden React-Codebase (`frontend/`) zu übernehmen.
> **Stack ist gesetzt:** React + Vite + Tailwind + shadcn/ui + react-router + lucide-react.
>
> **Hinweis (Stand M2-007):** `PlanGrid`, `RotationGrid`, `ShiftCell`, `Sparkline`,
> `KpiBar` und `ContextPanel` wurden durch `UnifiedPlanGrid`, `UnifiedShiftCell` und
> `PlanSidebar` ersetzt bzw. entfernt. Abschnitte §6/§7/§12/§13 beschreiben den
> ursprünglichen Design-Stand — geltende Konventionen stehen in `CLAUDE.md`
> (Abschnitt „Unified Plan Grid").

---

## Inhaltsverzeichnis

- [0 · Lies das zuerst](#0--lies-das-zuerst)
- [1 · Design-Tokens (Tailwind config + index.css)](#1--design-tokens-tailwind-config--indexcss)
- [2 · Schicht-Farbsystem](#2--schicht-farbsystem)
- [3 · Layout-Shell (AtelierShell)](#3--layout-shell-implementiert-als-atelierShell)
- [4 · Top-Command-Bar](#4--top-command-bar-über-jeder-seite)
- [5 · KPI-Sub-Bar](#5--kpi-sub-bar-auf-plan--und-dashboard-seite)
- [6 · Komponenten-Inventar](#6--komponenten-inventar-zu-bauen--shadcn-anpassen)
- [7 · Plan-Grid (Herzstück)](#7--plan-grid-herzstück)
- [8 · Dashboard (Route `/heute`)](#8--dashboard-route-heute)
- [9 · Ärzte-Liste (Route `/doctors`)](#9--ärzte-liste-route-doctors)
- [10 · Restliche Listen](#10--restliche-listen-stationen--schichttypen--qualifikationen--regeln)
- [11 · ⌘K Command Palette](#11--k-command-palette-neu)
- [12 · Routing & Page-Mapping](#12--routing--page-mapping)
- [13 · Reihenfolge der Implementierung](#13--reihenfolge-der-implementierung-für-claude-code)
- [14 · Was bewusst NICHT geändert wird](#14--was-bewusst-nicht-geändert-wird)
- [15 · Handoff-Pakete](#15--handoff-pakete-vorgefertigt-direkt-übernehmen)
- [16 · Prompt für Claude Code zum Starten](#16--prompt-für-claude-code-zum-starten)

---

## 0 · Lies das zuerst

1. Die finale Designrichtung steht in `Dienstplaner Redesign.html`,
   Section **„★ Empfohlene Richtung"** mit drei Artboards:
   - `1 · Dashboard` → `variants/variant-a.jsx`, `VariantA_Dashboard`
   - `2 · Plan` → `variants/variant-ab-plan.jsx`, `VariantAB_Plan`
   - `3 · Ärzte` → `variants/variant-a.jsx`, `VariantA_Doctors`
2. Die anderen Sections (Alternativen) sind nur Referenz und nicht zu übernehmen.
3. Quelle der gemeinsamen Mock-Daten: `variants/data.js` — Datenshape entspricht
   weitgehend den realen Types in `frontend/src/lib/types.ts`.

**Wichtig:** Die JSX-Dateien im Designprojekt sind keine Module — sie kleben alles auf
`window`. Beim Übernehmen in den Codebase werden daraus saubere TS-React-Komponenten
mit Tailwind statt Inline-Styles.

---

## 1 · Design-Tokens (Tailwind config + index.css)

Lege die Tokens fest, **bevor** du Komponenten baust. Diese Werte stammen 1:1 aus dem Entwurf
(`AB_P` / `A_PALETTE`):

```css
/* src/index.css — innerhalb von @layer base */
:root {
  --dp-paper:   #F6F1E6;
  --dp-card:    #FFFCF5;
  --dp-ink:     #26221C;
  --dp-ink-2:   #5C544A;
  --dp-ink-3:   #8A8275;
  --dp-line:    #E8E0CF;
  --dp-line-2:  #D6CCB6;
  --dp-accent:  #C66A3D;  /* terracotta */
  --dp-accent-2:#E69E66;
  --dp-ok:      #5A7A3A;
  --dp-warn:    #B85B22;
  --dp-warn-bg: #FBE5D6;
  --dp-warn-line:#F0C3A2;
  --dp-warn-ink:#7A3414;
}
```

Im `tailwind.config.ts` als named colors anbinden (`paper`, `card`, `ink`, `ink2`, `ink3`,
`line`, `line2`, `accent`, `accent2`, `ok`, `warn`).

### Typografie

- Sans: **Geist** (UI) — über `@import` von `https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700` einbinden.
- Serif: **Newsreader** (Headlines, KPI-Zahlen) — `?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600`.

Tailwind-Familien:
```ts
fontFamily: {
  sans:  ['Geist', 'ui-sans-serif', 'system-ui'],
  serif: ['Newsreader', 'ui-serif', 'Georgia'],
}
```

### Radius- & Spacing-Konventionen

| Element              | Radius | Hinweis                              |
|----------------------|--------|---------------------------------------|
| Karten / Panels      | 16 px  | `rounded-2xl`                          |
| KPI-Tiles            | 14 px  | `rounded-[14px]`                       |
| Chip / Pill          | 999 px | `rounded-full`                         |
| Schicht-Zellen       | 7 px   | `rounded-md` (im Plan-Grid)            |
| Icon-Buttons (Rail)  | 12 px  | `rounded-xl`                            |
| Borders generell     | 1 px solid `line`                                          |

---

## 2 · Schicht-Farbsystem

Die Pastell-Palette für Schichten lebt in `data.js → shiftPalette`. Sie ist
**Teil des Designsystems**, nicht der Daten — sie gehört in `frontend/src/lib/shift-colors.ts`:

```ts
export const SHIFT_PALETTE = {
  peach: { bg: '#FBE0CE', fg: '#7A3B14', dot: '#E08A5A' },
  sage:  { bg: '#D9E5C9', fg: '#3F5527', dot: '#7A9E55' },
  plum:  { bg: '#DDCFE3', fg: '#3D2A48', dot: '#7B5A92' },
  sky:   { bg: '#CFDFE8', fg: '#1F4358', dot: '#5489A7' },
  rose:  { bg: '#F2CFD3', fg: '#6B1E2A', dot: '#C45766' },
  sand:  { bg: '#EEDFC4', fg: '#5A4220', dot: '#B59052' },
  lemon: { bg: '#F2E8B5', fg: '#5A4B14', dot: '#B8A33D' },
  grey:  { bg: '#E0DED7', fg: '#55524A', dot: '#928D80' },
} as const
```

**Schritt 1 dafür:** Im `ShiftType`-Schema serverseitig (oder zumindest UI-seitig in einer
Mapping-Tabelle nach `id`) ein `colorToken: keyof typeof SHIFT_PALETTE` ergänzen.
Bis das Backend nachzieht: feste Reihenfolge in einer Map `shiftTypeId → token`.

---

## 3 · Layout-Shell (implementiert als AtelierShell)

`frontend/src/components/layout/AtelierShell.tsx` (ersetzt die ursprüngliche `AppShell.tsx`):

- **MiniRail** (60 px) links mit reinen Icon-Buttons. Tooltip auf Hover zeigt das Label.

> **Sichtbarkeit:** Die Rail ist Teil des persistenten `AppShell` und erscheint
> **auf jeder Route** — Plan, Ärzte, Stationen, Schichten, Qualifikationen, Regeln,
> alle Detail- und Form-Seiten. Ohne Ausnahme. Das Dashboard (`/heute`) **bekommt
> die Rail ebenfalls**; falls bewusst eine „Lobby"-Variante ohne Rail gewünscht ist,
> muss das explizit über ein `<AtelierShell variant="bare">`-Flag passieren — Default
> ist **Rail überall**. (In den Artboards der Designdatei wurde die Rail aus
> Layout-Gründen teils weggelassen; das ist eine Darstellungs-Konvention im Canvas,
> kein Designbeschluss.)

Reihenfolge der Rail-Items (von oben):
1. Logo-Tile (38 × 38, `bg-accent`, Buchstabe „D" in Newsreader-Italic, weiss).
2. Trenner (1 px Linie, 24 px breit, `bg-line`).
3. **Heute / Dashboard** — `LayoutDashboard`-Icon.
4. **Plan** — `Calendar`-Icon. (Default `active`.)
5. **Ärzte** — `Users`.
6. **Stationen** — `Building2`.
7. **Schichten** — `Clock`.
8. **Qualifikationen** — `Award`.
9. **Regeln / Sonderregelungen** — `Settings2`.
10. Spacer (flex-1).
11. **Avatar-Tile** des eingeloggten Users (Initialen, oklch-Hue, 32 × 32 rund).

Active-State: Icon-Tile bekommt `bg-ink text-paper`, sonst `text-ink2`.

Routes bleiben dieselben (`/doctors`, `/departments`, …), plus eine neue:
- `/` → Redirect auf `/heute` (Dashboard).
- `/heute` → `<DashboardPage />` (neu).
- `/plans` aktivieren → `<PlanPage />` (neu).

---

## 4 · Top-Command-Bar (über jeder Seite)

Direkt rechts neben der Rail beginnt eine **Command-Bar**, die auf allen Listenseiten
gleich aussieht und nur Inhalt austauscht:

```
┌─ Titel (Newsreader) ─┬─ Breadcrumb-Pfeile ─┬─ Filter-Chips ─┬─ Suchfeld ⌘K ─┬─ Primärbutton ─┐
```

- Titel: `font-serif text-2xl` mit italic-akzentuiertem Teil in `text-accent` (z.B.
  „**Mai** 2026", „**Team** · 12 Ärzte").
- Filter-Chips: `<Chip>`-Komponente (siehe §6).
- Suchfeld: `Input` mit lupe links und Mono-Tasten-Hint `⌘K` rechts. Öffnet Command Palette
  (cmdk).
- Primärbutton: rounded-full, `bg-accent text-paper`, klein.

**Mausweg-Hinweis:** Diese Bar ist das wichtigste Werkzeug gegen die „weiten Wege".
Wichtigste Aktionen sind hier oben **immer 1 Klick** entfernt; ⌘K ersetzt mehrstufige Klicks.

---

## 5 · KPI-Sub-Bar (auf Plan- und Dashboard-Seite)

Zweite Zeile direkt unter der Command-Bar, `bg-card` mit 1 px-Linie oben+unten:

- 4–6 KPIs nebeneinander: jeweils **große Newsreader-Zahl** + Mini-Label in `text-ink2`.
- In der Mitte: **Sparkline-Balken** (14 Balken für 14 Tage Abdeckung).
- Rechts: Tab-Group für Sub-Views: `Plan · Wunsch · Konflikte · Bilanz`.

KPI-Zahlen werden **immer** in `font-serif` + `tabular-nums` gerendert. Macht den Look.

---

## 6 · Komponenten-Inventar (zu bauen / shadcn anpassen)

Lege `frontend/src/components/dp/` an. Eine Datei pro Komponente, alle typisiert.

| Komponente | Beschreibung |
|---|---|
| `<MiniRail />` | siehe §3 |
| `<CommandBar />` | siehe §4, nimmt `title`, `accent`, `filters`, `actions` als Props |
| `<KpiBar />` | siehe §5, nimmt Array von KPIs |
| `<Chip>` | Pill mit 3 Varianten: `default`, `active` (`bg-ink text-paper`), `accent` (`bg-warn-bg text-warn-ink border-warn-line`). Optional `dot` + label. |
| `<ShiftChip code size />` | Schicht-Pille aus Code (z.B. `F`), holt Farbe aus `SHIFT_PALETTE` via ShiftType-Lookup. |
| `<ShiftCell shiftType conflict?>` | Quadratische Grid-Zelle für Plan-Grid (Buchstabe groß, optional roter Warndot oben rechts). |
| `<Avatar doc size />` | Initialen-Avatar. Farbe aus `oklch(0.86 0.08 ${doc.hue})` / `oklch(0.32 0.12 ${doc.hue})`. Hue muss pro Arzt deterministisch sein → in Doctor-Model speichern oder aus `id` ableiten. |
| `<KpiTile value label sub />` | KPI-Karte: serif-Zahl 32 px, label 13 px, sub 11 px `text-ink3`. |
| `<Sparkline values />` | 14 vertikale Balken, 5 × variable Höhe, `bg-accent2` (rot bei < 80%). |
| `<ContextPanel />` | rechtes 290 px-Panel; Sub-Komponenten `<ContextSection title>` und `<ConflictCard />`. |
| `<PlanGrid />` | Kernkomponente Plan-Ansicht (siehe §7). |

shadcn-Anpassungen:
- `button.tsx` Variante `accent` (`bg-accent text-paper hover:bg-[#B45B30]`).
- `badge.tsx` Variante `pastel-{token}` für Schichten — oder ganz durch `<ShiftChip />` ersetzen.
- `table.tsx` bleibt nur für nicht-Plan-Listen (Stationen, Schichttypen, Qualifikationen, Regeln).

---

## 7 · Plan-Grid (Herzstück)

Datei: `frontend/src/features/plans/components/PlanGrid.tsx`. Reines CSS-Grid, keine Tabelle.

```
grid-template-columns: 210px repeat(N_DAYS, 44px) 1fr
```

**Surface-Container (M2-006):** Das Grid lebt in einem
`rounded-2xl border border-line bg-card overflow-hidden`-Wrapper in `PlanPage.tsx`
(analog §10-Tabellen-Konvention). Sticky-Header- und Arzt-Label-Zellen sind `bg-card`
(nicht `bg-paper`) — sonst entsteht eine papierfarbene Naht beim Horizontal-Scroll.
Künftige Schritte (4-Wochen-Ansicht, Virtualisierung) müssen diesen Surface-Container
beibehalten.

**Leere Zellen:** `border border-line bg-paper/50` (solide Raster-Linie, leichte Eintiefung
gegen die Card-Fläche). Kein `border-dashed`. Hover: `bg-card hover:border-line-2`.

- Header-Zeile: Wochentag (10 px) + Tageszahl (16 px Newsreader). Heute = `bg-warn-bg text-warn-ink`. Wochenende = `bg-weekend` (Token, nicht Hex).
- Body-Zeilen: 42 px Höhe.
  - Linke Spalte: Avatar (26 px) + Name (13 px / 500) + role-line (10 px `text-ink3`).
  - Tageszellen: 3 px Padding, drinnen `<ShiftCell />`.
  - Selektierte Zeile (Person fokussiert): `bg-today`.
- Footer: Legende mit allen Schichttypen.

**View-Switching:**
- Default: 14 Tage horizontal (2 Wochen).
- Filter-Chip „2 Wochen" → „4 Wochen" wechselt zu Monatsansicht (kleinere Zellen 36 px,
  Schichtcode etwas dünner, 28 Tage).
- Filter-Chip „1 Tag" → wechselt zu Tages-Detailansicht (eine Spalte, ausführlicher).

**Konfliktmarkierung:**
- Zelle erhält 1.5 px `border-warn`.
- Warn-Dot 11 × 11 oben rechts mit `!`-Glyphe.
- Click → öffnet `<ConflictCard />` im rechten Kontext-Panel.

**Performance:** Bei vielen Ärzten + 28 Tagen: virtualisieren (`@tanstack/react-virtual`)
nur, falls > 30 Zeilen oder Monatsansicht.

---

## 8 · Dashboard (Route `/heute`)

Spalten: `grid-cols-[1.4fr_1fr]`, 28 px gap, 40 px Seitenpadding.

**Links** (in Reihenfolge):
1. Begrüßung-Block:
   - Kicker-Zeile in Uppercase 12 px `text-ink3`: „Montag · 11. Mai 2026 · KW 19".
   - H1 in Newsreader 38 px, italic-Akzent für „Heute" in `text-accent`.
2. KPI-Strip (4 Tiles): Abdeckung %, Offene Schichten, Regelkonflikte (warn-rot), Im Urlaub.
3. „Heute im Dienst" Karte (siehe Entwurf):
   - Pro Schicht eine Zeile: Dot + Name + Uhrzeit (mono) + Avatar-Chips der Ärzte.

**Rechts:**
1. „Aufmerksamkeit" — Liste mit Dot + Datum + Person + Hinweis (warn/error/info).
2. „Abdeckung KW 19" — pro Station ein Progress-Balken.
3. CTA-Karte (`bg-ink text-paper`): „Mai-Plan starten" mit kleinem Accent-Button rechts.

Alle „Karten" sind `rounded-2xl bg-card border border-line p-5`.

---

## 9 · Ärzte-Liste (Route `/doctors`)

Tabelle ersetzen durch **3-spaltiges Karten-Grid** (`grid-cols-3 gap-3.5`).

Karten-Inhalt (siehe `VariantA_Doctors`):
- Header: Avatar 44 px + Name (Newsreader 19 px) + Sub-Zeile mit Rolle/%, Leave-Badge rechts.
- Quals: kleine Pastell-Pills (Pills aus `bg-[#F3ECD8]`).
- „Nächste 14 Tage"-Mini-Heatmap: 14 schmale Schicht-Boxen nebeneinander.
- Footer: „N Dienste · M Urlaub" links, „Details →" rechts in `text-accent`.

Filter-Chips über dem Grid: Alle / Fachärzte / WBA / Extern.
Primärbutton: „+ Neuer Arzt" → behält `DoctorCreatePage` als Route.

---

## 10 · Restliche Listen (Stationen / Schichttypen / Qualifikationen / Regeln)

Behalten die `Table`-Komponente, **aber**:
- Innerhalb desselben `<CommandBar />` + `<KpiBar />`-Frames (KPI-Bar kann hier
  weggelassen oder durch eine simple Toolbar mit Filter ersetzt werden).
- Tabellen-Container `rounded-2xl border border-line bg-card overflow-hidden`.
- Bei Schichttypen: in „Name"-Spalte zusätzlich `<ShiftChip />` mit dem Code.
- Bei Status-Spalte: einheitlich `<Badge variant="ok">Aktiv</Badge>` (grün) bzw.
  `<Badge variant="muted">Inaktiv</Badge>` (grau). Keine schwarz-gefüllten Pills mehr.

---

## 11 · ⌘K Command Palette (neu)

Pflicht für „kurze Mauswege". Bibliothek: `cmdk` (bereits MIT, ~3 KB).

Aktionen, die immer verfügbar sind:
- Navigation („Plan", „Ärzte", „Stationen", …).
- „Neuen Arzt anlegen".
- „Neue Schicht zuweisen am …" (mit Datums-Parsing).
- Personensuche („krüger" → springt zu Doctor-Detail).
- Schicht-Quick-Edit: `<initialen> <code> <datum>` z.B. `lh n 12.5`.

Tastenkürzel: `cmd/ctrl + K` öffnet, `esc` schließt.

---

## 12 · Routing & Page-Mapping

| Route | Page | Status |
|---|---|---|
| `/` | Redirect → `/heute` | ✅ implementiert |
| `/heute` | `TodayPage` (Dashboard) | ✅ M7-002 |
| `/plans` | `PlanListPage` (Kachel-Grid, Plan anlegen) | ✅ M2-003 |
| `/plans/:id` | `PlanPage` (PlanGrid + ContextPanel, Schichtzuweisung) | ✅ M2-003 |
| `/doctors` | `DoctorListPage` → Karten-Grid | ✅ M1-011 |
| `/doctors/new` | `DoctorCreatePage` | ✅ implementiert |
| `/doctors/:id` | `DoctorDetailPage` | ✅ implementiert |
| `/departments` | Tabelle, Atelier-Frame | ✅ M1-011 |
| `/shift-types` | Tabelle, Atelier-Frame | ✅ M1-011 |
| `/qualifications` | Tabelle, Atelier-Frame | ✅ M1-011 |
| `/rule-overrides` | Tabelle, Atelier-Frame | ✅ M1-011 |

---

## 13 · Reihenfolge der Implementierung (für Claude Code)

Pro Schritt bitte committen und Screenshots zeigen.

1. ✅ **Tokens & Fonts** — `index.css`, `tailwind.config.ts`, `lib/design/tokens.ts`,
   `lib/design/shift-palette.ts`. (M1-009)
2. ✅ **Primitives** — `Chip`, `ShiftChip`, `ShiftCell`, `Avatar`, `KpiTile`, `Sparkline`
   in `components/dp/`. `/playground`-Route. (M1-009)
3. ✅ **Layout-Shell** — `AtelierShell` + `MiniRail` ersetzt `AppShell`. (M1-010)
4. ✅ **CommandBar + KpiBar** als reusable Frame. (M1-010)
5. ✅ **Dashboard** (`/heute`). (M1-011)
6. ✅ **PlanGrid + PlanPage** — PlanListPage (`/plans`), PlanPage (`/plans/:id`),
   PlanGrid, DoctorAssignPopover, ContextPanel + ConflictCard, Konflikt-Warn-Dot.
   Hooks: usePlans, usePlanShifts, usePlanConflicts, useAssignShift.
   Utility: planGridUtils.buildGridData. (M2-003/M2-004/M2-005/M2-006)
7. ✅ **DoctorList** auf Karten-Grid. (M1-011)
8. ✅ **Restliche Listen** in Atelier-Frame, Badges vereinheitlicht. (M1-011)
9. **⌘K Command Palette** — noch nicht implementiert.
10. ✅ **Aufräumen** alte Styles entfernt.

---

## 14 · Was bewusst NICHT geändert wird

- Routing-Library (`react-router`).
- Datenquelle (`@tanstack/react-query`, bestehende Hooks `useDoctors`, …).
- Form-Dialoge (`DoctorForm`, `ShiftTypeFormDialog`, …) — bekommen nur neue Tokens.
- API-Typen (`api-types.ts`).

---

## 15 · Handoff-Pakete (vorgefertigt, direkt übernehmen)

Im Ordner `handoff/` liegen produktionsreife Snippets — kopieren statt neu schreiben:

| Datei | Ziel im Codebase | Zweck |
|---|---|---|
| `handoff/tokens.ts` | `frontend/src/lib/design/tokens.ts` | Single Source of Truth: COLORS, RADII, SPACING, FONTS, TYPE_SCALE, `hueFromId()` |
| `handoff/shift-palette.ts` | `frontend/src/lib/design/shift-palette.ts` | 8-Token-Pastellpalette + `colorForShiftType()` Helper |
| `handoff/tailwind.merge.ts` | mergen in `tailwind.config.ts` | Farben / Fonts / Radien als Tailwind-Tokens |
| `handoff/primitives.tsx` | `frontend/src/components/dp/primitives.tsx` | `Chip`, `ShiftChip`, `ShiftCell`, `Avatar`, `KpiTile`, `Sparkline` — fertig getypt |
| `handoff/mock-data.ts` | `frontend/src/lib/mock/dp-mock.ts` | Doctors, ShiftTypes, Schedule, Conflicts — kompatibel mit `lib/types.ts` |
| `handoff/ACCEPTANCE.md` | Review-Checkliste | Done-Definition pro §13-Schritt; Stop-Gates für Reviews |

**Regel:** Wenn ein Wert (Farbe, Hue, Radius) im Code auftaucht, der nicht aus `tokens.ts`,
`shift-palette.ts` oder `tailwind.config.ts` stammt — ist es ein Fehler. Keine Magic Numbers,
keine Hex-Inline-Styles in Komponenten.

---

## 16 · Prompt für Claude Code zum Starten

```
Lies vollständig in dieser Reihenfolge:
  1. Implementierungsanleitung.md (diese Datei)
  2. handoff/ACCEPTANCE.md (Done-Definitionen je Schritt — bist du daran gebunden)
  3. handoff/tokens.ts, handoff/shift-palette.ts, handoff/tailwind.merge.ts
  4. handoff/primitives.tsx, handoff/mock-data.ts
  5. Dienstplaner Redesign.html  (öffne und screenshotte zur visuellen Referenz)
  6. variants/variant-a.jsx, variants/variant-ab-plan.jsx, variants/data.js
  7. frontend/src/App.tsx, AtelierShell.tsx, index.css, tailwind.config.ts
  8. frontend/src/features/doctors/DoctorListPage.tsx, frontend/src/lib/types.ts

Beginne mit Schritt 1 aus §13 (Tokens & Fonts):
  - Kopiere handoff/tokens.ts → src/lib/design/tokens.ts
  - Kopiere handoff/shift-palette.ts → src/lib/design/shift-palette.ts
  - Merge handoff/tailwind.merge.ts in tailwind.config.ts
  - Google-Fonts-Import in index.css

STOPP nach Schritt 1. Hake handoff/ACCEPTANCE.md ab und warte auf Review.
Erst dann Schritt 2. Niemals zwei Schritte gleichzeitig.

Regeln:
  - Keine Hex-Codes außerhalb von tokens.ts und shift-palette.ts
  - Keine neuen UI-Libraries außer cmdk (Schritt 9)
  - Bestehende shadcn-Komponenten erweitern, nicht ersetzen
  - Bei Unklarheit: fragen, nicht raten

Beginne mit Schritt 1 (Tokens & Fonts). Zeige mir den Diff, bevor du Schritt 2 anfängst.
Halte dich strikt an die Farb- und Radius-Tabelle in §1 und das Komponenten-Inventar in §6.
Keine neuen UI-Libraries außer cmdk (für Schritt 9). Bestehende shadcn-Komponenten erweitern,
nicht ersetzen.
```
