[CmdletBinding()]
Param(
    [string]$TargetUrl = "http://127.0.0.1:3001/governance",
    [int]$MaxLoops = 3
)

# ==========================================
# 1. ENVIRONMENT & DIRECTORY LOCK
# ==========================================
# Lock execution to the script's actual directory to prevent ENOENT errors
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($ProjectRoot)) { $ProjectRoot = (Get-Location).Path }
Set-Location -Path $ProjectRoot

# SCRIPT IMMUTABILITY GUARD: Prevent the AI from truncating/overwriting this script
$ScriptPath = $MyInvocation.MyCommand.Path
if (Test-Path $ScriptPath) {
    $ScriptInfo = Get-Item $ScriptPath
    if (-not $ScriptInfo.IsReadOnly) { $ScriptInfo.IsReadOnly = $true }
}

$RunId = (Get-Date).ToString("yyyyMMdd_HHmmss")
$LogDir = Join-Path $ProjectRoot ".agent_logs\$RunId"
$BrainFile = Join-Path $ProjectRoot "AI_State_Brain.md"
$TelemetryFile = Join-Path $ProjectRoot "Agent_Telemetry_Board.md"
$TestTargetFile = Join-Path $ProjectRoot ".agent_test_target"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# ==========================================
# 2. EDGE CASE: GIT SHIELD
# ==========================================
$IgnoreItems = @(".agent_logs/", "AI_State_Brain.md", "Agent_Telemetry_Board.md", ".agent_test_target")
$GitIgnorePath = Join-Path $ProjectRoot ".gitignore"
if (Test-Path $GitIgnorePath) {
    $CurrentIgnore = Get-Content $GitIgnorePath -Raw
    foreach ($Item in $IgnoreItems) {
        if ($CurrentIgnore -notmatch $([regex]::Escape($Item))) {
            Add-Content -Path $GitIgnorePath -Value "`n$Item"
        }
    }
}

# ==========================================
# 3. HELPER FUNCTIONS
# ==========================================
function Update-Telemetry ($Phase, $Status, $Details) {
    $Timestamp = (Get-Date).ToString("HH:mm:ss")
    $Content = @"
# Agent Telemetry Dashboard
**Run ID:** $RunId | **Target:** $TargetUrl
**Last Update:** $Timestamp

### Current Status
* **Phase:** ${Phase}
* **Status:** ${Status}
* **Details:** $Details
"@
    Set-Content -Path $TelemetryFile -Value $Content
    Write-Host "`n==========================================================" -ForegroundColor Magenta
    Write-Host " [$Timestamp] ${Phase} | ${Status}" -ForegroundColor White
    Write-Host " $Details" -ForegroundColor Cyan
    Write-Host "==========================================================`n" -ForegroundColor Magenta
}

function Validate-AgentHealth ($LogFilePath) {
    if (Test-Path $LogFilePath) {
        $LogContent = Get-Content $LogFilePath -Raw
        if ($LogContent -match "(?i)(quota exceeded|login|unauthorized|authentication failed|out of tokens)") {
            Write-Host "`n[FATAL] Cursor AI Token limit reached or unauthorized!" -ForegroundColor Red
            Exit
        }
    }
}

function Invoke-CursorAgent {
    param(
        [string]$Prompt,
        [string]$LogFilePath = $null
    )
    $AgentArgs = @(
        "--print",
        "--trust",
        "--approve-mcps",
        "--force",
        "--workspace", $ProjectRoot,
        $Prompt
    )
    if ($LogFilePath) {
        cursor-agent @AgentArgs 2>&1 | Tee-Object -FilePath $LogFilePath
    } else {
        cursor-agent @AgentArgs 2>&1
    }
}

