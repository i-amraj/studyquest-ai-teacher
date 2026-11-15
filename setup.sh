#!/usr/bin/env bash
# StudyQuest AI Teacher — ONE-COMMAND SETUP
# Usage:  bash setup.sh            (fresh install + run + public URL)
#         bash setup.sh --no-tunnel (sirf local run)
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
echo "=== StudyQuest setup shuru ==="

# 1) System packages (MySQL, Python, Node, build tools)
if command -v apt-get >/dev/null 2>&1; then
  if [ ! -f /tmp/.sq_apt_done ]; then
    sudo apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server python3 python3-venv python3-pip curl git build-essential libmysqlclient-dev pkg-config || true
    # Node 20 LTS agar node nahi hai ya purana hai
    if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    fi
    touch /tmp/.sq_apt_done
  fi
  sudo service mysql start || sudo mysqld_safe --skip-grant-tables=0 & sleep 3 || true
fi

# 2) MySQL database + user (idempotent)
if command -v mysql >/dev/null 2>&1; then
  sudo mysql -e "CREATE DATABASE IF NOT EXISTS studyquest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                 CREATE USER IF NOT EXISTS 'studyquest'@'localhost' IDENTIFIED BY 'studyquest_pass';
                 CREATE USER IF NOT EXISTS 'studyquest'@'127.0.0.1' IDENTIFIED BY 'studyquest_pass';
                 GRANT ALL PRIVILEGES ON studyquest.* TO 'studyquest'@'localhost';
                 GRANT ALL PRIVILEGES ON studyquest.* TO 'studyquest'@'127.0.0.1';
                 FLUSH PRIVILEGES;" && echo "[OK] MySQL database ready" || echo "[WARN] MySQL setup skip — SQLite fallback chalega"
fi

# 3) .env (secrets auto-generate; Gemini key ek baar poochta hai)
if [ ! -f backend/.env ]; then
  SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  GEMINI_KEY="${GEMINI_API_KEY:-}"
  if [ -z "$GEMINI_KEY" ]; then
    read -r -p "Apni Gemini API key paste karo (Enter = baad me .env me dalna): " GEMINI_KEY || true
  fi
  if command -v mysql >/dev/null 2>&1 && mysql -ustudyquest -pstudyquest_pass -e "SELECT 1" studyquest >/dev/null 2>&1; then
    DB_URL="mysql+pymysql://studyquest:studyquest_pass@127.0.0.1:3306/studyquest?charset=utf8mb4"
  else
    DB_URL="sqlite:///./studyquest_dev.db"
  fi
  cat > backend/.env << ENVEOF
SECRET_KEY=$SECRET
DATABASE_URL=$DB_URL
GEMINI_API_KEY=$GEMINI_KEY
GEMINI_MODEL=gemini-3.8-flash
GEMINI_MODEL_PRO=gemini-3.1-pro-preview
ENVEOF
  echo "[OK] backend/.env ready"
fi

# 4) Python deps
python3 -m venv backend/.venv
backend/.venv/bin/pip install -q --upgrade pip
backend/.venv/bin/pip install -q -r backend/requirements.txt
echo "[OK] Python deps installed"

# 5) Frontend build (single origin — backend hi serve karega, CORS/tunnel URL ki tension khatam)
(cd frontend && npm install -q && npm run build)
echo "[OK] Frontend build ready"

# 6) Run backend (8000) — purana process ho to rok do
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1
(cd backend && nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../server.log 2>&1 &)
for i in $(seq 1 30); do curl -s http://127.0.0.1:8000/api/health >/dev/null && break || sleep 1; done
curl -s http://127.0.0.1:8000/api/health && echo ""
echo "[OK] Local: http://localhost:8000"

# 7) Public URL via Cloudflare quick tunnel
if [ "${1:-}" != "--no-tunnel" ]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    curl -fsSL -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x /tmp/cloudflared && sudo mv /tmp/cloudflared /usr/local/bin/cloudflared || true
  fi
  pkill -f "cloudflared tunnel" 2>/dev/null || true
  nohup cloudflared tunnel --url http://localhost:8000 > tunnel.log 2>&1 &
  for i in $(seq 1 30); do grep -o "https://[a-z0-9-]*\.trycloudflare\.com" tunnel.log | grep -v "api.trycloudflare.com" | head -1 > /tmp/sq_url.txt && [ -s /tmp/sq_url.txt ] && break || sleep 1; done
  echo "=== PUBLIC URL: $(cat /tmp/sq_url.txt 2>/dev/null) ==="
  echo "(Tunnel band karne par URL badal jayega — college demo ke liye kaafi hai)"
fi
echo "=== Setup complete. Log: server.log | Tunnel: tunnel.log ==="
