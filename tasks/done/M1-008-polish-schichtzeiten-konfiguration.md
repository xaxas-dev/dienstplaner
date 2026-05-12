# Task M1-008: Polish, Schichtzeiten und Klinik-Konfiguration

## Ziel
Drei zusammenhängende Verbesserungen vor M2-003:

1. **dev.ps1 erweitern:** Automatisches `alembic upgrade head` vor 
   Backend-Start, damit DB nach Migrationen nicht händisch nachgezogen 
   werden muss
2. **Schichtzeiten im Seed:** Konkrete Uhrzeiten für V, T, N, T1 setzen
3. **App-Konfiguration:** Klinikname und ähnliche App-Einstellungen 
   konfigurierbar machen (Key-Value-Settings), damit das Tool auch in 
   anderen Kliniken einsetzbar ist

## Kontext
Lies vor Beginn: CLAUDE.md, docs/data-model.md, docs/decisions.md.

Diese Aufgabe ist eine kleine Korrektur- und Erweiterungs-Aufgabe. Sie
greift drei Themen auf, die im bisherigen Build sichtbar wurden:
- DB-Migrationen mussten manuell nachgezogen werden (Workflow-Problem)
- Schichtzeiten waren beim Seed null gelassen, sollen jetzt mit den
  realen Werten am UKSH gefüllt werden
- Der Header "Neurologie UKSH Lübeck" ist hartcodiert - macht das Tool
  klinikspezifisch und schlecht portabel

## Anforderungen

### 1. dev.ps1: Automatische Migration vor Backend-Start

Datei: `dev.ps1` im Projektroot

Aktuell startet sie Backend und Frontend in zwei Fenstern.
Neue Reihenfolge im Backend-Fenster:

1. In Backend-Verzeichnis wechseln
2. `uv run alembic upgrade head` (mit Output-Anzeige)
3. Erst dann `uv run uvicorn app.main:app --reload --port 8000` starten

Wenn der Migrations-Schritt fehlschlägt: Fehlermeldung anzeigen,
Backend NICHT starten (sonst läuft die App mit veraltetem Schema).

Frontend-Start bleibt unverändert.

Optional: ein kurzer Info-Output am Anfang:
```
[1/2] Wende Datenbank-Migrationen an...
[2/2] Starte Backend...
```

### 2. Schichtzeiten im Seed setzen

Datei: `scripts/seed_shift_types.py`

Werte für die vier Schichttypen ergänzen:

| Name | short_name | start | end | applies_on_weekdays | applies_on_weekend |
|---|---|---|---|---|---|
| V-Dienst | V | 15:00 | 20:15 | True | False |
| Tagdienst | T | 07:30 | 19:30 | False | True |
| Nachtdienst | N | 19:30 | 07:30 | True | True |
| Tagdienst INA | T1 | 07:30 | 16:00 | True | False |

Wichtige Anmerkungen:
- Nachtdienst hat start=19:30 > end=07:30 (über Mitternacht), das ist
  laut Datenmodell-Validierung erlaubt
- Bei T1 muss das Setup-Statement das `notes`-Feld behalten
  ("Tagdienst Interdisziplinäre Notaufnahme (Mo-Fr)")

**Idempotenz-Regel:**
- Wenn der ShiftType bereits start_time oder end_time gesetzt hat
  (nicht null), Werte NICHT überschreiben
- Nur setzen wenn beide null sind

Das funktioniert wie bei den Department-Headcounts: manuell gepflegte
Werte werden respektiert.

### 3. App-Konfiguration (Key-Value-Settings)

#### Datenmodell

Neue Tabelle `app_settings` in `backend/app/models/app_setting.py`:

```python
class AppSetting(Base):
    __tablename__ = "app_settings"
    id: int (PK)
    key: str (unique, not null, max 100)
    value: str (not null, max 1000)
    description: str | None (max 500)
    updated_at: datetime
```

Kein `created_at`, weil das Setting konzeptuell schon immer da ist.
`updated_at` reicht.

#### Pydantic-Schema

`schemas/app_setting.py`:
- AppSettingResponse (key, value, description, updated_at)
- AppSettingUpdate (nur value änderbar; key ist immutable)

Kein Create und kein Delete in der API. Settings werden über Seed 
initial angelegt; User-API erlaubt nur Update.

