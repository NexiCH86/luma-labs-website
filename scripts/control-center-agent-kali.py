#!/usr/bin/env python3
import json
import os
import shutil
import socket
import time
import urllib.request

ENDPOINT = os.environ.get("LUMA_CONTROL_ENDPOINT", "https://lumalabs.ch/api/control-center/ingest")
SECRET = os.environ.get("LUMA_CONTROL_SECRET", "")
INTERVAL = max(30, int(os.environ.get("LUMA_CONTROL_INTERVAL", "90")))


def read_cpu_times():
    with open("/proc/stat", "r", encoding="utf-8") as handle:
        fields = handle.readline().split()[1:]
    values = [int(value) for value in fields]
    idle = values[3] + (values[4] if len(values) > 4 else 0)
    total = sum(values)
    return idle, total


def read_cpu_percent():
    idle1, total1 = read_cpu_times()
    time.sleep(0.25)
    idle2, total2 = read_cpu_times()
    total_delta = total2 - total1
    idle_delta = idle2 - idle1
    if total_delta <= 0:
        return 0.0
    return round((1.0 - idle_delta / total_delta) * 100.0, 1)


def read_memory():
    values = {}
    with open("/proc/meminfo", "r", encoding="utf-8") as handle:
        for line in handle:
            key, raw = line.split(":", 1)
            values[key] = int(raw.strip().split()[0])
    total_kb = values.get("MemTotal", 0)
    available_kb = values.get("MemAvailable", 0)
    used_kb = max(0, total_kb - available_kb)
    percent = (used_kb / total_kb * 100.0) if total_kb else 0.0
    return round(percent, 1), round(used_kb / 1024**2, 2), round(total_kb / 1024**2, 2)


def read_uptime():
    with open("/proc/uptime", "r", encoding="utf-8") as handle:
        return int(float(handle.read().split()[0]))


def read_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("1.1.1.1", 80))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


def read_temperature():
    candidates = [
        "/sys/class/thermal/thermal_zone0/temp",
        "/sys/class/hwmon/hwmon0/temp1_input",
    ]
    for path in candidates:
        try:
            with open(path, "r", encoding="utf-8") as handle:
                value = float(handle.read().strip())
            if value > 1000:
                value /= 1000.0
            if -20 <= value <= 150:
                return round(value, 1)
        except (OSError, ValueError):
            continue
    return None


def build_payload():
    cpu = read_cpu_percent()
    memory_percent, memory_used, memory_total = read_memory()
    disk = shutil.disk_usage("/")
    disk_total = disk.total / 1024**3
    disk_used = disk.used / 1024**3
    disk_percent = (disk.used / disk.total * 100.0) if disk.total else 0.0

    return {
        "device": "kali-mac",
        "hostname": socket.gethostname(),
        "ip": read_ip(),
        "timestamp": int(time.time() * 1000),
        "uptimeSeconds": read_uptime(),
        "cpuPercent": cpu,
        "memoryPercent": memory_percent,
        "memoryUsedGb": memory_used,
        "memoryTotalGb": memory_total,
        "temperatureC": read_temperature(),
        "diskPercent": round(disk_percent, 1),
        "diskUsedGb": round(disk_used, 2),
        "diskTotalGb": round(disk_total, 2),
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
            "User-Agent": "LuMa-Control-Agent-Kali/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.status


def main():
    print("LuMa Control Center Kali Agent starting...", flush=True)
    print(f"Endpoint: {ENDPOINT}", flush=True)
    print(f"Interval: {INTERVAL}s", flush=True)
    while True:
        try:
            payload = build_payload()
            status = send(payload)
            temp = payload.get("temperatureC")
            temp_text = f" | TEMP {temp}C" if temp is not None else ""
            print(
                f"[OK] {payload['hostname']} | CPU {payload['cpuPercent']}% | "
                f"RAM {payload['memoryPercent']}%{temp_text} | HTTP {status}",
                flush=True,
            )
        except Exception as exc:
            print(f"[ERROR] {exc}", flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