function Ensure-DevServer {
    param([string]$Url)
    $Uri = [Uri]$Url
    $HealthUrl = "$($Uri.Scheme)://$($Uri.Host):$($Uri.Port)/healthz"
    try {
        $Resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
        if ($Resp.StatusCode -eq 200) { return $true }
    } catch {}

    Write-Host "Dev server not reachable at $HealthUrl. Starting npm run start..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run start" -WorkingDirectory $ProjectRoot -WindowStyle Hidden | Out-Null
    for ($Attempt = 1; $Attempt -le 30; $Attempt++) {
        Start-Sleep -Seconds 2
        try {
            $Resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
            if ($Resp.StatusCode -eq 200) { return $true }
        } catch {}
    }
    return $false
}

function Invoke-GovernanceDomMap {
    param([string]$Url)
    $DomMapFile = Join-Path $ProjectRoot "test-results\governance-dom-map-headed.json"
    $Uri = [Uri]$Url
    $BaseUrl = "$($Uri.Scheme)://$($Uri.Host):$($Uri.Port)"
    $env:BASE_URL = $BaseUrl
    $env:HEADLESS = "1"

    Write-Host "Capturing live DOM map from $BaseUrl/governance ..." -ForegroundColor DarkGray
    $MapProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build:css && node scripts/map-governance-dom-headed.mjs" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow -PassThru
    if ($MapProcess.ExitCode -ne 0 -or -not (Test-Path $DomMapFile)) {
        Write-Host "[WARN] DOM map script failed; investigation will use static repo sources only." -ForegroundColor Yellow
        return $null
    }
    return $DomMapFile
}

# ==========================================
# 4. PRE-FLIGHT & GIT SETUP
# ==========================================
Update-Telemetry "Initialization" "Running" "Setting up Git branch and parsing available tests..."

if (git status --porcelain) { git stash push -m "Auto-stash before AI run $RunId" | Out-Null }
$BranchName = "agent-opt-$RunId"
git checkout -b $BranchName | Out-Null

$PackageJsonPath = Join-Path $ProjectRoot "package.json"
$AvailableTestsString = if (Test-Path $PackageJsonPath) { ((Get-Content $PackageJsonPath | ConvertFrom-Json).scripts.PSObject.Properties | Where-Object { $_.Name -match "^test:" } | Select-Object -ExpandProperty Name) -join ", " } else { "npm run test:e2e" }

Set-Content -Path $BrainFile -Value "Target: $TargetUrl`nDirectives: Flatten UI hierarchy, zero-click data visibility.`nAvailable Tests: $AvailableTestsString`nFailure Ledger:`n[Empty]"

if (-not (Ensure-DevServer $TargetUrl)) {
    Update-Telemetry "Initialization" "FAILED" "Dev server did not become ready at $TargetUrl"
    Exit 1
}

# ==========================================
# 5. THE AUTONOMOUS LOOP
# ==========================================
$ConsecutiveFailures = 0

