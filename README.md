# StudyQuest — AI Teacher 🎓
College submission project: syllabus upload karo, Gemini AI units/chapters banata hai, har chapter padhata hai, notes + test deta hai, 80% pass gate ke saath gamified learning.

## Features
- **Animated landing page** — GSAP motion, live AI-teacher character (blinking/waving), typewriter teacher chat, floating XP chips, animated counters
- **4 languages** — Teacher padhata hai **Hindi (हिंदी), Urdu (اردو), Hinglish aur English** me — lesson, notes, doubt chat, test sab usi bhasha me (register par chuno ya dashboard se kabhi bhi badlo)
- **Smart syllabus upload** — PDF/photo, **25MB tak**; badi scanned PDF apne aap **auto-compress** hokar AI ko jaati hai, user ko size ki tension nahi
- **80% Mastery Gate** — test pass kiye bina agla chapter locked; fail par weak topics + AI dobara alag tareeke se padhata hai
- **Gamification** — XP, levels, daily streak, badges, leaderboard; har student ki unique ID (`STU-XXXXXXXX`)
- **Secure** — Argon2id passwords, JWT access + rotating refresh tokens, rate limits, har route par auth
- **Mobile-first** — fully responsive, mobile par bottom tab bar, koi overflow nahi

## One-command run
```bash
bash setup.sh
```
MySQL install → DB → .env → deps → frontend build → server → **public URL** (Cloudflare tunnel).

## Local dev (bina MySQL)
```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000   # SQLite fallback default
cd ../frontend && npm install && npm run dev  # http://localhost:5173
```
Gemini key: `backend/.env` me `GEMINI_API_KEY=` dalo.

## Structure
- `PLAN.md` — full plan + chunks
- `backend/app` — FastAPI (auth, models: 17 tables, gemini service)
- `frontend/src` — React (landing, auth, dashboard map)
- `setup.sh` — single-file setup
