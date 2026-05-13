# Task M1-010: Design-Foundation Teil 2 (MiniRail, CommandBar, KpiBar)

## Ziel
Layout-Shell auf den Atelier-Look umstellen. Drei Bausteine: schmale 
Icon-Sidebar (MiniRail, 60px) ersetzt die bestehende 240px-Sidebar, 
page-spezifische CommandBar als wiederverwendbare Komponente mit 
Titel, Filtern und Aktionen, KpiBar als minimaler KpiTile-Container.

Das ist Schritt 3+4 aus `docs/design-implementation.md`, plus 
KpiBar-Container aus §5/§6. Nach dieser Aufgabe lebt die App komplett 
in der neuen Shell. Die existierenden Stammdaten-Seiten hängen in 
der neuen Shell, ihr Inhalt und ihre internen Page-Header bleiben 
optisch wie bisher (Migration kommt in M1-011). Heute (`/heute`) 
und Pläne (`/plans`) bekommen sichtbare Nav-Einträge mit Platzhalter-
Seiten, die schon CommandBar verwenden.

## Kontext
Lies vor Beginn in dieser Reihenfolge:
1. `CLAUDE.md`
2. `docs/design-implementation.md` §3 (Layout-Shell), §4 (CommandBar), 
   §5 (KpiBar), §6 (Komponenten-Inventar). Source of Truth.
3. `handoff/ACCEPTANCE.md` §3, §4
4. `design-reference/Dienstplaner Redesign.html` (visuelle Referenz, 
   Section "★ Empfohlene Richtung")
5. `design-reference/variants/variant-a.jsx` (Dashboard- und 
   Ärzte-Variante als Implementierungs-Referenz)
6. `frontend/src/components/layout/AppShell.tsx` (aktueller Stand 
   nach M1-008, clinic_name im Header sitzt hier)
7. `frontend/src/components/dp/` (Primitives aus M1-009, besonders 
   `Avatar.tsx` mit oklch-Hue)
8. `frontend/src/App.tsx` (Routing, aktuelle Route-Pfade)
9. `frontend/src/lib/design/tokens.ts` (Farben, Radien)

**Wichtige Regeln aus der Anleitung (Wiederholung):**
- Keine Hex-Codes außerhalb von `tokens.ts` und `shift-palette.ts`
- Keine neuen UI-Libraries (cmdk kommt erst in M1-012)
- Bestehende shadcn-Komponenten erweitern, nicht ersetzen
- Bei Unklarheit: zuerst Anleitung lesen, sonst stoppen und fragen

## Entscheidungen für M1-010 (Abweichungen von der Anleitung)

Vor Schreiben des Briefings festgelegt. Diese drei Punkte weichen 
bewusst von `docs/design-implementation.md` §3 ab oder ergänzen sie:

1. **MiniRail bekommt zusätzliches Settings-Item.** Anleitung listet 
   für die untere Sektion nur das Avatar-Tile. Wir ergänzen ein 
   Settings-Icon als eigenes Rail-Item zwischen Spacer und Avatar, 
   damit die Einstellungen-Page direkt erreichbar bleibt. Begründung: 
   single-user App, kein User-Menu nötig, Settings ist der häufigste 
   Sekundär-Pfad.
2. **clinic_name als Sub-Label unter Avatar-Tile.** Die Anleitung 
   erwähnt clinic_name nicht. Wir hängen ihn als kleines zweizeiliges 
   Label (max 60px, truncated mit Tooltip) unter das Avatar-Tile. 
   Damit bleibt die in M1-008 eingeführte Settings-Anzeige sichtbar, 
   ohne die CommandBar zu belasten.
3. **KpiBar minimal in M1-010.** Anleitung §5 spezifiziert KpiBar mit 
   4-6 Tiles, Sparkline in der Mitte und Tab-Group rechts. Wir bauen 
   in M1-010 nur den Tile-Container. Sparkline und Tab-Group kommen 
   in M2-003, wenn echte Daten und Sub-Views nötig sind.

Weitere Entscheidungen (in Linie mit Anleitung):
- Bestehende Stammdaten-Pages bleiben optisch wie bisher, hängen aber 
  in neuer Shell. CommandBar wird dort erst in M1-011 eingebaut.
