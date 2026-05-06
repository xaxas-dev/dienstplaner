# Task M1-004: Frontend für Ärzte-Verwaltung

## Ziel
Vollständige Frontend-UI zur Verwaltung von Ärzten, einschließlich
Beschäftigungszeiträume und Qualifikationen. Plus die App-Grundstruktur:
Layout, Navigation, Routing, TanStack Query Setup, shadcn/ui-Initialisierung.

Am Ende kann deine Frau über den Browser Ärzte anlegen, bearbeiten,
löschen, ihre Beschäftigungszeiträume pflegen und Qualifikationen zuweisen.

## Kontext
Lies vor Beginn: CLAUDE.md, docs/architecture.md.

M1-001, M1-002, M1-003 sind abgeschlossen. Backend hat 30 Endpunkte
und ist über http://localhost:8000/docs voll dokumentiert. TypeScript-
Typen sind unter `src/lib/api-types.ts` aktuell generiert.

Diese Aufgabe ist die erste größere Frontend-Aufgabe. Sie etabliert das
Pattern für alle weiteren Frontend-Module.

## Designprinzipien für dieses Projekt

Wichtig: Dies ist eine **professionelle Klinik-Software** für Nutzer,
die NICHT IT-affin sind. Folgende Designprinzipien gelten durchgehend:

- **Klar vor kreativ.** Keine "bold maximalist" Designs. Refined, ruhig,
  professionell. Funktion vor Form.
- **Vorhersehbar.** Buttons sehen wie Buttons aus. Tabellen sind Tabellen.
  Keine ungewöhnlichen UI-Patterns.
- **Hohe Lesbarkeit.** Ausreichende Schriftgröße (Default 16px Body,
  nicht kleiner als 14px), guter Kontrast, klare Hierarchie.
- **Konsistenz.** Einmal etabliertes Pattern in der ganzen App nutzen.
- **Tastaturbedienung.** Tab-Reihenfolge logisch, Submit per Enter,
  Esc schließt Dialoge.
- **Deutsche Sprache.** Alle Labels, Buttons, Hilfetexte, Fehlermeldungen
  auf Deutsch.

Kein Dark Mode in dieser Aufgabe. Nicht weil schlecht, sondern weil
Out of Scope. Standard shadcn/ui Light Theme.

## Anforderungen

### 1. Dependencies installieren

Im frontend/-Ordner:

```
pnpm add react-router-dom @tanstack/react-query @tanstack/react-query-devtools
pnpm add react-hook-form @hookform/resolvers zod
pnpm add date-fns
pnpm add lucide-react
pnpm add zustand
```

shadcn/ui initialisieren falls noch nicht geschehen. Falls ein Konflikt
mit bestehender M0-001 Konfiguration: prüfen und konsistent halten.

shadcn/ui Komponenten installieren (über `pnpm dlx shadcn@latest add ...`):
- button
- card
- dialog
- form
- input
- label
- select
- separator
- switch
- table
- sonner (für Toast-Benachrichtigungen)
- alert-dialog (für Bestätigungs-Dialoge bei DELETE)
- badge

### 2. Globales Setup

#### src/lib/queryClient.ts

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

#### src/lib/api.ts erweitern

Bereits vorhandene apiGet/Post/Patch/Delete behalten. Erweitern um:
- Bessere ApiError-Klasse mit `status`, `detail`, `validationErrors`
  (für Pydantic 422 mit Liste von Field-Errors)
- Hilfsfunktion zum Parsen der FastAPI-Fehler-Responses

#### src/main.tsx

QueryClientProvider, BrowserRouter, Toaster (sonner) einbinden.

### 3. App Shell (src/components/layout/)

#### AppShell.tsx

Layout mit:
- **Sidebar links** (fixe Breite ~240px)
  - App-Logo/Titel oben ("Dienstplaner")
  - Navigations-Items mit Icons (lucide-react)
  - Items in M1-004: nur "Ärzte" aktiv. Andere ("Stationen",
    "Schichttypen", "Qualifikationen", "Tarif-Overrides", "Pläne")
    als deaktivierte Items vorbereiten (mit aria-disabled)
  - Aktiver Eintrag wird hervorgehoben
