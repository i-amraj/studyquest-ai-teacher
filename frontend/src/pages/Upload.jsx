import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { api, getTokens } from "../lib/api";

const STEPS = [
  { icon: "📤", label: "File upload ho rahi hai", sub: "Tumhari file server tak ja rahi hai" },
  { icon: "🔍", label: "File padhi ja rahi hai", sub: "Text nikala ja raha hai — badi file auto-compress hogi" },
  { icon: "🤖", label: "AI syllabus tod raha hai", sub: "Gemini Units · Chapters · Topics bana raha hai" },
  { icon: "🎯", label: "Structure taiyaar ho raha hai", sub: "Chapters par 80% mastery gate lag raha hai" },
];
const AI_LINES = ["Units pehchane ja rahe hain…", "Chapters ban rahe hain…", "Har chapter ke topics set ho rahe hain…", "Sequence check ho raha hai…", "Bas thoda sa aur — AI soch raha hai…"];

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState(""); const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [list, setList] = useState([]);
  const [step, setStep] = useState(0);           // 0..3 active step
  const [upPct, setUpPct] = useState(0);          // real upload %
  const [aiPct, setAiPct] = useState(0);          // AI step crawl %
  const [secs, setSecs] = useState(0);
  const [aiLine, setAiLine] = useState(0);
  const timers = useRef([]);
  const stepsRef = useRef(null);
  const nav = useNavigate();
  const load = () => api("/api/syllabi").then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => () => timers.current.forEach(clearInterval), []);

  // Step badalte hi GSAP pop animation
  useEffect(() => {
    if (busy && stepsRef.current) {
      const rows = stepsRef.current.children;
      if (rows[step]) gsap.fromTo(rows[step], { scale: .97, opacity: .5 }, { scale: 1, opacity: 1, duration: .45, ease: "back.out(2)" });
    }
  }, [step, busy]);

  function submit(e) {
    e.preventDefault(); if (!file) { setErr("Pehle file choose karo"); return; }
    setBusy(true); setErr(""); setStep(0); setUpPct(0); setAiPct(0); setSecs(0); setAiLine(0);
    const started = Date.now();
    const secTimer = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 500);
    const lineTimer = setInterval(() => setAiLine(v => (v + 1) % AI_LINES.length), 6000);
    timers.current = [secTimer, lineTimer];

    const fd = new FormData(); fd.append("file", file); fd.append("title", title); fd.append("subject", subject);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/syllabi/upload");
    const t = getTokens();
    xhr.setRequestHeader("Authorization", "Bearer " + t.access_token);
    xhr.upload.onprogress = ev => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        setUpPct(pct);
        if (pct >= 100) {
          setStep(1);
          // File pahunch gayi — ab server padh raha hai, phir AI step
          setTimeout(() => setStep(2), 3500);
          const crawl = setInterval(() => setAiPct(v => (v >= 92 ? 92 : v + Math.max(1, (92 - v) * 0.045))), 400);
          timers.current.push(crawl);
        }
      }
    };
    xhr.onload = () => {
      timers.current.forEach(clearInterval);
      let d = {};
      try { d = JSON.parse(xhr.responseText || "{}"); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && d.id) {
        setStep(3); setAiPct(100);
        setTimeout(() => nav("/app/syllabus/" + d.id), 900);
      } else {
        setErr(d.detail || "Upload fail ho gaya — dobara try karo");
        setBusy(false);
      }
    };
    xhr.onerror = () => { timers.current.forEach(clearInterval); setErr("Network error — connection check karke dobara try karo"); setBusy(false); };
    xhr.send(fd);
  }

  const barPct = step === 0 ? upPct : step === 1 ? 100 : aiPct;

  return (<div style={{ maxWidth: 680 }}>
    <h1 style={{ marginTop: 0 }}>Syllabus Upload</h1>
    <p style={{ color: "var(--muted)" }}>PDF ya photo upload karo — Gemini AI use Units, Chapters aur Topics me todega. Badi ya scanned PDF bhi chalegi — system use khud compress karke AI ko bhejta hai. Pehla chapter khula milega, baaki 80% gate se khulenge.</p>
    <form className="card" onSubmit={submit}>
      {err && <div className="err">{err}</div>}
      <div className="field"><label>Syllabus ka naam</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Data Structures — MCA Sem 3" disabled={busy} /></div>
      <div className="field"><label>Subject</label><input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Data Structures" disabled={busy} /></div>
      <div className="field"><label>File (PDF / PNG / JPG, max 25MB — badi scanned file apne aap compress ho jayegi)</label>
        <input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={busy}
          onChange={e => { const f = e.target.files[0]; if (f && f.size > 25 * 1024 * 1024) { setErr("File 25MB se badi hai (" + (f.size / 1048576).toFixed(1) + "MB) — chhoti file chuno"); setFile(null); return; } setErr(""); setFile(f); }} /></div>
      {file && <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>📎 {file.name} · {(file.size / 1048576).toFixed(2)} MB</p>}

      {!busy && <button className="btn" style={{ marginTop: 14 }}>Upload aur AI se structure banao</button>}

      {busy && (<div className="ai-loader" role="status" aria-live="polite">
        <div className="ai-loader-head">
          <div className="ai-ring"><span>🎓</span></div>
          <div>
            <b>AI Teacher kaam par hai…</b>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>{secs}s ho gaye · AI steps ko aam taur par 1–3 minute lagte hain, page band mat karna</div>
          </div>
        </div>
        <div className="ai-board" aria-hidden="true">
          <span className="chalk-line l1" /><span className="chalk-line l2" /><span className="chalk-line l3" />
          <span className="chalk-pen">✏️</span>
        </div>
        <div className="ai-steps" ref={stepsRef}>
          {STEPS.map((s, i) => {
            const state = i < step || (i === 3 && aiPct === 100) ? "done" : i === step ? "active" : "wait";
            return (<div key={s.label} className={"ai-step " + state}>
              <div className="ai-step-ic">{state === "done" ? "✓" : s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{s.label}</b>
                <div className="ai-step-sub">{i === 2 && state === "active" ? AI_LINES[aiLine] : s.sub}</div>
              </div>
              {state === "active" && <div className="ai-dots"><span /><span /><span /></div>}
              {state === "done" && <div className="ai-check">Ho gaya</div>}
            </div>);
          })}
        </div>
        <div className="ai-bar"><div className="ai-bar-fill" style={{ width: (step >= 1 ? barPct : upPct) + "%" }} /></div>
        <div className="ai-bar-label">{step === 0 ? `Upload: ${upPct}%` : step === 1 ? "File pahunch gayi — padhai ja rahi hai…" : aiPct >= 100 ? "Taiyaar! 🎉" : `AI progress: ~${Math.round(aiPct)}%`}</div>
      </div>)}
    </form>

    <h2>Mere Syllabi</h2>
    {list.length === 0 && <p style={{ color: "var(--muted)" }}>Abhi koi syllabus nahi hai.</p>}
    {list.map(s => (<div key={s.id} className="card" style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
      <div style={{ minWidth: 0 }}><b className="truncate" style={{ display: "block" }}>{s.title}</b>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{s.mastered}/{s.chapters} chapters mastered</span></div>
      <button className="btn" onClick={() => nav("/app/syllabus/" + s.id)}>Kholo</button>
    </div>))}
  </div>);
}
