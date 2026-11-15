import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user
from ..models import User, Syllabus, Unit, Chapter, Topic, Progress
from ..core.config import settings
from ..services.extract_service import extract_pdf_text, sniff_type, compress_pdf_for_ai
from ..services.ai_helpers import parse_syllabus

router = APIRouter(prefix="/api/syllabi", tags=["syllabi"])
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MIMES = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}

def own_syllabus(db, user, sid):
    s = db.get(Syllabus, sid)
    if not s or s.user_id != user.id:
        raise HTTPException(404, "Syllabus nahi mila")
    return s

def chapter_tree(db, syllabus_id, user_id):
    units = db.query(Unit).filter(Unit.syllabus_id == syllabus_id).order_by(Unit.position).all()
    out = []
    for u in units:
        chs = []
        for ch in db.query(Chapter).filter(Chapter.unit_id == u.id).order_by(Chapter.position).all():
            prog = db.query(Progress).filter(Progress.user_id == user_id, Progress.chapter_id == ch.id).first()
            topics = db.query(Topic).filter(Topic.chapter_id == ch.id).order_by(Topic.position).all()
            chs.append({"id": ch.id, "title": ch.title, "summary": ch.summary,
                        "status": prog.status if prog else "locked",
                        "best_score": prog.best_score if prog else 0,
                        "topics": [{"id": t.id, "title": t.title, "detail": t.detail} for t in topics]})
        out.append({"id": u.id, "title": u.title, "chapters": chs})
    return out

@router.post("/upload", status_code=201)
async def upload(file: UploadFile = File(...), title: str = Form(""), subject: str = Form(""),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File bahut badi hai ({len(data) // (1024 * 1024)}MB) — {settings.max_upload_mb}MB tak ki file upload karo")
    ftype = sniff_type(data)
    if not ftype:
        raise HTTPException(415, "Sirf PDF, PNG, JPG ya WebP syllabus chalega")
    fname = f"{uuid.uuid4().hex}.{ftype}"
    (UPLOAD_DIR / fname).write_bytes(data)
    raw_text = ""
    if ftype == "pdf":
        try:
            raw_text = extract_pdf_text(data)
        except Exception:
            raw_text = ""
    s = Syllabus(user_id=user.id, title=(title or file.filename or "My Syllabus")[:255], subject=subject[:180],
                 file_name=file.filename or fname, file_path=fname, file_type=ftype, status="parsing", raw_text=raw_text)
    db.add(s); db.commit(); db.refresh(s)
    ai_bytes = data
    if ftype == "pdf" and len(raw_text) < 200:
        # Scanned/bada PDF — AI ko bhejne se pehle auto-compress (user ko size ki tension nahi)
        ai_bytes = compress_pdf_for_ai(data)
    structure, source = parse_syllabus(db, user.id, raw_text, ai_bytes, ftype, MIMES[ftype])
    if not structure.get("units"):
        db.delete(s); db.commit()
        raise HTTPException(422, "Is file se syllabus samajh nahi aaya — saaf PDF ya photo try karo")
    first = True
    for ui, u in enumerate(structure.get("units", [])):
        unit = Unit(syllabus_id=s.id, title=str(u.get("title", f"Unit {ui+1}"))[:255], position=ui)
        db.add(unit); db.flush()
        for ci, ch in enumerate(u.get("chapters", [])):
            chapter = Chapter(unit_id=unit.id, title=str(ch.get("title", f"Chapter {ci+1}"))[:255],
                              summary=str(ch.get("summary", ""))[:2000], position=ci)
            db.add(chapter); db.flush()
            for ti, t in enumerate(ch.get("topics", [])):
                db.add(Topic(chapter_id=chapter.id, title=str(t.get("title", ""))[:255],
                             detail=str(t.get("detail", ""))[:2000], position=ti))
            db.add(Progress(user_id=user.id, chapter_id=chapter.id, status="unlocked" if first else "locked"))
            first = False
    s.status = "ready"
    db.commit()
    return {"id": s.id, "title": s.title, "subject": s.subject, "status": s.status, "parse_source": source,
            "units": chapter_tree(db, s.id, user.id)}

@router.get("")
def my_syllabi(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Syllabus).filter(Syllabus.user_id == user.id).order_by(Syllabus.id.desc()).all()
    out = []
    for s in rows:
        total = db.query(Chapter).join(Unit).filter(Unit.syllabus_id == s.id).count()
        mastered = db.query(Progress).join(Chapter).join(Unit).filter(
            Progress.user_id == user.id, Unit.syllabus_id == s.id, Progress.status == "mastered").count()
        out.append({"id": s.id, "title": s.title, "subject": s.subject, "status": s.status,
                    "chapters": total, "mastered": mastered})
    return out

@router.get("/{sid}")
def detail(sid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = own_syllabus(db, user, sid)
    return {"id": s.id, "title": s.title, "subject": s.subject, "status": s.status, "units": chapter_tree(db, s.id, user.id)}

@router.delete("/{sid}")
def remove(sid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = own_syllabus(db, user, sid)
    try:
        (UPLOAD_DIR / s.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    db.delete(s); db.commit()
    return {"ok": True}
