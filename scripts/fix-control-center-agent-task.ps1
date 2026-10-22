# Einmalig als Administrator ausfuehren (Master-Intel).
# Repariert die Aufgabe "LuMa Control Center Agent":
# - kein 72-Stunden-Zeitlimit mehr (vorher wurde der Agent nach 3 Tagen beendet)
# - zusaetzlich alle 10 Minuten ein Start-Versuch; laeuft der Agent schon,
#   wird der Versuch ignoriert (IgnoreNew)

$name = "LuMa Control Center Agent"
$task = Get-ScheduledTask -TaskName $name -ErrorAction Stop
$user = $task.Principal.UserId

$logon = New-ScheduledTaskTrigger -AtLogOn -User $user
$watch = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 10)

$settings = $task.Settings
$settings.ExecutionTimeLimit = "PT0S"
$settings.MultipleInstances = "IgnoreNew"
$settings.StopIfGoingOnBatteries = $false
$settings.DisallowStartIfOnBatteries = $false
$settings.StartWhenAvailable = $true

Set-ScheduledTask -TaskName $name -Trigger @($logon, $watch) -Settings $settings | Out-Null

$task = Get-ScheduledTask -TaskName $name
"Zeitlimit: $($task.Settings.ExecutionTimeLimit)"
$task.Triggers | ForEach-Object { "$($_.CimClass.CimClassName) $($_.Repetition.Interval)" }
