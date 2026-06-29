[CmdletBinding()]
Param(
    [string]$Target = "governance",
    [string]$TargetHost = "127.0.0.1",
    [int]$MaxLoops = 3,
    [int]$CircuitBreakerThreshold = 2,
    [double]$AutoPushWhenTrustAbove = 0.0,
    [int]$MinExplorationIdeas = 20,
    [switch]$DoPush,
    [switch]$SkipMcp,
    [switch]$RequireMcp,
    [switch]$AllowDegradedEvidence,
    [switch]$DryRun,
    [switch]$SkipCursorPhases,
    [switch]$ValidateOrchestratorOnly,
    [switch]$PauseBetweenPhases
)

# AutoHacker v6 - Collectors v5 + evidence digest + 11 gates + MCP preflight
# Phase 0 Explore -> Investigate -> Plan -> Build -> Verify (3-phase Cursor workflow)

$ErrorActionPreference = "Stop"
$ToolRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ToolRoot
Set-Location $ProjectRoot

if (-not $PSBoundParameters.ContainsKey('RequireMcp')) { $RequireMcp = $true }

$ConfigDir = Join-Path $ToolRoot "config"
$PromptsDir = Join-Path $ToolRoot "prompts"
$RunsDir = Join-Path $ToolRoot "runs"
$MemoryDir = Join-Path $ToolRoot "memory"

foreach ($Dir in @($RunsDir, $MemoryDir)) {
    if (-not (Test-Path $Dir)) { New-Item -ItemType Directory -Path $Dir -Force | Out-Null }
}

$RunId = (Get-Date).ToString("yyyyMMdd_HHmmss")
$RunDir = Join-Path $RunsDir $RunId
New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

$BrainFile = Join-Path $ProjectRoot "AI_State_Brain.md"
$RootTelemetryMirror = Join-Path $ProjectRoot "Agent_Telemetry_Board.md"
$ProgressLog = Join-Path $RunDir "progress.log"
$TelemetryFile = Join-Path $RunDir "telemetry.md"
$TestTargetFile = Join-Path $ProjectRoot ".agent_test_target"
$EvidenceBundleFile = Join-Path $RunDir "evidence-bundle.json"
$EvidenceDigestFile = Join-Path $RunDir "evidence-digest.md"
$ExplorationJson = Join-Path $RunDir "exploration-report.json"
$ExplorationMd = Join-Path $RunDir "exploration-report.md"
$HiddenValueJson = Join-Path $RunDir "hidden-value-report.json"
$VoidJson = Join-Path $RunDir "intra-card-void-report.json"
$StateMatrixJson = Join-Path $RunDir "state-matrix-summary.json"
$ScreenshotFoldPath = Join-Path $RunDir "screenshots\desktop-fold.png"
$ScreenshotDensityJson = Join-Path $RunDir "screenshot-density-report.json"
$DuplicateTextJson = Join-Path $RunDir "duplicate-text-report.json"
$DuplicateFullJson = Join-Path $RunDir "duplicate-text-full-catalog-report.json"
$MetricBaselineFile = Join-Path $MemoryDir "metric-baseline.json"
$PromptPatchesFile = Join-Path $MemoryDir "prompt-patches.json"
$EscalationFile = Join-Path $MemoryDir "collector-escalation.json"
$McpConfigFile = Join-Path $ProjectRoot ".cursor\mcp.json"

function Read-JsonConfig {
    param([string]$Path, $Defaults)
    if (-not (Test-Path $Path)) { return $Defaults }
    try { return (Get-Content $Path -Raw | ConvertFrom-Json) } catch { return $Defaults }
}

function Read-JsonFile { param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    try { return (Get-Content $Path -Raw | ConvertFrom-Json) } catch { return $null }
}

$ValuesCfg = Read-JsonConfig (Join-Path $ConfigDir "values.json") @{
    coreValues = @("Customer", "Realism & Simplicity", "Speed & Trust")
    metricThresholds = @{
        maxScrollToValuePx = 600; maxStickyChromeRatio = 0.45; maxFoldDeadBandPx = 200
        maxIntraCardVoidPx = 120; maxHiddenValueCount = 8; maxLeftWhitespaceRatio = 0.55
        maxDuplicateInstances = 1; maxBrokenClicks = 0; minExplorationIdeas = 20
    }
    trustWeights = @{
        evidenceComplete = 0.15; explorationQuality = 0.1; testsPass = 0.3; metricsImprove = 0.2
        stateMatrixPass = 0.1; mcpEnrichment = 0.1; screenshotDensityPass = 0.05
    }
}
$TargetsCfg = Read-JsonConfig (Join-Path $ConfigDir "targets.json") @{}
$CollectorsCfg = Read-JsonConfig (Join-Path $ConfigDir "collectors.json") @{ collectors = @() }

$TargetDef = $TargetsCfg.$Target
if (-not $TargetDef) {
    Write-Host "[FATAL] Unknown target '$Target'. Add to .autohacker/config/targets.json" -ForegroundColor Red
    Exit 1
}

$TargetPath = if ($TargetDef.path.StartsWith("/")) { $TargetDef.path } else { "/$($TargetDef.path)" }
$DefaultTestFallback = if ($TargetDef.defaultTest) { $TargetDef.defaultTest } else { "npm run test:journey:governance-autohacker-v6" }
$JourneyUrls = @()
if ($TargetDef.journeyUrls) { $JourneyUrls = @($TargetDef.journeyUrls) }
$CoreValues = @($ValuesCfg.coreValues)
$DesktopViewport = $ValuesCfg.viewports.desktop
$MobileViewport = $ValuesCfg.viewports.mobile
$Mt = $ValuesCfg.metricThresholds
$MaxVoidPx = [int]$Mt.maxIntraCardVoidPx
$MaxHidden = [int]$Mt.maxHiddenValueCount
$MaxLeftWhite = [double]$Mt.maxLeftWhitespaceRatio
$MaxDupInstances = [int]$Mt.maxDuplicateInstances
$MaxBrokenClicks = [int]$Mt.maxBrokenClicks
$MaxSticky = [double]$Mt.maxStickyChromeRatio
$MinIdeas = if ($MinExplorationIdeas -gt 0) { $MinExplorationIdeas } else { [int]$Mt.minExplorationIdeas }