- Alle Routen sichtbar in MiniRail. Heute und Pläne führen auf 
  Platzhalter-Pages, die schon CommandBar verwenden.
- Route-Pfade unverändert. Welches Schema im Code steht (z.B. 
  `/doctors` vs. `/aerzte`), nicht umbenennen. Anleitung verwendet 
  englische Pfade, aktueller Code-Stand ist verbindlich.

## Anforderungen

### Sub-Schritt 1: MiniRail und neue Shell-Struktur (ACCEPTANCE §3)

**1.1 Neue Layout-Komponenten anlegen**

Parallel zur bestehenden `AppShell.tsx` neue Komponenten anlegen, 
nicht direkt ersetzen:
- `frontend/src/components/layout/MiniRail.tsx`
- `frontend/src/components/layout/AtelierShell.tsx` (orchestriert 
  MiniRail + Content-Bereich + Outlet, KEIN globaler Header)

`CommandBar` kommt in Sub-Schritt 2, `KpiBar` in Sub-Schritt 3.

**1.2 MiniRail-Komponente**

Spec aus `docs/design-implementation.md` §3, mit den oben genannten 
Abweichungen.

Layout (von oben nach unten):
1. **Logo-Tile** (38x38, `bg-accent`, Buchstabe "D" in 
   Newsreader-Italic weiss, `rounded-xl`)
2. **Trenner** (1px Linie, 24px breit, `bg-line`)
3. **Heute** → `/heute` — Icon `LayoutDashboard`
4. **Plan** → `/plans` — Icon `Calendar`
5. **Ärzte** → bestehender Pfad — Icon `Users`
6. **Stationen / Bereiche** → bestehender Pfad — Icon `Building2`
7. **Schichten / Schichttypen** → bestehender Pfad — Icon `Clock`
8. **Qualifikationen** → bestehender Pfad — Icon `Award`
9. **Regeln / Sonderregelungen** → bestehender Pfad — Icon `Shield`
   (Anleitung sagt Settings2, das ist hier zu nah am echten 
   Settings-Icon. Shield passt semantisch, ist klar abgegrenzt.)
10. **Spacer** (`flex-1`)
11. **Einstellungen** → bestehender Pfad zu /einstellungen — Icon 
    `Settings` (Abweichung von Anleitung, siehe Entscheidung 1)
12. **Avatar-Tile** (32x32 rund, oklch-Hue aus Primitive-Avatar, 
    Initialen "P" für Planer oder so)
13. **Sub-Label** unter Avatar: clinic_name aus 
    `useAppSettings`/`useClinicName`-Hook, 10px `text-ink-3`, 
    `truncate`, Tooltip mit vollem Wert

Icon-Buttons je 40px hoch, `rounded-xl`. Hover-Tooltip rechts (shadcn 
Tooltip). Active-State: Tile bekommt `bg-ink text-paper`, sonst 
`text-ink-2`. Active-Match: `useLocation().pathname.startsWith(route)`, 
nicht exakte Equality (sonst markiert er `/aerzte` nicht mehr bei 
`/aerzte/123`).

Bestehende lucide-react-Icons. Falls Icon-Namen abweichen 
(z.B. lucide nennt sie anders), in Kommentar dokumentieren.

**1.3 Platzhalter-Seiten für Heute und Pläne**

- `frontend/src/features/today/TodayPage.tsx`
- `frontend/src/features/plans/PlansPage.tsx`

Inhalt minimal: 
- CommandBar wird in Sub-Schritt 2 eingebaut, jetzt erstmal nur 
  H1 in `dp-h1`-Klasse (Newsreader)
- Kurzer Hinweistext: "Diese Ansicht wird in M2-003 implementiert."
- Optional: gestricheltes Card-Frame als visueller Platzhalter
- Kein Mock-Inhalt, der später irreführen würde

Routen in `App.tsx` ergänzen:
- `/` → Redirect auf `/heute` (Anleitung §3)
- `/heute` → TodayPage
- `/plans` → PlansPage

