# Startet Backend und Frontend in separaten PowerShell-Fenstern
$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

Write-Host "Starte Dienstplaner..."
Write-Host ""

$backendCmd = @"
Set-Location '$backendPath'
Write-Host '[1/2] Wende Datenbank-Migrationen an...'
uv run alembic upgrade head
if (`$LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'FEHLER: Alembic-Migration fehlgeschlagen. Backend wird nicht gestartet.' -ForegroundColor Red
    Read-Host 'Druecken Sie Enter zum Schliessen'
    exit 1
}
Write-Host '[2/2] Starte Backend...'
uv run uvicorn app.main:app --reload --port 8000
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; pnpm dev"

Write-Host "Backend:  http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
Write-Host ""
Write-Host "API-Docs: http://localhost:8000/docs"