$script:McpPreflightOk = $false
$script:McpEnrichmentOk = $false

function Write-Progress {
    param([string]$Phase, [string]$Message)
    $Line = "[{0}] {1} | {2}" -f (Get-Date).ToString("HH:mm:ss"), $Phase, $Message
    Add-Content -Path $ProgressLog -Value $Line
    Write-Host $Line -ForegroundColor Green
}

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
    return "`n`nPrior failures - DO NOT repeat:`n" + ($Lines -join "`n")
}
function Add-PromptPatch { param([string]$Text)
    $Patches = Read-MemoryJson $PromptPatchesFile
    $List = [System.Collections.ArrayList]@()
    if ($Patches.items) { $List.AddRange(@($Patches.items)) | Out-Null }
    [void]$List.Add(@{ text = $Text; at = (Get-Date).ToString("o"); runId = $RunId })
    if ($List.Count -gt 25) { $List = [System.Collections.ArrayList]@($List[-25..-1]) }
    Write-MemoryJson $PromptPatchesFile @{ items = @($List) }
}

function Get-GateSnapshot {
    $G = @{
        h = (Test-HiddenValueGate)
        v = (Test-VoidGate)
        dup = (Test-DuplicateGate)
        mvoid = (Test-MainColumnVoidGate)
        fold = (Test-FoldClippingGate)
        hvoid = (Test-HorizontalVoidGate)
        overlap = (Test-ContentOverlapGate)
        sticky = (Test-StickyChromeGate)
        shot = (Test-ScreenshotDensityGate)
        nvoid = (Test-NegativeVoidGate)
        stateMatrix = (Test-StateMatrixGate)
        mcp = $script:McpEnrichmentOk
    }
    return $G
}

function Write-GateTelemetry { param([string]$Phase)
    $G = Get-GateSnapshot
    $Line = "Gates: h=$($G.h) v=$($G.v) dup=$($G.dup) mvoid=$($G.mvoid) fold=$($G.fold) hvoid=$($G.hvoid) overlap=$($G.overlap) sticky=$($G.sticky) shot=$($G.shot) nvoid=$($G.nvoid) stateMatrix=$($G.stateMatrix) mcp=$($G.mcp)"
    Write-Progress $Phase $Line
    return $G
}

function Update-Telemetry { param($Phase, $Status, $Details)
    $Ts = (Get-Date).ToString("HH:mm:ss")
    $G = Get-GateSnapshot
    $GateLine = "h=$($G.h) v=$($G.v) dup=$($G.dup) mvoid=$($G.mvoid) fold=$($G.fold) hvoid=$($G.hvoid) overlap=$($G.overlap) sticky=$($G.sticky) shot=$($G.shot) nvoid=$($G.nvoid) stateMatrix=$($G.stateMatrix) mcp=$($G.mcp)"
    Write-Progress $Phase "$Status - $Details"
    @"
# Agent Telemetry
**Run:** $RunId | **Target:** $script:TargetUrl | **Tier:** $(Get-CollectorTier)

### $Phase - $Status
$Details

**Gates:** $GateLine
Evidence digest: $EvidenceDigestFile
Progress: $ProgressLog
Updated: $Ts
"@ | Set-Content -Path $TelemetryFile
    @"
# Agent Telemetry Dashboard
**Run ID:** $RunId | **Target:** $script:TargetUrl
**Last Update:** $Ts

### Current Status
* **Phase:** $Phase
* **Status:** $Status
* **Details:** $Details
* **Gates:** $GateLine
"@ | Set-Content -Path $RootTelemetryMirror
}

function Get-JourneyUrlTokens {
    $Base = $script:TargetBaseUrl
    $Urls = @()
    foreach ($Rel in $JourneyUrls) {
        $P = if ($Rel.StartsWith("/")) { $Rel } else { "/$Rel" }
        $Urls += "$Base$P"
    }
    if ($Urls.Count -lt 2 -and $Urls.Count -ge 1) { return @{ JOURNEY_URLS = ($Urls -join "`n"); JOURNEY_URL_2 = $Urls[0] } }
    if ($Urls.Count -ge 2) { return @{ JOURNEY_URLS = ($Urls -join "`n"); JOURNEY_URL_2 = $Urls[1] } }
    return @{ JOURNEY_URLS = $script:TargetUrl; JOURNEY_URL_2 = $script:TargetUrl }
}

function Get-MetricSnapshotForTokens {
    $H = Read-JsonFile $HiddenValueJson
    $S = Read-JsonFile $ScreenshotDensityJson
    $E = Read-JsonFile $ExplorationJson
    $D = Read-JsonFile $DuplicateFullJson
    if (-not $D) { $D = Read-JsonFile $DuplicateTextJson }
    $Broken = 0
    if ($E -and $E.summary -and $E.summary.brokenInteractions) { $Broken = [int]$E.summary.brokenInteractions }
  elseif ($E -and $E.clickResults) {
        $Broken = @($E.clickResults | Where-Object { $_.ok -eq $false }).Count
    }
    return @{
        HIDDEN_VALUE_COUNT = if ($H) { "$($H.hiddenValueCount)" } else { "?" }
        LEFT_WHITESPACE_RATIO = if ($S) { "$($S.leftWhitespaceRatio)" } else { "?" }
        MAX_LEFT_WHITESPACE = "$MaxLeftWhite"
        DUPLICATE_COUNT = if ($D) { "$($D.duplicateCount)" } else { "0" }
        BROKEN_CLICK_COUNT = "$Broken"
    }
}