- **Hauptbereich rechts**
  - Header-Leiste mit Breadcrumb oder Seitentitel
  - Content-Bereich mit Outlet (React Router)

#### Routing (src/routes.tsx oder ähnlich)

Routes mit React Router v6:
- `/` → Redirect zu `/doctors`
- `/doctors` → DoctorListPage
- `/doctors/new` → DoctorCreatePage
- `/doctors/:doctorId` → DoctorDetailPage

Andere Routen werfen 404 Page.

### 4. Doctor List (src/features/doctors/)

#### useDoctors.ts (Hook)

TanStack Query Hook:
```typescript
export function useDoctors(includeInactive: boolean = false) {
  return useQuery({
    queryKey: ['doctors', { includeInactive }],
    queryFn: () => apiGet<DoctorWithRelations[]>(
      `/api/doctors?include_inactive=${includeInactive}`
    ),
  });
}
```

Analog: useDoctor(doctorId), useCreateDoctor, useUpdateDoctor, useDeleteDoctor.

Mutations sollten Cache invalidieren.

#### DoctorListPage.tsx

- Überschrift "Ärzte"
- Toolbar:
  - Switch "Inaktive anzeigen" (default off)
  - Button "Neuer Arzt" (rechts)
- Tabelle:
  - Spalten: Name, Typ (intern/extern), Weiterbildungsjahr/FA,
    Beschäftigung (z.B. "100% bis unbefristet"), Aktiv-Status, Aktionen
  - Sortierung: nach Name
  - Aktionen: "Bearbeiten" (Link), "Löschen" (mit Bestätigungs-Dialog)
- Loading-State: Skeleton oder einfacher Spinner
- Empty-State: "Noch keine Ärzte angelegt. [Neuer Arzt]"
- Error-State: Toast + Retry-Button

#### Beschäftigungs-Anzeige

In der Liste: zeige den **aktuell gültigen** EP an, plus Hinweis
falls mehrere existieren. Format z.B.:
- "100% (unbefristet)"
- "75% (bis 31.12.2026)"
- "60% (heute), wechselt zu 100% am 1.7.2026"

Wenn kein EP existiert: "Keine Beschäftigung hinterlegt"

### 5. Doctor Form (Create + Edit)

#### DoctorForm.tsx

Wiederverwendbar für Create und Edit. Props: `doctor?: Doctor`, `onSuccess?: () => void`.

Felder:
- Name (Pflicht)
- Kurzname (optional)
- Typ: Select "Intern" / "Extern" (default Intern)
- Weiterbildungsjahr: Number-Input 1-6 (sichtbar nur wenn Typ=Intern und nicht Facharzt)
- Facharzt: Switch (sichtbar nur wenn Typ=Intern)
- Aktiv: Switch (default true)
- Notizen: Textarea (optional)

Validierung mit Zod:
- Name: nicht leer, max 200 Zeichen
- Weiterbildungsjahr: integer 1-6, optional
- Facharzt + Weiterbildungsjahr nicht gleichzeitig

Form-Verhalten:
- Submit triggert Mutation
- Bei Erfolg: Toast "Arzt gespeichert", Redirect zur Detail-Seite
- Bei Fehler 422 vom Server: Field-Errors am Form zeigen, oder
  Allgemeinfehler als Toast wenn nicht zuordenbar
- Bei Fehler 5xx: Toast "Speichern fehlgeschlagen, bitte erneut versuchen"
- "Speichern" und "Abbrechen" Buttons

#### DoctorCreatePage.tsx

Header "Neuer Arzt", DoctorForm, kein Doctor übergeben.

#### DoctorDetailPage.tsx

Layout:
- Header mit Doctor-Name + Aktiv/Inaktiv Badge + "Löschen" Button
- Tabs oder Cards:
  - **Stammdaten**: DoctorForm zum Editieren
  - **Beschäftigungszeiträume**: Liste + "Neu" Button
  - **Qualifikationen**: Liste + "Hinzufügen" Button

### 6. Employment Periods Management

#### EmploymentPeriodList.tsx

