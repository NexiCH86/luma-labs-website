#!/usr/bin/env python3
import json
import os
import re
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


def run_text(command, timeout=8):
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def read_cpu_percent():
    output = run_text(["top", "-l", "2", "-n", "0", "-F", "-R"])
    matches = re.findall(r"CPU usage:\s*([\d.]+)% user,\s*([\d.]+)% sys", output)
    if not matches:
        return 0.0
    user, system = matches[-1]
    try:
        return round(float(user) + float(system), 1)
    except ValueError:
        return 0.0


def read_memory():
    total_text = run_text(["sysctl", "-n", "hw.memsize"])
    vm = run_text(["vm_stat"])
    try:
        total_bytes = int(total_text)
    except ValueError:
        return 0.0, 0.0, 0.0

    page_match = re.search(r"page size of (\d+) bytes", vm)
    page_size = int(page_match.group(1)) if page_match else 4096

    def pages(label):
        match = re.search(rf"^{re.escape(label)}:\s+(\d+)\.", vm, re.MULTILINE)
        return int(match.group(1)) if match else 0

    free_pages = pages("Pages free") + pages("Pages speculative")
    inactive_pages = pages("Pages inactive")
    purgeable_pages = pages("Pages purgeable")
    available_bytes = (free_pages + inactive_pages + purgeable_pages) * page_size
    used_bytes = max(0, total_bytes - available_bytes)
    percent = (used_bytes / total_bytes * 100) if total_bytes else 0
    return round(percent, 1), round(used_bytes / 1024**3, 2), round(total_bytes / 1024**3, 2)


def read_uptime():
    output = run_text(["sysctl", "-n", "kern.boottime"])
    match = re.search(r"sec = (\d+)", output)
    if not match:
        return 0
    try:
        boot = int(match.group(1))
        return max(0, int(time.time()) - boot)
    except ValueError:
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


def build_payload():
    cpu = read_cpu_percent()
    memory_percent, memory_used, memory_total = read_memory()
    disk = shutil.disk_usage("/")
    disk_total = disk.total / 1024**3
    disk_used = disk.used / 1024**3
    disk_percent = (disk.used / disk.total * 100) if disk.total else 0

    return {
        "device": "master-mac",
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
            "User-Agent": "LuMa-Control-Agent-macOS/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.status, response.read().decode("utf-8")


def main():
    print("LuMa Control Center macOS Agent starting...", flush=True)
    print(f"Endpoint: {ENDPOINT}", flush=True)
    print(f"Interval: {INTERVAL}s", flush=True)

    while True:
        try:
            payload = build_payload()
            status, _ = send(payload)
            print(
                f"[OK] {payload['hostname']} | CPU {payload['cpuPercent']}% | "
                f"RAM {payload['memoryPercent']}% | HTTP {status}",
                flush=True,
            )
        except Exception as exc:
            print(f"[ERROR] {exc}", flush=True)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
