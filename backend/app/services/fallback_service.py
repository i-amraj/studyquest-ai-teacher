"""Rule-based fallback: syllabus text se headings pakad kar structure banana,
aur chapter text se hi lesson/test banana. Gemini wapas aate hi cached content
Gemini version se replace ho sakta hai (Chunk 6 polish)."""
import re

def parse_structure_from_text(text: str) -> dict:
    units, cur_unit, cur_ch = [], None, None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        mu = re.match(r"(?i)^(unit|module|part)[\s\-]*\d*[:\.\-]?\s*(.+)$", line)
        mc = re.match(r"(?i)^(chapter|lesson|topic)[\s\-]*\d*[:\.\-]?\s*(.+)$", line)
        if mu and len(mu.group(2)) > 2:
            cur_unit = {"title": line[:120], "chapters": []}; units.append(cur_unit); cur_ch = None
        elif mc and len(mc.group(2)) > 2:
            if cur_unit is None:
                cur_unit = {"title": "Unit 1: Course Content", "chapters": []}; units.append(cur_unit)
            cur_ch = {"title": line[:120], "summary": "", "topics": []}; cur_unit["chapters"].append(cur_ch)
        elif cur_ch is not None and len(line) > 3:
            if len(cur_ch["topics"]) < 12:
                cur_ch["topics"].append({"title": line[:100], "detail": ""})
    units = [u for u in units if u["chapters"]]
    if not units:
        chunks = [l.strip() for l in text.splitlines() if len(l.strip()) > 4][:20]
        chs = [{"title": (c[:80] or f"Chapter {i+1}"), "summary": "", "topics": [{"title": c[:100], "detail": ""}]} for i, c in enumerate(chunks[:8])]
        units = [{"title": "Unit 1: Course Content", "chapters": chs or [{"title": "Chapter 1: Introduction", "summary": "", "topics": [{"title": "Overview", "detail": ""}]}]}]
    return {"units": units}

def lesson_from_topics(chapter_title: str, topics: list, subject: str = "") -> str:
    lines = [f"# {chapter_title}", "", "Is chapter me hum step-by-step ye topics samjhenge:", ""]
    for i, t in enumerate(topics, 1):
        title = t.get("title", f"Topic {i}"); detail = t.get("detail", "")
        lines += [f"## {i}. {title}", detail or f"{title} is chapter ka ek important hissa hai. Ise dhyaan se samjho — test me ispar sawal aayega.", ""]
    lines += ["## Yaad rakho", "Test dene se pehle har topic ek baar revise kar lo. 80% laana hai tabhi agla chapter khulega!"]
    return "\n".join(lines)

def test_from_topics(chapter_title: str, topics: list) -> dict:
    qs = []
    for i, t in enumerate(topics[:6]):
        title = t.get("title", f"Topic {i+1}")
        qs.append({"qtype": "mcq", "question": f"'{title}' ke baare me sahi statement kaun sa hai?",
                   "options": [f"{title} is chapter ka ek core topic hai", f"{title} ka is chapter se koi lena-dena nahi",
                               f"{title} sirf last chapter me aata hai", "Upar me se koi nahi"],
                   "correct_index": 0, "topic_title": title, "marks": 1})
    if topics:
        qs.append({"qtype": "short", "question": f"'{topics[0].get('title','pehle topic')}' ko apne shabdon me 2-3 lines me samjhao.",
                   "options": [], "correct_index": -1, "rubric": topics[0].get("detail", "") or topics[0].get("title", ""), "topic_title": topics[0].get("title", ""), "marks": 2})
    return {"questions": qs}
