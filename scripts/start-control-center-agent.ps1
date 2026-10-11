$env:LUMA_CONTROL_SECRET = [Environment]::GetEnvironmentVariable("LUMA_CONTROL_SECRET", "User")
$env:LUMA_CONTROL_ENDPOINT = [Environment]::GetEnvironmentVariable("LUMA_CONTROL_ENDPOINT", "User")
$env:LUMA_CONTROL_INTERVAL = [Environment]::GetEnvironmentVariable("LUMA_CONTROL_INTERVAL", "User")

& "C:\Users\Luis\AppData\Local\Python\pythoncore-3.14-64\python.exe" `
  "C:\Users\Luis\Projects\03_LuMa-Labs\luma-labs-website\scripts\control-center-agent-windows.py"