#### Migration

`0006_app_settings.py`:

Up: Tabelle erstellen plus Default-Datensätze einfügen:
- `clinic_name` = "Neurologie UKSH Lübeck", description = "Name der Klinik (wird im Header angezeigt)"
- Optional weitere für die Zukunft vorbereitet, aber jetzt nur 
  clinic_name

Down: Tabelle droppen.

Anmerkung: Defaults in der Migration anlegen ist OK, weil Settings
konzeptuell zur Schema-Migration gehören. Alternative wäre ein
Seed-Skript, das ist hier aber Overkill.

#### Repository

`repositories/app_setting_repository.py`:

- `list_settings(db) -> list[AppSetting]`
- `get_setting(db, key) -> AppSetting | None`
- `update_setting(db, key, value) -> AppSetting | None`

Kein Create/Delete im Repository - Settings sind über Migration 
vorhanden.

#### API

`api/app_settings.py` mit Prefix `/api/settings`:

- `GET /api/settings` → list[AppSettingResponse]
  - Alle Einstellungen
- `GET /api/settings/{key}` → AppSettingResponse
  - 404 wenn key unbekannt
- `PATCH /api/settings/{key}` → AppSettingResponse
  - Body: AppSettingUpdate (nur value)
  - 404 wenn key unbekannt

#### Fehlerbehandlung

- `SettingNotFoundError` → 404

### 4. Frontend: Klinikname im Header

#### Hook: useSettings()

`src/lib/useSettings.ts` (neu) oder analog:

```typescript
export function useClinicName() {
  return useQuery({
    queryKey: ['settings', 'clinic_name'],
    queryFn: () => apiGet<AppSettingResponse>('/api/settings/clinic_name'),
    staleTime: 5 * 60 * 1000, // 5min, ändert sich selten
  });
}
```

Oder generisch `useSetting(key)`, mit dem clinic_name als Spezialfall.

#### AppShell.tsx anpassen

In der Sidebar oder dem Header, wo aktuell "Neurologie UKSH Lübeck" 
hartcodiert steht: Wert aus dem Hook beziehen. Bei Loading-State: 
leer oder kurzer Skeleton, kein "loading...".

Wenn der Wert null/undefined ist (z.B. weil API noch lädt): nichts 
anzeigen statt "undefined".

### 5. Frontend: Settings-Seite

Neue Route `/settings`, neuer Sidebar-Eintrag "Einstellungen" 
(am Ende der Sidebar-Liste, vielleicht mit Trenner und kleinerem Text).

#### SettingsPage.tsx

Einfaches Layout:
- Überschrift "Einstellungen"
- Card pro Setting:
  - Label (description oder umformuliertes key)
  - Aktueller Wert in Text-Input
  - "Speichern" Button (oder Auto-Save mit Debounce)
  - Bei Erfolg: Toast "Einstellung gespeichert"

Für jetzt nur clinic_name. Aber generisch genug, dass weitere Settings 
ohne UI-Änderung sichtbar werden (Loop über alle Settings).

Validierung mit Zod:
- value nicht leer (für Strings)
- max 1000 Zeichen

### 6. Routing

In der Routing-Konfiguration:
- `/settings` → SettingsPage

Sidebar-Item: Eintrag am Ende mit Icon (lucide-react Settings).

### 7. Tests

#### Backend

- `test_app_settings_listed_after_migration`: nach Migration ist 
  clinic_name in DB
- `test_get_setting_existing`: GET /api/settings/clinic_name → 200
- `test_get_setting_404`: GET /api/settings/unknown → 404
- `test_update_setting`: PATCH ändert value
- `test_update_setting_404`: PATCH auf unbekanntes key → 404
- `test_shift_types_have_times_after_seed`: nach seed_shift_types.py
  sind alle vier Schichten mit korrekten Zeiten gefüllt
- `test_shift_types_seed_idempotent_for_times`: zweiter Seed-Lauf 
  überschreibt manuelle Werte nicht

#### Frontend

- SettingsPage: Form-Validierung leere value → Fehler
- AppShell: Klinikname wird im Header angezeigt nach Mock-Antwort

### 8. Dokumentation

