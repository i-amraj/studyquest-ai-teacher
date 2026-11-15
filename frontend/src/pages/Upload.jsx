import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getTokens } from "../lib/api";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState(""); const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [list, setList] = useState([]);
  const nav = useNavigate();
  const load = () => api("/api/syllabi").then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  async function submit(e) {
    e.preventDefault(); if (!file) { setErr("Pehle file choose karo"); return; }
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("title", title); fd.append("subject", subject);
      const t = getTokens();
      const r = await fetch("/api/syllabi/upload", { method: "POST", headers: { Authorization: "Bearer " + t.access_token }, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Upload fail ho gaya");
      nav("/app/syllabus/" + d.id);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (<div style={{maxWidth:680}}>
    <h1 style={{marginTop:0}}>Syllabus Upload</h1>
    <p style={{color:"var(--muted)"}}>PDF ya photo upload karo — Gemini AI use Units, Chapters aur Topics me todega. Badi ya scanned PDF bhi chalegi — system use khud compress karke AI ko bhejta hai. Pehla chapter khula milega, baaki 80% gate se khulenge.</p>
    <form className="card" onSubmit={submit}>
      {err && <div className="err">{err}</div>}
      <div className="field"><label>Syllabus ka naam</label><input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Data Structures — MCA Sem 3" /></div>
      <div className="field"><label>Subject</label><input className="input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Data Structures" /></div>
      <div className="field"><label>File (PDF / PNG / JPG, max 25MB — badi scanned file apne aap compress ho jayegi)</label>
        <input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>{const f=e.target.files[0]; if(f && f.size > 25*1024*1024){setErr("File 25MB se badi hai (" + (f.size/1048576).toFixed(1) + "MB) — chhoti file chuno"); setFile(null); return;} setErr(""); setFile(f);}} /></div>
      {file && <p style={{fontSize:13,color:"var(--muted)",margin:"6px 0 0"}}>📎 {file.name} · {(file.size/1048576).toFixed(2)} MB</p>}
      <button className="btn" disabled={busy}>{busy ? "AI syllabus tod raha hai… (30-90 sec lag sakte hain)" : "Upload aur AI se structure banao"}</button>
    </form>
    <h2>Mere Syllabi</h2>
    {list.length === 0 && <p style={{color:"var(--muted)"}}>Abhi koi syllabus nahi hai.</p>}
    {list.map(s => (<div key={s.id} className="card" style={{marginBottom:10,display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
      <div style={{minWidth:0}}><b className="truncate" style={{display:"block"}}>{s.title}</b>
      <span style={{color:"var(--muted)",fontSize:13}}>{s.mastered}/{s.chapters} chapters mastered</span></div>
      <button className="btn" onClick={() => nav("/app/syllabus/" + s.id)}>Kholo</button>
    </div>))}
  </div>);
}
