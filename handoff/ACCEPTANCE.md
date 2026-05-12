# Dienstplaner — Acceptance Checklist

Done-Definitions pro Implementierungsschritt (§13 der Anleitung).
Claude Code soll nach jedem Schritt diese Checkliste anhaken und stoppen, bis du grün gibst.

---

## ✅ Schritt 1 — Tokens & Fonts

- [x] `frontend/src/lib/design/tokens.ts` existiert, exportiert `COLORS`, `RADII`, `SPACING`, `FONTS`, `TYPE_SCALE`, `hueFromId()`.
- [x] `frontend/src/lib/design/shift-palette.ts` existiert, exportiert `SHIFT_PALETTE`, `SHIFT_TYPE_COLOR_MAP`, `colorForShiftType()`.
- [x] `tailwind.config.ts` extended um die Farben + fontFamilies aus `handoff/tailwind.merge.ts`.
- [x] `index.css`: Google-Fonts-Imports für Geist + Newsreader oben.
- [x] `body` rendert mit `bg-paper`, `font-sans`, `text-ink`.
- [x] Screenshot der bestehenden Ärzte-Liste zeigt: warmes Papier-Hintergrund, Geist-UI-Font, sonst unverändert.

## ✅ Schritt 2 — Primitives

- [x] `frontend/src/components/dp/{Chip,ShiftChip,ShiftCell,Avatar,KpiTile,Sparkline}.tsx` existieren.
- [x] Playground-Route `/playground` (nur in dev) zeigt **alle Varianten** jeder Primitive.
- [x] `Chip` hat 5 Varianten (default, active, accent, muted, ok) — visuell unterscheidbar.
- [x] `ShiftChip` rendert für `code='V'` Pfirsich, für `code='N'` Pflaume — Farben aus Palette, nicht hardgecoded.
- [x] `Avatar` mit `name='Lena Hartmann'` zeigt „LH", deterministisch dieselbe Hue über Reloads.
- [x] Sparkline mit `values=[...]` rendert 14 Balken, Werte < 0.8 sind rot.

## ✅ Schritt 3 — Layout-Shell

