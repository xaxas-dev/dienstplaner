# Architektur

> Platzhalter – wird in Meilenstein M1 ausgebaut.

Der Dienstplaner besteht aus einem FastAPI-Backend (Python 3.12) und einem
React-18-Frontend (TypeScript). Beide kommunizieren über eine REST-JSON-API.
Das Backend speichert alle Daten in einer lokalen SQLite-Datenbank und
verwendet Timefold Solver für die automatische Schichtplan-Optimierung.
Die Anwendung läuft ausschließlich lokal als Single-User-Desktop-App.
