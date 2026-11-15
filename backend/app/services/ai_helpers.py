import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models import AiUsage
from ..core.config import settings
from . import gemini_service as g, fallback_service as fb

SYLLABUS_SCHEMA = {
    "type": "OBJECT",
    "properties": {"units": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "title": {"type": "STRING"},
        "chapters": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "title": {"type": "STRING"}, "summary": {"type": "STRING"},
            "topics": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
                "title": {"type": "STRING"}, "detail": {"type": "STRING"}}, "required": ["title"]}}
        }, "required": ["title", "topics"]}}
    }, "required": ["title", "chapters"]}}},
    "required": ["units"],
}

TEST_SCHEMA = {
    "type": "OBJECT",
    "properties": {"questions": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "qtype": {"type": "STRING", "enum": ["mcq", "short"]},
        "question": {"type": "STRING"},
        "options": {"type": "ARRAY", "items": {"type": "STRING"}},
        "correct_index": {"type": "INTEGER"},
        "rubric": {"type": "STRING"},
        "topic_title": {"type": "STRING"},
        "marks": {"type": "INTEGER"},
    }, "required": ["qtype", "question", "topic_title", "marks", "correct_index"]}}},
    "required": ["questions"],
}

LANG_INSTRUCTIONS = {
    "hinglish": "Bhasha: Hinglish — Hindi ko Roman script me, simple aur dostana andaz me likho (technical terms English me).",
    "hindi": "Bhasha: shudh Hindi — Devanagari lipi me likho (technical terms English me rakh sakte ho, jaise 'Array').",
    "urdu": "Bhasha: Urdu — Urdu rasm-ul-khat (Nastaliq script) me likho (technical terms English me rakh sakte ho, jaise 'Array').",
    "english": "Language: English — write everything in clear, simple English.",
}
VALID_LANGS = tuple(LANG_INSTRUCTIONS.keys())

def lang_instruction(lang: str | None) -> str:
    return LANG_INSTRUCTIONS.get((lang or "hinglish").lower(), LANG_INSTRUCTIONS["hinglish"])

def budget_left(db: Session, user_id: int) -> bool:
    today = datetime.now(timezone.utc).date()
    count = db.query(AiUsage).filter(AiUsage.user_id == user_id).all()
    used = sum(1 for u in count if u.created_at and (u.created_at.date() if u.created_at.tzinfo else u.created_at.date()) == today)
    return used < settings.ai_daily_budget_per_user

def log_usage(db: Session, user_id: int, kind: str):
    db.add(AiUsage(user_id=user_id, kind=kind)); db.commit()

def parse_syllabus(db, user_id, raw_text: str, file_bytes: bytes, file_type: str, mime: str) -> tuple[dict, str]:
    """Returns (structure, source) — source: gemini | gemini-file | fallback"""
    prompt = ("Tum ek syllabus expert ho. Neeche diye syllabus ko Units > Chapters > Topics me todo. "
              "Har chapter ke 3-8 topics, har topic ka 1-line detail. Sirf syllabus me jo hai wahi rakho, khud se add mat karo.")
    if budget_left(db, user_id) and g.gemini_ready():
        try:
            if len(raw_text) >= 200:
                data = g.generate_json(prompt + "\n\nSYLLABUS TEXT:\n" + raw_text[:60000], SYLLABUS_SCHEMA)
            else:  # scanned PDF / image — file seedha Gemini ko
                data = g.generate_json_with_file(prompt, SYLLABUS_SCHEMA, file_bytes, mime)
            if data.get("units"):
                log_usage(db, user_id, "parse")
                return data, ("gemini" if len(raw_text) >= 200 else "gemini-file")
        except Exception:
            pass
    return fb.parse_structure_from_text(raw_text), "fallback"
