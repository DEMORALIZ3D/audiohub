#!/usr/bin/env python3
import http.server
import subprocess
import os
import sys
import threading
import logging
import json
import urllib.request

HOST = "0.0.0.0"
PORT = 4534
SECRET = os.getenv("AUDIOHUB_DEPLOY_TOKEN", "ah_local_dep_f98231")
AUDIOHUB_DIR = os.path.expanduser("~/code/audiohub")
LOG_FILE = os.path.join(AUDIOHUB_DIR, "deploy.log")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def send_discord(title: str, description: str, color: int = 1947988, fields: list = None):
    if not DISCORD_WEBHOOK_URL:
        return
    payload = {
        "embeds": [{
            "title": title,
            "description": description,
            "color": color,
            "fields": fields or [],
            "footer": {"text": "AudioHub CI/CD • media server"}
        }]
    }
    try:
        req = urllib.request.Request(
            DISCORD_WEBHOOK_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "AudioHub-Deployer"}
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        logging.error(f"Failed to send Discord webhook: {e}")

is_deploying = False
deploy_lock = threading.Lock()

def run_deploy(commit_info: dict = None):
    global is_deploying
    with deploy_lock:
        if is_deploying:
            logging.warning("Deployment already in progress. Skipping duplicate request.")
            return
        is_deploying = True

    try:
        logging.info("Starting deployment task...")
        
        # 1. Notify Discord that deploy has started
        commit_msg = commit_info.get("message", "No commit message") if commit_info else "Manual trigger"
        author = commit_info.get("author", "Unknown") if commit_info else "Admin"
        
        fields = [
            {"name": "Commit", "value": commit_msg[:100], "inline": False},
            {"name": "Author", "value": author, "inline": True},
            {"name": "Target", "value": os.getenv("DEPLOY_TARGET", "Homelab Media Server"), "inline": True}
        ]
        send_discord(
            title="🚀 AudioHub Deploy Started",
            description="Pulling `master` branch and rebuilding Docker container on media server...",
            color=15844367, # Gold / Yellow
            fields=fields
        )

        cmd = (
            f"cd {AUDIOHUB_DIR} && "
            "chmod -R u+rwX frontend backend scripts 2>/dev/null || true && "
            "git fetch origin master && "
            "git reset --hard origin/master && "
            "docker compose down && "
            "docker compose up -d --build audiohub"
        )

        with open(LOG_FILE, "a") as f:
            f.write(f"\n==================== Deployment: {os.popen('date').read().strip()} ====================\n")
            proc = subprocess.Popen(
                cmd, shell=True, stdout=f, stderr=subprocess.STDOUT
            )
            proc.wait()
            f.write(f"==================== Exit Code: {proc.returncode} ====================\n")

        logging.info(f"Deployment finished with exit code {proc.returncode}")

        if proc.returncode == 0:
            public_url = os.getenv("PUBLIC_URL", "http://localhost:4533")
            send_discord(
                title="✅ AudioHub Deployed Successfully",
                description=f"AudioHub has been rebuilt and is live at **{public_url}**",
                color=1947988, # Emerald Green
                fields=[
                    {"name": "Status", "value": "Online & Serving", "inline": True},
                    {"name": "Branch", "value": "master", "inline": True}
                ]
            )
        else:
            # Read last 5 lines of deploy log
            try:
                with open(LOG_FILE, "r") as f:
                    lines = f.readlines()
                    last_lines = "".join(lines[-6:])
            except Exception:
                last_lines = "Check deploy.log for details"

            send_discord(
                title="❌ AudioHub Deployment Failed",
                description=f"Docker build/startup failed with exit code `{proc.returncode}`:\n```{last_lines[:500]}```",
                color=15158332 # Red
            )
    except Exception as e:
        logging.error(f"Error during deployment: {e}")
        send_discord(
            title="❌ AudioHub Deployer Error",
            description=f"Deployer exception: `{str(e)}`",
            color=15158332
        )
    finally:
        with deploy_lock:
            is_deploying = False

class DeployHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        auth = self.headers.get("X-Deploy-Token")
        if auth != SECRET:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'{"error": "Forbidden"}')
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            data = json.loads(body.decode("utf-8"))
        except Exception:
            data = {}

        commit_info = data.get("commit")

        threading.Thread(target=run_deploy, args=(commit_info,), daemon=True).start()
        
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status": "deploying", "message": "Deployment started on media server"}')

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"service": "audiohub-deployer", "status": "online"}')

    def log_message(self, format, *args):
        logging.info("%s - - [%s] %s" % (self.client_address[0], self.log_date_time_string(), format % args))

if __name__ == "__main__":
    server = http.server.HTTPServer((HOST, PORT), DeployHandler)
    logging.info(f"AudioHub host deployer listening on {HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