function Expand-PromptTemplate {
    param([string]$TemplateFile, [hashtable]$Tokens)
    if (-not (Test-Path $TemplateFile)) { throw "Missing prompt template: $TemplateFile" }
    $Text = Get-Content $TemplateFile -Raw
    foreach ($Key in $Tokens.Keys) { $Text = $Text -replace [regex]::Escape("{{$Key}}"), [string]$Tokens[$Key] }
    return $Text
}

function Get-PromptTokens {
    param([int]$LoopIndex = 0, [string]$InvestLog = "", [string]$PlanLog = "", [string]$BuildLog = "", [string]$PatchText = "")
    $Base = @{
        TARGET_URL = $script:TargetUrl
        BRAIN_FILE = $BrainFile
        EVIDENCE_BUNDLE = $EvidenceBundleFile
        EVIDENCE_DIGEST = $EvidenceDigestFile
        EXPLORATION_JSON = $ExplorationJson
        EXPLORATION_MD = $ExplorationMd
        HIDDEN_VALUE_JSON = $HiddenValueJson
        VOID_JSON = $VoidJson
        STATE_MATRIX_JSON = $StateMatrixJson
        SCREENSHOT_FOLD_PATH = $ScreenshotFoldPath
        INVEST_LOG = $InvestLog
        PLAN_LOG = $PlanLog
        BUILD_LOG = $BuildLog
        TEST_TARGET_FILE = $TestTargetFile
        DESKTOP_VIEWPORT = $DesktopViewport
        MOBILE_VIEWPORT = $MobileViewport
        CORE_VALUES = ($CoreValues -join ", ")
        LOOP_INDEX = "$LoopIndex"
        PATCH_TEXT = $PatchText
        PROGRESS_LOG = $ProgressLog
        RUN_ID = $RunId
    }
    foreach ($KV in (Get-JourneyUrlTokens).GetEnumerator()) { $Base[$KV.Key] = $KV.Value }
    foreach ($KV in (Get-MetricSnapshotForTokens).GetEnumerator()) { $Base[$KV.Key] = $KV.Value }
    return $Base
}

function Wait-PhaseGate { param([string]$PhaseName)
    if (-not $PauseBetweenPhases) { return }
    Write-Host "`n=== PAUSE: Review $PhaseName. Press Enter to continue ===" -ForegroundColor Yellow
    Read-Host | Out-Null
}

function Test-ExplorationGate {
    if (-not (Test-Path $ExplorationJson)) { return $false }
    try {
        $J = Get-Content $ExplorationJson -Raw | ConvertFrom-Json
        $Real = if ($J.summary.realIdeaCount) { [int]$J.summary.realIdeaCount } else { @($J.clickReductionIdeas).Count }
        $Quality = if ($null -ne $J.summary.qualityPass) { [bool]$J.summary.qualityPass } else { $Real -ge $MinIdeas }
        return ($Real -ge $MinIdeas) -and $Quality -and (-not $J.summary.paddedToTwenty)
    } catch { return $false }
}

function Test-HiddenValueGate {
    if (-not (Test-Path $HiddenValueJson)) { return $true }
    try { return [int]((Get-Content $HiddenValueJson -Raw | ConvertFrom-Json).hiddenValueCount) -le $MaxHidden } catch { return $true }
}

function Test-VoidGate {
    if (-not (Test-Path $VoidJson)) { return $true }
    try { return [int]((Get-Content $VoidJson -Raw | ConvertFrom-Json).maxVoidPx) -le $MaxVoidPx } catch { return $true }
}

function Test-ScreenshotDensityGate {
    $J = Read-JsonFile $ScreenshotDensityJson
    if (-not $J) { return $true }
    if ($null -eq $J.leftWhitespaceRatio) { return $J.pass -ne $false }
    return ([double]$J.leftWhitespaceRatio -le $MaxLeftWhite) -and ($J.pass -ne $false)
}

function Test-DuplicateGate {
    $J = Read-JsonFile $DuplicateFullJson
    if (-not $J) { $J = Read-JsonFile $DuplicateTextJson }
    if (-not $J) { return $true }
    if ($J.duplicates -and $J.duplicates.Count -gt 0) {
        $Worst = ($J.duplicates | ForEach-Object { [int]$_.count } | Measure-Object -Maximum).Maximum
        return $Worst -le ($MaxDupInstances + 1)
    }
    return $true
}

function Test-MainColumnVoidGate {
    $J = Read-JsonFile (Join-Path $RunDir "main-column-void-report.json")
    if (-not $J) { return $true }
    return ($J.pass -ne $false) -and (-not $J.stackingDetected)
}

function Test-FoldClippingGate {
    $J = Read-JsonFile (Join-Path $RunDir "fold-clipping-report.json")
    if (-not $J) { return $true }
    return $J.pass -ne $false
}

function Test-HorizontalVoidGate {
    $J = Read-JsonFile (Join-Path $RunDir "horizontal-void-report.json")
    if (-not $J) { return $true }
    return $J.pass -ne $false
}

function Test-ContentOverlapGate {
    $J = Read-JsonFile (Join-Path $RunDir "content-overlap-report.json")
    if (-not $J) { return $true }
    return $J.pass -ne $false
}

function Test-NegativeVoidGate {
    $J = Read-JsonFile (Join-Path $RunDir "negative-void-report.json")
    if (-not $J) { return $true }
    return ($J.pass -ne $false) -and (-not $J.stackingDetected)
}

function Test-StickyChromeGate {
    $J = Read-JsonFile (Join-Path $RunDir "metrics-snapshot.json")
    if (-not $J) { return $true }
    $Ratio = if ($J.stickyChromeRatio) { [double]$J.stickyChromeRatio } else { 0 }
    return $Ratio -le $MaxSticky
}

function Test-StateMatrixGate {
    $J = Read-JsonFile $StateMatrixJson
    if (-not $J) { return $false }
    return [bool]$J.pass
}

function Test-AllEvidenceGates {
    $G = Get-GateSnapshot
    $Fail = @($G.Keys | Where-Object { $_ -ne 'mcp' -and $G[$_] -eq $false })
    return @{ pass = ($Fail.Count -eq 0); failed = $Fail; gates = $G }
}

