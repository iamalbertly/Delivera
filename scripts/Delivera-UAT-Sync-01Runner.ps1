param(
  [string]$TargetRoot = 'C:\Shared\Projects\Delivera',
  [string]$Branch = 'autohacker-20260615_093142',
  [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'

function Invoke-Checked {
  param([string]$FilePath, [string[]]$Arguments)
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $TargetRoot '.git'))) {
  throw "UAT checkout not found: $TargetRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $TargetRoot '.env'))) {
  throw "UAT environment file is missing: $TargetRoot\.env"
}

$trackedChanges = & git -C $TargetRoot status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect the UAT checkout.' }
if ($trackedChanges) {
  throw "UAT has tracked changes. Preserve or commit them before synchronization.`n$trackedChanges"
}

Write-Host "[uat-sync] Fast-forwarding $TargetRoot to origin/$Branch"
Invoke-Checked git @('-C', $TargetRoot, 'fetch', 'origin', $Branch)
Invoke-Checked git @('-C', $TargetRoot, 'merge', '--ff-only', "origin/$Branch")

Push-Location $TargetRoot
try {
  Invoke-Checked npm.cmd @('install', '--no-audit', '--no-fund')
  Invoke-Checked npm.cmd @('run', 'check:css')
} finally {
  Pop-Location
}

$expectedCommit = (& git -C $TargetRoot rev-parse --short=7 HEAD).Trim()
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  # Nodemon ignores documentation-only releases. Touching the watched entrypoint
  # forces a clean reload without changing tracked content.
  (Get-Item -LiteralPath (Join-Path $TargetRoot 'server.js')).LastWriteTime = Get-Date
}
if (-not $listener) {
  Write-Host "[uat-sync] Starting managed UAT on port $Port"
  $previousPort = $env:PORT
  $env:PORT = [string]$Port
  try {
    Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:hot') `
      -WorkingDirectory $TargetRoot -WindowStyle Hidden | Out-Null
  } finally {
    $env:PORT = $previousPort
  }
}

$versionUrl = "http://localhost:$Port/version"
for ($attempt = 1; $attempt -le 40; $attempt += 1) {
  try {
    $version = Invoke-RestMethod -Uri $versionUrl -TimeoutSec 2
    if ($version.commit -eq $expectedCommit) {
      Write-Host "[uat-sync] READY $($version.version) $($version.commit) $($version.branch)"
      exit 0
    }
  } catch { }
  Start-Sleep -Milliseconds 500
}

throw "UAT did not report expected commit $expectedCommit at $versionUrl"
