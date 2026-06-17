# Design: Doctor Name Split + Anrede + PD Dr. Titel

**Datum:** 2026-06-17  
**Status:** Approved

## Ziel

1. `Doctor.name` (einzelnes Feld) aufteilen in `first_name` + `last_name`
2. Optionales `salutation`-Feld hinzufügen (`Herr` / `Frau`) zur Geschlechtsbestimmung
3. `PD Dr.` zum Titel-Dropdown hinzufügen
4. Excel-Import auf neue Felder anpassen

---

## Backend

### ORM-Modell (`backend/app/models/doctor.py`)

- `name: String(200)` entfernen
- `first_name: String(100) NOT NULL` hinzufügen
- `last_name: String(100) NOT NULL` hinzufügen
- `salutation: String(10) nullable` hinzufügen (Werte: `"Herr"` / `"Frau"`, kein Enum — einfache Strings)
- Python `@property name` als Convenience: `f"{self.first_name} {self.last_name}".strip()`

### Alembic-Migration

Neue Migration (nächste Versionsnummer nach 0021):

```sql
ALTER TABLE doctors ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE doctors ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE doctors ADD COLUMN salutation VARCHAR(10);
-- Bestandsdaten: existierender name → last_name
UPDATE doctors SET last_name = name;
ALTER TABLE doctors DROP COLUMN name;
```

Migrations-Strategie für Bestandsdaten: existierender `name`-Wert wird vollständig in `last_name` übertragen, `first_name = ''`. Kein Splitversuch. User korrigiert manuell.

### Pydantic-Schemas (`backend/app/schemas/doctor.py`)

**DoctorBase:**
- `name` entfernen
- `first_name: str = Field(min_length=0, max_length=100)` hinzufügen
- `last_name: str = Field(min_length=1, max_length=100)` — Pflichtfeld
- `salutation: str | None = None` — optional, Werte `"Herr"` / `"Frau"` / `None`

**DoctorUpdate:**
- `first_name: str | None = None`
- `last_name: str | None = None`
- `salutation: str | None = None`

**DoctorResponse:**
```python
@computed_field
@property
def name(self) -> str:
    return f"{self.first_name} {self.last_name}".strip()
```
Backwards-Compat: alle Frontend-Stellen, die `doctor.name` lesen, funktionieren weiter ohne Änderung.

### Import-Service Anpassungen

#### `import_match_service.py`

Neue Hilfsfunktion `_normalize_raw_name(raw: str) -> str`:
- Komma-getrennt `"Berger, Anna"` → `"Berger Anna"` (Reihenfolge bleibt: Nachname Vorname)
- Kein Komma: unverändert (Reihenfolge bereits Nachname Vorname per Konvention)

Doctor-Seite für Matching: `f"{d.last_name} {d.first_name}".strip()` statt `d.name`

Matching-Ablauf:
1. Raw name normalisieren via `_normalize_raw_name`
2. Fuzzy gegen `"{last_name} {first_name}"` aller Doktoren — wie bisher

#### `import_commit_service.py`

Neue Hilfsfunktion `_split_name_parts(raw: str) -> tuple[str, str]`:
```python
def _split_name_parts(raw: str) -> tuple[str, str]:
    """Returns (last_name, first_name). Strips percentage suffix first."""
    clean = _PERCENT_RE.sub("", raw).strip()
    if "," in clean:
        parts = [p.strip() for p in clean.split(",", 1)]
        return parts[0], parts[1] if len(parts) > 1 else ""
    parts = clean.split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""
```

Neuer Doktor beim Commit:
```python
last_name, first_name = _split_name_parts(raw_name)
doctor = Doctor(first_name=first_name, last_name=last_name)
```

---

## Frontend

### `frontend/src/lib/types.ts`

`Doctor`-Typ:
- `name` entfernen oder als optional behalten (da API computed `name` weiterhin liefert: behalten als readonly)
- `first_name: string` hinzufügen
- `last_name: string` hinzufügen
- `salutation: string | null` hinzufügen

### `DoctorForm.tsx`

Formular-Felder (Reihenfolge):
1. **Anrede** — Select, optional: `__none__` / `Herr` / `Frau`
2. **Vorname** — Input text, optional (min_length=0)
3. **Nachname** — Input text, Pflichtfeld
4. Titel (bestehend, + `PD Dr.` als neue Option hinzufügen)
5. Kurzname (unverändert)
6. ... Rest unverändert

Zod-Schema:
```ts
salutation: z.string().nullable().optional(),
first_name: z.string().max(100).nullable().optional(),
last_name: z.string().min(1, 'Nachname ist erforderlich').max(100),
```

### `DoctorCard.tsx`

Anzeige-Logik:
- Headline: `{title} {first_name} {last_name}` (title optional, first_name optional)
- `salutation` wird in der Karte **nicht** angezeigt — nur im Formular relevant

### Titel-Dropdown

Bestehende Optionen + neue Option `PD Dr.`:
- Kein Titel
- Dr.
- PD Dr. ← neu
- Prof.
- Prof. Dr.
- PD (bleibt für Rückwärts-Compat)

---

## Was nicht geändert wird

- `DoctorCard.roleLabel()` — unverändert (nutzt rank, kein name)
- `DoctorListPage.applyFilter()` — unverändert (filtert nach rank/type, nicht name)
- Alle anderen Services die `doctor.name` lesen — funktionieren via computed property
- Kein neues `gender`-Feld — `salutation` dient als Gender-Indikator

---

## Test-Strategie

- Backend: bestehende `test_doctors_api.py` — anpassen für `first_name`/`last_name` statt `name` in Payloads
- Import: `test_import_commit_phase_d.py` — neuer Testfall für Komma-getrennten Namen, Testfall für kein-Komma-Format
- Frontend: DoctorForm-Tests in `features/doctors/tests/` anpassen

---

## Migrations-Risiko

Bestandsdaten: `first_name = ''` nach Migration. Kein harter Fehler, da `first_name` kein `min_length=1`-Constraint in DB. Im Formular ist `first_name` optional, also auch kein Validierungsfehler beim Öffnen+Speichern bestehender Doktoren.