Sortiert nach valid_from absteigend. Pro EP:
- Zeitraum (z.B. "1.5.2026 bis 31.12.2026" oder "ab 1.5.2026 (unbefristet)")
- Beschäftigungs-Prozent (z.B. "75%")
- Notizen (klein, abgekürzt)
- Aktionen: Bearbeiten, Löschen

Empty-State: "Noch keine Beschäftigungszeiträume hinterlegt."

#### EmploymentPeriodForm.tsx

In einem Dialog (shadcn/ui Dialog):
- valid_from: Date-Input (Pflicht)
- valid_to: Date-Input (optional, Hinweis "leer = unbefristet")
- employment_percentage: Number 1-100 (Pflicht)
- notes: Textarea (optional)

Validierung:
- valid_from < valid_to (falls valid_to gesetzt)
- employment_percentage 1-100

Server-Fehler 422 bei Overlap → Inline-Fehler oder Toast: 
"Überschneidung mit bestehendem Zeitraum (XX bis YY)"

### 7. Qualifications Management

#### QualificationManagerComponent.tsx

Im Detail-Bereich des Doctors:
- Liste der zugewiesenen Qualifikationen mit "Entfernen"-Button
  pro Eintrag
- Button "Hinzufügen" öffnet Dialog mit Select aus allen verfügbaren
  Qualifikationen, die noch nicht zugewiesen sind
- Optional im Dialog: erworben_am, läuft_ab_am Felder

Dafür braucht es eine `useQualifications()`-Hook (alle Qualifikationen
laden). Diese kommt strenggenommen erst in M1-005, aber wir bauen sie
hier minimal vor, damit das Doctor-Frontend funktioniert.

**Mindestens nötig:**
```typescript
export function useQualifications() {
  return useQuery({
    queryKey: ['qualifications'],
    queryFn: () => apiGet<QualificationResponse[]>('/api/qualifications'),
  });
}
```

In M1-005 wird darauf aufgebaut für volle Qualifikations-Verwaltung.

### 8. Bestätigungs-Dialog beim Löschen

shadcn/ui AlertDialog:
- "Arzt wirklich löschen?"
- Hinweis: "Alle Beschäftigungszeiträume und Qualifikations-Zuweisungen
  werden ebenfalls entfernt. Diese Aktion kann nicht rückgängig gemacht werden."
- Buttons "Abbrechen" und "Löschen" (Löschen in destructive-Variante)

Gleiches Pattern für Beschäftigungszeitraum-Löschen.

### 9. Toast-Benachrichtigungen

Mit sonner. Konsistente Sprache:
- Erfolg: "Arzt gespeichert" / "Arzt gelöscht" / "Beschäftigungszeitraum hinzugefügt" / etc.
- Fehler: "Speichern fehlgeschlagen" oder spezifische Server-Meldung

### 10. Tests

Frontend-Tests sind aufwändig und brüchig. Hier nur Pflicht-Tests:

#### tests/components/DoctorForm.test.tsx

- Validierung: leerer Name → Fehler
- Validierung: Facharzt + Weiterbildungsjahr → Fehler
- Render mit Doctor: Felder gefüllt
- Render ohne Doctor: Felder leer

#### tests/components/EmploymentPeriodForm.test.tsx

- Validierung: valid_from > valid_to → Fehler
- Validierung: employment_percentage 0 oder 101 → Fehler

Mehr Tests sind willkommen aber nicht Pflicht.

### 11. Mindest-Stilrichtlinien

- **Typografie:** sans-serif Default (system-ui oder eine moderne
  Sans wie Geist falls einfach einbindbar). Inter ist OK aber nicht zwingend.
- **Farben:** Standard shadcn/ui Theme. Akzentfarbe für Aktionen
  blau oder slate. Destructive rot.
- **Spacing:** Tailwind-Default. Konsistent (z.B. immer p-6 für Cards).
- **Icons:** lucide-react. Sparsam einsetzen, nur wo Bedeutung tragen.
- **Animationen:** dezent, kurz (150-200ms). Keine "wow" Effekte.

## Akzeptanzkriterien

