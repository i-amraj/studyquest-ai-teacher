import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, getTokens } from "../lib/api";
import Markdown from "../components/Markdown";

export default function Learn() {
  const { id } = useParams();
  const [ch, setCh] = useState(null); const [tab, setTab] = useState("lesson");
  const [lesson, setLesson] = useState(""); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { api("/api/chapters/" + id).then(setCh).catch(e => setErr(e.message)); }, [id]);
  async function loadLesson() { setBusy("lesson"); try { const d = await api("/api/chapters/" + id + "/lesson", { method: "POST" }); setLesson(d.content_md); } catch (e) { setErr(e.message); } finally { setBusy(""); } }
  async function loadNotes() { setBusy("notes"); try { const d = await api("/api/chapters/" + id + "/notes", { method: "POST" }); setNotes(d.content_md); } catch (e) { setErr(e.message); } finally { setBusy(""); } }
  function downloadPdf() {
    const t = getTokens();
    fetch("/api/chapters/" + id + "/notes/pdf", { headers: { Authorization: "Bearer " + t.access_token } })
      .then(r => r.blob()).then(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "notes.pdf"; a.click(); });
  }
  if (err && !ch) return <div className="err">{err}</div>;
  if (!ch) return <p>Loading…</p>;
  return (<div style={{maxWidth:820}}>
    <p style={{color:"var(--muted)",margin:"0 0 2px",fontSize:13}}>{ch.syllabus_title} · {ch.unit_title}</p>
    <h1 style={{marginTop:0}}>{ch.title}</h1>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"14px 0"}}>
      {[["lesson","📖 Lesson"],["notes","📝 Notes"],["chat","💬 Doubt Chat"],["test","🏆 Test"]].map(([k, label]) => (
        <button key={k} className={"btn" + (tab === k ? "" : " ghost")} onClick={() => { setTab(k); if (k === "lesson" && !lesson) loadLesson(); if (k === "notes" && !notes) loadNotes(); }}>{label}</button>
      ))}
    </div>
    {err && <div className="err">{err}</div>}
    {tab === "lesson" && (<div className="card">
      {busy === "lesson" ? <p>AI Teacher lesson bana raha hai…</p> : lesson ? <Markdown text={lesson} /> : <button className="btn" onClick={loadLesson}>Lesson shuru karo</button>}
    </div>)}
    {tab === "notes" && (<div className="card">
      {busy === "notes" ? <p>Notes ban rahe hain…</p> : notes ? (<><Markdown text={notes} /><button className="btn" onClick={downloadPdf}>⬇ Notes PDF download</button></>) : <button className="btn" onClick={loadNotes}>Notes banao</button>}
    </div>)}
    {tab === "chat" && <Chat cid={id} />}
    {tab === "test" && <Test cid={id} onMastered={() => api("/api/chapters/" + id).then(setCh)} />}
  </div>);
}

function Chat({ cid }) {
  const [msgs, setMsgs] = useState([]); const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { api("/api/chapters/" + cid + "/chat").then(setMsgs).catch(() => {}); }, [cid]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  async function send(e) {
    e.preventDefault(); if (!text.trim()) return;
    const m = text.trim(); setText(""); setMsgs(p => [...p, { role: "user", content: m }]); setBusy(true);
    try { const d = await api("/api/chapters/" + cid + "/chat", { method: "POST", body: JSON.stringify({ message: m }) });
      setMsgs(p => [...p, { role: "assistant", content: d.answer }]);
    } catch (x) { setMsgs(p => [...p, { role: "assistant", content: "Error: " + x.message }]); }
    finally { setBusy(false); }
  }
  return (<div className="card">
    <div style={{maxHeight:420,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingRight:4}}>
      {msgs.length === 0 && <p style={{color:"var(--muted)"}}>Is chapter se juda koi bhi doubt pucho — AI Teacher sirf isi chapter se jawab dega.</p>}
      {msgs.map((m, i) => (<div key={i} style={{alignSelf: m.role === "user" ? "flex-end" : "flex-start",maxWidth:"85%",
        background: m.role === "user" ? "var(--green)" : "var(--paper2)", color: m.role === "user" ? "#fff" : "var(--ink)",
        borderRadius:12,padding:"10px 14px",whiteSpace:"pre-wrap",lineHeight:1.55}}>{m.content}</div>))}
      {busy && <div style={{color:"var(--muted)"}}>Teacher soch raha hai…</div>}
      <div ref={endRef} />
    </div>
    <form onSubmit={send} style={{display:"flex",gap:8,marginTop:12}}>
      <input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Apna doubt likho…" />
      <button className="btn" disabled={busy}>Bhejo</button>
    </form>
  </div>);
}

