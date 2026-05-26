# Task M1-012: Command Palette (universell, plattformunabhängig)

## Ziel
Die in M1-010 stub-artig angelegte Suche in der `CommandBar` wird durch
eine voll funktionsfähige Command Palette ersetzt. Sie öffnet per
globalem Hotkey (`⌘K` auf Mac, `Strg+K` auf Windows/Linux) sowie per
Klick auf den Suchbutton in der CommandBar und bietet drei
Inhaltsklassen: **Navigation** zu allen Hauptseiten, **Quick-Actions**
(Neuer Arzt, Neuer Plan, …) und **Datensatz-Suche** über Ärzte, Pläne
und Stationen. Zusätzlich erscheinen die zuletzt genutzten Einträge
("Recents") als oberste Gruppe, solange das Suchfeld leer ist.

Die Darstellung ist plattform-universell: kein hardcodiertes Apple-
Glyph, sondern OS-Detection in einem zentralen Helper. Das hält den
Look idiomatic für Mac und Windows gleichermaßen.

## Kontext
Lies vor Beginn in dieser Reihenfolge:
1. `CLAUDE.md` — besonders die Konventionen zu „Frontend — Plan-Feature
   (M2-003)" (Hook-Konventionen, Query-Key-Objekte) und der Hinweis
   „Keine neuen Bibliotheken ohne explizite Rückfrage". Für M1-012 ist
   die Lib-Frage geklärt: `cmdk` wird eingeführt.
2. `frontend/src/components/dp/CommandBar.tsx` — Zeile 43-45 ist der
   Stub-Toast, Zeile 96-107 der Trigger-Button mit hardcodiertem `⌘K`.
3. `frontend/src/components/layout/MiniRail.tsx` — Zeile 24-32 enthält
   die `mainNavItems`-Liste, aus der die Navigation-Items der Palette
   abgeleitet werden. Falls möglich, beide Stellen aus derselben
   Konstante speisen.
4. `frontend/src/App.tsx` — hier wird der `CommandPaletteProvider`
   gewrappt. `BrowserRouter` muss außen sitzen, sonst greift
   `useNavigate()` nicht.
5. shadcn-Snippet für die `Command`-Komponente:
   <https://ui.shadcn.com/docs/components/command> — wir übernehmen
   den Standard-Wrapper über `cmdk` und passen Tailwind-Klassen an
   Atelier-Tokens (`bg-card`, `border-line`, `text-ink`, `text-ink-3`)
   an. Keine neuen Hex-Codes.
6. `docs/decisions.md` — neue ADRs werden in Sub-Schritt G ergänzt.
7. Vorhandene Entity-Hooks: `features/doctors/`, `features/plans/`,
   `features/departments/`. Welche `use…`-Hooks dort existieren, in
   Sub-Schritt D wiederverwenden. Nicht neu schreiben.

**Wichtige Regeln aus der Anleitung (Wiederholung):**
- `cmdk` ist die einzige neue Lib in M1-012 (Pflicht-Rückfrage erfüllt).
- Keine Hex-Codes außerhalb `tokens.ts` / `shift-palette.ts`.
- Bestehende shadcn-Komponenten erweitern, nicht ersetzen.
- INA-Verfügbarkeit, Konflikt-Engine, Tarif-Pipeline NICHT anfassen —
  M1-012 ist reines Frontend-Feature ohne Backend-Änderung.

## Entscheidungen für M1-012

Vor Schreiben des Briefings festgelegt:

1. **`cmdk` als einzige neue Lib.** Industriestandard, von shadcn
   `Command` empfohlen, bringt Fuzzy-Search und Keyboard-Navigation
   out-of-box. Alternative (selbst bauen über Radix Dialog + Input)
   verworfen — zu viel Aufwand für identischen Outcome.
2. **OS-Detection einmalig in `frontend/src/lib/platform.ts`.** Nicht
   verstreut. Der Hotkey-Listener akzeptiert beide Modifier
   (`metaKey || ctrlKey`) ohne Branch — nur die visuelle Anzeige
   verzweigt.
