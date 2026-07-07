"""Test tạm: dòng tiến trình yt-dlp có tới liên tục qua pipe không (xoá sau khi test)."""
import os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ytdl_server import find_ytdlp, find_ffmpeg

cmd = [
    find_ytdlp(),
    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
    "--merge-output-format", "mp4",
    "--no-playlist", "--newline",
    "--limit-rate", "3M",
    "--ffmpeg-location", find_ffmpeg(),
    "-o", os.path.join(os.environ["TEMP"], "pipetest-%(id)s.%(ext)s"),
    "https://www.youtube.com/watch?v=9bZkp7q19f0",
]
env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "PYTHONUNBUFFERED": "1"}
t0 = time.time()
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                        text=True, encoding="utf-8", errors="replace", env=env,
                        creationflags=subprocess.CREATE_NO_WINDOW)
for line in proc.stdout:
    line = line.strip()
    if "[download]" in line and "%" in line:
        print(f"{time.time()-t0:6.2f}s  {line[:80]}", flush=True)
proc.wait()
print(f"exit={proc.returncode}, total={time.time()-t0:.1f}s")
