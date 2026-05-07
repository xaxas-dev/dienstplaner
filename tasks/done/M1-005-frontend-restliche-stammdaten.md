# Task M1-005: Frontend für Departments, ShiftTypes, Qualifications, RuleOverrides

## Ziel
Komplettes Frontend für die restlichen vier Stammdaten-Entitäten.
Damit ist die Stammdaten-Verwaltung (M1) abgeschlossen.

Am Ende kann deine Frau alle Bereiche, Schichttypen, Qualifikationen
und Tarif-Overrides über die UI verwalten.

## Kontext
Lies vor Beginn: CLAUDE.md, docs/architecture.md.

M1-004 hat das Frontend-Pattern etabliert (App Shell, Routing, TanStack
Query, shadcn/ui, Form-Handling, Delete-Dialoge, Toasts). Diese Aufgabe
wendet dasselbe Pattern auf vier weitere Entitäten an.

Backend-Endpunkte sind alle vorhanden (M1-003), insgesamt 20 Endpunkte
für diese vier Entitäten. TypeScript-Typen sind generiert.

## Anforderungen

### 1. Sidebar-Navigation aktivieren

Die in M1-004 deaktivierten Nav-Items aktivieren:
- "Stationen" → /departments
- "Schichttypen" → /shift-types
- "Qualifikationen" → /qualifications
- "Tarif-Overrides" → /rule-overrides

Pläne und ggf. weitere bleiben deaktiviert (kommen in M2 ff.).

### 2. Routing erweitern

Routes ergänzen:
- `/departments` → DepartmentListPage
- `/shift-types` → ShiftTypeListPage
- `/qualifications` → QualificationListPage
- `/rule-overrides` → RuleOverrideListPage

Edit/Create im Dialog statt eigener Routes (analog zu EmploymentPeriod
in M1-004), weil diese Entitäten keine verschachtelten Sub-Entitäten haben.

### 3. Departments (src/features/departments/)

#### Hooks

```
useDepartments(includeInactive?: boolean)
useDepartment(id)
useCreateDepartment
useUpdateDepartment
useDeleteDepartment
```

#### DepartmentListPage.tsx

- Überschrift "Stationen"
- Toolbar:
  - Switch "Inaktive anzeigen" (default off)
  - Button "Neue Station"
- Tabelle, sortiert nach display_order, dann name:
  - Name
  - Kurzname
  - Typ (Badge "Intern" oder "Extern")
  - Dienst-relevant (Badge "Ja" / "Nein")
  - Sortier-Reihenfolge
  - Aktiv (Badge oder Switch zum direkten Toggle)
  - Aktionen: Bearbeiten (öffnet Dialog), Löschen
- Empty-State: "Noch keine Stationen angelegt."
- Hinweis: Nach Seed sind 21 Bereiche vorhanden. Die Liste ist also
  initial nicht leer.

#### DepartmentFormDialog.tsx

shadcn/ui Dialog. Felder:
- name (Pflicht, max 200)
- short_name (optional, max 50)
- is_external (Switch)
- is_shift_relevant (Switch, default true)
- display_order (Number, default 0)
- active (Switch, default true)
- notes (Textarea)

Validierung mit Zod:
- name: nicht leer, max 200
- short_name: max 50

Server-Fehler 422 (z.B. bei doppeltem Namen) inline am Form anzeigen
oder als Toast.

### 4. ShiftTypes (src/features/shift-types/)

#### Hooks

```
useShiftTypes(includeInactive?: boolean)
useCreateShiftType
useUpdateShiftType
useDeleteShiftType
```

#### ShiftTypeListPage.tsx

- Überschrift "Schichttypen"
- Toolbar mit "Neuer Schichttyp" Button und Inaktive-Filter
- Tabelle, sortiert nach display_order:
  - Name
  - Kurzname
  - Werktag (Badge "Ja"/"Nein")
  - Wochenende (Badge "Ja"/"Nein")
  - Uhrzeit (z.B. "07:00 - 15:00" oder "—" falls nicht gesetzt)
  - Aktiv
  - Aktionen

#### ShiftTypeFormDialog.tsx

Felder:
- name (Pflicht, unique)
- short_name (Pflicht, unique, max 20)
- applies_on_weekdays (Switch, default true)
- applies_on_weekend (Switch, default false)
- start_time (Time-Input, optional)
- end_time (Time-Input, optional)
- display_order (Number, default 0)
- active (Switch, default true)
- notes (Textarea)

