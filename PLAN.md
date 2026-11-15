# StudyQuest — AI Teacher for College Students
**College submission project | Raj Soni**

## 1. Idea (1 line)
Student apna syllabus (PDF/Image) upload karta hai → Gemini AI use Units → Chapters → Topics me todta hai → har chapter ko game-level ki tarah padhata hai, notes banata hai, test leta hai — **80% se kam par next chapter LOCK** rehta hai.

## 2. Final Tech Stack (deep-research verified, Nov 2026)
| Layer | Choice | Kyun |
|---|---|---|
| Frontend | React 18 + Vite, React Router, GSAP 3 (free) + Lenis (sirf landing) | Fast, mobile-first, smooth motion; GSAP ke saare plugins ab free hain |
| Backend | Python FastAPI 0.115+, Pydantic v2 | Async, auto docs, college viva me explain karna easy |
| DB | MySQL 8 (SQLAlchemy 2.0, PyMySQL, Alembic) | Requirement; utf8mb4, pooling |
| AI | Google Gemini via `google-genai` SDK (purana SDK deprecated) — `gemini-2.5-flash` default, `gemini-2.5-pro` fallback | Structured JSON output (Pydantic schema), PDF/image native samajhta hai |
| Auth | Argon2id password hash (OWASP #1), JWT access 30 min + refresh 7 din (rotated, DB me hashed) | Secure routes/APIs |
| PDF in | PyMuPDF (text layer) → scanned ho to Gemini Vision | Fast + accurate |
| PDF out | ReportLab (notes export) | Zero heavy deps |
| Deploy | Ek `setup.sh` → MySQL install, DB/user, .env secrets, deps, frontend build, backend serve (single origin), Cloudflare Tunnel se public URL | Ek command = live project |

## 3. Kaise kaam karega (User Flow)
1. Register/Login → har student ko unique ID: `STU-XXXXXXXX` (UUID based, kabhi repeat nahi)
2. Dashboard = game map (Duolingo-style winding path) — XP, Level, Streak, Badges
3. Syllabus upload (PDF/PNG/JPG, max 10MB, magic-byte check) → Gemini structured JSON: Units → Chapters → Topics
4. Chapter kholo → AI Teacher lesson (sirf us chapter ke content se grounded) + Doubt Chat (topic se bahar jawab nahi)
5. Notes auto-ready → PDF download
6. Chapter complete → Test (MCQ auto-check Python se, short-answer Gemini rubric se)
7. **≥80% = PASS** → +XP, badge, next chapter unlock. <80% = corrective re-teach (galat topics dobara, alag tareeke se) + naya test variant. Unlimited retry, koi "hearts" block nahi.
8. Spaced review: 1/3/7/21 din par purane chapters ke revision quests
9. Puri History: chats, tests, scores, notes — sab saved

## 4. Gamification (research-backed)
- Mastery gate 80% (Bloom mastery learning) + correctives + parallel retest
- XP sirf mastery/revision par (clicks par nahi), server-side XP ledger (cheating impossible)
- Level curve, daily streak + 1 freeze/week, milestone badges, daily quests (weak topics)
- Leaderboard: opt-in, weekly, chhota cohort — global all-time board NAHI (demotivate karta hai)

## 5. Security Checklist
Argon2id hash • JWT single-algo verify + refresh rotation/reuse-detect • har query me ownership check (IDOR safe) • upload magic-byte + size + UUID filename • rate-limit (login 5/min, AI endpoints daily budget per user) • CORS allowlist (single-origin deploy me same site) • saare AI outputs DB me cache (quota bachta hai, 429 par backoff) • secrets sirf `.env` me, git me kabhi nahi

## 6. UI Design (AI-generated NAHI lagega)
- Editorial/academic look: warm paper background, ink text, ek hi accent (deep green), Fraunces (headings) + Inter (body)
- BAN list: purple/indigo gradient, center hero + 3 cards, har jagah same radius/shadow — ye AI fingerprint hai, use nahi hoga
- GSAP ke sirf 2–4 signature moments (path draw, level-up, page transitions), transform/opacity only, `prefers-reduced-motion` respect
- Mobile-first: bottom tab bar, 44px touch targets, smooth scroll, koi horizontal overflow nahi, text truncate/ellipsis rules har card me

## 7. Build Chunks (isi order me banega)
- **Chunk 1 — Foundation:** project scaffold, MySQL schema (14 tables), Auth (register/login/refresh/logout), unique Student ID, protected routes, setup.sh v1 ✅ COMPLETE + LIVE TESTED 2026-11-15
- **Chunk 2 — Syllabus Engine:** upload + PyMuPDF extract + Gemini parse → Units/Chapters/Topics, progress map UI ✅ COMPLETE + TESTED
- **Chunk 3 — AI Teacher:** chapter lesson generation (cached), doubt chat (grounded, history saved), notes generation + PDF export ✅ COMPLETE + TESTED
- **Chunk 4 — Test Engine:** test generate, MCQ auto-eval, short-answer rubric eval, 80% gate, corrective re-teach + retest variants ✅ COMPLETE + TESTED
- **Chunk 5 — Gamification:** XP ledger, levels, streak, badges, quests, spaced review, leaderboard ✅ COMPLETE + TESTED
- **Chunk 6 — Polish + Deploy:** GSAP motion, landing page, full responsive QA, setup.sh final (MySQL→build→tunnel→public URL), README ✅ COMPLETE — full setup.sh run + Chromium E2E (register→upload→lesson→chat→notes→test→mastery→unlock→mobile) PASS 2026-11-15; 3 bugs found & fixed during testing (SPA deep-link 404, Upload-page useEffect crash, Gemini MCQ correct_index validation)

## 8. Add-ons (mere taraf se, minimum ke upar)
Admin/demo account seed • Demo syllabus sample (1-click try) • Test result analysis (topic-wise weak/strong) • Notes PDF with header/branding • API docs (Swagger) viva ke liye • Docker Compose alternative (docs me)

## 9. Research caveats (imaandari se)
Gemini free-tier ki exact quota Google publish nahi karta (per-project, AI Studio me dikhta hai) — isliye design quota-safe hai: cache + per-user daily AI budget. Model IDs `.env` me hain taaki submission day par latest model ek line me badal sake.
