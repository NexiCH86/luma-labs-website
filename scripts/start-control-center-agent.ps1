# Startet den Control-Center-Agent fuer Master-Intel (Aufgabe "LuMa Control Center Agent").
# Sucht Python selbst, damit ein Python-Update den Agent nicht still stoppt,
# und startet ihn nach einem Absturz nach 30 s neu.

$env:LUMA_CONTROL_SECRET = [Environment]::GetEnvironmentVariable("LUMA_CONTROL_SECRET", "User")
$env:LUMA_CONTROL_ENDPOINT = [Environment]::GetEnvironmentVariable("LUMA_CONTROL_ENDPOINT", "User")
$env:LUMA_CONTROL_INTERVAL = [Environment]::GetEnvironmentVariable("LUMA_CONTROL_INTERVAL", "User")

$agent = Join-Path $PSScriptRoot "control-center-agent-windows.py"
$pythonRoot = Join-Path $env:LOCALAPPDATA "Python"

function Find-Python {
    $core = Get-ChildItem -Path $pythonRoot -Directory -Filter "pythoncore-*" -ErrorAction SilentlyContinue |
        Sort-Object { [version](($_.Name -replace '^pythoncore-', '' -replace '-.*$', '') + '.0') } -Descending |
        ForEach-Object { Join-Path $_.FullName "python.exe" } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
    if ($core) { return $core }

    $shim = Join-Path $pythonRoot "bin\python.exe"
    if (Test-Path $shim) { return $shim }

    $command = Get-Command python.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notlike "*\WindowsApps\*" } |
        Select-Object -First 1
    if ($command) { return $command.Source }
    return $null
}

while ($true) {
    $python = Find-Python
    if ($python) {
        & $python $agent
    } else {
        Write-Output "[ERROR] Python not found"
    }
    Start-Sleep -Seconds 30
}