`docs/data-model.md` ergänzen:
- Tabelle `app_settings` dokumentieren
- Hinweis: Setting-Werte sind Strings, ggf. clientseitig parsen für 
  Zahlen oder Booleans (kommt mit Bedarf)

`docs/decisions.md` ergänzen:
- ADR: Key-Value-Settings statt typisierte Konfigurations-Tabelle,
  weil flexibel und erweiterbar ohne Migrationen
- ADR: clinic_name als initiale Einstellung, weitere Settings können 
  ohne Code-Änderung über Migration ergänzt werden
- ADR: dev.ps1 führt alembic upgrade automatisch aus, um manuelle 
  Migrations-Schritte zu vermeiden

## Akzeptanzkriterien

- [ ] dev.ps1 führt alembic upgrade head automatisch aus
- [ ] Falls Migration fehlschlägt: klare Fehlermeldung, Backend startet nicht
- [ ] seed_shift_types.py setzt Uhrzeiten korrekt (alle vier Typen)
- [ ] Idempotenz: zweiter Seed-Lauf überschreibt manuell gesetzte 
      Zeiten nicht
- [ ] Migration 0006 erstellt app_settings + Default clinic_name
- [ ] GET /api/settings funktioniert, listet clinic_name
- [ ] PATCH /api/settings/clinic_name speichert neuen Wert
- [ ] AppShell zeigt den Wert von clinic_name im Header
- [ ] Sidebar hat neuen Eintrag "Einstellungen"
- [ ] SettingsPage erlaubt Editieren von clinic_name
- [ ] Tests grün, ruff und type-check grün
- [ ] OpenAPI-Schema vollständig
- [ ] `pnpm generate-api` ausgeführt

## Out of Scope

- Weitere Settings (z.B. clinic_address, planner_name, default_horizon).
  Diese können später per Migration ergänzt werden ohne Code-Änderung
- Validierung von value-Typen (Integer, Boolean): aktuell alles String
- Konfigurations-Export/Import (z.B. JSON)
- Multi-Tenant-Konfiguration (mehrere Kliniken in einer DB)
- Logo-Upload für die Klinik
- Theming/Farben konfigurierbar
- Sprache konfigurierbar (durchgehend deutsch hartcodiert)
- Audit-Log für Settings-Änderungen

## Bekannte Stolperfallen

- **dev.ps1 Fehlerbehandlung:** Wenn alembic fehlschlägt, sollte der 
  Backend-Start abgebrochen werden. PowerShell exit codes prüfen:
  ```powershell
  uv run alembic upgrade head
  if ($LASTEXITCODE -ne 0) { exit 1 }
  ```
- **Schichtzeit-Übermitternachts-Validierung:** Wenn die Schema-
  Validierung im Service prüft "start < end", wird die Nacht-Schicht 
  fälschlich abgelehnt. Aktuelles Modell erlaubt das laut M1-005 - 
  hier nur darauf achten, dass der Seed nicht doppelt validiert.
- **Idempotenz bei Schichtzeit-Update:** prüfen ob bestehender Eintrag 
  bereits Uhrzeiten hat. Falls ja, nicht überschreiben.
- **Migration mit DML:** Datensätze in Migration einfügen funktioniert,
  aber muss in die `op.execute()` oder mit `op.bulk_insert()` 
  geschrieben werden. Reine ORM-Aufrufe sind in Migrationen unzuverlässig.
- **Frontend Stale-Data nach Setting-Update:** TanStack Query Cache 
  invalidieren nach PATCH, damit der Header sich aktualisiert.
- **Datums-immutability bei updated_at:** SQLAlchemy onupdate=func.now()
  funktioniert auch bei direkten Update-Statements aus dem Repository.
- **Setting nicht löschbar:** Repository hat kein delete. API hat kein
  DELETE. Wer das in der Zukunft braucht: Cleanup-Migration oder 
  explizite Erweiterung.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

OK-Annahmen:
- Sidebar-Position des Settings-Eintrags am Ende der Liste, kein 
  separater Bereich
- Settings sind nicht versioniert (kein History)
- Eine "Einstellung" entspricht 1:1 einem Setting-Datensatz im UI
- Settings sind in der API global (kein User-bezogen, kein Plan-bezogen)
- clinic_name als Default genau wie spezifiziert
- Keine Auto-Save-Funktion - explizites Speichern-Button
