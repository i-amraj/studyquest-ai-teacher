import { useEffect, useState } from "react";
import { api } from "../lib/api";
export default function History() {
  const [h, setH] = useState(null); const [stats, setStats] = useState(null);
  useEffect(() => { api("/api/me/history").then(setH).catch(() => {}); api("/api/me/stats").then(setStats).catch(() => {}); }, []);
  if (!h) return <p>Loading…</p>;
  return (<div style={{maxWidth:760}}>
    <h1 style={{marginTop:0}}>Meri History</h1>
    <p style={{color:"var(--muted)"}}>{h.syllabi_count} syllabi · {h.doubts_asked} doubts puche</p>
    {stats && (<div className="card" style={{marginBottom:14}}>
      <h3 style={{marginTop:0}}>Badges ({stats.badges.length})</h3>
      {stats.badges.length === 0 ? <p style={{color:"var(--muted)"}}>Abhi koi badge nahi — pehla chapter master karo!</p>
        : stats.badges.map(b => <p key={b.code}>⭐ <b>{b.title}</b> — {b.description}</p>)}
      <h3>XP History</h3>
      {stats.xp_history.length === 0 ? <p style={{color:"var(--muted)"}}>Abhi XP nahi mila.</p>
        : stats.xp_history.map((x, i) => <p key={i} style={{margin:"4px 0"}}>+{x.amount} XP — {x.reason}</p>)}
    </div>)}
    <h2>Test Attempts</h2>
    {h.attempts.length === 0 && <p style={{color:"var(--muted)"}}>Abhi koi test nahi diya.</p>}
    {h.attempts.map(a => (<div key={a.id} className="card" style={{marginBottom:8,padding:"12px 16px"}}>
      Chapter #{a.chapter_id} — <b>{a.score_percent}%</b> {a.passed ? "✅ Passed" : "❌ Failed"}
      {a.weak_topics?.length > 0 && <span style={{color:"var(--muted)"}}> · Weak: {a.weak_topics.join(", ")}</span>}
    </div>))}
  </div>);
}