**1.4 Bestehende Stammdaten-Pages in neue Shell**

In `App.tsx` das Layout-Wrapping umstellen: alle existierenden 
Routen laufen jetzt durch `AtelierShell`. Inhalt unverändert. Die 
Pages behalten ihre internen Page-Header (z.B. "Ärzte verwalten" mit 
+-Button). Visuell mischt sich kurz Alt-Inhalt mit neuer Shell - 
das ist die geplante Übergangsphase.

Konkret: `<Route element={<AppShell />}>` durch 
`<Route element={<AtelierShell />}>` ersetzen.

**1.5 clinic_name aus AppShell-Header entfernen**

In M1-008 wurde clinic_name im AppShell-Header platziert. Da der 
AppShell ersetzt wird durch AtelierShell, fällt der Header weg. 
clinic_name landet stattdessen als Sub-Label unter dem 
Avatar-Tile in der MiniRail.

`useAppSettings`/`useClinicName`-Hook wiederverwenden, nicht neu 
schreiben. Falls in M1-008 nicht als Hook gekapselt, jetzt zu 
`useClinicName` refactoren.

**1.6 Akzeptanzkriterien für Sub-Schritt 1**

- [ ] MiniRail ist 60px breit, volle Höhe, `bg-card`-Hintergrund, 
      `border-r border-line`
- [ ] Logo-Tile oben (38x38, D-Buchstabe, Newsreader-Italic, 
      bg-accent, weiss)
- [ ] Acht Haupt-Nav-Items + Trenner + Spacer + Settings + Avatar in 
      angegebener Reihenfolge
- [ ] Active-Route ist visuell hervorgehoben (`bg-ink text-paper`)
- [ ] Tooltips erscheinen on hover mit Klartext-Namen
- [ ] clinic_name als kleines Sub-Label unter Avatar sichtbar, 
      truncated, mit vollem Wert im Tooltip
- [ ] Avatar verwendet das Avatar-Primitive aus M1-009 (oklch-Hue)
- [ ] `/` redirected auf `/heute`
- [ ] Heute und Pläne sind erreichbar, zeigen Platzhalter
- [ ] Bestehende Stammdaten-Pages laufen weiter (kein 404, kein Crash)
- [ ] Alte 240px-Sidebar ist nicht mehr sichtbar
- [ ] `pnpm type-check` grün
- [ ] Keine neuen Hex-Codes außerhalb tokens.ts / shift-palette.ts

**Stop-Gate nach Sub-Schritt 1:**
- Commit: `feat: M1-010/1 mini rail and atelier shell`
- ACCEPTANCE.md §3 abhaken
- Warten auf Review (User klickt jede Nav-Position durch, prüft 
  Hover-Tooltips, Active-State, clinic_name-Sub-Label, Redirect)

### Sub-Schritt 2: CommandBar als Page-Komponente (ACCEPTANCE §4)

**2.1 CommandBar-Komponente**

`frontend/src/components/dp/CommandBar.tsx`. Wichtig: CommandBar ist 
**page-spezifisch**, nicht Teil der Shell. Jede Page rendert ihre 
eigene CommandBar mit ihren Props.

Spec aus `docs/design-implementation.md` §4:

```
┌─ Titel (Newsreader) │ Breadcrumb │ Filter-Chips │ Suchfeld ⌘K │ Primärbutton ─┐
```

Props:
```typescript
interface CommandBarProps {
  title: string                  // z.B. "Mai 2026"
  titleAccent?: string           // italic-akzentuierter Teil, z.B. "Mai"
  breadcrumb?: BreadcrumbItem[]  // optional
  filters?: FilterChip[]         // optional, je { label, active, onClick }
  primaryAction?: {              // optional
    label: string
    icon?: LucideIcon
    onClick: () => void
  }
  showSearch?: boolean           // default true, false für Pages ohne Search
}
```

Visuell:
- Volle Breite (rechts von MiniRail), ca 56-64px hoch
- `bg-paper` (gleicher Hintergrund wie Page), KEIN Border unten - 
  CommandBar fließt in den Page-Content. Falls visuelle Abgrenzung 
  nötig: nur durch Spacing.
