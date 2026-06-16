# Design: Besetzungsmodus-Erweiterungen

**Datum:** 2026-06-16  
**Status:** Genehmigt  

## Scope

Fünf zusammenhängende Erweiterungen des Besetzungsmodus:

1. Neue AbsenceTypes EA / INA-EA (Einarbeitung)
2. Neue AbsenceType UNBESETZT (X-Markierung)
3. DIV (SONSTIGES) als Halde für Import-Fragmente
4. Import: unmatched Codes → DIV-Abwesenheit mit Notiz
5. Zell-Klick öffnet Details-Tab mit Schicht- und Abwesenheitsdaten

---

## 1. Neue AbsenceTypes

### Enum-Werte (Backend)

```python
# backend/app/models/absence.py — AbsenceType(enum.StrEnum)
EINARBEITUNG     = "EINARBEITUNG"      # Kürzel: EA
EINARBEITUNG_INA = "EINARBEITUNG_INA"  # Kürzel: INA-EA
UNBESETZT        = "UNBESETZT"         # visuell: X-Kreuz
```

### Semantik

- **EA**: Arzt ist in stationärer Einarbeitung. Nur Besetzungsmodus relevant.
- **INA-EA**: Arzt ist in INA-Einarbeitung. Nur Besetzungsmodus relevant.
- **UNBESETZT**: Rotation-Slot ist an diesem Tag bewusst nicht besetzt. Kein Arzt-Dienst, kein Abwesenheitsgrund.

Alle drei blockieren INA-Verfügbarkeit automatisch (Phase A: alle Abwesenheiten blockieren über `ina_availability_service` — kein Sonderfall nötig).

### Alembic-Migration

SQLite speichert den Enum als String (`native_enum=False, length=50`). Die Spalte braucht keine strukturelle Änderung. Die Migration fügt nur die neuen Werte in einen Kommentar ein und setzt `length=50` auf das bestehende Enum-Objekt. Keine DDL-Änderung erforderlich.

### Drag-Chips im PlanModeBar

Alle drei Typen erscheinen **nur im Besetzungsmodus** als draggable Chips neben dem Nachtwoche-Chip.

```
| Schichttypen … | Nachtwoche | EA | INA-EA | ⊠ Unbesetzt | | Abwesenheiten … |
```

Im INA-Modus: EA, INA-EA und UNBESETZT-Chips werden nicht gerendert.

Technisch: neues `BESETZUNG_ONLY_ABSENCE_TYPES: AbsenceType[]` Array in `PlanModeBar.tsx`. Diese Chips werden nur bei `mode === 'besetzung'` gerendert.

### Zell-Darstellung UNBESETZT

Zelle zeigt ein diagonales Kreuz (X) über die gesamte Zellfläche:

```tsx
{/* SVG-Overlay für UNBESETZT */}
<svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
  <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
  <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
</svg>
```

Hintergrundfarbe: konfigurierbare Farbe aus `absenceColors['UNBESETZT']`. Kein Kürzel-Text.

---

## 2. Farbkonfiguration in Plan-Einstellungen

`absenceColors: Record<AbsenceType, string>` im App-Settings-Store erweitert sich automatisch mit neuen Enum-Werten.

`PlanSettingsModal.tsx` zeigt Farbfelder für alle 9 AbsenceTypes:

| Type | Label |
|---|---|
| URLAUB | Urlaub |
| KRANKHEIT | Krankheit |
| FORTBILDUNG | Fortbildung |
| ELTERNZEIT | Elternzeit |
| MUTTERSCHUTZ | Mutterschutz |
| SONSTIGES | Sonstiges (DIV) |
| EINARBEITUNG | Einarbeitung (EA) |
| EINARBEITUNG_INA | Einarbeitung INA (INA-EA) |
| UNBESETZT | Station unbesetzt |

Plus Springer-Farbe = 10 Farbfelder insgesamt.

Die statische Liste in `PlanSettingsModal.tsx` (aktuell 6 Einträge) wird auf alle 9 AbsenceTypes erweitert.

---

## 3. Import: EA / INA-EA

`DEFAULT_CODE_MAP` in `import_match_service.py` erhält zwei neue Einträge:

```python
"EA":     {"action": CodeDefaultAction.ABSENCE, "absence_type": AbsenceType.EINARBEITUNG},
"INA-EA": {"action": CodeDefaultAction.ABSENCE, "absence_type": AbsenceType.EINARBEITUNG_INA},
```

`UNBESETZT` wird **nicht** im Import-Mapping geführt — nur manuell setzbar.

---

## 4. Import: Unmatched Codes → DIV mit Notiz

### Problem

Nicht erkennbare Zellinhalte (z.B. `"Krank?"`, `"Sonderregelung"`, freie Memos) werden bisher als `UNMATCHED` markiert. Der Benutzer muss sie manuell mappen oder sie gehen verloren.

### Lösung

Unerkannte Codes bekommen als Default `ABSENCE + SONSTIGES`. Der Rohwert der Zelle wird als `notes` in der Abwesenheit gespeichert.

**Schema-Änderung** (`CodeEntry` in `excel_import.py`):
```python
default_note: str | None = None  # Rohwert für SONSTIGES-Abwesenheiten
```

