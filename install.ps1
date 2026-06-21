# Einrichtungsskript für Dienstplaner (Windows)
# Ausführen mit: powershell -ExecutionPolicy Bypass -File install.ps1
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$Backend   = Join-Path $ScriptDir "backend"
$Frontend  = Join-Path $ScriptDir "frontend"

function Ok($msg)   { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "⚠  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }
function Step($msg) { Write-Host "`n▶ $msg" -ForegroundColor Yellow }

# ── Voraussetzungen ────────────────────────────────────────────────────────────

Step "Prüfe Voraussetzungen..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js nicht gefunden. Bitte installieren: https://nodejs.org"
}
Ok "Node.js $(node --version)"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Fail "pnpm nicht gefunden. Installieren mit: npm install -g pnpm"
}
Ok "pnpm $(pnpm --version)"

# ── uv installieren (falls nicht vorhanden) ────────────────────────────────────

Step "Prüfe uv..."

$uvExe = "$env:USERPROFILE\.local\bin\uv.exe"
if (-not (Get-Command uv -ErrorAction SilentlyContinue) -and -not (Test-Path $uvExe)) {
    Write-Host "  Installiere uv..."
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
    Ok "uv installiert"
} else {
    Ok "uv bereits vorhanden"
}

# uv in aktuelle Session laden
$uvDir = "$env:USERPROFILE\.local\bin"
if (Test-Path $uvDir) {
    $env:PATH = "$uvDir;$env:PATH"
}

# ── Python-Backend ─────────────────────────────────────────────────────────────

Step "Richte Python-Backend ein..."

$venvPath = Join-Path $Backend ".venv"

# macOS-venv erkennen (hat bin\ statt Scripts\) und neu erstellen
if (Test-Path (Join-Path $venvPath "bin")) {
    Warn "macOS-venv gefunden — wird gelöscht und neu erstellt"
    Remove-Item $venvPath -Recurse -Force
}

if (-not (Test-Path $venvPath)) {
    Write-Host "  Erstelle venv mit Python 3.12..."
    uv venv $venvPath --python 3.12
    Ok "venv erstellt"
} else {
    Ok "venv bereits vorhanden"
}

Write-Host "  Installiere Python-Abhängigkeiten..."
Push-Location $Backend
uv sync --dev --quiet
Pop-Location
Ok "Python-Abhängigkeiten installiert"

# ── Frontend ───────────────────────────────────────────────────────────────────

Step "Richte Frontend ein..."

Write-Host "  Installiere npm-Pakete..."
Push-Location $Frontend
$env:CI = "true"
pnpm install --reporter=silent
$env:CI = ""
Pop-Location
Ok "Frontend-Abhängigkeiten installiert"

# ── Claude-Plugins ─────────────────────────────────────────────────────────────

Step "Installiere Claude-Plugins..."

# claude CLI aus VSCode-Extension finden (versionsneutral)
$ClaudeCli = Get-Item "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*-win32-x64\resources\native-binary\claude.exe" `
    -ErrorAction SilentlyContinue `
    | Sort-Object Name | Select-Object -Last 1 -ExpandProperty FullName

$pluginsJson = "$env:USERPROFILE\.claude\plugins\installed_plugins.json"

# ── claude-mem ──

$memInstalled = $false
if (Test-Path $pluginsJson) {
    $plugins = (Get-Content $pluginsJson | ConvertFrom-Json).plugins
    if ($plugins.PSObject.Properties.Name -contains "claude-mem@thedotmack") {
        $memInstalled = $true
    }
}

if ($memInstalled) {
    Ok "claude-mem bereits installiert"
} else {
    Write-Host "  Installiere claude-mem..."
    npx claude-mem install 2>&1 | Select-String "(OK|Complete|Error|FEHLER)"
    Ok "claude-mem installiert"
}

# ── caveman ──

$caveInstalled = $false
if (Test-Path $pluginsJson) {
    $plugins = (Get-Content $pluginsJson | ConvertFrom-Json).plugins
    if ($plugins.PSObject.Properties.Name -contains "caveman@caveman") {
        $caveInstalled = $true
    }
}

if ($caveInstalled) {
    Ok "caveman bereits installiert"
} elseif ($ClaudeCli) {
    Write-Host "  Installiere caveman..."
    & $ClaudeCli plugin marketplace add JuliusBrussee/caveman
    & $ClaudeCli plugin install caveman@caveman
    Ok "caveman installiert"
} else {
    Warn "claude CLI nicht gefunden — caveman übersprungen. Manuell installieren:"
    Warn "  claude plugin marketplace add JuliusBrussee/caveman"
    Warn "  claude plugin install caveman@caveman"
}

# ── Fertig ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Installation abgeschlossen." -ForegroundColor Green
Write-Host ""
Write-Host "  Projekt starten:       .\dev.ps1"
Write-Host "  Backend allein:        cd backend; uv run uvicorn app.main:app --reload --port 8000"
Write-Host "  Frontend allein:       cd frontend; pnpm dev"
Write-Host ""
Write-Host "  claude-mem Worker starten (einmalig pro Maschine):"
Write-Host "    npx claude-mem start"
