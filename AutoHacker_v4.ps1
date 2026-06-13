[CmdletBinding()]
Param(
    [string]$TargetUrl = "http://127.0.0.1:3001/governance",
    [int]$MaxLoops = 3
)

# Add this BEFORE the loop
Write-Host "Checking MCP Connection..." -ForegroundColor Yellow
$MCPCheck = npx -y @playwright/mcp@latest --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FATAL] MCP Server is unreachable. Please run 'npx playwright install chromium' or kill existing chrome processes." -ForegroundColor Red
    Exit
}

# ==========================================
# AGENT ENVIRONMENT SETUP
# ==========================================
# STRICT DIRECTORY LOCK: Forces execution in the exact folder the script lives in.
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($ProjectRoot)) { $ProjectRoot = (Get-Location).Path }
Set-Location -Path $ProjectRoot

$RunId = (Get-Date).ToString("yyyyMMdd_HHmmss")
$LogDir = Join-Path $ProjectRoot ".agent_logs\$RunId"
$BrainFile = Join-Path $ProjectRoot "AI_State_Brain.md"
$TelemetryFile = Join-Path $ProjectRoot "Agent_Telemetry_Board.md"
$TestTargetFile = Join-Path $ProjectRoot ".agent_test_target"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# Edge Case 1: The Git Shield
$IgnoreItems = @(".agent_logs/", "AI_State_Brain.md", "Agent_Telemetry_Board.md", ".agent_test_target")
$GitIgnorePath = Join-Path $ProjectRoot ".gitignore"
if (Test-Path $GitIgnorePath) {
    $CurrentIgnore = Get-Content $GitIgnorePath -Raw
    foreach ($Item in $IgnoreItems) {
        if ($CurrentIgnore -notmatch $([regex]::Escape($Item))) {
            Add-Content -Path $GitIgnorePath -Value "`n$Item"
            Write-Host "[Git] Added $Item to .gitignore" -ForegroundColor DarkGray
        }
    }
}

# Extract available tests
$PackageJsonPath = Join-Path $ProjectRoot "package.json"
if (Test-Path $PackageJsonPath) {
    $PackageJson = Get-Content $PackageJsonPath | ConvertFrom-Json
    $AvailableTests = $PackageJson.scripts.PSObject.Properties | Where-Object { $_.Name -match "^test:" } | Select-Object -ExpandProperty Name
    $AvailableTestsString = $AvailableTests -join ", "
} else {
    $AvailableTestsString = "npm run test:e2e"
}