- **Titel:** `font-serif text-2xl`, mit `titleAccent` als italic in 
  `text-accent` (gleiche Komponente, kein eigenes <ItalicTitle/>)
- **Breadcrumb:** kleine Pfeil-Icons + Klartext, `text-ink-3`
- **Filter-Chips:** verwendet Chip-Primitive aus M1-009. Aktive 
  Chips in `active`-Variante
- **Suchfeld:** Input mit Lupe links, `⌘K`-Chip rechts (Mono, klein). 
  Klick öffnet einen Toast "Command Palette kommt in M1-012". KEIN 
  echtes cmdk hier. Bei `showSearch=false` ausblenden.
- **Primärbutton:** `rounded-full`, `bg-accent text-paper`, klein. 
  Verwendet shadcn-Button mit neuer Variante `accent` (laut 
  Anleitung §6).

**2.2 shadcn-Button Variante "accent" ergänzen**

In `frontend/src/components/ui/button.tsx`:
```typescript
accent: 'bg-accent text-paper hover:bg-[#B45B30]'
```

Hex-Wert für Hover: aus `tokens.ts` ziehen, nicht hartcoden. Falls 
`accent.hover` nicht in tokens existiert, ergänzen.

**2.3 CommandBar in Platzhalter-Pages einbauen**

- `TodayPage.tsx`: 
  - title: aktueller Wochentag + Datum (z.B. "Mittwoch, 13. Mai 2026")
  - titleAccent: "Heute"
  - keine Filter, keine Action, Search sichtbar
- `PlansPage.tsx`:
  - title: aktueller Monat (z.B. "Mai 2026")
  - titleAccent: "Mai"
  - Filter-Chips: ["2 Wochen", "4 Wochen", "1 Tag"] - keine 
    aktive Logik, nur Optik
  - primaryAction: "+ Neuer Plan" (no-op, Toast)
  - Search sichtbar

Bestehende Stammdaten-Pages bekommen die CommandBar **nicht** in 
M1-010 (Migration in M1-011).

**2.4 Akzeptanzkriterien für Sub-Schritt 2**

- [ ] CommandBar als eigenständige Komponente in 
      `components/dp/CommandBar.tsx`
- [ ] Props-Interface: title, titleAccent, breadcrumb, filters, 
      primaryAction, showSearch
- [ ] Titel rendert mit Newsreader, optional italic-Akzent in accent
- [ ] Filter-Chips verwenden Chip-Primitive
- [ ] Search-Trigger zeigt Toast "Command Palette kommt in M1-012"
- [ ] Primärbutton rendert mit shadcn-Button-Variante `accent`
- [ ] TodayPage und PlansPage verwenden CommandBar mit eigenen Props
- [ ] Stammdaten-Pages haben (noch) keine CommandBar

**Stop-Gate nach Sub-Schritt 2:**
- Commit: `feat: M1-010/2 command bar page component`
- ACCEPTANCE.md §4 abhaken
- Warten auf Review (User prüft TodayPage und PlansPage visuell, 
  klickt Search-Trigger, klickt Filter-Chips, klickt Primärbutton)

### Sub-Schritt 3: KpiBar (minimaler Tile-Container)

**3.1 KpiBar-Komponente**

`frontend/src/components/dp/KpiBar.tsx`.

**Bewusst minimal:** nur Tile-Container, kein Sparkline, keine 
Tab-Group. Diese kommen in M2-003 mit echten Daten.

Props:
```typescript
interface KpiBarProps {
  tiles: Array<{
    label: string
    value: string | number
    sub?: string
    tone?: 'default' | 'warn' | 'ok'
  }>
}
```

Visuell:
- Horizontales Layout: `flex gap-3` oder `grid grid-cols-{N}`, 
  je nachdem ob feste oder variable Anzahl gewünscht
- `bg-card` mit `border border-line rounded-2xl` als Container, 
  Padding `p-4`
- Pro Tile ein `<KpiTile />` (aus M1-009)
- Overflow: bei N > 6 horizontal scrollen via `overflow-x-auto`. 
  Im Kommentar dokumentieren: empfohlene Anzahl 4-6.

