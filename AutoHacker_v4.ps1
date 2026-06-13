[CmdletBinding()]
Param(
    [string]$TargetUrl = "http://127.0.0.1:3001/governance",
    [int]$MaxLoops = 3
)

# ==========================================
# AGENT ENVIRONMENT SETUP
# ==========================================
$RunId = (Get-Date).ToString("yyyyMMdd_HHmmss")
$LogDir = ".\.agent_logs\$RunId"
$BrainFile = ".\AI_State_Brain.md"
$TelemetryFile = ".\Agent_Telemetry_Board.md"
$TestTargetFile = ".\.agent_test_target"

# Edge Case 1: The Git Shield (Keep AI files out of source control)
$IgnoreItems = @(".agent_logs/", "AI_State_Brain.md", "Agent_Telemetry_Board.md", ".agent_test_target")
$GitIgnorePath = ".\.gitignore"
if (Test-Path $GitIgnorePath) {
    $CurrentIgnore = Get-Content $GitIgnorePath -Raw
    foreach ($Item in $IgnoreItems) {
        if ($CurrentIgnore -notmatch $([regex]::Escape($Item))) {
            Add-Content -Path $GitIgnorePath -Value "`n$Item"
            Write-Host "[Git] Added $Item to .gitignore" -ForegroundColor DarkGray
        }
    }
}

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# Feature 1 Prep: Extract available tests from package.json
$PackageJson = Get-Content ".\package.json" | ConvertFrom-Json
$AvailableTests = $PackageJson.scripts.PSObject.Properties | Where-Object { $_.Name -match "^test:" } | Select-Object -ExpandProperty Name
$AvailableTestsString = $AvailableTests -join ", "

function Update-Telemetry ($Phase, $Status, $Details) {
    $Timestamp = (Get-Date).ToString("HH:mm:ss")
    # Using ${} to protect the variable name from the colon
    $Content = @"
# 🤖 Agent Telemetry Dashboard
**Run ID:** $RunId | **Target:** $TargetUrl
**Last Update:** $Timestamp

### Current Status
* **Phase:** ${Phase}
* **Status:** ${Status}
* **Details:** $Details

### System Health
* Test Command: $TestCommand
"@
    Set-Content -Path $TelemetryFile -Value $Content
    Write-Host "[$Timestamp] ${Phase}: ${Status}" -ForegroundColor Cyan
}

Update-Telemetry "Initialization" "Running" "Setting up Git sandbox..."
if (git status --porcelain) { git stash push -m "Auto-stash before AI run $RunId" | Out-Null }
$BranchName = "agent-opt-$RunId"
git checkout -b $BranchName | Out-Null

Set-Content -Path $BrainFile -Value @"
# Agent Persistent Memory
Target: $TargetUrl
Core Directives: Flatten UI hierarchy, zero-click data visibility, eliminate redundant borders.
Available Tests: $AvailableTestsString

## Failure Ledger (DO NOT REPEAT THESE):
[Empty - No failures yet]
"@

# ==========================================
# THE AUTONOMOUS LOOP
# ==========================================

$ConsecutiveFailures = 0

