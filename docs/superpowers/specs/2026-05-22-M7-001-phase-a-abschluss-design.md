# M7-001 — Phase-A-Abschluss & Polish

**Datum:** 2026-05-22  
**Branch:** task/M7-001-phase-a-abschluss  
**Abhängigkeiten:** M3-001, M4-001, M5-001, M6-001 (alle ✅)

---

## Ziel

Phase A formal abschließen. Vier konkrete Deliverables:
1. Neues Logo (Sortier-D · Schicht) in der Rail
2. Plan-Grid-Affordance (3 Ebenen: Dot-Grid, Crosshair, Drag-Modus)
3. Arzt-Titel in der Ärzte-Übersicht
4. Backend-Lifecycle-Smoke-Test + vollständiger Doku-Sweep

---

## Sub-Schritt A — Logo

**Commit:** `feat(ui): M7-001/A Sortier-D Logo`

### Dateien
| Aktion | Datei |
|--------|-------|
| Ersetzen (1:1) | `frontend/src/components/dp/LogoMark.tsx` ← `handoff/logo-mark.tsx` |
| Ergänzen | `frontend/src/index.css` — CSS-Keyframes `dp-logo-bar-pulse` |
| Ändern | `frontend/src/components/layout/Rail.tsx` — Logo-Tile |
| Ändern | `handoff/ACCEPTANCE.md` — neuer Block „Schritt 6a · Logo" |

### Spezifikation
- `LogoMark.tsx` exportiert `LogoMarkSvg`, `LogoMark`, `LogoWordmark`
- `LogoMark`-Default-Props: `size=38`, `bg='#C66A3D'`, `fg='#FFF8EF'`, `radius=12`, `pulse=false`
- CSS-Selector `[data-pulse] .dp-logo-bars [data-bar]` — Animation nur wenn `pulse=true`; statisch sonst
- `@media (prefers-reduced-motion: reduce)`: `animation: none`
- Rail: `<LogoMark size={38} radius={12} />` ersetzt das Newsreader-Italic-„D"-Div
- `pulse={isGenerating}` — vorerst `false` (kein Plan-Generator-Store in Phase A)
- TopBar.tsx existiert nicht → überspringen (logo.md §4.2 Fallback)

### Akzeptanz
Checkliste aus `handoff/logo.md §6` als neuen Block in `handoff/ACCEPTANCE.md` eintragen.  
Kein neuer Vitest-Test (visuell).

---

## Sub-Schritt B — Plan-Grid-Affordance

**Commit:** `feat(ui): M7-001/B Grid-Affordance A+D+E`

### Dateien
| Aktion | Datei |
|--------|-------|
| Ändern | `frontend/src/features/plans/components/PlanGrid.tsx` |
| Ändern | ShiftCell (in PlanGrid.tsx oder eigene Datei, je nach aktuellem Stand) |
| Ändern | `handoff/ACCEPTANCE.md` — neuer Block „Schritt 6b · Plan-Grid-Affordance" |

### Ebene A — Dot-Grid (Ruhezustand)
- 5×5 px Punkt, `border-radius: 999px`, zentriert in leerer Zelle
- Farbe Werktag: `#D6CCB6` (Token `colors.line2`)
- Farbe Wochenende: `#CBC2AC`
- Nicht in Header-Zeile (Tageszahl-Spalte)

### Ebene D — Crosshair-Hover
State auf PlanGrid-Level:
```tsx
const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
```
- Row-Tint: `#FAF0DC`
- Header-Cell-Highlight: Hintergrund `#FBE5D6`, Farbe `#7A3414`
- Zielzelle (leer): gestrichelter Rahmen 1.5px `#C66A3D`, BG `rgba(198,106,61,0.08)`, `border-radius: 7px`, `+`-Glyph 14px `#C66A3D` weight 500
- Dot aus Ebene A in der Hover-Zielzelle ausblenden
- Filled-Zelle: Row + Header markiert, kein `+`-Glyph
- Keyboard-Fokus: löst denselben Crosshair aus
- `transition: background 80ms ease-out, border-color 80ms ease-out`
- `prefers-reduced-motion`: Dauer 0ms

### Ebene E — Drag-Modus
| Zustand | Hintergrund | Rahmen |
|---------|-------------|--------|
| valid | `rgba(122,158,85,0.12)` | `1px dashed rgba(122,158,85,0.55)` |
| invalid | `rgba(0,0,0,0.04)` + 45°-Schraffur CSS | keiner |
| hover-target | `rgba(198,106,61,0.16)` | `1.5px solid #C66A3D` |

Schraffur:
```css
background-image: repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.06) 4px 5px);
```
Avatar-Preview in Hover-Zielzelle: `<Avatar size={18}>`, opacity 0.95.