for ($i = 1; $i -le $MaxLoops; $i++) {
    if ($ConsecutiveFailures -ge 2) {
        Update-Telemetry "CIRCUIT BREAKER" "HALTED" "Successive regressions detected. Stopping to prevent token burn."
        break
    }

    # ---------------------------------------------------------
    # Phase 1: Investigation (live DOM map pre-captured by script)
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Investigation" "Capturing live DOM map, then streaming agent analysis..."
    
    $DomMapFile = Invoke-GovernanceDomMap $TargetUrl
    $DomMapHint = if ($DomMapFile) {
        Add-Content -Path $BrainFile -Value "`nDOM Map: $DomMapFile"
        "Read the live DOM evidence at ${DomMapFile} (Playwright headless scan of ${TargetUrl})."
    } else {
        "No live DOM map was captured; derive structure from governance.html, render controllers, and 09-governance.css."
    }

    $InvestPrompt = @"
Read ${BrainFile}. ${DomMapHint} Cross-check with source files. Map the DOM structure. Identify 3 nested components causing click/scroll friction. Output a precise list of files to modify. Do not report Playwright MCP availability — DOM evidence is supplied by the script when present.
"@
    $InvestLog = Join-Path $LogDir "L${i}_Investigation.md"
    Invoke-CursorAgent -Prompt $InvestPrompt -LogFilePath $InvestLog
    Validate-AgentHealth $InvestLog

    # ---------------------------------------------------------
    # Phase 2: Master Plan & Target Extraction
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Planning" "Drafting changes and selecting fail-fast test..."
    $PlanPrompt = "Based on the investigation, draft a technical refactoring plan to flatten the UI. Review the 'Available Tests' in ${BrainFile}. Identify the SINGLE most specific journey test script that will validate your changes. Write EXACTLY the npm command (e.g., 'npm run test:journey:governance') to the file ${TestTargetFile}. Do not write anything else to that file."
    
    $PlanLog = Join-Path $LogDir "L${i}_Plan.md"
    Invoke-CursorAgent -Prompt $PlanPrompt -LogFilePath $PlanLog
    Validate-AgentHealth $PlanLog

    # ---------------------------------------------------------
    # Phase 3: Code Implementation
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Implementation" "Applying code modifications..."
    $ImplPrompt = "Execute the code changes defined in your plan directly to the files on disk. Do NOT modify the AutoHacker.ps1 script."
    
    $ImplLog = Join-Path $LogDir "L${i}_Implementation.md"
    Invoke-CursorAgent -Prompt $ImplPrompt -LogFilePath $ImplLog
    Validate-AgentHealth $ImplLog

    if (-not (git status --porcelain)) {
        Update-Telemetry "Loop $i" "ERROR" "Phantom Edit detected (no files changed). Retrying."
        $ConsecutiveFailures++
        continue
    }

    # ---------------------------------------------------------
    # Phase 4: Targeted Verification
    # ---------------------------------------------------------
    $TargetTest = Get-Content $TestTargetFile -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($TargetTest) -or $TargetTest -notmatch "npm run test:") {
        $TargetTest = "npm run test:journey:governance"
    }

    Update-Telemetry "Loop $i" "Verification" "Compiling CSS and running test: $TargetTest"
    
    Write-Host "Building CSS..." -ForegroundColor DarkGray
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build:css" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow
    
    Write-Host "Running tests..." -ForegroundColor DarkGray
    try {
        $TestProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $TargetTest" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow -PassThru
        $TestExitCode = $TestProcess.ExitCode
    } catch {
        $TestExitCode = 1
    }

    # ---------------------------------------------------------
    # Phase 5: Semantic Git Commit or Rollback
    # ---------------------------------------------------------
    if ($TestExitCode -eq 0) {
        Update-Telemetry "Loop $i" "SUCCESS" "Tests passed. Staging commit..."
        git add .
        
        $CommitPrompt = "Read the staged git diff. Output a single, highly descriptive conventional commit message for these changes. Output ONLY the string."
        $CommitMsg = Invoke-CursorAgent -Prompt $CommitPrompt
        if ([string]::IsNullOrWhiteSpace($CommitMsg)) { $CommitMsg = "refactor(ui): auto-optimization loop $i" }
        
        git commit -m "$CommitMsg" | Out-Null
        $ConsecutiveFailures = 0 
        
        $BrainContent = Get-Content $BrainFile -Raw
        $BrainContent -replace "(?s)Failure Ledger.*", "Failure Ledger:`n[Cleared]" | Set-Content $BrainFile
    } else {
        Update-Telemetry "Loop $i" "ROLLBACK" "Tests failed. Reverting and updating ledger."
        Add-Content -Path $BrainFile -Value "`n- Loop $i FAILED running ${TargetTest}. Do NOT use the exact same logic."
        git reset --hard | Out-Null
        git clean -fd | Out-Null
        $ConsecutiveFailures++
    }
}

Update-Telemetry "Agent Run Complete" "Finished" "Review Branch: $BranchName"
Get-Process -Name "cursor-agent" -ErrorAction SilentlyContinue | Stop-Process -Force