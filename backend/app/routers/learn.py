import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user
from ..models import User, Chapter, Unit, Syllabus, Topic, Lesson, Note, ChatMessage, Progress
from ..services import gemini_service as g, fallback_service as fb
from ..services.ai_helpers import budget_left, log_usage, lang_instruction

router = APIRouter(prefix="/api/chapters", tags=["learn"])

def get_chapter_ctx(db, user, cid):
    ch = db.get(Chapter, cid)
    if not ch:
        raise HTTPException(404, "Chapter nahi mila")
    unit = db.get(Unit, ch.unit_id)
    s = db.get(Syllabus, unit.syllabus_id)
    if s.user_id != user.id:
        raise HTTPException(404, "Chapter nahi mila")
    prog = db.query(Progress).filter(Progress.user_id == user.id, Progress.chapter_id == cid).first()
    if not prog or prog.status == "locked":
        raise HTTPException(403, "Ye chapter locked hai — pehle wala chapter 80% se pass karo")
    topics = db.query(Topic).filter(Topic.chapter_id == cid).order_by(Topic.position).all()
    return ch, unit, s, prog, topics

def topics_text(topics):
    return "\n".join(f"- {t.title}: {t.detail}" for t in topics)

@router.get("/{cid}")
def chapter_detail(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch, unit, s, prog, topics = get_chapter_ctx(db, user, cid)
    lesson = db.query(Lesson).filter(Lesson.chapter_id == cid).first()
    note = db.query(Note).filter(Note.chapter_id == cid).first()
    return {"id": ch.id, "title": ch.title, "summary": ch.summary, "unit_title": unit.title,
            "syllabus_title": s.title, "status": prog.status, "best_score": prog.best_score,
            "topics": [{"id": t.id, "title": t.title, "detail": t.detail} for t in topics],
            "has_lesson": bool(lesson), "has_notes": bool(note)}

@router.post("/{cid}/lesson")
def gen_lesson(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch, unit, s, prog, topics = get_chapter_ctx(db, user, cid)
    existing = db.query(Lesson).filter(Lesson.chapter_id == cid).first()
    if existing:
        return {"content_md": existing.content_md, "source": "cache"}
    content, source = "", "fallback"
    if budget_left(db, user.id) and g.gemini_ready():
        try:
            content = g.generate_text(
                f"Chapter: {ch.title}\nSubject: {s.subject or s.title}\nTopics:\n{topics_text(topics)}\n\n"
                "Is chapter ko ek dost-teacher ki tarah padhao. " + lang_instruction(user.language) + " "
                "Markdown use karo: # title, ## har topic, examples, aur aakhir me 'Yaad rakho' summary. 500-800 words.",
                system="Tum StudyQuest ke AI Teacher ho. Sirf diye gaye topics par padhao, bahar ka content mat add karo.")
            if len(content) > 100:
                source = "gemini"; log_usage(db, user.id, "lesson")
            else:
                content = ""
        except Exception:
            content = ""
    if not content:
        content = fb.lesson_from_topics(ch.title, [{"title": t.title, "detail": t.detail} for t in topics], s.subject)
    db.add(Lesson(chapter_id=cid, content_md=content))
    if prog.status == "unlocked":
        prog.status = "learning"
    db.commit()
    return {"content_md": content, "source": source}

@router.post("/{cid}/notes")
def gen_notes(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch, unit, s, prog, topics = get_chapter_ctx(db, user, cid)
    existing = db.query(Note).filter(Note.chapter_id == cid).first()
    if existing:
        return {"content_md": existing.content_md, "source": "cache"}
    content, source = "", "fallback"
    if budget_left(db, user.id) and g.gemini_ready():
        try:
            content = g.generate_text(
                f"Chapter: {ch.title}\nTopics:\n{topics_text(topics)}\n\n"
                "Exam-ready short notes banao (Markdown): key definitions, bullet points, formulas/facts, aur 5 one-line revision points. " + lang_instruction(user.language),
                system="Tum StudyQuest ke AI Teacher ho. Sirf diye gaye topics ke notes banao.")
            if len(content) > 80:
                source = "gemini"; log_usage(db, user.id, "notes")
            else:
                content = ""
        except Exception:
            content = ""
    if not content:
        content = "# Notes — " + ch.title + "\n\n" + "\n".join(f"- **{t.title}**: {t.detail or 'Revision point'}" for t in topics)
    db.add(Note(chapter_id=cid, content_md=content)); db.commit()
    return {"content_md": content, "source": source}

@router.get("/{cid}/notes/pdf")
def notes_pdf(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch, unit, s, prog, topics = get_chapter_ctx(db, user, cid)
    note = db.query(Note).filter(Note.chapter_id == cid).first()
    if not note:
        gen_notes(cid, db, user)
        note = db.query(Note).filter(Note.chapter_id == cid).first()
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    import re, html
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18*mm, bottomMargin=18*mm, leftMargin=16*mm, rightMargin=16*mm)
    styles = getSampleStyleSheet()
    story = [Paragraph(f"StudyQuest Notes — {html.escape(s.title)}", styles["Title"]),
             Paragraph(html.escape(ch.title), styles["Heading1"]), Spacer(1, 6)]
    for line in note.content_md.splitlines():
        t = line.strip()
        if not t:
            story.append(Spacer(1, 4)); continue
        t = html.escape(t.lstrip("#").strip())
        t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
        style = styles["Heading2"] if line.startswith("##") else styles["BodyText"]
        story.append(Paragraph(t, style))
    story.append(Spacer(1, 10)); story.append(Paragraph("Generated by StudyQuest AI Teacher", styles["BodyText"]))
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="notes-chapter-{cid}.pdf"'})

class ChatIn(BaseModel):
    message: str

@router.get("/{cid}/chat")
def chat_history(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_chapter_ctx(db, user, cid)
    rows = db.query(ChatMessage).filter(ChatMessage.user_id == user.id, ChatMessage.chapter_id == cid).order_by(ChatMessage.id).all()
    return [{"role": r.role, "content": r.content} for r in rows]

@router.post("/{cid}/chat")
def chat(cid: int, data: ChatIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch, unit, s, prog, topics = get_chapter_ctx(db, user, cid)
    msg = data.message.strip()
    if not msg or len(msg) > 2000:
        raise HTTPException(422, "Message 1-2000 characters ka hona chahiye")
    db.add(ChatMessage(user_id=user.id, chapter_id=cid, role="user", content=msg)); db.commit()
    history = db.query(ChatMessage).filter(ChatMessage.user_id == user.id, ChatMessage.chapter_id == cid).order_by(ChatMessage.id.desc()).limit(8).all()[::-1]
    convo = "\n".join(f"{h.role}: {h.content}" for h in history)
    answer, source = "", "fallback"
    if budget_left(db, user.id) and g.gemini_ready():
        try:
            answer = g.generate_text(
                f"Chapter: {ch.title}\nChapter topics:\n{topics_text(topics)}\n\nPurani baat-cheet:\n{convo}\n\nStudent ka naya sawal: {msg}",
                system=("Tum StudyQuest ke AI Teacher ho. Sirf is chapter ke topics se jude sawalo ke jawab simple tareeke se do, example ke saath. " + lang_instruction(user.language) + " "
                        "Agar sawal chapter se bahar ka hai to politely bolo ki ye is chapter ka hissa nahi hai, aur chapter ke kisi topic ki taraf guide karo."))
            if len(answer) > 10:
                source = "gemini"; log_usage(db, user.id, "chat")
            else:
                answer = ""
        except Exception:
            answer = ""
    if not answer:
        answer = (f"Achha sawal hai! '{ch.title}' me ye topics hain: {', '.join(t.title for t in topics[:5])}. "
                  "Abhi AI service busy hai — in topics ko lesson me dobara padho, tumhe jawab wahi milega. Thodi der me phir try karo!")
    db.add(ChatMessage(user_id=user.id, chapter_id=cid, role="assistant", content=answer)); db.commit()
    return {"answer": answer, "source": source}

@router.post("/{cid}/reteach")
def reteach(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ch, unit, s, prog, topics = get_chapter_ctx(db, user, cid)
    from ..models import TestAttempt
    last = db.query(TestAttempt).filter(TestAttempt.user_id == user.id, TestAttempt.chapter_id == cid).order_by(TestAttempt.id.desc()).first()
    weak = (last.weak_topics if last else []) or [t.title for t in topics[:3]]
    weak_text = ", ".join(weak)
    content, source = "", "fallback"
    if budget_left(db, user.id) and g.gemini_ready():
        try:
            content = g.generate_text(
                f"Chapter: {ch.title}\nStudent in topics me weak hai: {weak_text}\nSaare topics:\n{topics_text(topics)}\n\n"
                "In weak topics ko BILKUL alag, aur simple tareeke se dobara samjhao — real-life example aur analogy ke saath. Markdown, 300-450 words. " + lang_instruction(user.language),
                system="Tum StudyQuest ke AI Teacher ho — corrective re-teaching expert.")
            if len(content) > 80:
                source = "gemini"; log_usage(db, user.id, "reteach")
            else:
                content = ""
        except Exception:
            content = ""
    if not content:
        sel = [t for t in topics if t.title in weak] or topics[:3]
        content = "# Dobara samjho — " + ch.title + "\n\n" + "\n".join(f"## {t.title}\n{t.detail or 'Ise ek real-life example se jod kar yaad karo.'}" for t in sel)
    return {"content_md": content, "source": source, "weak_topics": weak}