function Test({ cid, onMastered }) {
  const [test, setTest] = useState(null); const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null); const [busy, setBusy] = useState(""); const [reteach, setReteach] = useState("");
  async function gen() {
    setBusy("gen"); setResult(null); setAnswers({}); setReteach("");
    try { const g = await api("/api/chapters/" + cid + "/test/generate", { method: "POST" });
      const d = await api("/api/chapters/" + cid + "/test/" + g.test_id); setTest(d);
    } catch (e) { alert(e.message); } finally { setBusy(""); }
  }
  async function submit() {
    setBusy("sub");
    try { const r = await api("/api/chapters/" + cid + "/test/submit", { method: "POST", body: JSON.stringify({ test_id: test.test_id, answers }) });
      setResult(r); if (r.passed) onMastered();
    } catch (e) { alert(e.message); } finally { setBusy(""); }
  }
  async function doReteach() {
    setBusy("re");
    try { const d = await api("/api/chapters/" + cid + "/reteach", { method: "POST" }); setReteach(d.content_md); }
    catch (e) { alert(e.message); } finally { setBusy(""); }
  }
  if (result) return (<div className="card">
    <h2 style={{marginTop:0}}>{result.passed ? "🎉 Mastered!" : "💪 Thoda aur mehnat"}</h2>
    <p style={{fontSize:22}}><b>{result.score_percent}%</b> score {result.passed ? `· +${result.xp_awarded} XP` : "· 80% chahiye tha"}</p>
    <p>{result.message}</p>
    {result.weak_topics?.length > 0 && <p><b>Weak topics:</b> {result.weak_topics.join(", ")}</p>}
    {!result.passed && <button className="btn" onClick={doReteach} disabled={busy === "re"}>{busy === "re" ? "Bana raha hai…" : "Weak topics dobara padhao"}</button>}
    {reteach && <div style={{marginTop:14}}><Markdown text={reteach} /></div>}
    <div style={{marginTop:14}}><button className="btn ghost" onClick={gen}>Naya test do</button></div>
  </div>);
  if (!test) return (<div className="card"><h2 style={{marginTop:0}}>Chapter Test</h2>
    <p style={{color:"var(--muted)"}}>80% ya zyada = chapter mastered, +XP aur agla chapter unlock. Kam aaye to weak topics dobara padhaye jayenge.</p>
    <button className="btn" onClick={gen} disabled={busy === "gen"}>{busy === "gen" ? "Test ban raha hai…" : "Test shuru karo"}</button></div>);
  return (<div className="card">
    {test.questions.map((q, i) => (<div key={q.id} style={{marginBottom:18}}>
      <b>Q{i + 1}. {q.question}</b> <span style={{color:"var(--muted)",fontSize:12}}>({q.marks} marks · {q.topic_title})</span>
      {q.qtype === "mcq" ? (<div style={{display:"grid",gap:8,marginTop:8}}>
        {q.options.map((op, oi) => (<label key={oi} style={{display:"flex",gap:8,alignItems:"center",background:"var(--paper2)",borderRadius:10,padding:"10px 12px",cursor:"pointer",color:"var(--ink)",fontSize:14,fontWeight:500,margin:0}}>
          <input type="radio" name={"q" + q.id} checked={answers[q.id]?.index === oi} onChange={() => setAnswers(p => ({ ...p, [q.id]: { index: oi } }))} /> {op}</label>))}
      </div>) : (<textarea className="input" rows={3} style={{marginTop:8}} placeholder="Apna jawab likho…"
        value={answers[q.id]?.text || ""} onChange={e => setAnswers(p => ({ ...p, [q.id]: { text: e.target.value } }))} />)}
    </div>))}
    <button className="btn" onClick={submit} disabled={busy === "sub"}>{busy === "sub" ? "Check ho raha hai…" : "Submit karo"}</button>
  </div>);
}
