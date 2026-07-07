#!/usr/bin/env python3
"""Helper tải video YouTube — server + bộ cài gộp trong 1 file (macOS / Linux / Windows).

Cài đặt (1 lần mỗi máy):  python3 ytdl_server.py install
  → kiểm tra/cài yt-dlp + ffmpeg, copy file này vào thư mục cài đặt,
    đăng ký tự khởi động cùng máy, chạy server và tự kiểm tra.

Chạy server (tự động sau khi cài):  python3 ytdl_server.py
  Nhận request từ extension (qua background.js), chạy yt-dlp tải video
  về thư mục Downloads, theo dõi % tiến trình từng job.

Endpoint (chỉ lắng nghe 127.0.0.1):
  GET /ping           → kiểm tra helper sống
  GET /download?url=  → bắt đầu tải (chỉ nhận link YouTube), trả về {id}
  GET /status?id=     → {status: downloading|done|error, percent, file, error}
  GET /reveal?id=     → mở thư mục chứa file đã tải trong Finder/Explorer
"""
import json
import platform
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PORT = 43011
DOWNLOAD_DIR = Path.home() / "Downloads"
SYSTEM = platform.system()  # Darwin | Linux | Windows
if SYSTEM == "Windows":
    import os
    INSTALL_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "ytdl-helper"
else:
    INSTALL_DIR = Path.home() / ".ytdl-helper"
ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com",
    "music.youtube.com", "youtu.be",
}
PROGRESS_RE = re.compile(r"\[download\]\s+(\d+(?:\.\d+)?)%")

# ==================== SERVER ====================

jobs = {}
jobs_lock = threading.Lock()


def find_ytdlp():
    found = shutil.which("yt-dlp")
    if found:
        return found
    for p in ("/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp",
              str(Path.home() / ".local/bin/yt-dlp")):
        if Path(p).exists():
            return p
    return None


def set_job(job_id, **fields):
    with jobs_lock:
        jobs.setdefault(job_id, {}).update(fields)


def get_job(job_id):
    with jobs_lock:
        return dict(jobs.get(job_id) or {})


def run_download(job_id, url):
    ytdlp = find_ytdlp()
    if not ytdlp:
        set_job(job_id, status="error", error="Không tìm thấy yt-dlp — chạy lại: python3 ytdl_server.py install")
        return

    cmd = [
        ytdlp,
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
        "--merge-output-format", "mp4",
        "--no-playlist", "--newline",
        "--no-simulate", "--print", "after_move:filepath",
        "-o", str(DOWNLOAD_DIR / "%(title)s [%(id)s].%(ext)s"),
        url,
    ]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding="utf-8", errors="replace")
    except OSError as e:
        set_job(job_id, status="error", error=f"Không chạy được yt-dlp: {e}")
        return

    file_path = None
    last_line = ""
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        last_line = line
        m = PROGRESS_RE.search(line)
        if m:
            set_job(job_id, percent=float(m.group(1)))
        elif not line.startswith("[") and Path(line).exists():
            # dòng do --print after_move:filepath in ra: đường dẫn file cuối cùng
            file_path = line

    proc.wait()
    if proc.returncode == 0 and file_path:
        set_job(job_id, status="done", percent=100, file=file_path)
    else:
        set_job(job_id, status="error", error=last_line or "yt-dlp thoát bất thường")


def reveal_file(path):
    if SYSTEM == "Darwin":
        subprocess.run(["open", "-R", path])
    elif SYSTEM == "Windows":
        subprocess.run(["explorer", "/select,", path])
    else:
        subprocess.run(["xdg-open", str(Path(path).parent)])


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        if parsed.path == "/ping":
            return self._send(200, {"status": "ok", "version": 3})

        if parsed.path == "/download":
            url = query.get("url", [None])[0]
            host = urlparse(url or "").hostname
            if host not in ALLOWED_HOSTS:
                return self._send(400, {"error": "chỉ nhận link YouTube"})
            job_id = uuid.uuid4().hex[:8]
            set_job(job_id, status="downloading", percent=0)
            threading.Thread(target=run_download, args=(job_id, url), daemon=True).start()
            return self._send(200, {"id": job_id})

        if parsed.path == "/status":
            job = get_job(query.get("id", [""])[0])
            if not job:
                return self._send(404, {"error": "không có job này"})
            return self._send(200, job)

        if parsed.path == "/reveal":
            job = get_job(query.get("id", [""])[0])
            if job.get("file"):
                reveal_file(job["file"])
                return self._send(200, {"status": "ok"})
            return self._send(404, {"error": "job chưa có file"})

        self._send(404, {"error": "not found"})

    def log_message(self, *args):
        pass