- [ ] Alte Sidebar (240 px) entfernt.
- [ ] `MiniRail` (60 px) auf allen Routes sichtbar — auch Dashboard.
- [ ] Aktiver Route-Tab hat `bg-ink text-paper`.
- [ ] Hover auf Icon zeigt Tooltip mit deutschem Label.
- [ ] Logo-Tile oben hat `bg-accent`, Newsreader-Italic „D" in Papierfarbe.
- [ ] Avatar-Tile unten zeigt Initialen des Users (Mock: „MD" = Maria Dienstplaner).

## ✅ Schritt 4 — CommandBar + KpiBar

- [ ] `<CommandBar />` als reusable Komponente — Props `{ title, accent?, breadcrumb?, filters?, search?, actions? }`.
- [ ] Titel rendert in Newsreader, `accent`-Teil in `text-accent`.
- [ ] Suchfeld zeigt `⌘K`-Hinweis rechts (mono).
- [ ] `<KpiBar />` rendert horizontale KPI-Reihe + optionale Sparkline + optionale Tab-Group rechts.
- [ ] Höhe der Sub-Bar konstant 84 px; kein Layout-Sprung beim Route-Wechsel.

## ✅ Schritt 5 — Dashboard (`/heute`)

- [ ] Route registriert; `/` → Redirect `/heute`.
- [ ] Kicker-Zeile zeigt **aktuelles Datum** (kein hardcoded Mai 11).
- [ ] H1 mit Italic-Akzent „Heute".
- [ ] 4 KPI-Tiles: Abdeckung, Offene Schichten, Konflikte (warn-rot, wenn > 0), Im Urlaub.
- [ ] „Heute im Dienst"-Karte zeigt pro Schicht: Code-Dot, Name, Uhrzeit, Avatar-Chips der zugewiesenen Ärzte.
- [ ] Rechts: Aufmerksamkeitsliste, Abdeckung-Bars je Station, CTA-Karte.
- [ ] Komplett mit Mock-Daten aus `frontend/src/lib/mock/dp-mock.ts`. Kein Backend-Call.

## ✅ Schritt 6 — Plan-Page (`/plans`)

- [ ] Route aktiviert (war disabled).
- [ ] CommandBar zeigt Monat + Jahr im Newsreader, Filter-Chips (Alle / Station / Rolle), Switch (1 Tag / 2 Wochen / 4 Wochen), „Heute"-Button.
- [ ] KpiBar zeigt Mai-KPIs.
- [ ] `PlanGrid`:
  - Header: Wochentag-Kürzel + Tageszahl; Heute = `bg-warn-bg`; Wochenende = `bg-weekend`.
  - Linke Spalte: Avatar + Name + Rollen-Sub.
  - Zellen: `<ShiftCell />` mit Pastell-Farbe, leere Zellen als dashed-Outline.
  - Konflikte: rote Border + Dot oben rechts.
- [ ] Klick auf eine Konflikt-Zelle öffnet `<ContextPanel />` rechts mit `<ConflictCard />`.
- [ ] Klick auf eine leere Zelle öffnet Schichttyp-Picker (Popover, keine Modal-Dialog).
- [ ] Footer-Legende mit allen aktiven Schichttypen.
- [ ] View „4 Wochen" rendert 28 Spalten ohne Layout-Bruch, Zellen 36 px.

## ✅ Schritt 7 — Ärzte-Karten

- [ ] `/doctors` rendert Grid `grid-cols-3 gap-3.5`, nicht mehr Tabelle.
- [ ] Karte: Avatar 44 px + Newsreader-Name + Sub-Zeile + Quals + 14-Tage-Mini-Heatmap + Footer.
- [ ] Filter-Chips: Alle / Fachärzte / WBA / Assistenz / Extern / Inaktive (toggle).
- [ ] „Neuer Arzt"-Button rechts oben (accent rounded-full).
- [ ] Klick auf Karte → `/doctors/:id` (Detail bleibt vorerst Original-UI, nur Styling).
- [ ] Karte hat `hover:` Lift-Effekt (`hover:-translate-y-px shadow`).

## ✅ Schritt 8 — Restliche Listen

- [ ] Stationen / Schichttypen / Qualifikationen / Regeln nutzen denselben CommandBar-Frame.
- [ ] Tabellen sitzen in `rounded-2xl border-line bg-card overflow-hidden` Container.
- [ ] Status-Spalten: einheitliches `<Badge>`-Component (Aktiv/Inaktiv).
- [ ] Bei Schichttypen: erste Spalte zeigt `<ShiftChip />` neben dem Namen.
- [ ] Keine Page-spezifischen Headings mehr — alles über CommandBar.

## ✅ Schritt 9 — ⌘K Command Palette

- [ ] `cmdk` installiert; `<CommandPalette />` als globaler Provider.
- [ ] Cmd/Ctrl+K öffnet, Esc schließt.
- [ ] Navigation zu jeder Route per Pfeil + Enter.
- [ ] Personensuche: tippt man „krü" → springt zu Krüger.
- [ ] „Neuer Arzt"-Action navigiert zu `/doctors/new`.
- [ ] Schließt sich nach Aktion.

## ✅ Schritt 10 — Aufräumen

- [ ] Keine ungenutzten Imports / Komponenten aus dem alten Layout übrig (`grep` auf `OldSidebar` etc. ist leer).
- [ ] Lighthouse: Accessibility ≥ 95 für Dashboard und Plan.
- [ ] Keyboard-Tab durch Plan-Grid funktioniert; alle Zellen fokussierbar.
- [ ] Reduced-Motion-Test: keine störenden Übergänge.
- [ ] README erwähnt das Designsystem-Verzeichnis `lib/design/`.

---

## Regression-Smoke

Diese darfst du nach jedem Schritt 1× drücken und nichts darf brennen:

1. Login → landet auf `/heute`.
2. Rail-Click auf „Plan" → 14-Tage-Grid zeigt mind. 6 Ärzte.
3. Rail-Click „Ärzte" → Karten-Grid; „Neuer Arzt" öffnet bestehende Form.
4. Cmd+K → tippe „rege" → Enter → landet auf Regeln.
5. Reload → bleibt auf aktueller Route, kein weißer Blitz.
