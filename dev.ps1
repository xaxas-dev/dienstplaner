# Startet Backend und Frontend in separaten PowerShell-Fenstern
$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

Write-Host "Starte Dienstplaner..."
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; uv run uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; pnpm dev"

Write-Host "Backend:  http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
Write-Host ""
Write-Host "API-Docs: http://localhost:8000/docs"
