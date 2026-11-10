# Issue #253: what keeps a Windows runner busy right after the Deno suite?
# One bounded sample (about 3 s): machine CPU and disk, the busiest
# processes, and real-time scanning state. Read-only; it changes nothing.
param([string]$Label = 'snapshot')
$ErrorActionPreference = 'Continue'
Write-Output "== Runner snapshot: $Label at $((Get-Date).ToUniversalTime().ToString('o'))"
$counters = @(
  '\Processor(_Total)\% Processor Time',
  '\PhysicalDisk(_Total)\% Disk Time',
  '\PhysicalDisk(_Total)\Avg. Disk Queue Length',
  '\Process(*)\% Processor Time'
)
$samples = Get-Counter -Counter $counters -SampleInterval 1 -MaxSamples 3 -ErrorAction SilentlyContinue
if ($samples) {
  $all = $samples | ForEach-Object { $_.CounterSamples }
  $all | Where-Object { $_.Path -notlike '*\process(*' } |
    Group-Object Path |
    ForEach-Object {
      '{0}: {1:N1}' -f $_.Name, ($_.Group | Measure-Object CookedValue -Average).Average
    }
  Write-Output '-- Busiest processes (average % of one core over the sample)'
  $all | Where-Object { $_.Path -like '*\process(*' -and $_.InstanceName -notin @('_total', 'idle') } |
    Group-Object InstanceName |
    ForEach-Object {
      [pscustomobject]@{
        Process = $_.Name
        CpuPercent = [math]::Round(($_.Group | Measure-Object CookedValue -Average).Average, 1)
      }
    } |
    Sort-Object CpuPercent -Descending |
    Select-Object -First 12 |
    Format-Table -AutoSize | Out-String -Width 160
}
Write-Output '-- Node, Deno, npm and shell processes still running'
Get-Process -Name node, deno, cmd, conhost, bun -ErrorAction SilentlyContinue |
  Select-Object Name, Id, CPU, StartTime |
  Format-Table -AutoSize | Out-String -Width 160
$defender = Get-MpComputerStatus -ErrorAction SilentlyContinue
if ($defender) {
  Write-Output ('Defender real-time protection: {0}; on-access protection: {1}' -f $defender.RealTimeProtectionEnabled, $defender.OnAccessProtectionEnabled)
}