Validierung:
- name, short_name nicht leer
- mindestens eines von applies_on_weekdays / applies_on_weekend muss true sein
- start_time und end_time entweder beide gesetzt oder beide leer
- start_time != end_time (wenn beide gesetzt)
- Hinweis: start_time > end_time ist ERLAUBT (Mitternachts-Schicht)

UI-Hinweis bei Mitternachts-Schicht: kleiner Info-Text "Schicht über
Mitternacht, z.B. 21:00 bis 07:00"

### 5. Qualifications (src/features/qualifications/)

#### Hooks

In M1-004 wurde `useQualifications()` minimal angelegt. Hier vollständig
ausbauen:

```
useQualifications(includeInactive?: boolean)
useQualification(id)
useCreateQualification
useUpdateQualification
useDeleteQualification
```

Wichtig: Wenn `useQualifications()` schon existiert mit einer einfacheren
Signatur, hier erweitern (nicht duplizieren).

#### QualificationListPage.tsx

- Überschrift "Qualifikationen"
- Toolbar mit "Neue Qualifikation" und Inaktive-Filter
- Tabelle, sortiert nach name:
  - Name
  - Kurzname
  - Beschreibung (gekürzt, max 100 Zeichen, mit "..." am Ende)
  - Aktiv
  - Aktionen

Optional, falls einfach machbar: Spalte "Verwendung" mit Anzahl Ärzte
die diese Qualifikation haben. Das erfordert aber einen zusätzlichen
Backend-Aufruf (z.B. `GET /api/doctors` und clientseitig zählen) und
ist nicht zwingend.

#### QualificationFormDialog.tsx

Felder:
- name (Pflicht, unique)
- short_name (optional)
- description (Textarea, optional)
- active (Switch, default true)

Validierung:
- name nicht leer

#### Delete-Verhalten

Der Backend-Endpoint liefert bei Verwendung 422 mit einer Detail-Message
wie:
```
"Qualifikation wird noch von folgenden Ärzten verwendet: Dr. A, Dr. B"
```

Der AlertDialog für Löschen:
- Titel: "Qualifikation löschen?"
- Text: "Diese Aktion kann nicht rückgängig gemacht werden."
- Bei 422-Antwort: Toast oder Inline-Anzeige der Server-Meldung

### 6. RuleOverrides (src/features/rule-overrides/)

Diese Entität ist komplexer als die anderen, weil sie Scope, Doctor,
Datums-Range und freien Wert hat.

#### Hooks

```
useRuleOverrides(filters?: {scope?, doctor_id?, rule_key?, active_on_date?})
useCreateRuleOverride
useUpdateRuleOverride
useDeleteRuleOverride
```

#### RuleOverrideListPage.tsx

- Überschrift "Tarif-Overrides"
- Toolbar:
  - Filter Scope (alle / global / pro Arzt)
  - Filter Arzt (Select, sichtbar nur wenn Scope=Doctor)
  - Filter rule_key (Text-Input)
  - Filter "aktiv am Datum" (Date-Input, optional)
  - Button "Neuer Override"
- Tabelle, sortiert nach created_at desc:
  - Regel (rule_key)
  - Scope (Badge "Global" / "Pro Arzt")
  - Arzt (Name, falls scope=DOCTOR, sonst "—")
  - Gültig von / bis (z.B. "1.1.2026 - unbefristet")
  - Wert (override_value)
  - Begründung (gekürzt)
  - Aktionen
- Empty-State: "Noch keine Tarif-Overrides angelegt."

#### RuleOverrideFormDialog.tsx

Felder:
- rule_key (Text-Input, Pflicht)
- scope (Select: "Global" / "Pro Arzt", default "Global")
- doctor_id (Select aus useDoctors, sichtbar nur wenn scope=Doctor, Pflicht in dem Fall)
- valid_from (Date-Input, optional)
- valid_to (Date-Input, optional)
- override_value (Text-Input, Pflicht)
- reason (Textarea, optional)

Validierung mit Zod:
- rule_key nicht leer
- override_value nicht leer
- wenn scope=DOCTOR: doctor_id Pflicht
- wenn scope=GLOBAL: doctor_id muss leer sein (UI sollte das automatisch
  beim Wechsel des Scopes leeren)
- wenn beide Daten gesetzt: valid_from <= valid_to

UI-Hinweis: Liste der bekannten rule_keys als Vorschlag (z.B. Datalist
oder Combobox). Bekannte Keys: `max_bereitschaft_per_month`,
`min_ruhezeit_hours`. Ist optional, ein normales Text-Feld reicht.

### 7. Wiederverwendung

Es ist sinnvoll, gemeinsame Komponenten zu extrahieren falls noch nicht
geschehen:

