[CmdletBinding()]
Param(
    [string]$Target = "governance",
    [string]$TargetHost = "127.0.0.1",
    [int]$MaxLoops = 3,
    [int]$CircuitBreakerThreshold = 2,
    [double]$AutoPushWhenTrustAbove = 0.0,
    [switch]$DoPush,
    [switch]$SkipMcp,
    [switch]$DryRun
)

# =============================================================================
# AutoHacker — agentic UX friction reducer (.autohacker/)
# Evidence: metric-driven collectors | Loop: Investigate -> Plan -> Build -> Verify
# Memory: failure ledger, prompt patches, collector escalation
# =============================================================================

$ErrorActionPreference = "Stop"
$ToolRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ToolRoot
Set-Location $ProjectRoot

$ConfigDir = Join-Path $ToolRoot "config"
$RunsDir = Join-Path $ToolRoot "runs"
$MemoryDir = Join-Path $ToolRoot "memory"
$OrchestratorPath = $MyInvocation.MyCommand.Path

foreach ($Dir in @($RunsDir, $MemoryDir)) {
    if (-not (Test-Path $Dir)) { New-Item -ItemType Directory -Path $Dir -Force | Out-Null }
}

$RunId = (Get-Date).ToString("yyyyMMdd_HHmmss")
$RunDir = Join-Path $RunsDir $RunId
New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$BrainFile = Join-Path $RunDir "brain.md"
$TelemetryFile = Join-Path $RunDir "telemetry.md"
$TestTargetFile = Join-Path $RunDir "test_target.txt"
$EvidenceBundleFile = Join-Path $RunDir "evidence-bundle.json"
$FailureLedgerFile = Join-Path $MemoryDir "failure-ledger.json"
$MetricBaselineFile = Join-Path $MemoryDir "metric-baseline.json"
$PromptPatchesFile = Join-Path $MemoryDir "prompt-patches.json"
$EscalationFile = Join-Path $MemoryDir "collector-escalation.json"

if (Test-Path $OrchestratorPath) {
    $OrcInfo = Get-Item $OrchestratorPath
    if (-not $OrcInfo.IsReadOnly) { $OrcInfo.IsReadOnly = $true }
}

function Read-JsonConfig {
    param([string]$Path, $Defaults)
    if (-not (Test-Path $Path)) { return $Defaults }
    try { return (Get-Content $Path -Raw | ConvertFrom-Json) } catch { return $Defaults }
}

$ValuesCfg = Read-JsonConfig (Join-Path $ConfigDir "values.json") @{
    coreValues = @("Customer", "Realism & Simplicity", "Speed & Trust")
    metricThresholds = @{ maxScrollToValuePx = 600; maxStickyChromeRatio = 0.4; maxFoldDeadBandPx = 350 }
    trustWeights = @{ evidenceComplete = 0.3; testsPass = 0.4; metricsImprove = 0.3 }
}
$TargetsCfg = Read-JsonConfig (Join-Path $ConfigDir "targets.json") @{}
$CollectorsCfg = Read-JsonConfig (Join-Path $ConfigDir "collectors.json") @{ collectors = @() }

$TargetDef = $TargetsCfg.$Target
if (-not $TargetDef) {
    Write-Host "[FATAL] Unknown target '$Target'. Add to .autohacker/config/targets.json" -ForegroundColor Red
    Exit 1
}

$TargetPath = if ($TargetDef.path.StartsWith("/")) { $TargetDef.path } else { "/$($TargetDef.path)" }
$DefaultTestFallback = if ($TargetDef.defaultTest) { $TargetDef.defaultTest } else { "npm run test:e2e" }
$CoreValues = @($ValuesCfg.coreValues)
$Directives = @($ValuesCfg.directives)
$DesktopViewport = $ValuesCfg.viewports.desktop
$MobileViewport = $ValuesCfg.viewports.mobile

function Read-MemoryJson { param([string]$Path)
    if (-not (Test-Path $Path)) { return @{} }
    try { return (Get-Content $Path -Raw | ConvertFrom-Json) } catch { return @{} }
}
function Write-MemoryJson { param([string]$Path, $Object)
    $Object | ConvertTo-Json -Depth 14 | Set-Content -Path $Path -Encoding UTF8
}

