import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

const ICON = { mastered: "✓", learning: "▶", unlocked: "○", locked: "🔒" };
export default function Syllabus() {
  const { id } = useParams(); const [data, setData] = useState(null); const [err, setErr] = useState("");
  const nav = useNavigate();
  useEffect(() => { api("/api/syllabi/" + id).then(setData).catch(e => setErr(e.message)); }, [id]);
  if (err) return <div className="err">{err}</div>;
  if (!data) return <p>Loading…</p>;
  return (<div style={{maxWidth:760}}>
    <h1 style={{marginTop:0}}>{data.title}</h1>
    <p style={{color:"var(--muted)"}}>Chapter par click karo — lesson, notes, doubt chat aur test wahi milega. 🔒 wala chapter pehle wale ko 80% se pass karke khulega.</p>
    {data.units.map(u => (<div key={u.id} style={{marginBottom:22}}>
      <h2 style={{fontSize:20,borderBottom:"2px solid var(--line)",paddingBottom:6}}>{u.title}</h2>
      <div className="pathmap">
        {u.chapters.map((c, i) => (<div key={c.id} className={"node " + (c.status === "mastered" ? "done" : c.status === "locked" ? "locked" : "")}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div className="dot">{ICON[c.status] || "○"}</div>{i < u.chapters.length - 1 && <div className="stem" />}
          </div>
          <div style={{paddingBottom:16,minWidth:0,flex:1}}>
            <button disabled={c.status === "locked"} onClick={() => nav("/app/chapter/" + c.id)}
              style={{background:"none",border:0,textAlign:"left",padding:0,fontWeight:700,fontSize:16,color:"var(--ink)"}}>
              {c.title}</button>
            <div style={{color:"var(--muted)",fontSize:13}}>
              {c.topics.length} topics{c.best_score ? ` · Best score: ${c.best_score}%` : ""} · {c.status}
            </div>
          </div>
        </div>))}
      </div>
    </div>))}
  </div>);
}
