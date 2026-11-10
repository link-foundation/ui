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
  '\Memory\Pages Output/sec',
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
$perProcess = @('\Process(*)\% Processor Time', '\Process(*)\IO Read Bytes/sec', '\Process(*)\IO Write Bytes/sec')
$counters = $machine + $perProcess
$data = Get-Counter -Counter $counters -SampleInterval 1 -MaxSamples $Samples -ErrorAction SilentlyContinue
if ($data) {
  Write-Output '-- Machine counters per second'
  foreach ($set in $data) {
    $values = $set.CounterSamples | Where-Object { $_.Path -notlike '*\process(*' } |
      ForEach-Object { '{0}={1:N3}' -f (($_.Path -split '\\')[-2..-1] -join '\'), $_.CookedValue }
    Write-Output ('{0:HH:mm:ss.fff} {1}' -f $set.Timestamp.ToUniversalTime(), ($values -join '; '))
  }
  # Per-process CPU and I/O for every sample, so a burst can be attributed.
  Write-Output '-- Busiest processes per second (CPU % of one core, I/O KB/s)'
  foreach ($set in $data) {
    # Same-named processes (node#1, node#2) are summed per name.
    $rows = $set.CounterSamples |
      Where-Object { $_.Path -like '*\process(*' -and $_.InstanceName -notin @('_total', 'idle') } |
      Group-Object InstanceName |
      ForEach-Object {
        $cpu = ($_.Group | Where-Object { $_.Path -like '*% processor time' } | Measure-Object CookedValue -Sum).Sum
        $read = ($_.Group | Where-Object { $_.Path -like '*io read bytes/sec' } | Measure-Object CookedValue -Sum).Sum
        $write = ($_.Group | Where-Object { $_.Path -like '*io write bytes/sec' } | Measure-Object CookedValue -Sum).Sum
        [pscustomobject]@{ Name = $_.Name; Cpu = [math]::Round($cpu); ReadKB = [math]::Round($read / 1KB); WriteKB = [math]::Round($write / 1KB) }
      } |
      Where-Object { $_.Cpu -ge 5 -or $_.ReadKB -ge 64 -or $_.WriteKB -ge 64 } |
      Sort-Object { $_.ReadKB + $_.WriteKB + $_.Cpu } -Descending |
      Select-Object -First 6 |
      ForEach-Object { '{0} cpu={1} readKB={2} writeKB={3}' -f $_.Name, $_.Cpu, $_.ReadKB, $_.WriteKB }
    Write-Output ('{0:HH:mm:ss.fff} {1}' -f $set.Timestamp.ToUniversalTime(), ($rows -join '; '))
  }
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