function Get-CollectorTier {
    $Esc = Read-MemoryJson $EscalationFile
    $Key = "target::$Target"
    if ($Esc.PSObject.Properties.Name -contains $Key -and $Esc.$Key.tier) { return [int]$Esc.$Key.tier }
    return 1
}
function Set-CollectorTier { param([int]$Tier)
    $Esc = @{}
    if (Test-Path $EscalationFile) { $Esc = Read-MemoryJson $EscalationFile }
    $Esc | Add-Member -NotePropertyName "target::$Target" -NotePropertyValue (@{ tier = $Tier; updatedAt = (Get-Date).ToString("o") }) -Force
    Write-MemoryJson $EscalationFile $Esc
}

function Get-PromptPatchesText {
    $Patches = Read-MemoryJson $PromptPatchesFile
    if (-not $Patches.items) { return "" }
    $Lines = @($Patches.items | ForEach-Object { "- $($_.text)" })
    if ($Lines.Count -eq 0) { return "" }
    return "`n`nPrior failures — DO NOT repeat:`n" + ($Lines -join "`n")
}

function Add-PromptPatch { param([string]$Text)
    $Patches = Read-MemoryJson $PromptPatchesFile
    $List = [System.Collections.ArrayList]@()
    if ($Patches.items) { $List.AddRange(@($Patches.items)) | Out-Null }
    [void]$List.Add(@{ text = $Text; at = (Get-Date).ToString("o"); runId = $RunId })
    if ($List.Count -gt 25) { $List = [System.Collections.ArrayList]@($List[-25..-1]) }
    Write-MemoryJson $PromptPatchesFile @{ items = @($List) }
}

function Update-Telemetry { param($Phase, $Status, $Details)
    $Ts = (Get-Date).ToString("HH:mm:ss")
    @"
# Agent Telemetry
**Run:** $RunId | **Target:** $script:TargetUrl | **Tier:** $(Get-CollectorTier)

### $Phase — $Status
$Details
Updated: $Ts
"@ | Set-Content -Path $TelemetryFile
    Write-Host "`n[$Ts] $Phase | $Status — $Details" -ForegroundColor Cyan
}

function Validate-AgentHealth { param([string]$LogFilePath)
    if (-not (Test-Path $LogFilePath)) { return }
    $C = Get-Content $LogFilePath -Raw
    if ($C -match "(?i)(quota exceeded|unauthorized|out of tokens)") { Exit 1 }
}

function Get-AvailableTests {
    $P = Join-Path $ProjectRoot "package.json"
    if (-not (Test-Path $P)) { return "npm run test:e2e" }
    $Names = (Get-Content $P | ConvertFrom-Json).scripts.PSObject.Properties |
        Where-Object { $_.Name -match "^test:" } | Select-Object -ExpandProperty Name
    return ($Names -join ", ")
}

function Invoke-CursorAgent {
    param([string]$Prompt, [string]$LogFilePath = $null, [switch]$UseMcp, [string]$Mode = $null)
    if ($DryRun) {
        if ($LogFilePath) { Set-Content -Path $LogFilePath -Value "# DRY RUN`n$Prompt" }
        return
    }
    $Args = @("--print", "--trust", "--force", "--workspace", $ProjectRoot)
    if ($UseMcp -and -not $SkipMcp) { $Args += "--approve-mcps" }
    if ($Mode -eq "plan") { $Args += "--plan" }
    $Args += $Prompt
    if ($LogFilePath) { cursor-agent @Args 2>&1 | Tee-Object -FilePath $LogFilePath }
    else { cursor-agent @Args 2>&1 }
}

function Resolve-TargetBaseUrl {
    $PortFile = Join-Path $ProjectRoot ".delivera-dev-port"
    Start-Process cmd.exe -ArgumentList "/c node scripts/Delivera-Dev-Port-Guard-01Check.js" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow | Out-Null
    if (Test-Path $PortFile) {
        $Port = (Get-Content $PortFile -Raw).Trim()
        if ($Port -match '^\d+$') { return "http://${TargetHost}:${Port}" }
    }
    return "http://${TargetHost}:3001"
}