**3.2 KpiBar im Playground demonstrieren**

In `PlaygroundPage.tsx` neue Sektion "KpiBar":
- Variante 1: drei Tiles (default)
- Variante 2: fünf Tiles mit gemischten tones (default, warn, ok)

Damit ist die Komponente getestet, bevor sie in M2-003 verwendet 
wird.

**3.3 Akzeptanzkriterien für Sub-Schritt 3**

- [ ] KpiBar rendert N Tiles in horizontaler Anordnung
- [ ] Playground zeigt zwei Varianten
- [ ] KpiBar hat Container-Optik (bg-card, border-line, rounded-2xl)
- [ ] Overflow bei N > 6 funktioniert (horizontal scroll)
- [ ] Tone-Varianten werden korrekt an KpiTile weitergereicht
- [ ] Empfohlene Anzahl 4-6 als Kommentar dokumentiert

**Stop-Gate nach Sub-Schritt 3:**
- Commit: `feat: M1-010/3 kpi bar tile container`
- Warten auf Review (User öffnet Playground, prüft beide Varianten 
  und Overflow)

### Sub-Schritt 4: Tests, Cleanup, Doku

**4.1 Tests ergänzen**

`frontend/src/components/layout/__tests__/`:
- `MiniRail.test.tsx`: rendert alle Nav-Items, Active-State reagiert 
  auf Route-Wechsel, clinic_name-Sub-Label kommt aus 
  Settings-Hook-Mock
- `AtelierShell.test.tsx`: rendert MiniRail und Outlet, kein 
  globaler Header

`frontend/src/components/dp/__tests__/`:
- `CommandBar.test.tsx`: rendert title und titleAccent, Filter-Chips 
  werden gerendert, Search-Trigger zeigt Toast on click, 
  Primärbutton ist klickbar
- `KpiBar.test.tsx`: rendert N Tiles, leere Liste rendert leeren 
  Container, Tone wird weitergereicht

Vorhandene Tests, die `AppShell` direkt importierten oder den 
clinic_name-Header testeten, an `AtelierShell` anpassen oder löschen.

**4.2 Alte AppShell und Sidebar entfernen**

Sobald `AtelierShell` funktioniert und alle Routen darin laufen:
- `AppShell.tsx` löschen
- Alte Sidebar-Komponente (vermutlich `Sidebar.tsx`) löschen
- Imports prüfen (`grep -r "AppShell\|Sidebar" frontend/src/`)
- Tests, die diese Komponenten direkt testeten, entfernen

**4.3 Lint, Type-Check, Test-Run**

```
cd frontend
pnpm type-check
pnpm lint
pnpm vitest run
```

Alles grün.

**4.4 Dokumentation aktualisieren**

`docs/decisions.md` ergänzen:
- ADR: MiniRail (60px) statt klassische Sidebar (240px). Bewusste 
  Abweichungen von Anleitung: Settings als eigenes Rail-Item, 
  clinic_name als Sub-Label unter Avatar.
- ADR: CommandBar ist page-spezifisch, jede Page rendert ihre 
  eigene mit Props. Globale Top-Bar gibt es nicht.
- ADR: KpiBar in M1-010 minimal (nur Tile-Container). Sparkline 
  und Tab-Group kommen in M2-003 mit echten Daten.
- ADR: shadcn-Button bekommt neue Variante `accent` (terracotta)

`README.md` unter "Entwicklung":
- Hinweis auf Shell-Struktur (MiniRail + AtelierShell + 
  page-spezifische CommandBar)
- Hinweis dass Heute und Pläne aktuell Platzhalter sind
- Hinweis dass Stammdaten-Pages noch ohne CommandBar laufen 
  (Migration in M1-011)

**Stop-Gate nach Sub-Schritt 4:**
- Commit: `chore: M1-010/4 tests docs and cleanup`
- Final-Review durch User
- Merge in main (Standard-Sequenz)

## Akzeptanzkriterien (Gesamtaufgabe)

