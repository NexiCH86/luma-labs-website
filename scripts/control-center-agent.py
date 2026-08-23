#!/usr/bin/env python3
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
INTERVAL = max(15, int(os.environ.get("LUMA_CONTROL_INTERVAL", "30")))


def read_cpu_percent():
    def sample():
        with open("/proc/stat", "r", encoding="utf-8") as handle:
            parts = handle.readline().split()[1:]
        values = [int(value) for value in parts]
        idle = values[3] + (values[4] if len(values) > 4 else 0)
        return sum(values), idle

    total1, idle1 = sample()
    time.sleep(0.25)
    total2, idle2 = sample()
    delta_total = total2 - total1
    delta_idle = idle2 - idle1
    if delta_total <= 0:
        return 0.0
    return round((1 - delta_idle / delta_total) * 100, 1)


def read_memory():
    values = {}
    with open("/proc/meminfo", "r", encoding="utf-8") as handle:
        for line in handle:
            key, rest = line.split(":", 1)
            values[key] = int(rest.strip().split()[0])
    total_kb = values.get("MemTotal", 0)
    available_kb = values.get("MemAvailable", 0)
    used_kb = max(0, total_kb - available_kb)
    percent = (used_kb / total_kb * 100) if total_kb else 0
    return round(percent, 1), round(used_kb / 1024 / 1024, 2), round(total_kb / 1024 / 1024, 2)


def read_temperature():
    path = "/sys/class/thermal/thermal_zone0/temp"
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return round(float(handle.read().strip()) / 1000, 1)
    except (OSError, ValueError):
        return None


def read_uptime():
    try:
        with open("/proc/uptime", "r", encoding="utf-8") as handle:
            return int(float(handle.read().split()[0]))
    except (OSError, ValueError):
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


def command_ok(command):
    try:
        result = subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=3,
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def service_state(name):
    return "online" if command_ok(["systemctl", "is-active", "--quiet", name]) else "offline"


def docker_container_state(name):
    try:
        result = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", name],
            capture_output=True,
            text=True,
            check=False,
            timeout=3,
        )
        if result.returncode != 0:
            return "unknown"
        return "online" if result.stdout.strip().lower() == "true" else "offline"
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"


def build_payload():
    cpu = read_cpu_percent()
    memory_percent, memory_used, memory_total = read_memory()
    disk = shutil.disk_usage("/")
    disk_total = disk.total / 1024**3
    disk_used = disk.used / 1024**3
    disk_percent = (disk.used / disk.total * 100) if disk.total else 0

    return {
        "device": "luisserver",
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
        "services": {
            "radarCollector": service_state("luma-radar.service"),
            "docker": service_state("docker.service"),
            "portainer": docker_container_state("portainer"),
            "uptimeKuma": docker_container_state("uptime-kuma"),
            "nginxProxyManager": docker_container_state("nginx-proxy-manager"),
            "fileBrowser": docker_container_state("filebrowser"),
        },
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
            "User-Agent": "LuMa-Control-Agent/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.status, response.read().decode("utf-8")


def main():
    print("LuMa Control Center Agent starting...")
    print(f"Endpoint: {ENDPOINT}")
    print(f"Interval: {INTERVAL}s")

    while True:
        try:
            payload = build_payload()
            status, response = send(payload)
            print(
                f"[OK] {payload['hostname']} | CPU {payload['cpuPercent']}% | "
                f"RAM {payload['memoryPercent']}% | TEMP {payload['temperatureC']}C | HTTP {status}"
            )
        except Exception as exc:
            print(f"[ERROR] {exc}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
