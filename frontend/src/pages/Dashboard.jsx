import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { api, authApi, clearTokens, getTokens } from "../lib/api";

export function Shell() {
  const nav = useNavigate();
  if (!getTokens()) { nav("/login"); return null; }
  return (<div className="shell">
    <aside className="side">
      <div className="brand"><span className="mark">S</span> StudyQuest</div>
      <div style={{height:14}} />
      <NavLink className="nav" to="/app" end>🏠 &nbsp;Home</NavLink>
      <NavLink className="nav" to="/app/upload">📚 &nbsp;Syllabus Upload</NavLink>
      <NavLink className="nav" to="/app/history">🕘 &nbsp;History</NavLink>
      <div style={{flex:1}} />
      <button className="btn ghost" onClick={() => { clearTokens(); nav("/login"); }}>Logout</button>
    </aside>
    <main className="main"><Outlet /></main>
    <nav className="tabbar">
      <NavLink to="/app" end>Home</NavLink><NavLink to="/app/upload">Upload</NavLink><NavLink to="/app/history">History</NavLink>
    </nav>
  </div>);
}

export function Dashboard() {
  const [me, setMe] = useState(null); const [stats, setStats] = useState(null);
  const [syl, setSyl] = useState([]); const [board, setBoard] = useState([]); const [lang, setLang] = useState("hinglish");
  const ref = useRef(null); const nav = useNavigate();
  useEffect(() => {
    authApi.me().then(m => { setMe(m); if (m.language) setLang(m.language); }).catch(() => {});
    api("/api/me/stats").then(setStats).catch(() => {});
    api("/api/syllabi").then(setSyl).catch(() => {});
    api("/api/me/leaderboard").then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (me && ref.current) gsap.fromTo(ref.current.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, stagger: .07, duration: .5, ease: "power2.out" }); }, [me]);
  if (!me) return <p>Loading…</p>;
  return (<div style={{maxWidth:860}}>
    <h1 style={{margin:"0 0 4px",fontSize:30}}>Namaste, {me.name.split(" ")[0]} 👋</h1>
    <p style={{color:"var(--muted)",margin:0}}>Student ID: <b>{me.public_id}</b> · {me.course || "Course"} {me.college ? "· " + me.college : ""}</p>
    <div className="statgrid" ref={ref}>
      <div className="stat"><b>{me.xp}</b><div style={{color:"var(--muted)",fontSize:13}}>Total XP</div></div>
      <div className="stat"><b>Level {stats?.level || me.level}</b><div style={{color:"var(--muted)",fontSize:13}}>Next: {stats?.next_level_xp || 100} XP</div></div>
      <div className="stat"><b>{me.streak_days} din</b><div style={{color:"var(--muted)",fontSize:13}}>Streak 🔥</div></div>
      <div className="stat"><b>{stats?.badges?.length || 0}</b><div style={{color:"var(--muted)",fontSize:13}}>Badges ⭐</div></div>
    </div>
    <div className="card" style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:18}}>
      <div style={{fontSize:22}}>🗣️</div>
      <div style={{flex:1,minWidth:180}}><b>Teacher ki bhasha</b>
      <div style={{color:"var(--muted)",fontSize:13}}>Lesson, notes, doubt chat aur test isi bhasha me aayenge. (Pehle se bane lesson/notes waisi hi rahenge.)</div></div>
      <select className="input" style={{width:"auto"}} value={lang} onChange={async e => { const v = e.target.value; setLang(v);
        try { await api("/api/me/language", { method: "PATCH", body: { language: v } }); } catch { /* ignore */ } }}>
        <option value="hinglish">Hinglish</option><option value="hindi">हिंदी</option><option value="urdu">اردو</option><option value="english">English</option>
      </select>
    </div>
    {stats && (<div style={{background:"var(--paper2)",borderRadius:10,height:10,overflow:"hidden",marginBottom:20}}>
      <div style={{width:(stats.level_progress_percent || 0)+"%",height:"100%",background:"var(--green)"}} /></div>)}
    <h2>Continue Learning</h2>
    {syl.length === 0 && (<div className="card"><p style={{marginTop:0}}>Abhi koi syllabus nahi hai. Pehla syllabus upload karo aur apni quest shuru karo!</p>
      <Link className="btn" to="/app/upload">Syllabus upload karo</Link></div>)}
    {syl.map(s => (<div key={s.id} className="card" style={{marginBottom:10,display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
      <div style={{minWidth:0}}><b className="truncate" style={{display:"block"}}>{s.title}</b>
      <span style={{color:"var(--muted)",fontSize:13}}>{s.mastered}/{s.chapters} chapters mastered</span></div>
      <button className="btn" onClick={() => nav("/app/syllabus/" + s.id)}>Continue</button>
    </div>))}
    {board.length > 0 && (<><h2 style={{marginTop:24}}>Leaderboard (Top XP)</h2>
      <div className="card">{board.map((u, i) => (<p key={u.public_id} style={{margin:"6px 0",fontWeight: u.you ? 700 : 400}}>
        {i + 1}. {u.name} — {u.xp} XP · Level {u.level} {u.you ? "(tum)" : ""}</p>))}</div></>)}
  </div>);
}
