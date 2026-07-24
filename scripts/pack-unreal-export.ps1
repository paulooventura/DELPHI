# Pack DELPHI source + assets for Unreal Engine migration.
# Usage: .\scripts\pack-unreal-export.ps1  (from repo root)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ExportRoot = Join-Path $Root "exports\unreal-engine"
$ZipPath = Join-Path $Root "exports\DELPHI-UE-Export.zip"

$WebLib = Join-Path $Root "agent\web\lib"
$WebApp = Join-Path $Root "agent\web\app"
$WebComponents = Join-Path $Root "agent\web\components"
$WebHooks = Join-Path $Root "agent\web\hooks"
$IosSrc = Join-Path $Root "native\ios\CosmicClock\Sources\CosmicClock"
$Docs = Join-Path $Root "docs"

# Ensure export skeleton
$dirs = @(
    "$ExportRoot\source-reference\web\cosmic",
    "$ExportRoot\source-reference\web\worldCycles",
    "$ExportRoot\source-reference\web\design",
    "$ExportRoot\source-reference\web\hooks",
    "$ExportRoot\source-reference\web\components",
    "$ExportRoot\source-reference\web\app",
    "$ExportRoot\source-reference\ios",
    "$ExportRoot\assets",
    "$ExportRoot\docs"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

function Copy-IfExists($src, $dest) {
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dest -Force
        return $true
    }
    return $false
}

# Core sky / math
$coreFiles = @(
    "skyPositions.ts",
    "sphericalView.ts",
    "deviceAttitude.ts",
    "orientationCalibration.ts",
    "localSignals.ts",
    "sensorSmoothing.ts",
    "magneticDeclination.ts",
    "galacticFrequency.ts",
    "cosmicAssets.ts",
    "deepSkyCatalog.ts",
    "starmap.ts",
    "deviceOrientation.ts",
    "spacetime.ts",
    "cycleSystems.ts"
)
foreach ($f in $coreFiles) {
    Copy-IfExists (Join-Path $WebLib $f) "$ExportRoot\source-reference\web\$f" | Out-Null
}

# cosmic/*
Get-ChildItem (Join-Path $WebLib "cosmic\*.ts") -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$ExportRoot\source-reference\web\cosmic\" -Force
}

# worldCycles
Get-ChildItem (Join-Path $WebLib "worldCycles") -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = $_.FullName.Substring((Join-Path $WebLib "worldCycles").Length + 1)
    $destDir = Join-Path "$ExportRoot\source-reference\web\worldCycles" (Split-Path $rel -Parent)
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item $_.FullName (Join-Path "$ExportRoot\source-reference\web\worldCycles" $rel) -Force
}

Copy-IfExists (Join-Path $WebLib "design\observatoryTokens.ts") "$ExportRoot\source-reference\web\design\observatoryTokens.ts" | Out-Null

# UI reference
Copy-IfExists (Join-Path $WebComponents "CelestialSkyView.tsx") "$ExportRoot\source-reference\web\components\CelestialSkyView.tsx" | Out-Null
Copy-IfExists (Join-Path $WebComponents "WatchMovement.tsx") "$ExportRoot\source-reference\web\components\WatchMovement.tsx" | Out-Null
Copy-IfExists (Join-Path $WebHooks "useCosmicClock.ts") "$ExportRoot\source-reference\web\hooks\useCosmicClock.ts" | Out-Null
Copy-IfExists (Join-Path $WebApp "page.tsx") "$ExportRoot\source-reference\web\app\page.tsx" | Out-Null

# Tests (parity reference)
Get-ChildItem $WebLib -Filter "*.test.ts" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$ExportRoot\source-reference\web\" -Force
}

# iOS Swift kernel
Get-ChildItem $IosSrc -Filter "*.swift" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName "$ExportRoot\source-reference\ios\" -Force
}

# Docs + assets
Copy-IfExists (Join-Path $Docs "COSMOS.md") "$ExportRoot\docs\COSMOS.md" | Out-Null
Copy-IfExists (Join-Path $Docs "WORLD-CYCLES.md") "$ExportRoot\docs\WORLD-CYCLES.md" | Out-Null
Copy-IfExists (Join-Path $Docs "assets\13-tones-20-tribes.png") "$ExportRoot\assets\13-tones-20-tribes.png" | Out-Null
Copy-IfExists (Join-Path $Root "agent\web\public\delphi-brand-reference.png") "$ExportRoot\assets\delphi-brand-reference.png" | Out-Null
Copy-IfExists (Join-Path $Root "agent\web\public\icon.svg") "$ExportRoot\assets\icon.svg" | Out-Null

# Manifest
$gitHash = ""
try { $gitHash = (git -C $Root rev-parse --short HEAD 2>$null) } catch {}
$packedAt = (Get-Date).ToUniversalTime().ToString("o")

$manifest = @{
    name = "DELPHI-UE-Export"
    version = "1.0.0"
    packedAtUtc = $packedAt
    gitCommit = $gitHash
    liveSite = "https://delphi.pauloventura.org"
    skymapFixes = @(
        "Sun/moon calibration uses liveAttitudeRef view azimuth (not throttled HUD heading)"
        "CelestialSkyView recomputes ephemeris every paint frame"
    )
    ueRecommendedVersion = "5.4+"
    modules = @(
        @{ id = "ephemeris"; sources = @("skyPositions.ts", "cosmic/celestialBodies.ts", "cosmic/minorBodies.ts"); ueTarget = "UDelphiEphemeris" }
        @{ id = "spherical"; sources = @("sphericalView.ts"); ueTarget = "FDelphiSphericalView" }
        @{ id = "attitude"; sources = @("deviceAttitude.ts", "orientationCalibration.ts"); ueTarget = "FDelphiDeviceAttitude" }
        @{ id = "clock"; sources = @("hooks/useCosmicClock.ts", "cosmic/CosmicClockEngine.ts", "galacticFrequency.ts"); ueTarget = "UDelphiCosmicClockSubsystem" }
        @{ id = "calendars"; sources = @("worldCycles/"); ueTarget = "DataTables" }
        @{ id = "visual"; sources = @("cosmicAssets.ts", "design-tokens.json"); ueTarget = "MPC_DelphiObservatory" }
    )
    assets = @(
        "assets/delphi-brand-reference.png"
        "assets/13-tones-20-tribes.png"
        "assets/icon.svg"
    )
    startHere = "README-START-HERE.md"
    migrationGuide = "MIGRATION-GUIDE.md"
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $ExportRoot "manifest.json") -Encoding UTF8

# Zip
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path "$ExportRoot\*" -DestinationPath $ZipPath -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "DELPHI Unreal export ready:" -ForegroundColor Green
Write-Host "  Folder: $ExportRoot"
Write-Host "  Zip:    $ZipPath ($sizeMb MB)"
Write-Host "  Commit: $gitHash"
Write-Host ""
