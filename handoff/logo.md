# Logo · Sortier-D Schicht

> **Aufgabe für Claude Code:** das alte „Kalenderfeld"-Logo durch die
> neue Marke „Sortier-D · Schicht" ersetzen — eine D-Silhouette, deren
> Bogen aus fünf sortierten Schicht-Balken besteht. Vorlage:
> `handoff/logo-mark.tsx` (fertig getypte React-Komponente),
> Visuelle Referenz: `Logo Runde 2.html` und `Sortier-D Evolution.html`
> im Design-Projekt (Variante „Schicht").

---

## 0 · Was ist anders

| Bisher (Kalenderfeld) | Neu (Sortier-D · Schicht) |
|---|---|
| Kalender-Rahmen mit Header-Linie | Großes Initial-D — Säule links + Bogen rechts |
| Drei Gantt-Balken unter dem Header | Fünf sortierte Balken, deren Längen den D-Bogen zeichnen |
| Mittlerer Balken voll, oben/unten dimm | Jeder Balken in 2–3 Schicht-Segmente (Früh/Spät/Nacht); pro Reihe **eines** gesetzt, andere sind Kandidaten (opacity 0.32) |
| Pulse-Animation auf 3 Bars | Pulse-Animation auf 5 Segmente, sequenziell top → bottom |

**Inhaltlich** transportiert die neue Marke: *Ordnung ins Unübersichtliche
+ Schichten + Initial-D*. Sie funktioniert als Logo (großes Format, Wortmarke)
**und** als Live-Status-Indikator (Pulse beim Plan-Generieren).

---

## 1 · Dateien, die anzufassen sind

```
frontend/src/components/dp/LogoMark.tsx           ← ersetzen (siehe §2)
frontend/src/index.css (oder globale Stylesheet)  ← Keyframes ergänzen (siehe §3)
frontend/src/components/dp/Rail.tsx               ← Verwendung anpassen (siehe §4)
frontend/src/components/dp/TopBar.tsx             ← Wordmark einsetzen (siehe §4)
handoff/ACCEPTANCE.md                             ← Akzeptanz-Block 1c aktualisieren (siehe §6)
```

Die fertige Komponente liegt bereits in **`handoff/logo-mark.tsx`** —
ein 1:1-Drop-in. Inhaltlich nichts dazudichten, nur einsetzen.

---

## 2 · LogoMark.tsx ersetzen

**Quelle:** `handoff/logo-mark.tsx`.
**Ziel:** `frontend/src/components/dp/LogoMark.tsx`.

Die Datei exportiert drei Symbole:

```tsx
export function LogoMarkSvg({ size?, fg? })       // pures SVG, ohne Container
export function LogoMark({ size?, bg?, fg?, radius?, pulse?, ariaLabel? })
export function LogoWordmark({ tone?, size?, pulse? })  // SVG + Schriftzug
```

**Default-Werte (kein Anpassbedarf, nur zur Info):**

* `size = 38`
* `bg = '#C66A3D'` (Akzent · Terrakotta)
* `fg = '#FFF8EF'` (Papier · Creme)
* `radius = 12`
* `pulse = false`
* `ariaLabel = 'Dienstplaner'`

**Geometrie (für visuelle Verifikation):**

* viewBox `0 0 40 40`
* Säule: `<rect x=7 y=8 width=3.4 height=24 rx=1.6>`
* Bogen-Balken: 5 Reihen, y-Versatz 5, Höhe 4
  ```ts
  const rows = [
    { w: 10, set: 2 },
    { w: 16, set: 2 },
    { w: 18, set: 1 },
    { w: 16, set: 0 },
    { w: 10, set: 0 },
  ]
  ```
* Pro Reihe 2 (w<16) oder 3 (w≥16) Schicht-Segmente, segGap 0.7
* Gesetztes Segment: voll deckend + `data-bar="1..5"`
* Kandidat-Segmente: `opacity={0.32}`, kein `data-bar`

---

## 3 · Keyframes für Pulse-Animation

In `frontend/src/index.css` (oder ein globales Stylesheet) ergänzen:

```css
@keyframes dp-logo-bar-pulse {
  0%, 70%, 100% { opacity: 1; }
  35%           { opacity: 0.35; }
}

[data-pulse] .dp-logo-bars [data-bar] {
  animation: dp-logo-bar-pulse 1.6s ease-in-out infinite;
}
[data-pulse] .dp-logo-bars [data-bar="1"] { animation-delay: 0s;    }
[data-pulse] .dp-logo-bars [data-bar="2"] { animation-delay: 0.12s; }
[data-pulse] .dp-logo-bars [data-bar="3"] { animation-delay: 0.24s; }
[data-pulse] .dp-logo-bars [data-bar="4"] { animation-delay: 0.36s; }
[data-pulse] .dp-logo-bars [data-bar="5"] { animation-delay: 0.48s; }

@media (prefers-reduced-motion: reduce) {
  [data-pulse] .dp-logo-bars [data-bar] { animation: none; }
}
```

**Wichtig:** das Pulse-Selector-Set greift **nur**, wenn der äußere
Wrapper `data-pulse=""` trägt (das macht `<LogoMark pulse />` automatisch).
Ohne `pulse` ist das SVG vollständig statisch — keine CPU-Last.

---

## 4 · Verwendung im UI

### 4.1 Rail (`Rail.tsx`)

Der bisherige Tile mit dem Newsreader-Italic „D" wird ersetzt durch:

```tsx
import { LogoMark } from '@/components/dp/LogoMark'

// im Rail, oben:
<LogoMark size={38} radius={12} />
```

Wenn die App gerade einen Plan generiert (Selektor / Store-Flag):

```tsx
<LogoMark size={38} radius={12} pulse={isGenerating} />
```

### 4.2 Top-Bar (`TopBar.tsx`)

Newsreader-Italic-„Dienstplaner" bekommt links das Tile-Logo:

```tsx
<div className="flex items-center gap-2.5">
  <LogoMark size={32} radius={10} />
  <span className="font-serif italic text-[22px] tracking-tight">
    Dienstplaner
  </span>
  <span className="text-[11px] uppercase tracking-wider text-ink3">
    Neurologie · UKSH Lübeck
  </span>
</div>
```

Alternativ den fertigen Wordmark einsetzen:

```tsx
import { LogoWordmark } from '@/components/dp/LogoMark'
<LogoWordmark size={32} />
```

### 4.3 Favicon / App-Icon

* 32 × 32 PNG exportieren aus `LogoMark` mit `size={32}`.
* Genauso 180 × 180 (`apple-touch-icon`) und 512 × 512 (`maskable`).
* Hintergrund-Bleed: 12 % Padding um das Glyph für Maskable-Compliance.

---

## 5 · Was unverändert bleibt

* Farb-Tokens (`#C66A3D` Akzent, `#FFF8EF` Papier, `#26221C` Ink)
* Newsreader-Schriftfamilie für „Dienstplaner" + Italic-Akzent auf
  dem letzten Wortteil
* `radius = 12` für Rail-Größe, `size * 0.32` als Verhältnis im Wordmark
* `aria-label="Dienstplaner"` auf dem äußeren Span

Wenn etwas davon angetastet werden müsste: **vorher rückfragen**, nicht
mit-refactorn.

---

## 6 · Akzeptanz

In `handoff/ACCEPTANCE.md` den bisherigen Punkt unter „Schritt 4 · Rail / Top-Bar":

```
- [ ] Logo-Tile oben hat `bg-accent`, Newsreader-Italic „D" in Papierfarbe.
```

ersetzen durch:

```
- [ ] Logo-Tile oben hat `bg-accent`, zeigt die "Sortier-D · Schicht"-Marke
      aus `LogoMark.tsx` in Papierfarbe.
- [ ] Bei laufender Plan-Generierung trägt der Wrapper `data-pulse=""`,
      und die fünf gesetzten Schicht-Segmente pulsieren sequenziell top → bottom.
- [ ] `prefers-reduced-motion: reduce` deaktiviert die Pulse-Animation.
- [ ] Wordmark in der Top-Bar zeigt das Tile-Logo links neben
      "Dienst*planer*" (Newsreader, Italic-Akzent auf "planer").
- [ ] Favicon 32 px ist die Marke ohne Tile-Background, in Akzent-Farbe.
```

---

## 7 · Quick-Prompt für Claude Code

> Lies `handoff/grid-affordance.md` … **und zusätzlich** `handoff/logo.md`.
>
> Schritt 1 (Logo): Ersetze `frontend/src/components/dp/LogoMark.tsx`
> 1:1 mit dem Inhalt aus `handoff/logo-mark.tsx`. Ergänze die Keyframes
> aus §3 in `frontend/src/index.css`. Setze das neue `<LogoMark />`
> in `Rail.tsx` (size 38, radius 12) und in `TopBar.tsx` (size 32, radius 10
> neben dem Schriftzug) ein. Wenn der Plan-Generator-Status verfügbar ist,
> verdrahte `pulse={isGenerating}` im Rail-Tile. Aktualisiere
> `handoff/ACCEPTANCE.md` gemäß §6.
>
> Schritt 2 (Grid-Affordance): wie in `handoff/grid-affordance.md` §7
> beschrieben.
>
> Schritt 3: visuell gegen `Logo Runde 2.html` (Variante „Schicht") und
> `Sortier-D Evolution.html` (Karte „Schicht") im Design-Projekt verifizieren.