3. **Datensatz-Items lazy.** TanStack-Queries mit `enabled: isOpen`,
   kein Prefetch beim Mount. Lokale App, kleine Datenmengen, kein
   Pagination nötig — Anzeige-Limit 10 pro Gruppe genügt.
4. **Recents lokal in `localStorage`.** Kein Server-State, kein
   Backend-Endpoint. Max 5 Einträge, Storage-Key
   `dp-command-palette-recents`.
5. **Keine Page-Context-Quick-Actions in M1-012.** Nur globale
   Aktionen (Neuer Arzt, Neuer Plan, Neue Station). Kontextabhängige
   Actions („diesen Plan exportieren" auf `/plans/:id`) folgen in
   einem späteren Milestone, sobald ein Page-Context-Hook etabliert
   ist.

## Anforderungen

### Sub-Schritt A: Setup — cmdk, shadcn Command, Platform-Helper

**A.1 cmdk installieren**
```powershell
cd D:\Softwareprojekte\Dienstplaner\frontend
pnpm add cmdk
```
`package.json` und `pnpm-lock.yaml` mit committen.

**A.2 shadcn Command-Wrapper anlegen**
- `frontend/src/components/ui/command.tsx`
- Standard-Snippet von shadcn übernehmen: `Command`, `CommandDialog`,
  `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`,
  `CommandSeparator`, `CommandEmpty`, `CommandShortcut`.
- Tailwind-Klassen an Atelier-Tokens binden: `bg-card`, `border-line`,
  `text-ink`, `text-ink-3`. Selected-State: `bg-paper text-ink`.
  Keine Hex-Codes, keine neuen Tokens.
- `CommandDialog` ist ein Wrapper um shadcn `Dialog` + `Command` —
  rendert via Radix-Portal in `document.body`.

**A.3 Platform-Helper**
- `frontend/src/lib/platform.ts`
- API:
  ```typescript
  export function isMac(): boolean
  export function getModifierKey(): 'meta' | 'ctrl'
  export function getModifierGlyph(): '⌘' | 'Strg'
  ```
- Detection-Reihenfolge:
  1. `navigator.userAgentData?.platform` (Chromium, modernes API)
  2. Fallback `navigator.platform` (deprecated, aber breit unterstützt)
  3. Default `false` → Win/Linux-Verhalten
- Pattern: `/mac/i`-Match auf beide Quellen. Niemals reine
  String-Equality (`=== 'MacIntel'`) — bricht bei iOS-Safari oder
  zukünftigen Plattform-Strings.
- Helper sind synchron, einmaliger Lookup beim ersten Aufruf cachen
  ist optional (nicht zwingend).

**A.4 Akzeptanzkriterien für Sub-Schritt A**
- [x] `cmdk` in `frontend/package.json` als Dependency
- [x] `components/ui/command.tsx` exportiert alle Command-Bausteine
- [x] Tailwind-Klassen verwenden ausschließlich Atelier-Tokens
- [x] `lib/platform.ts` exportiert `isMac`, `getModifierKey`,
      `getModifierGlyph`
- [x] `pnpm type-check` grün

**Stop-Gate nach Sub-Schritt A:**
- Commit: `feat: M1-012/A cmdk setup and platform helper`
- Warten auf Review (User prüft Lib-Install und Helper-Signatur)

### Sub-Schritt B: CommandPalette-Komponente + Provider mit globalem Hotkey

**B.1 Provider und Context**
- `frontend/src/features/command-palette/CommandPaletteProvider.tsx`
- React-Context mit `{ isOpen, open, close, toggle }`
- `useEffect` registriert auf `document` einen `keydown`-Listener:
  ```typescript
  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      toggle()
    }
  }
  ```
  Cleanup in `useEffect`-Return.
- Hotkey ist plattform-agnostisch: Mac-User drücken ⌘, Win/Linux-User
  drücken Strg — beide werden vom selben Listener gefangen. Kein
  OS-Branch im Handler.

**B.2 useCommandPalette-Hook**
- `frontend/src/features/command-palette/useCommandPalette.ts`
- Liefert den Context-Wert. Wirft, wenn außerhalb des Providers
  aufgerufen — analog zu bestehenden Hook-Patterns im Codebase.

**B.3 CommandPalette-Komponente**
- `frontend/src/features/command-palette/CommandPalette.tsx`
- Rendert `CommandDialog` (offen wenn `isOpen`)
- `CommandInput` mit Placeholder `"Suchen oder Befehl…"`
- `CommandList` enthält in B.3 nur einen statischen
  `<CommandEmpty>Keine Treffer</CommandEmpty>` — Items folgen in
  Sub-Schritten C, D, E.

**B.4 Provider in App.tsx einhängen**
- `App.tsx`: `<CommandPaletteProvider>` umschließt die Routes,
  innerhalb `<BrowserRouter>` (wegen `useNavigate` in den
  Item-Handlern in C). Reihenfolge prüfen.
- `<CommandPalette />` als Geschwister-Komponente rendern (Portal
  rendert in `body` — wo der React-Mountpoint liegt, ist egal,
  Hauptsache innerhalb des Providers).

**B.5 Akzeptanzkriterien für Sub-Schritt B**
- [x] `CommandPaletteProvider` exportiert Context und Provider
- [x] `useCommandPalette` wirft außerhalb Provider, sonst State
- [x] Globaler Hotkey öffnet/schließt die Palette (sowohl `Meta+K`
      als auch `Ctrl+K`)
- [x] `Esc` schließt die Palette (von shadcn-Dialog gehandhabt)
- [x] Provider in `App.tsx` korrekt platziert (innerhalb
      `BrowserRouter`)

**Stop-Gate nach Sub-Schritt B:**
- Commit: `feat: M1-012/B palette shell and global hotkey`
- Warten auf Review (User drückt Hotkey, prüft Open/Close)

### Sub-Schritt C: Navigation- und Quick-Action-Registries

**C.1 Navigation-Items**
- `frontend/src/features/command-palette/items/navigation.ts`
- Exportiert eine Funktion `useNavigationItems()`, die `useNavigate()`
  aufruft und ein Array aus Items zurückgibt:
  ```typescript
  interface CommandItemDef {
    id: string                  // stabil, für Recents-Dedup
    label: string               // sichtbarer Text
    group: 'navigation' | 'actions' | 'doctors' | 'plans' | 'departments'
    icon?: LucideIcon
    keywords?: string[]         // für besseres Fuzzy-Matching
    onSelect: () => void
  }
  ```
- Items aus den `mainNavItems` in `MiniRail.tsx:24-32` ableiten —
  wenn möglich die Konstante extrahieren (z.B. nach
  `lib/navigation/routes.ts`) und in beiden Komponenten importieren.
  Wenn das den Scope sprengt: kommentieren, dass beide Listen
  synchron gehalten werden müssen, und ein TODO für Folge-Refactor
  hinterlassen.
- Einträge: Heute, Pläne, Ärzte, Stationen, Schichttypen,
  Qualifikationen, Sonderregelungen, Einstellungen.

**C.2 Quick-Actions**
- `frontend/src/features/command-palette/items/quickActions.ts`
- `useQuickActions()` liefert:
  - „Neuer Arzt" → `navigate('/doctors/new')`
  - „Neuer Plan" → `navigate('/plans')` mit `state` oder Hash, der
    den „Neuer Plan"-Dialog dort triggert (falls Hook vorhanden);
    sonst nur Navigation zur Liste mit Hinweis im Briefing-Kommentar
  - „Neue Station" → `navigate('/departments')` analog
- Wenn die Ziel-Page keine direkte Action-Trigger-Möglichkeit hat,
  reicht die Navigation. Keine neuen Page-Features in M1-012 bauen.

**C.3 Items in CommandPalette einhängen**
- `CommandPalette.tsx`: zwei `CommandGroup` mit `heading="Navigation"`
  und `heading="Aktionen"`. Items mappen, `onSelect`-Callback ruft
  zuerst `pushRecent(item)` (kommt in Sub-Schritt E — Platzhalter
  jetzt vorbereiten oder erst nach E ergänzen), dann
  `close()`, dann `item.onSelect()`.

**C.4 Akzeptanzkriterien für Sub-Schritt C**
- [x] `useNavigationItems()` liefert 8 Items aus den MiniRail-Routen
- [x] `useQuickActions()` liefert mindestens 3 Quick-Actions
- [x] Palette zeigt zwei Gruppen, Treffer per Fuzzy-Search
- [x] Klick / Enter auf ein Item navigiert und schließt die Palette

**Stop-Gate nach Sub-Schritt C:**
- Commit: `feat: M1-012/C navigation and quick actions`
- Warten auf Review (User testet alle Items)

### Sub-Schritt D: Datensatz-Suche (Ärzte, Pläne, Stationen)

**D.1 Entity-Items-Hook**
- `frontend/src/features/command-palette/items/useEntityItems.ts`
- Kombiniert die bestehenden Entity-Hooks (`useDoctors`, `usePlans`,
  `useDepartments`) mit `enabled: isOpen`. `isOpen` aus
  `useCommandPalette()`.
- Falls die existierenden Hooks `enabled` nicht als Parameter
  unterstützen, **nicht** die Hooks anpassen — stattdessen `useQuery`
  direkt im neuen Hook aufrufen mit den gleichen Query-Keys.
  Doppelte Cache-Einträge vermeiden, indem die Query-Key-Objekte
  (`doctorKeys`, `planKeys`, `departmentKeys`) wiederverwendet werden.
- Output: drei Arrays `doctorItems`, `planItems`, `departmentItems`,
  jeweils gemappt auf `CommandItemDef` aus C.1.
- `value`-Strategie für `CommandItem`: `\`${item.name} ${item.id}\``,
  damit Fuzzy-Search Namen und ID matched.

**D.2 onSelect-Handler**
- Doctor → `navigate(\`/doctors/\${id}\`)`
- Plan → `navigate(\`/plans/\${id}\`)`
- Department → `navigate('/departments')` (Departments hat in der
  aktuellen Code-Basis keine Detail-Route — Übersicht reicht)

**D.3 CommandPalette erweitern**
- Drei zusätzliche `CommandGroup`: "Ärzte", "Pläne", "Stationen".
- Pro Gruppe Anzeige-Limit 10 (clientseitig per `.slice(0, 10)`).
- Bei leerem Suchstring trotzdem rendern, damit Browse-Use-Case
  funktioniert.

**D.4 Akzeptanzkriterien für Sub-Schritt D**
- [x] `useEntityItems` lädt erst beim Öffnen der Palette
- [x] Drei Gruppen werden gerendert, Limit 10 sichtbar
- [x] Fuzzy-Search findet Datensätze über Name und ID
- [x] Klick auf einen Eintrag navigiert zur Detail-/Übersichts-Route
- [x] Empty-State `<CommandEmpty>Keine Treffer</CommandEmpty>` bei
      keinem Match

**Stop-Gate nach Sub-Schritt D:**
- Commit: `feat: M1-012/D entity search`
- Warten auf Review (User testet Suche über echte Daten)

### Sub-Schritt E: Recents (localStorage)

**E.1 Storage-Adapter**
- `frontend/src/features/command-palette/recents.ts`
- API:
  ```typescript
  export interface RecentItem { id: string; label: string; group: string }
  export function getRecents(): RecentItem[]
  export function pushRecent(item: RecentItem): void
  export function clearRecents(): void
  ```
- Storage-Key: `dp-command-palette-recents`
- `pushRecent`: prepend, dedupliziere per `id`, cap auf 5 Einträge.
- JSON-Parse-Fehler abfangen (`try/catch`), bei Fehler leere Liste
  zurückgeben — defensive gegen manipulierten Storage.

**E.2 Recents in CommandPalette**
- Beim Open: `getRecents()` lesen.
- Recents als oberste `CommandGroup` mit `heading="Zuletzt verwendet"`
  rendern, **nur** wenn:
  - `inputValue` leer ist, UND
  - `recents.length > 0`
- Jeder `onSelect`-Handler (in C, D) ruft vor Navigation
  `pushRecent({ id, label, group })`. Damit Recents auch
  Quick-Actions enthalten, nicht nur Navigation/Datensätze.

**E.3 Re-Navigation aus Recents**
- Recent-Items haben keinen eigenen `onSelect` gespeichert — beim
  Rendern wird per `id` in den aktiven Item-Listen (navigation +
  actions + entities) nachgeschlagen. Wenn der Eintrag dort nicht
  mehr existiert (z.B. Arzt gelöscht), Item ausblenden und
  `clearRecents`-Eintrag stillschweigend entfernen.

**E.4 Akzeptanzkriterien für Sub-Schritt E**
- [x] `recents.ts` mit getRecents/pushRecent/clearRecents
- [x] Recents-Gruppe erscheint nur bei leerem Input und vorhandenen
      Recents
- [x] Dedup per `id`, max 5 Einträge
- [x] Auswahl eines Recent-Items navigiert zum Ziel und aktualisiert
      die Recents-Liste
- [x] Verwaiste Recents (Item nicht mehr verfügbar) verschwinden
      transparent

**Stop-Gate nach Sub-Schritt E:**
- Commit: `feat: M1-012/E recents`
- Warten auf Review

### Sub-Schritt F: CommandBar-Integration und plattform-spezifischer Glyph

**F.1 Toast-Stub durch echte Aktion ersetzen**
- `frontend/src/components/dp/CommandBar.tsx:43-45`:
  ```typescript
  const { open } = useCommandPalette()
  function handleSearchClick() { open() }
  ```
- Import `useCommandPalette` ergänzen, `toast`-Import entfernen falls
  sonst nicht mehr benötigt.

**F.2 Plattform-spezifischer Glyph**
- Zeile 103-105 (Glyph-Span) ersetzen:
  ```tsx
  import { getModifierGlyph, isMac } from '@/lib/platform'
  ...
  <span className="font-mono text-[10px] bg-line rounded px-1 py-0.5 leading-none">
    {isMac() ? `${getModifierGlyph()}K` : `${getModifierGlyph()}+K`}
  </span>
  ```
  Mac: `⌘K` (kein Plus, wie auf macOS üblich).
  Win/Linux: `Strg+K` (mit Plus, wie auf Windows üblich).

**F.3 Akzeptanzkriterien für Sub-Schritt F**
- [x] Klick auf den Suchbutton öffnet die Palette (kein Toast mehr)
- [x] Glyph zeigt `⌘K` auf Mac-Mock und `Strg+K` auf Win-Mock
- [x] Keine M1-012-Verweise mehr im CommandBar-Code
- [x] Hotkey und Klick sind funktional äquivalent

**Stop-Gate nach Sub-Schritt F:**
- Commit: `feat: M1-012/F commandbar wiring and platform glyph`
- Warten auf Review (User testet auf Win, optional Mac)

### Sub-Schritt G: Tests, Cleanup, Doku, Milestone-Abschluss

**G.1 Tests** (`vitest`)
- `frontend/src/lib/__tests__/platform.test.ts`
  - `isMac()` mit `navigator.platform = 'MacIntel'` → `true`
  - `isMac()` mit `navigator.platform = 'Win32'` → `false`
  - `getModifierGlyph()` liefert `'⌘'` bzw `'Strg'`
- `frontend/src/features/command-palette/__tests__/CommandPaletteProvider.test.tsx`
  - Render mit Provider, `userEvent.keyboard('{Meta>}k{/Meta}')`
    öffnet die Palette
  - `userEvent.keyboard('{Control>}k{/Control}')` öffnet auch
  - `Esc` schließt
  - `useCommandPalette` außerhalb Provider wirft
- `frontend/src/features/command-palette/__tests__/CommandPalette.test.tsx`
  - Render mit Mock-Items, `userEvent.type` filtert
  - Klick auf Navigation-Item triggert `useNavigate`-Mock
  - Quick-Action-Klick triggert `onSelect`-Mock
  - `<CommandEmpty>` bei keinem Match sichtbar
- `frontend/src/features/command-palette/__tests__/recents.test.ts`
  - `pushRecent` dedupliziert
  - cap auf 5
  - JSON-Parse-Fehler liefert leere Liste
- `frontend/src/components/dp/__tests__/CommandBar.test.tsx`
  (Update bestehender Tests):
  - Glyph zeigt `⌘K` bei Mac-Mock (`navigator.platform = 'MacIntel'`)
  - Glyph zeigt `Strg+K` bei Win-Mock
  - Klick auf Trigger ruft `open()` (statt Toast)

**G.2 Cleanup**
- Alte M1-012-Verweise in `CommandBar.tsx` (Toast-Text) sind in F
  bereits entfernt — nichts weiteres.
- Done-Tasks (`tasks/done/M1-010-…`) bleiben historisch unverändert.

**G.3 Dokumentation** (CLAUDE.md-Pflicht-Checkliste)
- `docs/decisions.md` neue ADRs:
  - „`cmdk` als Lib für Command Palette eingeführt"
  - „Globaler Hotkey akzeptiert `metaKey || ctrlKey`, Glyph
    plattform-spezifisch via `lib/platform.ts`"
  - „Datensatz-Items der Palette werden lazy-geladen
    (`enabled: isOpen`), kein Prefetch"
  - „Recents in `localStorage` (`dp-command-palette-recents`), max 5,
    kein Server-State"
- `docs/open-questions.md`: keine bisher offene Frage betroffen —
  überspringen.
- `docs/constraints.md`: kein Constraint-Bezug — überspringen.
- `CLAUDE.md` neuer Abschnitt „Frontend — Command-Palette-Pattern
  (M1-012)":
  - Hook-Konvention: `useCommandPalette` wirft außerhalb Provider
  - Hotkey-Pattern: ein Listener, beide Modifier
  - Plattform-Helper: einmalig in `lib/platform.ts`, nicht verstreut
  - Entity-Items lazy via `enabled: isOpen`, Query-Key-Objekte
    aus den jeweiligen Features wiederverwenden
- `tasks/open/M1-012-command-palette.md` → `tasks/done/`, alle
  `[ ]` durch `[x]` ersetzen, Abschnitt „Abschluss" mit Datum,
  Branch-Name, Commit-Liste, Testergebnis anhängen.

**G.4 Lint, Type-Check, Test-Run**
```powershell
cd D:\Softwareprojekte\Dienstplaner\frontend
pnpm type-check
pnpm lint
pnpm vitest run
```
Alles grün.

**G.5 Akzeptanzkriterien für Sub-Schritt G**
- [x] Tests aus G.1 implementiert und grün
- [x] ADRs in `docs/decisions.md`
- [x] `CLAUDE.md` um neuen Pattern-Abschnitt ergänzt
- [x] Briefing in `tasks/done/` verschoben, Checklisten abgehakt,
      Abschluss-Abschnitt angehängt
- [x] `pnpm type-check`, `pnpm lint`, `pnpm vitest run` grün

**Stop-Gate nach Sub-Schritt G:**
- Commit: `chore: M1-012/G tests docs and cleanup`
- Final-Review durch User
- Merge in main (Standard-Sequenz aus M1-010-Briefing übernehmen)

## Akzeptanzkriterien (Gesamtaufgabe)

- [x] `cmdk` ist als Dependency in `frontend/package.json` eingetragen
- [x] `frontend/src/components/ui/command.tsx` exportiert alle
      Command-Bausteine über Atelier-Tokens
- [x] `frontend/src/lib/platform.ts` mit `isMac`,
      `getModifierKey`, `getModifierGlyph`
- [x] `frontend/src/features/command-palette/CommandPaletteProvider.tsx`
      mit globalem Hotkey-Listener
- [x] `frontend/src/features/command-palette/CommandPalette.tsx`
      rendert alle Gruppen (Recents, Navigation, Aktionen, Ärzte,
      Pläne, Stationen)
- [x] Recents in `localStorage`, max 5, deduped per `id`
- [x] `CommandBar.tsx` öffnet die Palette per Klick und zeigt
      plattform-spezifischen Glyph
- [x] Hotkey `Meta+K` und `Ctrl+K` öffnen die Palette
- [x] Alle Tests grün, `type-check` und `lint` grün
- [x] ADRs in `docs/decisions.md`, Pattern-Abschnitt in `CLAUDE.md`
- [x] Briefing in `tasks/done/` mit Abschlussnotiz

## Out of Scope

- Page-spezifische Quick-Actions („Diesen Plan exportieren" auf
  Detailseite) — Folge-Milestone
- Backend-getriebene Volltext-Suche über Notes, Patienten-Daten o.ä.
- Recents-Sync zwischen Geräten (lokal-only App)
- Aktions-Shortcuts (z.B. `G H` für „Go Heute") — gesonderter
  Folge-Milestone
- Eigene Theme-Variante der Palette (nutzt Atelier-Tokens)
- Settings-Page für Storage-Verwaltung (`clearRecents` ist nur API,
  kein UI in M1-012)
- Plan-Generator-Pulse oder ähnliche dynamische Tile-States
- Backend-Änderungen jeder Art

## Bekannte Stolperfallen

- **`cmdk` `Command.Dialog` braucht eigenen Portal-Root.** In Tests
  mit `@testing-library/react` entweder den Portal-Container ans
  Test-`container` mounten oder die `Command`-Komponente direkt ohne
  Dialog-Wrapper testen.
- **Hotkey-Konflikt:** Manche Browser-Konfigurationen binden `Ctrl+K`
  an die Adressleiste. `e.preventDefault()` nach erfolgreichem Match
  ist Pflicht — sonst flackert die Adressleiste auf. Bei Vite-Dev-
  Server selten ein Problem, in Production-Builds testen.
- **`navigator.platform` ist deprecated**, aber funktioniert. Modernes
  API `navigator.userAgentData.platform` zuerst probieren, dann
  Fallback. Bei `undefined` defensiv auf `false` defaulten — nie raten.
- **TanStack-Query `enabled: isOpen`:** beim Schließen werden Queries
  „inactive", beim erneuten Öffnen aus dem Cache geliefert (stale-
  while-revalidate). Den `QueryClient`-Default-StaleTime nicht im
  Palette-Hook überschreiben — globale Konvention respektieren.
- **`userEvent.keyboard` für Meta/Ctrl:** Syntax ist
  `'{Meta>}k{/Meta}'` bzw `'{Control>}k{/Control}'`. JSDOM rendert
  keine echten Focus-Highlights — Selektion per `value`-Attribut
  testen, nicht per visuellem State.
- **Provider-Reihenfolge in `App.tsx`:** `CommandPaletteProvider`
  muss **innerhalb** von `BrowserRouter` sitzen (weil `useNavigate`
  in Item-Handlern aufgerufen wird), aber **oberhalb** der `<Routes>`.
  Falsche Reihenfolge crasht beim ersten Item-Klick.
- **MiniRail-Routes-Konstante:** Sub-Schritt C empfiehlt die Liste zu
  extrahieren. Wenn der Extract zu viel Scope öffnet (andere Imports,
  Tests, etc.), Liste verdoppeln und TODO-Kommentar — kein
  Scope-Creep im M1-012-Briefing.
- **`pushRecent` bei Item ohne Recents-Eignung:** alle Items erhalten
  `pushRecent`. Wenn das später unerwünscht ist (z.B. Settings-Item
  soll nicht in Recents), Flag `excludeFromRecents?: boolean` am
  Item-Def nachrüsten — nicht in M1-012.
- **Storage-Migration:** Wenn der Recent-Item-Shape später erweitert
  wird, alte Einträge defensive parsen (Try-Catch, fehlende Felder
  toleranter Default). Nicht jetzt vorbauen, nur im Hinterkopf.
- **Lint-Regel `no-restricted-imports`:** Vorhandene shadcn-Komponenten
  importieren bisher via `@/components/ui/…`. Den neuen `command.tsx`
  exakt gleich strukturieren — sonst ESLint motzt.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

OK-Annahmen:
- `useDoctors`, `usePlans`, `useDepartments` existieren oder lassen
  sich aus den jeweiligen Feature-Verzeichnissen ableiten. Wenn sie
  fehlen, Query-Key-Objekte (`doctorKeys`, etc.) sind vorhanden und
  `useQuery` direkt aufrufen.
- shadcn `Dialog` ist bereits installiert (M1-010 hat ihn implizit
  über andere Komponenten gezogen). Wenn nicht, in Sub-Schritt A
  zusätzlich `@radix-ui/react-dialog` installieren — separater Commit
  und Hinweis im Briefing-Kommentar.
- `useNavigate` aus `react-router-dom` ist im Codebase im Einsatz
  (M2-003 verwendet Router-Navigation). Falls Routing-Lib eine andere
  ist, in Sub-Schritt B Hook-Aufruf anpassen.
- Recents werden persistent in `localStorage` gespeichert, nicht in
  `sessionStorage` — Single-User-App, persistenter Komfort ist
  erwünscht.
- Die Quick-Action „Neuer Plan" navigiert zur Plan-Liste. Falls dort
  ein Dialog für neue Pläne existiert (Hook oder URL-State), den
  triggern — sonst nur Navigation und ein Hinweis-Kommentar im Code.
- Mac-User wird die fertige Implementierung auf Mac selbst testen.
  M1-012-Verifikation läuft primär auf Windows.
- Keine i18n nötig — Strings hartcodiert deutsch wie der Rest der App.

## Abschluss

**Datum:** 2026-05-26
**Branch:** task/M1-012-command-palette
**Commits:**
- `feat: M1-012/A cmdk setup and platform helper`
- `feat: M1-012/B palette shell and global hotkey`
- `fix: M1-012/B import path CommandPalette uses barrel re-export`
- `feat: M1-012/C navigation and quick actions`
- `fix: M1-012/C icon rendering pattern uppercase variable`
- `feat: M1-012/D entity search doctors plans departments`
- `feat: M1-012/E recents localStorage max 5 deduped`
- `feat: M1-012/F commandbar wiring and platform glyph`
- `chore: M1-012/G tests docs and cleanup`

**Testergebnis:** 195 Tests grün (35 Test-Dateien), 0 Fehler
**ADRs:** ADR-072 bis ADR-075 in `docs/decisions.md`

**Abweichungen vom Briefing:**
- Echte API-Typen (`Doctor.name` statt `first_name`/`last_name`, `Plan.valid_from`/`valid_to` statt `start_date`/`end_date`) weichen von Briefing-Beschreibung ab — Implementierung nutzt korrekte Felder aus generiertem OpenAPI-Schema.
- `useEntityItems` ruft `useQuery` direkt auf (mit `enabled`-Option) statt die Feature-Hooks zu wrappen, da diese kein `enabled`-Param exponieren.

Bei Unklarheit: zuerst `CLAUDE.md` und vorhandene Feature-Hooks lesen,
dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:
```powershell
cd D:\Softwareprojekte\Dienstplaner
git status                  # sauber?
git checkout main
git pull origin main
git checkout -b task/M1-012-command-palette
```

Nach Abschluss aller Sub-Schritte:
```powershell
git push origin task/M1-012-command-palette

git checkout main
git pull origin main
git merge task/M1-012-command-palette
git push origin main

move tasks\open\M1-012-command-palette.md tasks\done\
git add .
git commit -m "chore: archive completed task M1-012"
git push
```

`pnpm generate-api` nicht nötig, M1-012 hat keine Backend-Änderungen.