- [ ] `frontend/src/components/layout/MiniRail.tsx` existiert
- [ ] `frontend/src/components/layout/AtelierShell.tsx` existiert
- [ ] `frontend/src/components/dp/CommandBar.tsx` existiert
- [ ] `frontend/src/components/dp/KpiBar.tsx` existiert
- [ ] Alte `AppShell.tsx` und alte Sidebar entfernt
- [ ] `frontend/src/features/today/TodayPage.tsx` (Platzhalter mit 
      CommandBar)
- [ ] `frontend/src/features/plans/PlansPage.tsx` (Platzhalter mit 
      CommandBar)
- [ ] MiniRail: Logo-Tile, alle Haupt-Nav-Items, Settings, 
      Avatar+clinic_name in korrekter Reihenfolge
- [ ] `/` redirected auf `/heute`
- [ ] Active-State in MiniRail funktioniert (auch bei Sub-Routen)
- [ ] clinic_name kommt aus Settings-Hook, Sub-Label truncated, 
      Tooltip mit vollem Wert
- [ ] CommandBar als page-spezifische Komponente, in zwei 
      Platzhalter-Pages eingebaut
- [ ] shadcn-Button-Variante `accent` ergänzt
- [ ] KpiBar minimal: nur Tile-Container, im Playground demonstriert
- [ ] Bestehende Stammdaten-Pages laufen unverändert in neuer Shell 
      (ohne CommandBar)
- [ ] Tests für MiniRail, AtelierShell, CommandBar, KpiBar geschrieben
- [ ] `pnpm type-check`, `pnpm lint`, `pnpm vitest run` grün
- [ ] `docs/decisions.md` und `README.md` aktualisiert
- [ ] Keine neuen Hex-Codes außerhalb tokens.ts / shift-palette.ts

## Out of Scope

- ⌘K Command Palette (kommt in M1-012, hier nur Toast-Stub)
- Sparkline in KpiBar (kommt in M2-003)
- Tab-Group in KpiBar (kommt in M2-003)
- Dashboard-Inhalt für Heute (kommt in M2-003)
- PlanGrid-Inhalt für Pläne (kommt in M2-003)
- CommandBar in Stammdaten-Pages (kommt in M1-011)
- DoctorList-Umstellung auf Karten (kommt in M1-011)
- ContextPanel rechts (kommt in M2-003)
- Mobile-Layout (App ist Desktop-only, single user, lokal)
- Theme-Switch hell/dunkel (nicht geplant)
- Internationalisierung (deutsch hartcodiert)
- Tastatur-Shortcuts in MiniRail (kommt mit ⌘K in M1-012)
- Hue im Doctor-Model speichern (Anleitung §6 erwähnt das. Wir 
  leiten Hue weiter aus ID ab, Backend-Migration kommt später)

## Bekannte Stolperfallen

- **Doppelte Shell-Phase:** während Sub-Schritt 1 existieren 
  `AppShell` und `AtelierShell` parallel. In `App.tsx` darf nur 
  eine pro Route aktiv sein, sonst gibt es doppelte Sidebars.
- **Settings-Hook wiederverwenden:** der bestehende Hook aus M1-008 
  für `clinic_name`. Nicht neu schreiben, sondern importieren. 
  Wenn er noch nicht als Hook gekapselt ist, jetzt in einen 
  `useClinicName`-Hook refactoren.
- **Active-State in MiniRail:** `useLocation().pathname.startsWith()` 
  matchen, nicht exakte Equality. Sonst markiert er `/aerzte` nicht 
  mehr, sobald man auf `/aerzte/123` steht. Spezialfall: `/` darf 
  nicht alle Routen matchen, deshalb explizit prüfen oder 
  `/heute`-Match nur bei exakt `/heute`.
- **Tooltips:** shadcn-Tooltip braucht `TooltipProvider` am Root. 
  Falls noch nicht in `App.tsx` eingebunden, jetzt ergänzen.
- **clinic_name-Sub-Label bei 60px Breite:** zwei Zeilen ist okay, 
  aber `truncate` und `max-w-[60px]` sind Pflicht. Tooltip mit 
  vollem Wert. Bei sehr langen Klinik-Namen (>20 Zeichen) wird das 
  Label fast unlesbar - das ist akzeptabel, voller Wert ist im 
  Settings-Tab.
