# Task M0-003: API-Typgenerierung Backend → Frontend

## Ziel
TypeScript-Typen werden automatisch aus dem OpenAPI-Schema des Backends
generiert. Ein einziger Befehl hält Backend und Frontend dauerhaft im Sync.
Kein manuelles Schreiben von API-Typen im Frontend.

## Kontext
Lies vor Beginn: CLAUDE.md
M0-001 ist abgeschlossen. Backend läuft auf Port 8000 und liefert unter
http://localhost:8000/openapi.json ein valides OpenAPI 3.x Schema.
Frontend läuft auf Port 5173 mit Vite-Proxy /api → localhost:8000.

## Anforderungen

### 1. openapi-typescript installieren

Im frontend/-Ordner:

```
pnpm add -D openapi-typescript
```

Kein anderes Tool. Nicht openapi-generator-cli, nicht swagger-codegen.

### 2. Generierungs-Skript einrichten

In frontend/package.json ein neues Script:

```json
"generate-api": "openapi-typescript http://localhost:8000/openapi.json -o src/lib/api-types.ts"
```

### 3. Typisierter API-Client

Die bestehende frontend/src/lib/api.ts erweitern:
- Basis-URL als Konstante: http://localhost:8000 (nicht hardcoded überall)
- Eine generische fetch-Wrapper-Funktion mit korrektem TypeScript-Typing
- Fehlerbehandlung: HTTP-Fehler als typisierte Exceptions
- Noch keine domain-spezifischen Funktionen (kommt in M1)

Beispiel-Struktur (kein Copy-Paste, als Orientierung):

```typescript
export async function apiGet<T>(path: string): Promise<T> { ... }
export async function apiPost<T>(path: string, body: unknown): Promise<T> { ... }
export async function apiPatch<T>(path: string, body: unknown): Promise<T> { ... }
export async function apiDelete(path: string): Promise<void> { ... }
```

### 4. Startseite anpassen

Die bestehende "Verbindung prüfen"-Logik in App.tsx soll den neuen
typisierten API-Client verwenden statt eines rohen fetch-Aufrufs.
Die generierten Typen aus api-types.ts sollen für die Health-Response
verwendet werden.

### 5. .gitignore prüfen

src/lib/api-types.ts soll NICHT in .gitignore stehen.
Die generierte Datei wird eingecheckt, damit das Frontend ohne
laufendes Backend gebaut werden kann.

### 6. README ergänzen

In README.md unter einem neuen Abschnitt "Entwicklung" folgenden
Hinweis ergänzen:

```
## Entwicklung

### API-Typen aktualisieren
Nach jeder Änderung an Backend-Endpunkten oder Schemas:
cd frontend && pnpm generate-api
```

## Akzeptanzkriterien

- [ ] `cd frontend && pnpm generate-api` läuft durch ohne Fehler
  (Backend muss dafür laufen)
- [ ] src/lib/api-types.ts existiert und enthält TypeScript-Typen
- [ ] api.ts enthält typisierten Wrapper (apiGet, apiPost, apiPatch, apiDelete)
- [ ] App.tsx nutzt den Wrapper, keinen rohen fetch mehr
- [ ] `pnpm type-check` läuft grün
- [ ] `uv run ruff check .` läuft grün (Backend unverändert)
- [ ] `uv run pytest` läuft grün
- [ ] README enthält Hinweis zur Typgenerierung

## Out of Scope
- Keine domain-spezifischen API-Funktionen (z.B. getDoctors)
- Kein automatisches Neu-Generieren bei Dateiänderungen (kein Watch-Modus)
- Keine Authentifizierung
- Keine weiteren Backend-Endpunkte
- Kein React Query noch nicht (kommt in M1)

## Bekannte Stolperfallen
- openapi-typescript generiert Typen im "paths"-Format, nicht als
  direkte Interface-Exporte. Die Nutzung sieht anders aus als gewohnt.
  Dokumentation lesen: https://openapi-ts.dev/introduction
- Der Generierungsbefehl braucht ein laufendes Backend. Im CI (falls
  später eingerichtet) muss das Backend vorher gestartet werden.
- api-types.ts nicht manuell bearbeiten, sie wird bei jedem
  generate-api überschrieben. Kommentar am Anfang der Datei ergänzen:
  "// GENERATED FILE - nicht manuell bearbeiten"

## Annahmen die ich treffe
Keine. Bei Unklarheit stoppen und nachfragen.