- [ ] App startet, Navigation links sichtbar mit "Ärzte" als aktivem Eintrag
- [ ] Alle anderen Nav-Items deaktiviert/grau
- [ ] /doctors zeigt Liste, leer initial
- [ ] "Neuer Arzt" Form funktioniert, neuer Eintrag erscheint in Liste
- [ ] Klick auf Eintrag öffnet Detail-Seite
- [ ] Editieren der Stammdaten funktioniert, Änderungen werden gespeichert
- [ ] Hinzufügen eines Beschäftigungszeitraums funktioniert
- [ ] Bearbeiten und Löschen von EPs funktioniert
- [ ] Hinzufügen und Entfernen von Qualifikationen funktioniert
- [ ] Löschen eines Arztes mit Bestätigungs-Dialog
- [ ] Alle Server-Validierungsfehler werden in der UI angezeigt (z.B. EP-Overlap)
- [ ] Switch "Inaktive anzeigen" filtert die Liste
- [ ] Tests laufen grün (`pnpm test` oder `pnpm vitest run`)
- [ ] Type-Check grün (`pnpm type-check`)
- [ ] Lint grün (`pnpm lint` falls eingerichtet)
- [ ] Sprache durchgehend deutsch
- [ ] Keine Konsolen-Fehler beim normalen Bedienen

## Out of Scope

- Andere Stammdaten-UIs: Departments, ShiftTypes, Qualifications-Verwaltung,
  RuleOverrides (kommen in M1-005)
- Plan-Editor und Schichten-UI
- Drag-and-Drop
- Dark Mode
- Bulk-Operationen (z.B. mehrere Ärzte gleichzeitig löschen)
- Export oder Import (CSV, Excel)
- Suche/Filter über Name (kann später kommen, vorerst Tabelle ohne Filter)
- Pagination (bei <100 Ärzten nicht nötig)
- Autocomplete oder Fuzzy-Suche
- Avatar-Bilder oder Foto-Upload
- Print-Stylesheets
- Mobile-Optimierung (Tablet OK, Smartphone nein)

## Bekannte Stolperfallen

- **TanStack Query Cache-Keys:** Konsistente Keys verwenden. Bei
  Änderungen an einem Doctor müssen sowohl die Liste (`['doctors']`) als
  auch das Detail (`['doctor', id]`) invalidiert werden.
- **React Hook Form mit Zod:** zodResolver muss aus
  `@hookform/resolvers/zod` importiert werden.
- **API-Typen aus generierter Datei:** `components['schemas']['DoctorResponse']`
  Syntax. Alias-Typen in einer separaten `src/lib/types.ts` definieren
  für lesbareren Code:
  ```typescript
  import type { components } from './api-types';
  export type Doctor = components['schemas']['DoctorWithRelations'];
  export type DoctorCreate = components['schemas']['DoctorCreate'];
  ```
- **Datums-Handling:** API liefert ISO-Strings (`2026-05-06`). HTML
  date-Inputs erwarten `YYYY-MM-DD`. Beim Senden zur API als String
  belassen, nicht in Date-Objekte konvertieren.
- **Dialog vs Page für EP-Form:** Dialog reicht und ist einfacher.
- **Optimistic Updates:** Vorerst NICHT verwenden. Einfache Mutationen
  mit Cache-Invalidierung sind robuster und für eine lokale App schnell genug.
- **Form-Reset bei Submit:** Nach erfolgreichem Submit sollte das Form
  zurückgesetzt werden, sonst zeigt es alte Werte beim nächsten Öffnen.
- **shadcn/ui Form-Komponente:** ist FormProvider-basiert, gut mit
  React Hook Form integriert. Doku lesen.

## Annahmen die ich treffe

Falls etwas unklar ist, dokumentiere es hier und stoppe.

Beispiel-Annahmen, die OK sind:
- Routing: Edit-Form ist im Detail-Page integriert (kein separates /doctors/:id/edit)
- Beschäftigungszeitraum-Form ist im Dialog, nicht eigene Page
- Qualifikations-Zuweisung ist im Dialog, nicht eigene Page
- Sprache ist deutsch durchgehend, keine i18n-Vorbereitung nötig
- Kein Drag-and-Drop in Listen (keine Sortierung änderbar)