### Layer-Priorität (Switch in ShiftCell)
```
1. filled   → ShiftChip rendern
2. dragging → valid/invalid/hover-target, Punkt aus
3. hover    → Crosshair-Ziel, Punkt aus
4. idle     → Punkt aus Ebene A
```

### Akzeptanz
Checklisten A, D, E aus `handoff/grid-affordance.md` als Block in `handoff/ACCEPTANCE.md`.

---

## Sub-Schritt C — Arzt-Titel in Ärzte-Übersicht

**Commit:** `feat(ui): M7-001/C Titel in Ärzte-Übersicht`

### Dateien
| Aktion | Datei |
|--------|-------|
| Ändern | `frontend/src/features/doctors/DoctorCard.tsx` |
| Erweitern | `frontend/src/features/doctors/tests/DoctorCard.test.tsx` |

### Spezifikation
- `doctor.title` ist bereits in `DoctorWithRelations` (`title?: string | null`)
- Anzeige: `{doctor.title ? `${doctor.title} ` : ''}{doctor.name}` — gleicher Schriftstil, gleiche Zeile
- Nur in `DoctorCard.tsx` — nicht in Popover, nicht im Grid, nicht in anderen Listen
- Test: Case mit `title: 'Dr. med.'` und ohne Titel

---

## Sub-Schritt D — Backend-Smoke-Test

**Commit:** `test: M7-001/D Plan-Lifecycle-Smoke`

### Dateien
| Aktion | Datei |
|--------|-------|
| Neu | `backend/tests/integration/test_plan_lifecycle_smoke.py` |

### Flow
```
1. POST /api/doctors          → Doctor anlegen
2. POST /api/plans            → Plan anlegen (Monat des Doctors)
3. GET  /api/shift-types      → ersten ShiftType holen
4. POST /api/plans/{id}/shifts → Shift anlegen
5. PATCH /api/shifts/{id}     → Shift belegen (doctor_id)
6. GET  /api/plans/{id}/conflicts → 200, conflicts-Array vorhanden
7. GET  /api/plans/{id}/export    → 200, Content-Type xlsx
```
- Nutzt bestehende `conftest.py` (TestClient, db-Session)
- Keine neuen Fixtures nötig
- Jeder Schritt assertiert HTTP-Status

---

## Sub-Schritt E — Doku-Sweep

**Commit:** `docs: M7-001/E vollständiger Doku-Sweep`

### Dateien
| Prüfen / Aktualisieren |
|------------------------|
| `README.md` |
| `docs/architecture.md` |
| `docs/data-model.md` |
| `docs/constraints.md` |
| `docs/design-implementation.md` |
| `backend/app/services/department_service.py` (TODO:54) |

### Konkrete Änderungen
- **README.md:** Status-Zeile auf „Phase A abgeschlossen"; Platzhalter-Seiten-Referenzen entfernen; Setup-Anleitung verifizieren
- **architecture.md:** Verzeichnisstruktur gegen aktuellen Code abgleichen (features/plans/components/ etc.)
- **data-model.md:** Doctor `title`-Feld + Migration 0007 dokumentieren
- **constraints.md:** M3–M6 implementierte Constraints ergänzen (Rotation-Exklusivität, DnD, Availability, Tarif-Pipeline, Excel-Export)
- **design-implementation.md:** Auf Aktualität prüfen; veraltete Abschnitte aktualisieren
- **department_service.py:54:** TODO auflösen — Department-Nutzung in Plänen läuft über `RotationAssignment`; Kommentar präzisieren oder Guard implementieren

---

## Sub-Schritt F — Milestone-Abschluss

**Commit:** `docs: M7-001/F Abschluss + ADRs`

### Dateien
| Aktion | Datei |
|--------|-------|
| Neu | `tasks/done/M7-001-phase-a-abschluss.md` (aus tasks/open/ verschieben) |
| Ergänzen | `docs/decisions.md` — neue ADRs |
| Ergänzen | `docs/open-questions.md` — beantwortete Fragen schließen |
| Ergänzen | `CLAUDE.md` — neue Patterns |
| Aktualisieren | `docs/roadmap.md` — M7 → ✅ |

### ADRs (Vorschau)
- ADR-065: LogoMark Sortier-D ersetzt Newsreader-Italic-„D" in Rail
- ADR-066: Plan-Grid-Affordance (3 Ebenen A/D/E) per Handoff-Spec
- ADR-067: Doctor-Titel nur in DoctorCard (Ärzte-Übersicht), nicht systemweit

---

## Nicht in Scope

- TopBar.tsx erstellen (existiert nicht, logo.md Fallback greift)
- `pulse={isGenerating}` verdrahten (kein Plan-Generator-Store in Phase A)
- OQ-003, OQ-004, OQ-006, OQ-007 lösen (bleiben offen bis Domänenklärung)
- Playwright E2E
- Neue Bibliotheken