- `src/components/data-table.tsx`: dünner Wrapper um shadcn/ui Table
  mit Loading-, Empty- und Error-States. Nicht überengineeren.
- `src/components/confirm-delete-dialog.tsx`: AlertDialog für Delete
  mit konfigurierbarem Titel/Text.
- `src/components/inactive-toggle.tsx`: Switch + Label für "Inaktive anzeigen"

Wenn solche Komponenten in M1-004 schon entstanden sind: nutzen, nicht
duplizieren.

### 8. Tests

Nur Pflicht-Tests, analog zu M1-004:

- ShiftTypeFormDialog: Validierung "kein Tag-Typ" → Fehler
- ShiftTypeFormDialog: Validierung Mitternachts-Schicht ist OK
- RuleOverrideFormDialog: scope=DOCTOR ohne doctor_id → Fehler
- DepartmentFormDialog: leerer Name → Fehler

Mehr Tests sind willkommen.

### 9. Sprache und Terminologie

Konsistente deutsche Begriffe:
- "Stationen" statt "Departments"
- "Schichttypen" oder "Dienstarten" (sich für eine entscheiden, in
  der ganzen App durchziehen)
- "Qualifikationen"
- "Tarif-Overrides" (kann auch "Tarif-Ausnahmen" oder ähnlich heißen,
  konsistent halten)

In rule_keys und ähnlichen technischen Identifiern bleibt englisches
snake_case.

## Akzeptanzkriterien

- [ ] Alle vier neuen Routen erreichbar, Sidebar-Navigation funktioniert
- [ ] /departments zeigt 21 Seed-Bereiche
- [ ] /shift-types zeigt 3 Seed-Schichttypen
- [ ] CRUD funktioniert bei allen vier Entitäten
- [ ] Filter und Sortierungen funktionieren wie spezifiziert
- [ ] Server-Fehler werden in der UI angezeigt (z.B. Qualification InUse,
  doppelte Namen)
- [ ] RuleOverride: scope-Wechsel ändert sichtbare Felder korrekt
- [ ] ShiftType: Mitternachts-Schicht ist erlaubt
- [ ] Tests grün
- [ ] Type-Check grün
- [ ] Lint grün
- [ ] Sprache durchgehend deutsch
- [ ] Keine Konsolen-Fehler im Normalbetrieb

## Out of Scope

- Plan-Modul (kommt in M2)
- Bulk-Operationen
- Export/Import von Stammdaten
- Drag-and-Drop für display_order
- Inline-Editing in Tabellen (alles über Dialog)
- Suche über alle Entitäten gleichzeitig
- Audit-Log
- Wiederverwendung von Stammdaten zwischen Plänen visualisieren
- Verwendungs-Statistiken (außer dem optionalen "Verwendung" bei
  Qualifications)
- Visualisierung der Bereiche-Hierarchie

## Bekannte Stolperfallen

- **Conditional Fields:** RuleOverride hat sichtbarkeitsabhängige
  Felder (doctor_id nur bei scope=DOCTOR). React Hook Form mit
  `watch()` oder ähnlichen Mechanismen sauber lösen.
- **Datalist vs Combobox:** rule_key Vorschläge als Datalist sind
  einfach (HTML5), funktionieren aber schlecht mit Hook Form. Pures
  Text-Input reicht.
- **Time-Input und null:** HTML time-input liefert leeren String
  wenn nicht gesetzt. Vor Senden als null konvertieren.
- **Refetch nach Mutation:** Konsistente Cache-Invalidierung. Bei
  Departments und ShiftTypes auch andere Hooks invalidieren, die das
  nutzen (z.B. wird Department-Liste in Plan-Modul später wieder gebraucht).
- **Doctor-Selector in RuleOverride:** Nutze useDoctors, aber der
  könnte sehr lang werden. Falls nötig: einfaches Combobox mit Suche
  (shadcn/ui hat ein Pattern dafür).
- **Reihenfolge der Form-Felder:** Logische Gruppierung. Zuerst
  Identifizierung (Name), dann Eigenschaften, dann Status, dann Notizen.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

Beispiel-Annahmen, die OK sind:
- Edit über Dialog, nicht eigene Page
- "Schichttypen" als deutscher Begriff (nicht "Dienstarten")
- "Tarif-Overrides" als deutscher Begriff
- Verwendungs-Spalte bei Qualifikationen optional, nicht Pflicht
- Bei display_order keine Drag-and-Drop Sortierung, nur Number-Input
- Inaktive-Toggle ist konsistent in allen vier Listen
