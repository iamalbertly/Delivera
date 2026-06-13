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
    # Phase 1: Investigation (Using Default Playwright MCP)
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Investigation" "Streaming Agent output (Playwright mapping UI)..."
    
    $InvestPrompt = @"
Read ${BrainFile}. Use the Playwright MCP to navigate to ${TargetUrl}. Let Playwright launch its own isolated browser automatically. Map the DOM structure. Identify 3 nested components causing click/scroll friction. Output a precise list of files to modify. DO NOT execute terminal commands.
"@
    $InvestLog = Join-Path $LogDir "L${i}_Investigation.md"
    cursor-agent chat $InvestPrompt --trust 2>&1 | Tee-Object -FilePath $InvestLog
    Validate-AgentHealth $InvestLog

    # ---------------------------------------------------------
    # Phase 2: Master Plan & Target Extraction
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Planning" "Drafting changes and selecting fail-fast test..."
    $PlanPrompt = "Based on the investigation, draft a technical refactoring plan to flatten the UI. Review the 'Available Tests' in ${BrainFile}. Identify the SINGLE most specific journey test script that will validate your changes. Write EXACTLY the npm command (e.g., 'npm run test:journey:governance') to the file ${TestTargetFile}. Do not write anything else to that file."
    
    $PlanLog = Join-Path $LogDir "L${i}_Plan.md"
    cursor-agent chat $PlanPrompt --trust 2>&1 | Tee-Object -FilePath $PlanLog
    Validate-AgentHealth $PlanLog

    # ---------------------------------------------------------
    # Phase 3: Code Implementation
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Implementation" "Applying code modifications..."
    $ImplPrompt = "Execute the code changes defined in your plan directly to the files on disk. Do NOT modify the AutoHacker.ps1 script."
    
    $ImplLog = Join-Path $LogDir "L${i}_Implementation.md"
    cursor-agent chat $ImplPrompt --trust 2>&1 | Tee-Object -FilePath $ImplLog
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
        $CommitMsg = cursor-agent chat $CommitPrompt --trust
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