- **Logo-Tile:** der D-Buchstabe ist in der Anleitung als 
  Newsreader-Italic in weiss spezifiziert. Sichergehen, dass die 
  Font-Familie und das italic-Style korrekt rendern - nicht den 
  shadcn-Button mit Text füllen, sondern eigenes Tile-Markup.
- **Avatar-Tile mit clinic_name-Label:** das Avatar-Tile selbst ist 
  rund (32x32). Das clinic_name-Label kommt darunter, NICHT als 
  Sub-Eigenschaft des Avatars. Wenn jemand das Avatar-Primitive 
  benutzt, das hat keine Sub-Label-Prop. Eigenes Wrapper-Markup in 
  der MiniRail bauen.
- **Route-Pfade:** nicht umbenennen. Welches Schema im Code steht 
  (englisch/deutsch), beibehalten. Anleitung verwendet englische 
  Pfade als Vorschlag, der aktuelle Code-Stand ist verbindlich.
- **shadcn-Button-Variante:** beim Hinzufügen der `accent`-Variante 
  in `button.tsx` die `variants`-Definition in `buttonVariants` 
  ergänzen, nicht eine neue Datei. Sonst funktioniert die 
  TypeScript-Inferenz nicht.
- **`bg-paper` für CommandBar:** Anleitung §4 zeigt CommandBar mit 
  weichem Übergang zur Page (keine harte Linie). Bei manchen Pages 
  könnte das verwirrend wirken (wo endet die Bar, wo beginnt der 
  Content?). Wenn das in Review als Problem auffällt, dünne 
  `border-b border-line/40` als Sub-Detail nachziehen.
- **Test-Setup für AtelierShell:** braucht `MemoryRouter`-Wrapper 
  in Tests, sonst crasht `useLocation`. Test-Util 
  `renderWithRouter` ggf. neu anlegen.
- **Search-Trigger-Toast:** den Toast-Mechanismus, falls in shadcn 
  vorhanden (Sonner oder shadcn/toast), verwenden. Wenn keiner 
  installiert ist, einen Console-Log und ein leichtes Inline-Hint-
  Element reichen erstmal.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

OK-Annahmen:
- Bestehende Stammdaten-Pages (DoctorList, etc.) bleiben optisch 
  exakt wie bisher, nur das umgebende Shell ändert sich
- Routen-Namen bleiben unverändert (was im aktuellen Code steht)
- Settings-Hook aus M1-008 ist verwendbar oder leicht refactorbar
- Klinikname-Fallback "Klinik" ist akzeptabel solange Settings-API 
  noch lädt
- Search-Trigger zeigt einen Toast bei Klick, kein Modal
- Avatar in Rail ist statisch (Initialen "P" oder leerer Hash), 
  keine User-Daten (Single-User)
- Logo-Tile-Buchstabe "D" bleibt statisch, kein dynamischer Marker 
  basierend auf clinic_name
- Tests für visuelle Aspekte (Tooltip-Animation, exakte Farb-Werte) 
  werden nicht geschrieben, nur Funktion und Rendering
- shadcn-Tooltip ist bereits installiert oder leicht hinzufügbar 
  (sonst eigene minimale Lösung)
- lucide-react ist installiert (M1-009 nutzt es vermutlich schon)

Bei Unklarheit: zuerst `docs/design-implementation.md` §3, §4, §5, 
§6 lesen, dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:
```powershell
cd D:\Softwareprojekte\Dienstplaner
git status                  # sauber?
git checkout main
git pull origin main
git checkout -b task/M1-010-design-foundation-teil2
```

Briefing nach `tasks\open\M1-010-design-foundation-teil2.md` 
kopieren.

Nach Abschluss aller Sub-Schritte:
```powershell
git push origin task/M1-010-design-foundation-teil2

git checkout main
git pull origin main
git merge task/M1-010-design-foundation-teil2
git push origin main

move tasks\open\M1-010-design-foundation-teil2.md tasks\done\
git add .
git commit -m "chore: archive completed task M1-010"
git push
```

`pnpm generate-api` nicht nötig, M1-010 hat keine Backend-Änderungen.
