// Chhota safe markdown renderer (headings, bold, lists, paragraphs) — koi extra dep nahi.
function inline(t, k) {
  const parts = t.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => i % 2 ? <b key={k + "-" + i}>{p}</b> : <span key={k + "-" + i}>{p}</span>);
}
export default function Markdown({ text }) {
  const blocks = []; let list = null;
  (text || "").split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!list) { list = []; blocks.push(list); }
      list.push(line.slice(2)); return;
    }
    list = null;
    if (!line) return;
    if (line.startsWith("### ")) blocks.push(<h4 key={i}>{inline(line.slice(4), i)}</h4>);
    else if (line.startsWith("## ")) blocks.push(<h3 key={i}>{inline(line.slice(3), i)}</h3>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={i}>{inline(line.slice(2), i)}</h2>);
    else blocks.push(<p key={i} style={{lineHeight:1.65}}>{inline(line, i)}</p>);
  });
  return (<div>{blocks.map((b, i) => Array.isArray(b)
    ? <ul key={"l" + i} style={{lineHeight:1.7}}>{b.map((li, j) => <li key={j}>{inline(li, "l" + i + "-" + j)}</li>)}</ul>
    : b)}</div>);
}
