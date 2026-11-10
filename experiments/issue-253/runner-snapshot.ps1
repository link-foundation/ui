# What keeps a Windows runner slow right after the Deno suite? Bounded samples
# (one per second) of machine CPU, memory paging, the C: and D: disks, the
# busiest processes and real-time scanning state. Read-only; it changes nothing.
param([string]$Label = 'snapshot', [int]$Samples = 3)
$ErrorActionPreference = 'Continue'
Write-Output "== Runner snapshot: $Label at $((Get-Date).ToUniversalTime().ToString('o'))"
$machine = @(
  '\Processor(_Total)\% Processor Time',
  '\Memory\Available MBytes',
  '\Memory\Pages Input/sec',
  '\Memory\Page Reads/sec',
  '\Memory\Modified Page List Bytes',
  '\Memory\Standby Cache Normal Priority Bytes',
  '\LogicalDisk(C:)\% Disk Time',
  '\LogicalDisk(C:)\Avg. Disk Queue Length',
  '\LogicalDisk(C:)\Disk Read Bytes/sec',
  '\LogicalDisk(C:)\Disk Write Bytes/sec',
  '\LogicalDisk(C:)\Avg. Disk sec/Read',
  '\LogicalDisk(D:)\% Disk Time',
  '\LogicalDisk(D:)\Avg. Disk sec/Read'
)
$counters = $machine + '\Process(*)\% Processor Time'
$data = Get-Counter -Counter $counters -SampleInterval 1 -MaxSamples $Samples -ErrorAction SilentlyContinue
if ($data) {
  Write-Output '-- Machine counters per second'
  foreach ($set in $data) {
    $values = $set.CounterSamples | Where-Object { $_.Path -notlike '*\process(*' } |
      ForEach-Object { '{0}={1:N3}' -f (($_.Path -split '\\')[-2..-1] -join '\'), $_.CookedValue }
    Write-Output ('{0:HH:mm:ss.fff} {1}' -f $set.Timestamp.ToUniversalTime(), ($values -join '; '))
  }
  Write-Output '-- Busiest processes (average % of one core over the sample)'
  $data | ForEach-Object { $_.CounterSamples } |
    Where-Object { $_.Path -like '*\process(*' -and $_.InstanceName -notin @('_total', 'idle') } |
    Group-Object InstanceName |
    ForEach-Object {
      [pscustomobject]@{
        Process = $_.Name
        CpuPercent = [math]::Round(($_.Group | Measure-Object CookedValue -Average).Average, 1)
      }
    } |
    Sort-Object CpuPercent -Descending |
    Select-Object -First 8 |
    Format-Table -AutoSize | Out-String -Width 160
}
Write-Output '-- Largest working sets (MB)'
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 8 |
  Select-Object Name, Id, @{ Name = 'WorkingSetMB'; Expression = { [math]::Round($_.WorkingSet64 / 1MB) } } |
  Format-Table -AutoSize | Out-String -Width 160
Write-Output '-- Node, Deno, npm and shell processes still running'
Get-Process -Name node, deno, cmd, conhost, bun -ErrorAction SilentlyContinue |
  Select-Object Name, Id, CPU, StartTime |
  Format-Table -AutoSize | Out-String -Width 160
$defender = Get-MpComputerStatus -ErrorAction SilentlyContinue
if ($defender) {
  Write-Output ('Defender real-time protection: {0}; on-access protection: {1}' -f $defender.RealTimeProtectionEnabled, $defender.OnAccessProtectionEnabled)
}