function Ensure-DevServer { param([string]$Url)
    $Uri = [Uri]$Url
    $Health = "$($Uri.Scheme)://$($Uri.Host):$($Uri.Port)/healthz"
    for ($pass = 0; $pass -lt 2; $pass++) {
        try {
            $R = Invoke-WebRequest -Uri $Health -UseBasicParsing -TimeoutSec 5
            if ($R.StatusCode -eq 200) { return $true }
        } catch {}
        if ($pass -eq 0) {
            Start-Process cmd.exe -ArgumentList "/c npm run start" -WorkingDirectory $ProjectRoot -WindowStyle Hidden | Out-Null
            Start-Sleep -Seconds 4
        }
    }
    for ($a = 1; $a -le 25; $a++) {
        Start-Sleep -Seconds 2
        try {
            $R = Invoke-WebRequest -Uri $Health -UseBasicParsing -TimeoutSec 5
            if ($R.StatusCode -eq 200) { return $true }
        } catch {}
    }
    return $false
}

function Invoke-Collectors { param([int]$Tier, [string]$BaseUrl, [string]$OutRunDir)
    $env:BASE_URL = $BaseUrl
    $env:HEADLESS = "1"
    $env:AUTOHACKER_RUN_DIR = $OutRunDir
    $env:AUTOHACKER_RUN_ID = $RunId
    $env:AUTOHACKER_TARGET = $Target
    $Results = @{ tier = $Tier; collectors = @(); outputs = @(); ok = $true }

    $List = @($CollectorsCfg.collectors | Where-Object { [int]$_.tier -le $Tier })
    foreach ($Col in $List) {
        if ($Col.env) {
            foreach ($Prop in $Col.env.PSObject.Properties) {
                Set-Item -Path "env:$($Prop.Name)" -Value $Prop.Value
            }
        }
        $Cmd = ($Col.cmd -replace '\{runId\}', $RunId)
        Write-Host "  [$($Col.id)] tier $($Col.tier): $Cmd" -ForegroundColor DarkGray
        if ($DryRun) { continue }
        $Proc = Start-Process cmd.exe -ArgumentList "/c $Cmd" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow -PassThru
        $Entry = @{ id = $Col.id; exitCode = $Proc.ExitCode; outputs = @() }
        foreach ($Rel in $Col.outputs) {
            $Rel2 = $Rel -replace '\{runId\}', $RunId
            $Abs = if ([System.IO.Path]::IsPathRooted($Rel2)) { $Rel2 } else { Join-Path $ProjectRoot ($Rel2 -replace '/', '\') }
            if (Test-Path $Abs) {
                $Entry.outputs += $Abs
                $Results.outputs += $Abs
            }
        }
        if ($Proc.ExitCode -ne 0) { $Results.ok = $false }
        $Results.collectors += $Entry
    }
    return $Results
}

function Merge-EvidenceBundle {
    param($CollectorResult, [string]$BaseUrl, [string]$TargetFullUrl)
    $Bundle = @{
        runId = $RunId; target = $Target; url = $TargetFullUrl; baseUrl = $BaseUrl
        tier = $CollectorResult.tier; capturedAt = (Get-Date).ToString("o")
        artifacts = @($CollectorResult.outputs); metrics = @{}; trustHints = @{ evidenceComplete = $false }
    }
    $MetricsSnap = Join-Path $RunDir "metrics-snapshot.json"
    if (Test-Path $MetricsSnap) {
        try { $Bundle.metrics.ux = (Get-Content $MetricsSnap -Raw | ConvertFrom-Json) } catch {}
    }
    foreach ($Art in $CollectorResult.outputs) {
        if (-not (Test-Path $Art)) { continue }
        if ($Art -match "click-audit|clickmap") {
            try {
                $J = Get-Content $Art -Raw | ConvertFrom-Json
                if ($J.summary) { $Bundle.metrics.brokenClickCount = [int]$J.summary.failed }
            } catch {}
        }
    }
    $Bundle.trustHints.evidenceComplete = ($Bundle.artifacts.Count -ge 2)
    if (-not $DryRun) {
        $Bundle | ConvertTo-Json -Depth 14 | Set-Content -Path $EvidenceBundleFile -Encoding UTF8
    }
    return $Bundle
}

function Get-LoopMetrics { param($Bundle)
    $M = @{ scrollToPrimaryValuePx = 9999; stickyChromeRatio = 0.5; foldDeadBandPx = 9999; brokenClickCount = 0; overlapPxTotal = 0 }
    if ($Bundle.metrics.ux) {
        $U = $Bundle.metrics.ux
        if ($null -ne $U.scrollToPrimaryValuePx) { $M.scrollToPrimaryValuePx = [double]$U.scrollToPrimaryValuePx }
        if ($null -ne $U.stickyChromeRatio) { $M.stickyChromeRatio = [double]$U.stickyChromeRatio }
        if ($null -ne $U.foldDeadBandPx) { $M.foldDeadBandPx = [double]$U.foldDeadBandPx }
        if ($null -ne $U.overlapPxTotal) { $M.overlapPxTotal = [double]$U.overlapPxTotal }
    }
    if ($Bundle.metrics.brokenClickCount) { $M.brokenClickCount = [int]$Bundle.metrics.brokenClickCount }
    return $M
}

function Compare-MetricsImproved { param($Before, $After)
    $Improved = 0; $Regressed = 0; $Notes = @()
    foreach ($Key in @("scrollToPrimaryValuePx", "foldDeadBandPx", "brokenClickCount", "overlapPxTotal")) {
        if ($null -eq $Before.$Key -or $null -eq $After.$Key) { continue }
        if ($After.$Key -lt $Before.$Key) { $Improved++; $Notes += "$Key $($Before.$Key)->$($After.$Key)" }
        elseif ($After.$Key -gt $Before.$Key) { $Regressed++; $Notes += "$Key REGRESSED $($Before.$Key)->$($After.$Key)" }
    }
    if ($After.stickyChromeRatio -lt $Before.stickyChromeRatio) { $Improved++ }
    elseif ($After.stickyChromeRatio -gt $Before.stickyChromeRatio) { $Regressed++ }
    $Pass = ($Regressed -eq 0) -and (($Improved -gt 0) -or ($After.brokenClickCount -eq 0 -and $Before.brokenClickCount -eq 0))
    return @{ improved = $Improved; regressed = $Regressed; notes = $Notes; pass = $Pass }
}

function Get-TrustScore { param([bool]$TestsPass, $MetricCompare, $Bundle)
    $W = $ValuesCfg.trustWeights
    $Score = 0.0
    if ($Bundle.trustHints.evidenceComplete) { $Score += [double]$W.evidenceComplete }
    if ($TestsPass) { $Score += [double]$W.testsPass }
    if ($MetricCompare.pass) { $Score += [double]$W.metricsImprove }
    return [math]::Round($Score, 3)
}

function Initialize-Brain { param($Bundle, [string]$Tests)
    $V = $CoreValues -join ", "
    $D = $Directives -join "; "
    @"
Run ID: $RunId
Target: $script:TargetUrl
Core Values: $V
Directives: $D
Evidence: $EvidenceBundleFile
Tier: $(Get-CollectorTier)
Tests: $Tests
Artifacts:
$($Bundle.artifacts | ForEach-Object { "- $_" } | Out-String)
Memory: $PromptPatchesFile
"@ | Set-Content -Path $BrainFile
}

function Get-InvestigationPrompt { param($InvestLog, [int]$LoopIndex, [string]$PatchText)
    $V = $CoreValues -join ", "
    @"
Read $BrainFile and $EvidenceBundleFile. Metrics-first (foldDeadBandPx, scrollToPrimaryValuePx, stickyChromeRatio) — not DOM trees.

Investigation Loop $LoopIndex on $script:TargetUrl:
Desktop ($DesktopViewport) + mobile ($MobileViewport). Use Playwright MCP to confirm metric hotspots OR terminal Playwright — never report MCP status.

1. Console errors with repro; positive + negative journeys.
2. Layout/CSS fixes for dead vertical space — cite metric numbers.
3. 20+ click/scroll reductions with source files and evidence paths.
4. Values: $V.
$PatchText

Write brief to $InvestLog. Do not edit .autohacker/AutoHacker.ps1 or app code yet.
"@

function Get-MasterPlanPrompt { param($InvestLog, $PlanLog, [int]$LoopIndex, [string]$PatchText)
    $V = $CoreValues -join ", "
    @"
Read $BrainFile, $EvidenceBundleFile, $InvestLog. Master Plan Loop $LoopIndex.

Save to $PlanLog: 14+ improvements (each with metric target), 7+ bonus merges, 5+ edge cases, rationale vs $V. No timelines.

Write ONE npm line to $TestTargetFile. Plan Delivera-*-Validation-Tests.spec.js with geometry + console guards.
Do NOT implement. $PatchText
"@

function Get-BuildPrompt { param($PlanLog, $InvestLog, [int]$LoopIndex, [string]$PatchText)
    $V = $CoreValues -join ", "
    @"
Read $BrainFile, $InvestLog, $PlanLog, $EvidenceBundleFile. Build Loop $LoopIndex.

Implement plan: UX fixes, 4+ edge cases per major item, Playwright specs (UI queries + console, fail-fast, journey value not noise).
Run npm in $TestTargetFile before done. Do NOT modify .autohacker/AutoHacker.ps1.
$PatchText
"@

# --- Preflight ---
Update-Telemetry "Init" "Running" "Git branch, server, collectors..."
$RootGitIgnore = Join-Path $ProjectRoot ".gitignore"
if (Test-Path $RootGitIgnore) {
    $Gi = Get-Content $RootGitIgnore -Raw
    if ($Gi -notmatch '\.autohacker/runs') { Add-Content $RootGitIgnore "`n.autohacker/runs/`n.autohacker/memory/" }
}

if (-not $DryRun) {
    if (git status --porcelain) { git stash push -m "autohacker-$RunId" | Out-Null }
    $BranchName = "autohacker-$RunId"
    git checkout -b $BranchName | Out-Null
} else { $BranchName = "dry-run" }

$TargetBaseUrl = Resolve-TargetBaseUrl
$script:TargetUrl = "$TargetBaseUrl$TargetPath"

if (-not (Ensure-DevServer $script:TargetUrl)) { Update-Telemetry "Init" "FAILED" "Server down"; Exit 1 }

$Tier = Get-CollectorTier
$CollectorResult = Invoke-Collectors -Tier $Tier -BaseUrl $TargetBaseUrl -OutRunDir $RunDir
$Bundle = Merge-EvidenceBundle -CollectorResult $CollectorResult -BaseUrl $TargetBaseUrl -TargetFullUrl $script:TargetUrl
if ($Bundle.artifacts.Count -lt 1) { Update-Telemetry "Init" "FAILED" "No evidence"; Exit 1 }

Initialize-Brain -Bundle $Bundle -Tests (Get-AvailableTests)
$PatchText = Get-PromptPatchesText
$ConsecutiveFailures = 0

for ($i = 1; $i -le $MaxLoops; $i++) {
    if ($ConsecutiveFailures -ge $CircuitBreakerThreshold) { break }

    $InvestLog = Join-Path $RunDir "L${i}_Investigation.md"
    $PlanLog = Join-Path $RunDir "L${i}_Plan.md"
    $BuildLog = Join-Path $RunDir "L${i}_Implementation.md"

    Update-Telemetry "Loop $i" "Evidence" "Tier $Tier"
    $CollectorResult = Invoke-Collectors -Tier $Tier -BaseUrl $TargetBaseUrl -OutRunDir $RunDir
    $Bundle = Merge-EvidenceBundle -CollectorResult $CollectorResult -BaseUrl $TargetBaseUrl -TargetFullUrl $script:TargetUrl
    $MetricsBefore = Get-LoopMetrics -Bundle $Bundle

    Update-Telemetry "Loop $i" "Investigate" "Cursor"
    Invoke-CursorAgent -Prompt (Get-InvestigationPrompt $InvestLog $i $PatchText) -LogFilePath $InvestLog -UseMcp
    Validate-AgentHealth $InvestLog
    if ((Test-Path $InvestLog) -and (Get-Item $InvestLog).Length -lt 300 -and $Tier -lt 3) {
        $Tier = [Math]::Min(3, $Tier + 1); Set-CollectorTier $Tier
        Add-PromptPatch "Loop $i thin investigation — tier $Tier"
        $PatchText = Get-PromptPatchesText
    }

    Update-Telemetry "Loop $i" "Plan" "Master plan"
    Invoke-CursorAgent -Prompt (Get-MasterPlanPrompt $InvestLog $PlanLog $i $PatchText) -LogFilePath $PlanLog -UseMcp -Mode plan
    Validate-AgentHealth $PlanLog

    Update-Telemetry "Loop $i" "Build" "Implement"
    Invoke-CursorAgent -Prompt (Get-BuildPrompt $PlanLog $InvestLog $i $PatchText) -LogFilePath $BuildLog -UseMcp
    Validate-AgentHealth $BuildLog

    if (-not $DryRun -and -not (git status --porcelain)) {
        Add-PromptPatch "Loop $i phantom edit"
        $ConsecutiveFailures++; continue
    }

    $TargetTest = (Get-Content $TestTargetFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($TargetTest) -or $TargetTest -notmatch "npm run test:") {
        $TargetTest = $DefaultTestFallback
        Set-Content $TestTargetFile $TargetTest
    }

    $TestExitCode = 1
    if (-not $DryRun) {
        Start-Process cmd.exe -ArgumentList "/c npm run build:css" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow | Out-Null
        for ($Attempt = 1; $Attempt -le 2; $Attempt++) {
            $Tp = Start-Process cmd.exe -ArgumentList "/c $TargetTest" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow -PassThru
            $TestExitCode = $Tp.ExitCode
            if ($TestExitCode -eq 0) { break }
        }
    } else { $TestExitCode = 0 }

    $PostCollector = Invoke-Collectors -Tier $Tier -BaseUrl $TargetBaseUrl -OutRunDir $RunDir
    $PostBundle = Merge-EvidenceBundle -CollectorResult $PostCollector -BaseUrl $TargetBaseUrl -TargetFullUrl $script:TargetUrl
    $MetricsAfter = Get-LoopMetrics -Bundle $PostBundle
    $MetricCompare = Compare-MetricsImproved -Before $MetricsBefore -After $MetricsAfter
    $Trust = Get-TrustScore -TestsPass ($TestExitCode -eq 0) -MetricCompare $MetricCompare -Bundle $PostBundle

    Update-Telemetry "Loop $i" "Trust" "score=$Trust"

    if ($TestExitCode -eq 0 -and $MetricCompare.regressed -eq 0) {
        if (-not $DryRun) {
            git add .
            $Msg = (Invoke-CursorAgent -Prompt "Read staged diff. Output one conventional commit message only." | Out-String).Trim()
            if ([string]::IsNullOrWhiteSpace($Msg)) { $Msg = "feat(autohacker): metric-driven UX tooling loop $i" }
            git commit -m ($Msg -replace "`r?`n", " ") | Out-Null
            Write-MemoryJson $MetricBaselineFile $MetricsAfter
            if ($DoPush -or ($AutoPushWhenTrustAbove -gt 0 -and $Trust -ge $AutoPushWhenTrustAbove)) {
                git push -u origin $BranchName 2>&1
            }
        }
        $ConsecutiveFailures = 0
        Update-Telemetry "Loop $i" "SUCCESS" "trust=$Trust"
    } else {
        $Reason = if ($TestExitCode -ne 0) { "tests failed" } else { "metric regression" }
        Add-PromptPatch "Loop $i $Reason"
        if (-not $DryRun) { git reset --hard | Out-Null; git clean -fd | Out-Null }
        $ConsecutiveFailures++
        if ($Tier -lt 3) { $Tier++; Set-CollectorTier $Tier }
        $PatchText = Get-PromptPatchesText
        Update-Telemetry "Loop $i" "ROLLBACK" $Reason
    }
}

Update-Telemetry "Done" "Finished" "RunDir: $RunDir"
Get-Process -Name "cursor-agent" -ErrorAction SilentlyContinue | Stop-Process -Force
