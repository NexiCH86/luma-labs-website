#!/usr/bin/env python3
import ctypes
import json
import os
import shutil
import socket
import subprocess
import time
import urllib.request

ENDPOINT = os.environ.get(
    "LUMA_CONTROL_ENDPOINT",
    "https://lumalabs.ch/api/control-center/ingest",
)
SECRET = os.environ.get("LUMA_CONTROL_SECRET", "")
INTERVAL = max(30, int(os.environ.get("LUMA_CONTROL_INTERVAL", "90")))


class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ("dwLength", ctypes.c_ulong),
        ("dwMemoryLoad", ctypes.c_ulong),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def run_text(command, timeout=8):
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def read_cpu_percent():
    output = run_text([
        "powershell",
        "-NoProfile",
        "-Command",
        "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average",
    ])
    try:
        return round(float(output.replace(",", ".")), 1)
    except ValueError:
        return 0.0


def read_memory():
    state = MEMORYSTATUSEX()
    state.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(state)):
        return 0.0, 0.0, 0.0
    total = state.ullTotalPhys / 1024**3
    available = state.ullAvailPhys / 1024**3
    used = max(0.0, total - available)
    percent = (used / total * 100) if total else 0.0
    return round(percent, 1), round(used, 2), round(total, 2)


def read_uptime():
    try:
        return int(ctypes.windll.kernel32.GetTickCount64() / 1000)
    except Exception:
        return 0


def read_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("1.1.1.1", 80))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


def read_gpu():
    query = (
        "name,utilization.gpu,temperature.gpu,memory.used,memory.total,"
        "power.draw,power.limit"
    )
    output = run_text([
        "nvidia-smi",
        f"--query-gpu={query}",
        "--format=csv,noheader,nounits",
    ])
    if not output:
        return None
    first = output.splitlines()[0]
    parts = [part.strip() for part in first.split(",")]
    if len(parts) < 7:
        return None

    def number(value):
        try:
            return float(value)
        except ValueError:
            return None

    return {
        "name": parts[0],
        "utilizationPercent": number(parts[1]),
        "temperatureC": number(parts[2]),
        "memoryUsedMb": number(parts[3]),
        "memoryTotalMb": number(parts[4]),
        "powerDrawW": number(parts[5]),
        "powerLimitW": number(parts[6]),
    }


def build_payload():
    cpu = read_cpu_percent()
    memory_percent, memory_used, memory_total = read_memory()
    disk = shutil.disk_usage(os.environ.get("SystemDrive", "C:") + "\\")
    disk_total = disk.total / 1024**3
    disk_used = disk.used / 1024**3
    disk_percent = (disk.used / disk.total * 100) if disk.total else 0

    return {
        "device": "master-intel",
        "hostname": socket.gethostname(),
        "ip": read_ip(),
        "timestamp": int(time.time() * 1000),
        "uptimeSeconds": read_uptime(),
        "cpuPercent": cpu,
        "memoryPercent": memory_percent,
        "memoryUsedGb": memory_used,
        "memoryTotalGb": memory_total,
        "temperatureC": None,
        "diskPercent": round(disk_percent, 1),
        "diskUsedGb": round(disk_used, 2),
        "diskTotalGb": round(disk_total, 2),
        "gpu": read_gpu(),
        "services": {},
    }


def send(payload):
    if not SECRET:
        raise RuntimeError("LUMA_CONTROL_SECRET is not set")

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-control-secret": SECRET,
            "User-Agent": "LuMa-Control-Agent-Windows/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.status, response.read().decode("utf-8")


def main():
    print("LuMa Control Center Windows Agent starting...", flush=True)
    print(f"Endpoint: {ENDPOINT}", flush=True)
    print(f"Interval: {INTERVAL}s", flush=True)

    while True:
        try:
            payload = build_payload()
            status, _ = send(payload)
            gpu = payload.get("gpu") or {}
            gpu_text = (
                f" | GPU {gpu.get('utilizationPercent')}% {gpu.get('temperatureC')}C"
                if gpu else ""
            )
            print(
                f"[OK] {payload['hostname']} | CPU {payload['cpuPercent']}% | "
                f"RAM {payload['memoryPercent']}%{gpu_text} | HTTP {status}",
                flush=True,
            )
        except Exception as exc:
            print(f"[ERROR] {exc}", flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