**Analyse-Phase** (`import_match_service.py`):
```python
# Bisher: default_action=UNMATCHED
# Neu:
CodeEntry(
    raw=raw,
    default_action=CodeDefaultAction.ABSENCE,
    absence_type=AbsenceType.SONSTIGES,
    default_note=raw,   # Rohwert als spätere Notiz
    ...
)
```

**Commit-Phase** (`import_commit_service.py`):
```python
# Beim Erstellen von SONSTIGES-Abwesenheiten aus Import:
"notes": raw_code_value  # raw-Schlüssel aus resolutions dict
```

**Frontend** (`importTypes.ts`, `ImportDialog.tsx/CodeRow`):
- `CodeEntry`: `default_note?: string`
- `CodeRow`: bei SONSTIGES-Resolution zeigt Hinweis an: _"Notiz: «{default_note}»"_ (grau, klein)

### Verbleib von UNMATCHED

`CodeDefaultAction.UNMATCHED` bleibt im Enum erhalten (für explizite manueller Auswahl in CodeRow: "Ignorieren"). Analyse erzeugt aber keine UNMATCHED-Entries mehr für reguläre nicht-erkannte Zellen — nur noch SONSTIGES.

---

## 5. Zell-Klick → Details-Tab

### Aktuelles Verhalten

`handleCellClick` setzt `setContextShift(null)` und öffnet den `DoctorAssignPopover`. Shift-Details im Sidebar erscheinen nur beim Klick auf Konflikt-Dot oder Sidebar-Shift-Link.

### Gewünschtes Verhalten

Klick auf Zelle mit Schicht oder Abwesenheit → Sidebar Details-Tab zeigt die Daten der ausgewählten Zelle.

### Callback-Erweiterung

```ts
// UnifiedPlanGrid.tsx
onCellClick?(
  rotationId: number,
  doctorId: number,
  dayKey: string,
  shiftId: number | null,
  shiftKey: boolean,
  clickPos: { x: number; y: number },
  absenceId: number | null,   // NEU
): void
```

`UnifiedPlanGrid` übergibt `cell.absenceId ?? null` als siebtes Argument.

### PlanPage-State

```ts
const [contextAbsence, setContextAbsence] = useState<Absence | null>(null)
```

`handleCellClick` Logik:
```
shiftId != null  → find in shifts[] → setContextShift(found)   + setContextAbsence(null)
absenceId != null → find in planAbsences[] → setContextAbsence(found) + setContextShift(null)
sonst           → setContextShift(null) + setContextAbsence(null)
```

DoctorAssignPopover öffnet weiterhin wie bisher (keine Änderung am Popover-Flow).

### PlanSidebar-Erweiterung

Neues Prop `absence?: Absence`.

Im Details-Tab, nach dem bestehenden Shift-Block, neue Absence-Karte:

```
┌──────────────────────────────────┐
│ ABWESENHEIT  · 12.06 – 12.06    │
│ DIV — Sonstiges                  │
│ ───────────────────────────────  │
│ Notiz: "Sonderregelung Chefarzt" │ ← bei notes != null
└──────────────────────────────────┘
```

Bei UNBESETZT: zeigt nur Typ + Datum, keine Notiz-Sektion.

---

## Betroffene Dateien

| Datei | Art |
|---|---|
| `backend/app/models/absence.py` | +3 AbsenceType-Werte |
| `backend/migrations/versions/xxx_add_absence_types.py` | neue Migration |
| `backend/app/services/import_match_service.py` | DEFAULT_CODE_MAP + unmatched→SONSTIGES |
| `backend/app/services/import_commit_service.py` | notes=raw bei SONSTIGES |
| `backend/app/schemas/excel_import.py` | CodeEntry.default_note |
| `frontend/src/lib/types.ts` | AbsenceType-Union erweitern |
| `frontend/src/lib/importTypes.ts` | CodeEntry.default_note |
| `frontend/src/features/plans/unifiedGridUtils.ts` | EA/INA-EA/UNBESETZT in ABSENCE_CODES |
| `frontend/src/features/plans/components/PlanModeBar.tsx` | BESETZUNG_ONLY_ABSENCE_TYPES + Chips |
| `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` | absenceId im Callback |
| `frontend/src/features/plans/components/UnifiedShiftCell.tsx` | UNBESETZT X-Overlay |
| `frontend/src/features/plans/PlanPage.tsx` | contextAbsence State + handleCellClick |
| `frontend/src/features/plans/components/PlanSidebar.tsx` | absence-Prop + Karte |
| `frontend/src/features/plans/components/PlanSettingsModal.tsx` | 9 AbsenceType-Farbfelder |
| `frontend/src/features/plans/components/AbsenceAssignPopover.tsx` | Labels EA/INA-EA/UNBESETZT |
| `frontend/src/features/plans/components/ImportDialog.tsx` | CodeRow Notiz-Hinweis |
| `frontend/src/features/doctors/AbsenceFormDialog.tsx` | 3 neue Typen in Auswahl |
| `frontend/src/features/doctors/AbsenceList.tsx` | Labels + badge-Varianten |

---

## Nicht im Scope

- INA-Verfügbarkeitslogik für EA/INA-EA (Phase A: weiche Validierung)
- Import-Mapping für UNBESETZT
- Solver-Integration (Phase B)