for ($i = 1; $i -le $MaxLoops; $i++) {
    if ($ConsecutiveFailures -ge 2) {
        Update-Telemetry "CIRCUIT BREAKER" "HALTED" "Multiple regressions detected."
        break
    }

    # ---------------------------------------------------------
    # STEP 1: Glass-Box Investigation
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Investigation" "Scanning $TargetUrl..."
    $InvestPrompt = "Read $BrainFile. Using Playwright MCP in HEADED MODE, navigate to $TargetUrl. Map the DOM. Identify 3 nested components causing click/scroll friction. Output a precise list of files to modify."
    $InvestOut = cursor-agent chat $InvestPrompt --trust
    $InvestOut | Out-File "$LogDir\L${i}_Investigation.md"

    # ---------------------------------------------------------
    # STEP 2: Master Plan & Blast Radius Targeting
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Planning" "Drafting plan and selecting targeted test..."
    $PlanPrompt = @"
Based on $LogDir\L${i}_Investigation.md, draft a technical refactoring plan to flatten the UI. 
CRITICAL DIRECTIVE: Review the 'Available Tests' in $BrainFile. Based strictly on the files you plan to modify, identify the SINGLE most specific journey test script that will validate these changes (e.g., test:journey:governance). 
Write EXACTLY the npm command (e.g., 'npm run test:journey:governance') to the file $TestTargetFile. Do not write anything else to that file.
Update $BrainFile with your intended codebase changes.
"@
    $PlanOut = cursor-agent chat $PlanPrompt --trust
    $PlanOut | Out-File "$LogDir\L${i}_Plan.md"

    # ---------------------------------------------------------
    # STEP 3: Implementation Check
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Implementation" "Writing code..."
    $ImplPrompt = "Execute the code changes defined in $LogDir\L${i}_Plan.md. DO NOT output code blocks in chat, write to the actual files."
    cursor-agent chat $ImplPrompt --trust | Out-Null

    if (-not (git status --porcelain)) {
        Update-Telemetry "Loop $i" "ERROR" "Phantom Edit detected. Retrying."
        $ConsecutiveFailures++
        continue
    }

    # ---------------------------------------------------------
    # STEP 4: Targeted Verification (Fail-Fast)
    # ---------------------------------------------------------
    $TargetTest = Get-Content $TestTargetFile -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($TargetTest) -or $TargetTest -notmatch "npm run test:") {
        $TargetTest = "npm run test:test:journey:governance" # Fallback
        Write-Host "[WARNING] Agent failed to select a valid test. Defaulting to governance journey." -ForegroundColor Yellow
    }

    Update-Telemetry "Loop $i" "Verification" "Compiling CSS and running targeted test: $TargetTest"
    
    # Edge Case 3: CSS Build Desync
    Write-Host "Rebuilding CSS..." -ForegroundColor DarkGray
    npm run build:css | Out-Null

    # Edge Case 4: Process Timeout (Max 3 minutes per test suite to prevent hanging)
    Write-Host "Running $TargetTest..." -ForegroundColor DarkGray
    $TestJob = Start-Job -ScriptBlock { Invoke-Expression $args[0] } -ArgumentList $TargetTest
    Wait-Job $TestJob -Timeout 180 | Out-Null
    
    if ($TestJob.State -eq "Running") {
        Stop-Job $TestJob
        $TestExitCode = 1
        Write-Host "[ERROR] Test timed out and was killed." -ForegroundColor Red
    } else {
        $JobResult = Receive-Job $TestJob
        $TestExitCode = if ($JobResult -match "failed|Error") { 1 } else { 0 }
    }
    Remove-Job $TestJob

    # ---------------------------------------------------------
    # STEP 5: Semantic Git Commit or Rollback
    # ---------------------------------------------------------
    if ($TestExitCode -eq 0) {
        Update-Telemetry "Loop $i" "SUCCESS" "Tests passed. Synthesizing semantic commit..."
        
        # Feature 2: Diff Summarizer
        git add .
        $GitDiff = git diff --staged
        $DiffFile = "$LogDir\L${i}_Diff.patch"
        $GitDiff | Out-File $DiffFile

        $CommitPrompt = "Read the git diff in $DiffFile. Write a single, highly descriptive conventional commit message (e.g., 'refactor(ui): removed nested boxes in governance dashboard'). Output ONLY the commit message string, nothing else."
        $CommitMsg = cursor-agent chat $CommitPrompt --trust
        
        git commit -m "$CommitMsg" | Out-Null
        $ConsecutiveFailures = 0 
        
        $BrainContent = Get-Content $BrainFile -Raw
        $BrainContent -replace "(?s)## Failure Ledger.*", "## Failure Ledger:`n[Cleared after success]" | Set-Content $BrainFile
    } else {
        Update-Telemetry "Loop $i" "ROLLBACK" "Tests failed. Updating Failure Ledger."
        Add-Content -Path $BrainFile -Value "`n- LOOP $i FAILED running $TargetTest. Do NOT use the exact same logic."
        git reset --hard | Out-Null
        git clean -fd | Out-Null
        $ConsecutiveFailures++
    }
}

Update-Telemetry "Agent Run Complete" "Finished" "Review Branch: $BranchName"
Get-Process -Name "cursor-agent" -ErrorAction SilentlyContinue | Stop-Process -Force