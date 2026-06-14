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

# Launcher — delegates to isolated .autohacker/ orchestrator
$ToolScript = Join-Path $PSScriptRoot ".autohacker\AutoHacker.ps1"
if (-not (Test-Path $ToolScript)) {
    Write-Host "[FATAL] Missing $ToolScript" -ForegroundColor Red
    Exit 1
}
& $ToolScript @PSBoundParameters