def serve():
    print(f"yt-dlp helper: http://127.0.0.1:{PORT} → tải về {DOWNLOAD_DIR}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


# ==================== BỘ CÀI (python3 ytdl_server.py install) ====================

def say(msg):
    print(f"\n==> {msg}")


def die(msg):
    print(f"\n❌ LỖI: {msg}", file=sys.stderr)
    sys.exit(1)


def run_ok(cmd):
    return subprocess.run(cmd).returncode == 0


def ensure_tools():
    say("Kiểm tra yt-dlp + ffmpeg...")
    need_ytdlp = find_ytdlp() is None
    need_ffmpeg = shutil.which("ffmpeg") is None and not Path("/opt/homebrew/bin/ffmpeg").exists()
    if not need_ytdlp and not need_ffmpeg:
        return

    if SYSTEM == "Darwin":
        if not shutil.which("brew"):
            die("Cần Homebrew để cài yt-dlp + ffmpeg. Cài tại https://brew.sh rồi chạy lại.")
        if need_ytdlp and not run_ok(["brew", "install", "yt-dlp"]):
            die("Cài yt-dlp thất bại")
        if need_ffmpeg and not run_ok(["brew", "install", "ffmpeg"]):
            die("Cài ffmpeg thất bại")
    elif SYSTEM == "Linux":
        if shutil.which("apt-get"):
            run_ok(["sudo", "apt-get", "update"])
            ok = run_ok(["sudo", "apt-get", "install", "-y", "ffmpeg", "yt-dlp"]) \
                or run_ok(["sudo", "apt-get", "install", "-y", "ffmpeg"]) and run_ok(["pip3", "install", "--user", "-U", "yt-dlp"])
        elif shutil.which("dnf"):
            ok = run_ok(["sudo", "dnf", "install", "-y", "yt-dlp", "ffmpeg"])
        elif shutil.which("pacman"):
            ok = run_ok(["sudo", "pacman", "-S", "--needed", "--noconfirm", "yt-dlp", "ffmpeg"])
        else:
            ok = run_ok(["pip3", "install", "--user", "-U", "yt-dlp"])
        if not ok or (shutil.which("ffmpeg") is None):
            die("Cài yt-dlp/ffmpeg thất bại — cài thủ công rồi chạy lại")
    elif SYSTEM == "Windows":
        if not shutil.which("winget"):
            die("Máy chưa có winget (App Installer). Cài từ Microsoft Store rồi chạy lại.")
        if need_ytdlp and not run_ok(["winget", "install", "-e", "--id", "yt-dlp.yt-dlp",
                                      "--accept-source-agreements", "--accept-package-agreements"]):
            die("Cài yt-dlp thất bại")
        if need_ffmpeg and not run_ok(["winget", "install", "-e", "--id", "Gyan.FFmpeg",
                                       "--accept-source-agreements", "--accept-package-agreements"]):
            die("Cài ffmpeg thất bại")
        print("Lưu ý: winget vừa cài xong thì PATH mới chỉ có ở cửa sổ terminal MỚI.")
    else:
        die(f"Hệ điều hành {SYSTEM} chưa được hỗ trợ")


def register_autostart(server_path):
    say("Đăng ký tự khởi động cùng máy...")
    if SYSTEM == "Darwin":
        plist = Path.home() / "Library/LaunchAgents/com.hoanglap.ytdl-helper.plist"
        uid = subprocess.run(["id", "-u"], capture_output=True, text=True).stdout.strip()
        subprocess.run(["launchctl", "bootout", f"gui/{uid}/com.hoanglap.ytdl-helper"],
                       capture_output=True)
        plist.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.hoanglap.ytdl-helper</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>{server_path}</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/ytdl-helper.log</string>
    <key>StandardErrorPath</key><string>/tmp/ytdl-helper.log</string>
</dict>
</plist>
""")
        # bootout xong, process cũ (KeepAlive) cần một nhịp mới thoát hẳn —
        # bootstrap ngay dễ dính lỗi I/O nên thử lại vài lần
        for _ in range(4):
            if run_ok(["launchctl", "bootstrap", f"gui/{uid}", str(plist)]):
                break
            time.sleep(2)
        else:
            die("launchctl bootstrap thất bại — xem /tmp/ytdl-helper.log")
    elif SYSTEM == "Linux":
        unit_dir = Path.home() / ".config/systemd/user"
        unit_dir.mkdir(parents=True, exist_ok=True)
        (unit_dir / "ytdl-helper.service").write_text(f"""[Unit]
Description=YouTube download helper (yt-dlp)

[Service]
ExecStart=/usr/bin/env python3 {server_path}
Restart=always
Environment=PATH=%h/.local/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
""")
        run_ok(["systemctl", "--user", "daemon-reload"])
        if not run_ok(["systemctl", "--user", "enable", "--now", "ytdl-helper"]):
            die("systemctl enable thất bại — xem: systemctl --user status ytdl-helper")
        run_ok(["systemctl", "--user", "restart", "ytdl-helper"])
    elif SYSTEM == "Windows":
        pythonw = Path(sys.executable).with_name("pythonw.exe")
        runner = str(pythonw if pythonw.exists() else sys.executable)
        if not run_ok(["schtasks", "/Create", "/F", "/TN", "ytdl-helper", "/SC", "ONLOGON",
                       "/TR", f'"{runner}" "{server_path}"']):
            die("Tạo task tự khởi động thất bại")
        run_ok(["schtasks", "/Run", "/TN", "ytdl-helper"])


def verify_running():
    say("Kiểm tra helper...")
    import urllib.request
    for _ in range(5):
        time.sleep(1)
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/ping", timeout=2) as r:
                if json.load(r).get("status") == "ok":
                    say("✅ Cài xong! Quay lại YouTube và bấm 'Kiểm tra lại' là dùng được.")
                    return
        except Exception:
            pass
    die("Helper không phản hồi. macOS: xem /tmp/ytdl-helper.log — "
        "Linux: systemctl --user status ytdl-helper — Windows: chạy tay 'python ytdl_server.py' xem lỗi")


def do_install():
    ensure_tools()
    say(f"Cài helper vào {INSTALL_DIR}...")
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    target = INSTALL_DIR / "ytdl_server.py"
    if Path(__file__).resolve() != target.resolve():
        shutil.copy2(__file__, target)
    register_autostart(target)
    verify_running()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "install":
        do_install()
    else:
        serve()
