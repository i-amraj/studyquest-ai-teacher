import math
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user
from ..models import User, XpLedger, Badge, UserBadge, TestAttempt, Syllabus, ChatMessage

router = APIRouter(prefix="/api/me", tags=["me"])

class LangIn(BaseModel):
    language: str

@router.patch("/language")
def set_language(data: LangIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..services.ai_helpers import VALID_LANGS
    lang = (data.language or "").lower()
    if lang not in VALID_LANGS:
        raise HTTPException(422, "Language hindi, urdu, hinglish ya english me se chuno")
    user.language = lang; db.commit()
    return {"language": lang}

@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    level = int(math.sqrt(user.xp / 100)) + 1
    cur_base = (level - 1) ** 2 * 100
    nxt_base = level ** 2 * 100
    badges = (db.query(Badge).join(UserBadge).filter(UserBadge.user_id == user.id).all())
    ledger = db.query(XpLedger).filter(XpLedger.user_id == user.id).order_by(XpLedger.id.desc()).limit(10).all()
    return {"public_id": user.public_id, "language": getattr(user, "language", "hinglish"), "name": user.name, "xp": user.xp, "level": level,
            "level_progress_percent": round((user.xp - cur_base) / max(nxt_base - cur_base, 1) * 100, 1),
            "next_level_xp": nxt_base, "streak_days": user.streak_days,
            "badges": [{"code": b.code, "title": b.title, "description": b.description, "icon": b.icon} for b in badges],
            "xp_history": [{"amount": l.amount, "reason": l.reason, "created_at": l.created_at.isoformat() if l.created_at else None} for l in ledger]}

@router.get("/history")
def history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    atts = db.query(TestAttempt).filter(TestAttempt.user_id == user.id).order_by(TestAttempt.id.desc()).limit(30).all()
    syl = db.query(Syllabus).filter(Syllabus.user_id == user.id).count()
    chats = db.query(ChatMessage).filter(ChatMessage.user_id == user.id, ChatMessage.role == "user").count()
    return {"syllabi_count": syl, "doubts_asked": chats,
            "attempts": [{"id": a.id, "chapter_id": a.chapter_id, "score_percent": a.score_percent, "passed": a.passed,
                          "weak_topics": a.weak_topics, "created_at": a.created_at.isoformat() if a.created_at else None} for a in atts]}

@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(User).order_by(User.xp.desc()).limit(10).all()
    return [{"public_id": u.public_id, "name": u.name, "xp": u.xp, "level": u.level, "you": u.id == user.id} for u in rows]