function Update-Telemetry ($Phase, $Status, $Details) {
    $Timestamp = (Get-Date).ToString("HH:mm:ss")
    $Content = @"
# 🤖 Agent Telemetry Dashboard
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

# Edge Case Solution: Token/Auth Death-Watch
function Validate-AgentHealth ($LogFilePath) {
    if (Test-Path $LogFilePath) {
        $LogContent = Get-Content $LogFilePath -Raw
        if ($LogContent -match "(?i)(quota exceeded|login|unauthorized|authentication failed|out of tokens|requires premium)") {
            Write-Host "`n[FATAL ERROR] Cursor AI authentication failure or token limit reached!" -ForegroundColor Red
            Write-Host "Check the log file: $LogFilePath" -ForegroundColor Yellow
            Exit
        }
    }
}

Update-Telemetry "Initialization" "Running" "Context locked to ${ProjectRoot}. Setting up Git sandbox..."
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
        Update-Telemetry "CIRCUIT BREAKER" "HALTED" "Multiple regressions detected. Stopping to prevent token burn."
        break
    }

    # ---------------------------------------------------------
    # STEP 1: Glass-Box Investigation
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Investigation" "LIVE AGENT STREAM: Scanning ${TargetUrl}..."
    $InvestPrompt = "Read ${BrainFile}. Navigate to ${TargetUrl}. CRITICAL: Use the native Playwright MCP protocol directly. DO NOT attempt to write or execute shell scripts to map the DOM. Map the DOM structure. Identify 3 nested components causing click/scroll friction. Output a precise list of files to modify."
    
    $InvestLog = Join-Path $LogDir "L${i}_Investigation.md"
    # The 2>&1 merges tool logs/errors into the stream, Tee-Object prints to console AND file simultaneously
    cursor-agent chat $InvestPrompt --trust 2>&1 | Tee-Object -FilePath $InvestLog
    Validate-AgentHealth $InvestLog

    # ---------------------------------------------------------
    # STEP 2: Master Plan & Blast Radius Targeting
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Planning" "LIVE AGENT STREAM: Drafting plan and selecting test..."
    $PlanPrompt = "Based on the investigation, draft a technical refactoring plan to flatten the UI. CRITICAL DIRECTIVE: Review the 'Available Tests' in ${BrainFile}. Based strictly on the files you plan to modify, identify the SINGLE most specific journey test script that will validate these changes. Write EXACTLY the npm command (e.g., 'npm run test:journey:governance') to the file ${TestTargetFile}. Do not write anything else to that file. Update ${BrainFile} with your intended codebase changes."
    
    $PlanLog = Join-Path $LogDir "L${i}_Plan.md"
    cursor-agent chat $PlanPrompt --trust 2>&1 | Tee-Object -FilePath $PlanLog
    Validate-AgentHealth $PlanLog

    # ---------------------------------------------------------
    # STEP 3: Implementation Check
    # ---------------------------------------------------------
    Update-Telemetry "Loop $i" "Implementation" "LIVE AGENT STREAM: Writing code..."
    $ImplPrompt = "Execute the code changes defined in your plan. DO NOT output code blocks in chat, write directly to the actual files."
    
    $ImplLog = Join-Path $LogDir "L${i}_Implementation.md"
    cursor-agent chat $ImplPrompt --trust 2>&1 | Tee-Object -FilePath $ImplLog
    Validate-AgentHealth $ImplLog

    if (-not (git status --porcelain)) {
        Update-Telemetry "Loop $i" "ERROR" "Phantom Edit detected (Agent wrote no files). Retrying."
        $ConsecutiveFailures++
        continue
    }

    # ---------------------------------------------------------
    # STEP 4: Targeted Verification (Fail-Fast)
    # ---------------------------------------------------------
    $TargetTest = Get-Content $TestTargetFile -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($TargetTest) -or $TargetTest -notmatch "npm run test:") {
        $TargetTest = "npm run test:journey:governance" # Fallback
        Write-Host "[WARNING] Agent failed to select a valid test. Defaulting to: $TargetTest" -ForegroundColor Yellow
    }

    Update-Telemetry "Loop $i" "Verification" "Compiling CSS and running targeted test: $TargetTest"
    
    Write-Host "Rebuilding CSS..." -ForegroundColor DarkGray
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build:css" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow
    
    Write-Host "Running $TargetTest..." -ForegroundColor DarkGray
    # Execute the test natively so you can see the playwright output in real-time
    try {
        $TestProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $TargetTest" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow -PassThru
        $TestExitCode = $TestProcess.ExitCode
    } catch {
        $TestExitCode = 1
    }

    # ---------------------------------------------------------
    # STEP 5: Semantic Git Commit or Rollback
    # ---------------------------------------------------------
    if ($TestExitCode -eq 0) {
        Update-Telemetry "Loop $i" "SUCCESS" "Tests passed. Synthesizing semantic commit..."
        
        git add .
        $GitDiff = git diff --staged
        $DiffFile = Join-Path $LogDir "L${i}_Diff.patch"
        $GitDiff | Out-File $DiffFile

        $CommitPrompt = "Read the git diff in ${DiffFile}. Write a single, highly descriptive conventional commit message (e.g., 'refactor(ui): removed nested boxes in governance dashboard'). Output ONLY the commit message string, nothing else."
        
        # We capture this silently because it's just a commit string
        $CommitMsg = cursor-agent chat $CommitPrompt --trust
        
        if ([string]::IsNullOrWhiteSpace($CommitMsg)) { $CommitMsg = "Auto-Optimization Loop $i" }
        
        git commit -m "$CommitMsg" | Out-Null
        $ConsecutiveFailures = 0 
        
        $BrainContent = Get-Content $BrainFile -Raw
        $BrainContent -replace "(?s)## Failure Ledger.*", "## Failure Ledger:`n[Cleared after success]" | Set-Content $BrainFile
    } else {
        Update-Telemetry "Loop $i" "ROLLBACK" "Tests failed. Updating Failure Ledger."
        Add-Content -Path $BrainFile -Value "`n- LOOP $i FAILED running ${TargetTest}. Do NOT use the exact same logic."
        git reset --hard | Out-Null
        git clean -fd | Out-Null
        $ConsecutiveFailures++
    }
}

Update-Telemetry "Agent Run Complete" "Finished" "Review Branch: $BranchName"
Get-Process -Name "cursor-agent" -ErrorAction SilentlyContinue | Stop-Process -Force