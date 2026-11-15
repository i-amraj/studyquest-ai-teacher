import json, math
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user
from ..models import User, Chapter, Topic, Test, Question, TestAttempt, Progress, Unit, XpLedger, Badge, UserBadge
from ..services import gemini_service as g, fallback_service as fb
from ..services.ai_helpers import budget_left, log_usage, lang_instruction, TEST_SCHEMA
from .learn import get_chapter_ctx

router = APIRouter(prefix="/api/chapters", tags=["tests"])

def award_xp(db, user, amount, reason, ref_id=0):
    if amount <= 0:
        return
    db.add(XpLedger(user_id=user.id, amount=amount, reason=reason, ref_id=ref_id))
    user.xp += amount
    user.level = int(math.sqrt(user.xp / 100)) + 1

def maybe_badge(db, user, code, title, desc, icon):
    b = db.query(Badge).filter(Badge.code == code).first()
    if not b:
        b = Badge(code=code, title=title, description=desc, icon=icon); db.add(b); db.flush()
    if not db.query(UserBadge).filter(UserBadge.user_id == user.id, UserBadge.badge_id == b.id).first():
        db.add(UserBadge(user_id=user.id, badge_id=b.id))

@router.post("/{cid}/test/generate")
def generate_test(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch, unit, s, prog, topics = get_chapter_ctx(db, user, cid)
    attempts = db.query(TestAttempt).filter(TestAttempt.user_id == user.id, TestAttempt.chapter_id == cid).count()
    variant = attempts + 1
    data, source = None, "fallback"
    if budget_left(db, user.id) and g.gemini_ready():
        for _try in range(2):
            try:
                prompt = (f"Chapter: {ch.title}\nTopics:\n" + "\n".join(f"- {t.title}: {t.detail}" for t in topics) +
                          f"\n\nEk test banao (variant {variant} — pehle se alag sawal): 6 MCQ (har MCQ me exactly 4 options, options shuffle karke rakho taaki sahi jawab hamesha pehla na ho, aur correct_index ZAROOR do — sahi option ka 0-based index) aur 2 short-answer (rubric me model answer, correct_index -1). "
                          "Har question me topic_title, marks (MCQ=1, short=2) aur correct_index do. Ek bhi MCQ bina correct_index ke mat bhejo. " + lang_instruction(user.language) + " Sawal, options aur rubric usi bhasha me rakho.")
                raw = g.generate_json(prompt, TEST_SCHEMA)
                valid = []
                for q in raw.get("questions", []):
                    if q.get("qtype") == "mcq":
                        opts = q.get("options") or []
                        ci = q.get("correct_index")
                        if isinstance(ci, int) and 0 <= ci < len(opts) and len(opts) >= 2:
                            valid.append(q)
                        # galat/bina correct_index wala MCQ drop — warna student use kabhi pass nahi kar payega
                    else:
                        valid.append(q)
                if len([q for q in valid if q.get("qtype") == "mcq"]) >= 4:
                    data = {"questions": valid}; source = "gemini"; log_usage(db, user.id, "test"); break
            except Exception:
                data = None
    if not data:
        data = fb.test_from_topics(ch.title, [{"title": t.title, "detail": t.detail} for t in topics])
    test = Test(chapter_id=cid, variant=variant); db.add(test); db.flush()
    for q in data["questions"][:10]:
        db.add(Question(test_id=test.id, qtype=q.get("qtype", "mcq"), question=str(q.get("question", ""))[:2000],
                        options=q.get("options", []) if isinstance(q.get("options"), list) else [],
                        correct_index=int(q.get("correct_index", -1)), rubric=str(q.get("rubric", ""))[:2000],
                        topic_title=str(q.get("topic_title", ""))[:255], marks=int(q.get("marks", 1))))
    db.commit()
    return {"test_id": test.id, "variant": variant, "source": source}

@router.get("/{cid}/test/{test_id}")
def get_test(cid: int, test_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_chapter_ctx(db, user, cid)
    test = db.get(Test, test_id)
    if not test or test.chapter_id != cid:
        raise HTTPException(404, "Test nahi mila")
    qs = db.query(Question).filter(Question.test_id == test_id).order_by(Question.id).all()
    return {"test_id": test.id, "questions": [{"id": q.id, "qtype": q.qtype, "question": q.question,
            "options": q.options, "marks": q.marks, "topic_title": q.topic_title} for q in qs]}

class SubmitIn(BaseModel):
    test_id: int
    answers: dict  # {question_id: {"index": int} | {"text": str}}

@router.post("/{cid}/test/submit")
def submit(cid: int, data: SubmitIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch, unit, s, prog, topics = get_chapter_ctx(db, user, cid)
    test = db.get(Test, data.test_id)
    if not test or test.chapter_id != cid:
        raise HTTPException(404, "Test nahi mila")
    qs = db.query(Question).filter(Question.test_id == test.id).all()
    total = sum(q.marks for q in qs) or 1
    earned, weak, detail = 0.0, [], []
    short_qs = []
    for q in qs:
        a = data.answers.get(str(q.id)) or data.answers.get(q.id) or {}
        if q.qtype == "mcq":
            ok = int(a.get("index", -1)) == q.correct_index
            got = q.marks if ok else 0
            if not ok:
                weak.append(q.topic_title)
            detail.append({"question_id": q.id, "correct": ok, "got": got, "correct_index": q.correct_index})
            earned += got
        else:
            short_qs.append((q, str(a.get("text", ""))))
    for q, text in short_qs:
        got = 0.0
        if text.strip():
            if budget_left(db, user.id) and g.gemini_ready():
                try:
                    res = g.generate_json(
                        f"Question: {q.question}\nModel answer/rubric: {q.rubric}\nStudent answer: {text}\n\n"
                        f"Score 0 to {q.marks} (float allowed). Sirf JSON do.",
                        {"type": "OBJECT", "properties": {"score": {"type": "NUMBER"}, "feedback": {"type": "STRING"}}, "required": ["score"]})
                    got = max(0.0, min(float(res.get("score", 0)), float(q.marks)))
                    log_usage(db, user.id, "eval")
                except Exception:
                    got = 0.0
            if got == 0.0:  # fallback: keyword overlap
                rub = set(w.lower() for w in q.rubric.split() if len(w) > 3)
                ans = set(w.lower() for w in text.split() if len(w) > 3)
                ratio = len(rub & ans) / max(len(rub), 1)
                got = round(q.marks * min(ratio * 1.6, 1.0), 1)
        if got < q.marks * 0.6:
            weak.append(q.topic_title)
        detail.append({"question_id": q.id, "correct": got >= q.marks * 0.6, "got": got})
        earned += got
    percent = round(earned / total * 100, 1)
    passed = percent >= 80
    attempt = TestAttempt(user_id=user.id, test_id=test.id, chapter_id=cid, score_percent=percent,
                          passed=passed, answers=data.answers, weak_topics=list(dict.fromkeys(weak)))
    db.add(attempt); db.flush()
    xp_awarded = 0
    if percent > prog.best_score:
        prog.best_score = percent
    if passed and prog.status != "mastered":
        prog.status = "mastered"
        attempts_count = db.query(TestAttempt).filter(TestAttempt.user_id == user.id, TestAttempt.chapter_id == cid).count()
        xp_awarded = 50 + (25 if attempts_count <= 1 else 0)
        award_xp(db, user, xp_awarded, "chapter_mastered", cid)
        maybe_badge(db, user, "first_mastery", "First Mastery", "Pehla chapter 80%+ se pass", "star")
        # next chapter unlock
        all_ch = (db.query(Chapter).join(Unit).filter(Unit.syllabus_id == s.id)
                  .order_by(Unit.position, Chapter.position).all())
        ids = [c.id for c in all_ch]
        if cid in ids and ids.index(cid) + 1 < len(ids):
            nxt = db.query(Progress).filter(Progress.user_id == user.id, Progress.chapter_id == ids[ids.index(cid) + 1]).first()
            if nxt and nxt.status == "locked":
                nxt.status = "unlocked"
    db.commit()
    return {"score_percent": percent, "passed": passed, "xp_awarded": xp_awarded,
            "weak_topics": list(dict.fromkeys(weak)), "detail": detail,
            "message": "Mastered! Agla chapter unlock ho gaya." if passed else "80% se kam hai — weak topics dobara padho aur phir test do."}

@router.get("/{cid}/attempts")
def attempts(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_chapter_ctx(db, user, cid)
    rows = db.query(TestAttempt).filter(TestAttempt.user_id == user.id, TestAttempt.chapter_id == cid).order_by(TestAttempt.id.desc()).all()
    return [{"id": r.id, "score_percent": r.score_percent, "passed": r.passed, "weak_topics": r.weak_topics,
             "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]
