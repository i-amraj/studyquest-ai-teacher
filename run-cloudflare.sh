#!/usr/bin/env bash
# StudyQuest ko apne Cloudflare subdomain (study.iamraj.me) par chalao.
# Pehle Cloudflare API se tunnel "studyquest" banta hai aur uska token
# .tunnel-token file me rakha jata hai (ye file git me NAHI jati).
# Phir bas:  bash run-cloudflare.sh
set -e
cd "$(dirname "$0")"

if [ ! -f .tunnel-token ]; then
  echo "✗ .tunnel-token file nahi mili — pehle Cloudflare tunnel banna baaki hai."
  exit 1
fi
TOKEN=$(tr -d ' \n' < .tunnel-token)

# cloudflared na ho to download karo
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "→ cloudflared download ho raha hai…"
  curl -fsSL -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x /tmp/cloudflared
  CF=/tmp/cloudflared
else
  CF=$(command -v cloudflared)
fi

# Backend chal raha hai? nahi to start karo
if ! curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  echo "→ Backend start ho raha hai…"
  (cd backend && nohup .venv/bin/uvicorn app.main:app --port 8000 > ../server.log 2>&1 &)
  for i in $(seq 1 20); do curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1 && break || sleep 1; done
fi

echo "→ Tunnel start: https://study.iamraj.me"
exec "$CF" tunnel run --token "$TOKEN"