function Test-McpEnrichmentGate { param([string]$ExploreLogPath)
    if (-not (Test-Path $ExploreLogPath)) { return $false }
    $C = Get-Content $ExploreLogPath -Raw
    if ($C -match 'MCP_BLOCKED') { return $false }
    if ($C.Length -lt 1200) { return $false }
    return ($C -match '(?i)MCP enrichment|screenshot|desktop-fold|Playwright MCP')
}

function Test-InvestigationGate { param([string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    $C = Get-Content $Path -Raw
    return ($C.Length -ge 800) -and ($C -match "(?i)click|scroll|void|hidden|foldDeadBand|whitespace|duplicate")
}

function Test-PlanGate { param([string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    $C = Get-Content $Path -Raw
    return ($C.Length -ge 600) -and ($C -match "(?i)improvement|edge case|rationale")
}

function Validate-AgentHealth { param([string]$LogFilePath)
    if (-not (Test-Path $LogFilePath)) { return }
    if ((Get-Content $LogFilePath -Raw) -match "(?i)(quota exceeded|unauthorized|out of tokens)") { Exit 1 }
}

function Get-AvailableTests {
    $P = Join-Path $ProjectRoot "package.json"
    if (-not (Test-Path $P)) { return "npm run test:e2e" }
    return ((Get-Content $P | ConvertFrom-Json).scripts.PSObject.Properties | Where-Object { $_.Name -match "^test:" } | Select-Object -ExpandProperty Name) -join ", "
}

function Invoke-McpPreflight {
    $Ok = $true
    $Notes = @()
    $McpCli = Join-Path $ProjectRoot "node_modules\@playwright\mcp\cli.js"
    if (-not (Test-Path $McpCli)) {
        $Notes += "missing @playwright/mcp cli"
        $Ok = $false
    } else {
        $Ver = Start-Process cmd.exe -ArgumentList "/c node `"$McpCli`" --version" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow -PassThru
        if ($Ver.ExitCode -ne 0) { $Notes += "mcp cli --version failed"; $Ok = $false }
    }
    if (-not (Test-Path $McpConfigFile)) { $Notes += "missing .cursor/mcp.json"; $Ok = $false }
    $script:McpPreflightOk = $Ok
    Write-Progress "mcp-preflight" "ok=$Ok $($Notes -join '; ')"
    if ($RequireMcp -and -not $Ok -and -not $AllowDegradedEvidence -and -not $SkipMcp -and -not $ValidateOrchestratorOnly) {
        Write-Host "[FATAL] MCP preflight failed. Fix Playwright MCP or use -AllowDegradedEvidence for collector-only." -ForegroundColor Red
        Exit 1
    }
    return $Ok
}

function Invoke-CursorAgent {
    param([string]$Prompt, [string]$LogFilePath = $null, [switch]$UseMcp, [string]$Mode = $null, [string]$PhaseLabel = "cursor-agent")
    Write-Progress $PhaseLabel "Starting cursor-agent mode=$Mode mcp=$($UseMcp -and -not $SkipMcp)"
    if ($DryRun -or $SkipCursorPhases) {
        Write-Progress $PhaseLabel "Skipped (DryRun or SkipCursorPhases)"
        if ($LogFilePath) { Set-Content -Path $LogFilePath -Value "# SKIPPED`n$Prompt" }
        return
    }
    $AgentArgs = @("--print", "--trust", "--force", "--workspace", $ProjectRoot)
    if ($UseMcp -and -not $SkipMcp) { $AgentArgs += "--approve-mcps" }
    if ($Mode -eq "plan") { $AgentArgs += "--plan" }
    $AgentArgs += $Prompt
    if ($LogFilePath) { cursor-agent @AgentArgs 2>&1 | Tee-Object -FilePath $LogFilePath }
    else { cursor-agent @AgentArgs 2>&1 }
    Write-Progress $PhaseLabel "Finished"
}

function Resolve-TargetBaseUrl {
    Start-Process cmd.exe -ArgumentList "/c node scripts/Delivera-Dev-Port-Guard-01Check.js" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow | Out-Null
    $PortFile = Join-Path $ProjectRoot ".delivera-dev-port"
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
        try { if ((Invoke-WebRequest -Uri $Health -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { return $true } } catch {}
        if ($pass -eq 0) {
            Start-Process cmd.exe -ArgumentList "/c npm run start" -WorkingDirectory $ProjectRoot -WindowStyle Hidden | Out-Null
            Start-Sleep 4
        }
    }
    for ($a = 1; $a -le 25; $a++) {
        Start-Sleep 2
        try { if ((Invoke-WebRequest -Uri $Health -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { return $true } } catch {}
    }
    return $false
}

function Invoke-Collectors { param([int]$Tier, [string]$BaseUrl)
    $env:BASE_URL = $BaseUrl
    $env:HEADLESS = "1"
    $env:AUTOHACKER_RUN_DIR = $RunDir
    $env:AUTOHACKER_RUN_ID = $RunId
    $env:AUTOHACKER_TARGET = $Target
    $env:MAX_INTRA_CARD_VOID_PX = "$MaxVoidPx"
    $env:MAX_SCREENSHOT_LEFT_WHITESPACE_RATIO = "$MaxLeftWhite"
    $Results = @{ tier = $Tier; collectors = @(); outputs = @(); ok = $true }

    foreach ($Col in @($CollectorsCfg.collectors | Where-Object { [int]$_.tier -le $Tier })) {
        if ($Col.env) {
            foreach ($Prop in $Col.env.PSObject.Properties) { Set-Item "env:$($Prop.Name)" $Prop.Value }
        } else {
            Remove-Item env:AUTOHACKER_CATALOG -ErrorAction SilentlyContinue
            Remove-Item env:AUTOHACKER_DUP_OUT -ErrorAction SilentlyContinue
        }
        $Cmd = $Col.cmd -replace '\{runId\}', $RunId
        Write-Progress "collector" "[$($Col.id)] tier $($Col.tier): $Cmd"
        if ($DryRun) { continue }
        $Proc = Start-Process cmd.exe -ArgumentList "/c $Cmd" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow -PassThru
        $Entry = @{ id = $Col.id; exitCode = $Proc.ExitCode; outputs = @() }
        foreach ($Rel in $Col.outputs) {
            $Abs = Join-Path $ProjectRoot (($Rel -replace '\{runId\}', $RunId) -replace '/', '\')
            if (Test-Path $Abs) { $Entry.outputs += $Abs; $Results.outputs += $Abs }
        }
        if ($Proc.ExitCode -ne 0) { $Results.ok = $false }
        $Results.collectors += $Entry
    }
    return $Results
}

function Read-ReportJson { param([string]$Name)
    $P = Join-Path $RunDir $Name
    if (-not (Test-Path $P)) { return $null }
    try { return (Get-Content $P -Raw | ConvertFrom-Json) } catch { return $null }
}

function Merge-EvidenceBundle {
    param($CollectorResult, [string]$BaseUrl, [string]$TargetFullUrl, [bool]$McpOk = $false)
    $Bundle = @{
        runId = $RunId; target = $Target; url = $TargetFullUrl; baseUrl = $BaseUrl
        tier = $CollectorResult.tier; capturedAt = (Get-Date).ToString("o")
        artifacts = @($CollectorResult.outputs); metrics = @{}
        trustHints = @{ evidenceComplete = $false; explorationQuality = $false; mcpEnrichment = $McpOk; stateMatrixPass = $false; screenshotDensityPass = $false }
    }
    $ReportMap = @{
        ux = "metrics-snapshot.json"
        hiddenValue = "hidden-value-report.json"
        intraCardVoid = "intra-card-void-report.json"
        mainColumnVoid = "main-column-void-report.json"
        negativeVoid = "negative-void-report.json"
        horizontalVoid = "horizontal-void-report.json"
        contentOverlap = "content-overlap-report.json"
        foldClipping = "fold-clipping-report.json"
        screenshotDensity = "screenshot-density-report.json"
        duplicateText = "duplicate-text-report.json"
        duplicateTextFull = "duplicate-text-full-catalog-report.json"
        stateMatrix = "state-matrix-summary.json"
    }
    foreach ($KV in $ReportMap.GetEnumerator()) {
        $J = Read-ReportJson $KV.Value
        if ($J) { $Bundle.metrics[$KV.Key] = $J }
    }
    if (Test-Path $ExplorationJson) {
        try { $Bundle.metrics.exploration = (Get-Content $ExplorationJson -Raw | ConvertFrom-Json).summary } catch {}
    }
    foreach ($Art in $CollectorResult.outputs) {
        if ($Art -match "click-audit|clickmap") {
            try {
                $J = Get-Content $Art -Raw | ConvertFrom-Json
                if ($J.summary) { $Bundle.metrics.brokenClickCount = [int]$J.summary.failed }
            } catch {}
        }
    }
    $MinArtifacts = [math]::Min(12, @($CollectorsCfg.collectors).Count)
    $Bundle.trustHints.evidenceComplete = ($Bundle.artifacts.Count -ge $MinArtifacts)
    $Bundle.trustHints.explorationQuality = (Test-ExplorationGate)
    $Bundle.trustHints.stateMatrixPass = (Test-StateMatrixGate)
    $Bundle.trustHints.screenshotDensityPass = (Test-ScreenshotDensityGate)
    $Bundle.trustHints.mcpEnrichment = $McpOk
    if (-not $DryRun) { $Bundle | ConvertTo-Json -Depth 16 | Set-Content -Path $EvidenceBundleFile -Encoding UTF8 }
    return $Bundle
}

function Build-EvidenceDigest {
    param($Bundle)
    $G = Get-GateSnapshot
    $H = Read-JsonFile $HiddenValueJson
    $S = Read-JsonFile $ScreenshotDensityJson
    $Sm = Read-JsonFile $StateMatrixJson
    $E = Read-JsonFile $ExplorationJson
    $Dup = Read-JsonFile $DuplicateFullJson
    if (-not $Dup) { $Dup = Read-JsonFile $DuplicateTextJson }

    $Findings = @()
    if ($H -and $H.findings) {
        foreach ($F in @($H.findings | Select-Object -First 10)) {
            $Findings += "- [$($F.kind)] $($F.label)"
        }
    }
    $Broken = @()
    if ($E -and $E.clickResults) {
        foreach ($C in @($E.clickResults | Where-Object { $_.ok -eq $false } | Select-Object -First 10)) {
            $Broken += "- $($C.viewport): $($C.label)"
        }
    }
    $DupLines = @()
    if ($Dup -and $Dup.duplicates) {
        foreach ($D in @($Dup.duplicates | Select-Object -First 5)) {
            $DupLines += "- `"$($D.text)"` x$($D.count)"
        }
    }

    $Digest = @"
# AutoHacker Evidence Digest
**Run:** $RunId | **URL:** $script:TargetUrl | **Tier:** $(Get-CollectorTier)

## Gate summary
| Gate | Pass |
|------|------|
| hidden (h) | $($G.h) |
| intra-card void (v) | $($G.v) |
| duplicates (dup) | $($G.dup) |
| main-column void (mvoid) | $($G.mvoid) |
| fold clipping (fold) | $($G.fold) |
| horizontal void (hvoid) | $($G.hvoid) |
| overlap | $($G.overlap) |
| sticky chrome (sticky) | $($G.sticky) |
| screenshot density (shot) | $($G.shot) |
| negative void (nvoid) | $($G.nvoid) |
| state matrix | $($G.stateMatrix) |
| MCP enrichment | $($G.mcp) |

## Worst metrics
- leftWhitespaceRatio: $(if ($S) { $S.leftWhitespaceRatio } else { 'n/a' }) (max $MaxLeftWhite)
- hiddenValueCount: $(if ($H) { $H.hiddenValueCount } else { 'n/a' }) (max $MaxHidden)
- stateMatrix.pass: $(if ($Sm) { $Sm.pass } else { 'n/a' })

## Screenshot
- Fold: $ScreenshotFoldPath

## Hidden value (top)
$($Findings -join "`n")

## Broken clicks (top)
$($Broken -join "`n")

## Duplicate copy
$($DupLines -join "`n")

## Artifacts
$($Bundle.artifacts -join "`n")

Core values: $($CoreValues -join ', ')
"@
    if (-not $DryRun) { Set-Content -Path $EvidenceDigestFile -Value $Digest.Trim() -Encoding UTF8 }
    return $Digest
}

function Get-LoopMetrics { param($Bundle)
    $M = @{
        scrollToPrimaryValuePx = 9999; stickyChromeRatio = 0.5; foldDeadBandPx = 9999
        brokenClickCount = 0; overlapPxTotal = 0; hiddenValueCount = 99; maxVoidPx = 9999
        leftWhitespaceRatio = 1.0
    }
    if ($Bundle.metrics.ux) {
        $U = $Bundle.metrics.ux
        if ($null -ne $U.scrollToPrimaryValuePx) { $M.scrollToPrimaryValuePx = [double]$U.scrollToPrimaryValuePx }
        if ($null -ne $U.stickyChromeRatio) { $M.stickyChromeRatio = [double]$U.stickyChromeRatio }
        if ($null -ne $U.foldDeadBandPx) { $M.foldDeadBandPx = [double]$U.foldDeadBandPx }
        if ($null -ne $U.overlapPxTotal) { $M.overlapPxTotal = [double]$U.overlapPxTotal }
    }
    if ($Bundle.metrics.hiddenValue) { $M.hiddenValueCount = [int]$Bundle.metrics.hiddenValue.hiddenValueCount }
    if ($Bundle.metrics.intraCardVoid) { $M.maxVoidPx = [int]$Bundle.metrics.intraCardVoid.maxVoidPx }
    if ($Bundle.metrics.brokenClickCount) { $M.brokenClickCount = [int]$Bundle.metrics.brokenClickCount }
    if ($Bundle.metrics.screenshotDensity) { $M.leftWhitespaceRatio = [double]$Bundle.metrics.screenshotDensity.leftWhitespaceRatio }
    return $M
}

function Compare-MetricsImproved { param($Before, $After)
    $Improved = 0; $Regressed = 0; $Notes = @()
    foreach ($Key in @("scrollToPrimaryValuePx", "foldDeadBandPx", "brokenClickCount", "overlapPxTotal", "hiddenValueCount", "maxVoidPx", "leftWhitespaceRatio")) {
        if ($null -eq $Before.$Key -or $null -eq $After.$Key) { continue }
        if ($After.$Key -lt $Before.$Key) { $Improved++; $Notes += "$Key $($Before.$Key)->$($After.$Key)" }
        elseif ($After.$Key -gt $Before.$Key) { $Regressed++; $Notes += "$Key REGRESSED $($Before.$Key)->$($After.$Key)" }
    }
    if ($After.stickyChromeRatio -lt $Before.stickyChromeRatio) { $Improved++ }
    elseif ($After.stickyChromeRatio -gt $Before.stickyChromeRatio) { $Regressed++ }
    $Pass = ($Regressed -eq 0) -and (($Improved -gt 0) -or ($After.hiddenValueCount -le $MaxHidden -and $After.maxVoidPx -le $MaxVoidPx -and $After.leftWhitespaceRatio -le $MaxLeftWhite))
    return @{ improved = $Improved; regressed = $Regressed; notes = $Notes; pass = $Pass }
}

function Get-TrustScore {
    param([bool]$TestsPass, $MetricCompare, $Bundle, [bool]$ExplorationOk, [bool]$McpOk)
    $W = $ValuesCfg.trustWeights
    $Score = 0.0
    if ($Bundle.trustHints.evidenceComplete) { $Score += [double]($W.evidenceComplete) }
    if ($ExplorationOk) { $Score += [double]($W.explorationQuality) }
    if ($TestsPass) { $Score += [double]($W.testsPass) }
    if ($MetricCompare.pass) { $Score += [double]($W.metricsImprove) }
    if ($Bundle.trustHints.stateMatrixPass) { $Score += [double]($W.stateMatrixPass) }
    if ($McpOk) { $Score += [double]($W.mcpEnrichment) }
    if ($Bundle.trustHints.screenshotDensityPass) { $Score += [double]($W.screenshotDensityPass) }
    return [math]::Round([math]::Min(1.0, $Score), 3)
}

function Initialize-Brain { param($Bundle, [string]$Tests)
    $H = if ($Bundle.metrics.hiddenValue) { $Bundle.metrics.hiddenValue.hiddenValueCount } else { "?" }
    $V = if ($Bundle.metrics.intraCardVoid) { $Bundle.metrics.intraCardVoid.maxVoidPx } else { "?" }
    $W = if ($Bundle.metrics.screenshotDensity) { $Bundle.metrics.screenshotDensity.leftWhitespaceRatio } else { "?" }
    $Existing = if (Test-Path $BrainFile) { Get-Content $BrainFile -Raw } else { "" }
    $Block = @"

## AutoHacker Run $RunId (v6)
Target: $script:TargetUrl
Core Values: $($CoreValues -join ', ')
Evidence digest: $EvidenceDigestFile
Evidence bundle: $EvidenceBundleFile
Screenshot: $ScreenshotFoldPath
State matrix: $StateMatrixJson
Tier: $(Get-CollectorTier)
Regression test: $DefaultTestFallback
Progress: $ProgressLog
hiddenValueCount: $H | maxVoidPx: $V | leftWhitespaceRatio: $W
"@
    if ($Existing -match 'AutoHacker Run') {
        $Existing = $Existing -replace '(?ms)## AutoHacker Run.*', $Block.Trim()
    } else {
        $Existing = "Target: $script:TargetUrl`nAvailable Tests: $Tests`n$Block"
    }
    Set-Content -Path $BrainFile -Value $Existing.Trim()
}

# --- Preflight ---
Write-Progress "init" "AutoHacker v6 run $RunId target=$Target"
Update-Telemetry "Init" "Running" "Preflight server + MCP + collectors v6"

$GiPath = Join-Path $ProjectRoot ".gitignore"
if (Test-Path $GiPath) {
    $Gi = Get-Content $GiPath -Raw
    if ($Gi -notmatch '\.autohacker/runs') { Add-Content $GiPath "`n.autohacker/runs/`n.autohacker/memory/" }
}

if (-not $DryRun -and -not $ValidateOrchestratorOnly) {
    if (git status --porcelain) { git stash push -m "autohacker-$RunId" | Out-Null }
    $BranchName = "autohacker-$RunId"
    git checkout -b $BranchName 2>$null
    if ($LASTEXITCODE -ne 0) { git checkout -b $BranchName | Out-Null }
} else { $BranchName = "validate-$RunId" }

$script:TargetBaseUrl = Resolve-TargetBaseUrl
$script:TargetUrl = "$script:TargetBaseUrl$TargetPath"
if (-not (Ensure-DevServer $script:TargetUrl)) { Update-Telemetry "Init" "FAILED" "Server down"; Exit 1 }

Invoke-McpPreflight | Out-Null

$Tier = Get-CollectorTier
Write-Progress "init" "Running collectors tier $Tier"
$CollectorResult = Invoke-Collectors -Tier $Tier -BaseUrl $script:TargetBaseUrl
$Bundle = Merge-EvidenceBundle -CollectorResult $CollectorResult -BaseUrl $script:TargetBaseUrl -TargetFullUrl $script:TargetUrl
Build-EvidenceDigest -Bundle $Bundle | Out-Null
Write-GateTelemetry "post-collectors" | Out-Null

$GateResult = Test-AllEvidenceGates
if (-not $GateResult.pass) {
    Write-Progress "init" "WARN evidence gates failed: $($GateResult.failed -join ',')"
    if ($Tier -lt 3) {
        $Tier++; Set-CollectorTier $Tier
        $CollectorResult = Invoke-Collectors -Tier $Tier -BaseUrl $script:TargetBaseUrl
        $Bundle = Merge-EvidenceBundle -CollectorResult $CollectorResult -BaseUrl $script:TargetBaseUrl -TargetFullUrl $script:TargetUrl
        Build-EvidenceDigest -Bundle $Bundle | Out-Null
        Write-GateTelemetry "post-collectors-retry" | Out-Null
    }
}

if (-not (Test-ExplorationGate)) {
    Write-Progress "init" "WARN exploration quality low (need $MinIdeas ideas)"
}

Initialize-Brain -Bundle $Bundle -Tests (Get-AvailableTests)
$PatchText = Get-PromptPatchesText

if ($ValidateOrchestratorOnly) {
    $Checks = @(
        (Test-Path $ExplorationJson),
        (Test-Path (Join-Path $RunDir "metrics-snapshot.json")),
        (Test-Path $HiddenValueJson),
        (Test-Path $StateMatrixJson),
        (Test-Path $EvidenceDigestFile),
        (Test-Path $ScreenshotDensityJson),
        (@($CollectorsCfg.collectors).Count -ge 15),
        (Test-Path (Join-Path $PromptsDir "01-investigation.md"))
    )
    $Ok = ($Checks | Where-Object { $_ -eq $true }).Count
    $Status = if ($Ok -ge 7) { "PASS" } else { "FAIL" }
    $G = Write-GateTelemetry "Validate"
    Update-Telemetry "Validate" $Status "Checks passed: $Ok/8 | RunDir: $RunDir"
    if ($Ok -lt 7) { Exit 1 }
    Exit 0
}

$EvidenceGate = Test-AllEvidenceGates
if (-not $EvidenceGate.pass -and -not $AllowDegradedEvidence) {
    Update-Telemetry "Init" "BLOCKED" "Evidence gates failed: $($EvidenceGate.failed -join ', '). Use -AllowDegradedEvidence to proceed."
    Exit 1
}

# Phase 0 - Cursor MCP enrichment
$ExplorePrompt = Expand-PromptTemplate (Join-Path $PromptsDir "00-explore-cursor.md") (Get-PromptTokens -PatchText $PatchText)
$ExploreLog = Join-Path $RunDir "L0_Explore_Cursor.md"
Update-Telemetry "Phase 0" "Explore" "MCP enrichment required=$RequireMcp"
Invoke-CursorAgent -Prompt $ExplorePrompt -LogFilePath $ExploreLog -UseMcp -PhaseLabel "phase-0-explore"
Validate-AgentHealth $ExploreLog
$script:McpEnrichmentOk = Test-McpEnrichmentGate $ExploreLog
if ($RequireMcp -and -not $script:McpEnrichmentOk -and -not $AllowDegradedEvidence) {
    Add-PromptPatch "Phase 0 MCP enrichment failed"
    Update-Telemetry "Phase 0" "FAILED" "MCP enrichment gate failed"
    Exit 1
}
$Bundle = Merge-EvidenceBundle -CollectorResult $CollectorResult -BaseUrl $script:TargetBaseUrl -TargetFullUrl $script:TargetUrl -McpOk $script:McpEnrichmentOk
Build-EvidenceDigest -Bundle $Bundle | Out-Null
Write-GateTelemetry "phase-0" | Out-Null
Wait-PhaseGate "Phase 0 Explore"

if ($MaxLoops -le 0) { Update-Telemetry "Done" "Finished" "MaxLoops=0 after preflight"; Exit 0 }

$ConsecutiveFailures = 0
for ($i = 1; $i -le $MaxLoops; $i++) {
    if ($ConsecutiveFailures -ge $CircuitBreakerThreshold) { break }

    $InvestLog = Join-Path $RunDir "L${i}_Investigation.md"
    $PlanLog = Join-Path $RunDir "L${i}_Plan.md"
    $BuildLog = Join-Path $RunDir "L${i}_Implementation.md"
    $Tokens = { param($Extra) Get-PromptTokens -LoopIndex $i -InvestLog $InvestLog -PlanLog $PlanLog -BuildLog $BuildLog -PatchText $PatchText @Extra }

    Write-Progress "loop-$i" "Evidence refresh tier $Tier"
    $CollectorResult = Invoke-Collectors -Tier $Tier -BaseUrl $script:TargetBaseUrl
    $Bundle = Merge-EvidenceBundle -CollectorResult $CollectorResult -BaseUrl $script:TargetBaseUrl -TargetFullUrl $script:TargetUrl -McpOk $script:McpEnrichmentOk
    Build-EvidenceDigest -Bundle $Bundle | Out-Null
    $MetricsBefore = Get-LoopMetrics -Bundle $Bundle
    $ExplorationOk = Test-ExplorationGate
    Write-GateTelemetry "loop-$i-pre" | Out-Null

    Update-Telemetry "Loop $i" "Investigate" "Phase 1"
    $InvPrompt = Expand-PromptTemplate (Join-Path $PromptsDir "01-investigation.md") (&$Tokens)
    Invoke-CursorAgent -Prompt $InvPrompt -LogFilePath $InvestLog -UseMcp -PhaseLabel "phase-1-investigate"
    Validate-AgentHealth $InvestLog
    if (-not (Test-InvestigationGate $InvestLog)) {
        Add-PromptPatch "Loop $i thin investigation"
        if ($Tier -lt 3) { $Tier++; Set-CollectorTier $Tier }
        $PatchText = Get-PromptPatchesText
    }
    Wait-PhaseGate "Phase 1 Investigation"

    Update-Telemetry "Loop $i" "Plan" "Phase 2 master plan"
    $PlanPrompt = Expand-PromptTemplate (Join-Path $PromptsDir "02-master-plan.md") (&$Tokens)
    Invoke-CursorAgent -Prompt $PlanPrompt -LogFilePath $PlanLog -UseMcp -Mode plan -PhaseLabel "phase-2-plan"
    Validate-AgentHealth $PlanLog
    if (-not (Test-PlanGate $PlanLog)) { Add-PromptPatch "Loop $i thin plan" }
    Wait-PhaseGate "Phase 2 Master Plan"

    Update-Telemetry "Loop $i" "Build" "Phase 3 implement"
    $BuildPrompt = Expand-PromptTemplate (Join-Path $PromptsDir "03-build.md") (&$Tokens)
    Invoke-CursorAgent -Prompt $BuildPrompt -LogFilePath $BuildLog -UseMcp -PhaseLabel "phase-3-build"
    Validate-AgentHealth $BuildLog
    Wait-PhaseGate "Phase 3 Build"

    if (-not $DryRun -and -not (git status --porcelain)) {
        Add-PromptPatch "Loop $i phantom edit"
        $ConsecutiveFailures++; continue
    }

    $TargetTest = (Get-Content $TestTargetFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($TargetTest) -or $TargetTest -notmatch "npm run test:") {
        $TargetTest = $DefaultTestFallback
        Set-Content $TestTargetFile $TargetTest
    }

    $env:AUTOHACKER_RUN_ID = $RunId
    $TestExitCode = 1
    if (-not $DryRun) {
        Start-Process cmd.exe -ArgumentList "/c npm run build:css" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow | Out-Null
        for ($Attempt = 1; $Attempt -le 2; $Attempt++) {
            $Tp = Start-Process cmd.exe -ArgumentList "/c $TargetTest" -WorkingDirectory $ProjectRoot -Wait -NoNewWindow -PassThru
            $TestExitCode = $Tp.ExitCode
            if ($TestExitCode -eq 0) { break }
        }
    } else { $TestExitCode = 0 }

    $PostCollector = Invoke-Collectors -Tier $Tier -BaseUrl $script:TargetBaseUrl
    $PostBundle = Merge-EvidenceBundle -CollectorResult $PostCollector -BaseUrl $script:TargetBaseUrl -TargetFullUrl $script:TargetUrl -McpOk $script:McpEnrichmentOk
    Build-EvidenceDigest -Bundle $PostBundle | Out-Null
    $MetricsAfter = Get-LoopMetrics -Bundle $PostBundle
    $MetricCompare = Compare-MetricsImproved -Before $MetricsBefore -After $MetricsAfter
    $ExplorationOk = Test-ExplorationGate
    $Trust = Get-TrustScore -TestsPass ($TestExitCode -eq 0) -MetricCompare $MetricCompare -Bundle $PostBundle -ExplorationOk $ExplorationOk -McpOk $script:McpEnrichmentOk

    $GatePass = ($TestExitCode -eq 0) -and ($MetricCompare.regressed -eq 0) -and (Test-HiddenValueGate) -and (Test-VoidGate) -and (Test-ScreenshotDensityGate) -and (Test-StateMatrixGate)
    $G = Write-GateTelemetry "loop-$i-trust"
    Update-Telemetry "Loop $i" "Trust" "score=$Trust gate=$GatePass"

    if ($GatePass) {
        if (-not $DryRun) {
            git add .
            git commit -m "feat(governance): AutoHacker v6 loop $i UX friction reductions" | Out-Null
            Write-MemoryJson $MetricBaselineFile $MetricsAfter
            if ($DoPush -or ($AutoPushWhenTrustAbove -gt 0 -and $Trust -ge $AutoPushWhenTrustAbove)) {
                git push -u origin $BranchName 2>&1
            }
        }
        $ConsecutiveFailures = 0
        Update-Telemetry "Loop $i" "SUCCESS" "trust=$Trust"
    } else {
        $Reason = if ($TestExitCode -ne 0) { "tests failed" }
        elseif (-not (Test-StateMatrixGate)) { "state matrix" }
        elseif (-not (Test-ScreenshotDensityGate)) { "screenshot density" }
        elseif (-not (Test-VoidGate)) { "intra-card void" }
        elseif (-not (Test-HiddenValueGate)) { "hidden value" }
        else { "metric regression" }
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
