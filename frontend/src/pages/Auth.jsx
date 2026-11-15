import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../lib/api";

export function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e) { e.preventDefault(); setBusy(true); setErr("");
    try { await authApi.login({ email, password }); nav("/app"); }
    catch (x) { setErr(x.message); } finally { setBusy(false); } }
  return (<div className="auth"><div className="card">
    <div className="brand"><span className="mark">S</span> StudyQuest</div>
    <h1 style={{fontSize:28,margin:"18px 0 4px"}}>Wapas swagat hai</h1>
    <p style={{color:"var(--muted)",margin:"0 0 18px"}}>Apni learning journey wahi se shuru karo jahan chhodi thi.</p>
    {err && <div className="err">{err}</div>}
    <form onSubmit={submit}>
      <div className="field"><label>Email</label><input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@college.edu" /></div>
      <div className="field"><label>Password</label><input className="input" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></div>
      <button className="btn" style={{width:"100%"}} disabled={busy}>{busy ? "Ruko…" : "Login"}</button>
    </form>
    <p style={{fontSize:14,color:"var(--muted)"}}>Account nahi hai? <Link to="/register">Register karo</Link></p>
  </div></div>);
}

export function Register() {
  const [f, setF] = useState({ name:"", email:"", password:"", college:"", course:"", language:"hinglish" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function submit(e) { e.preventDefault(); setBusy(true); setErr("");
    try { await authApi.register(f); nav("/app"); }
    catch (x) { setErr(x.message); } finally { setBusy(false); } }
  return (<div className="auth"><div className="card">
    <div className="brand"><span className="mark">S</span> StudyQuest</div>
    <h1 style={{fontSize:28,margin:"18px 0 4px"}}>Apna account banao</h1>
    <p style={{color:"var(--muted)",margin:"0 0 18px"}}>Register karte hi tumhe ek unique Student ID milegi.</p>
    {err && <div className="err">{err}</div>}
    <form onSubmit={submit}>
      <div className="field"><label>Poora naam</label><input className="input" required value={f.name} onChange={set("name")} placeholder="Raj Soni" /></div>
      <div className="field"><label>Email</label><input className="input" type="email" required value={f.email} onChange={set("email")} placeholder="you@college.edu" /></div>
      <div className="field"><label>Password (kam se kam 8 characters)</label><input className="input" type="password" required minLength={8} value={f.password} onChange={set("password")} placeholder="••••••••" /></div>
      <div className="field"><label>College</label><input className="input" value={f.college} onChange={set("college")} placeholder="Jagran Institute of Management" /></div>
      <div className="field"><label>Course</label><input className="input" value={f.course} onChange={set("course")} placeholder="MCA" /></div>
      <div className="field"><label>Padhai ki bhasha (Teacher isi me padhayega)</label><select className="input" value={f.language} onChange={set("language")}><option value="hinglish">Hinglish (Hindi + English mix)</option><option value="hindi">हिंदी (Devanagari)</option><option value="urdu">اردو (Urdu)</option><option value="english">English</option></select></div>
      <button className="btn" style={{width:"100%"}} disabled={busy}>{busy ? "Ban raha hai…" : "Account banao"}</button>
    </form>
    <p style={{fontSize:14,color:"var(--muted)"}}>Pehle se account hai? <Link to="/login">Login karo</Link></p>
  </div></div>);
}
