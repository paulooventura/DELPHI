# Cosmos Prowler / Delphi — MV-style local test entry (port 8312 -> Next.js 3000)
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if (-not (Test-Path "$Root\agent\web\node_modules")) {
  Write-Host "Installing dependencies (agent/web)..."
  npm --prefix "$Root\agent\web" install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}

$args = @("$Root\scripts\dev-proxy.mjs")
if ($NoBrowser) { $args += "--no-open" }

node @args
