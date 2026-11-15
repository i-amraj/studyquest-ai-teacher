import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";

const LINES = [
  "Namaste! Main tumhara AI Teacher hu 🎓",
  "Array samjho — ek dabba, kai khaane 📦",
  "Doubt hai? Poocho, main yahi hu 💬",
  "Test me 80% laoge tabhi agla chapter khulega 🔓",
  "Notes taiyaar hain — PDF download kar lo 📄",
];

function TeacherSVG() {
  return (
    <svg viewBox="0 0 300 300" className="teacher-svg" role="img" aria-label="AI Teacher">
      {/* board */}
      <rect x="18" y="26" width="264" height="150" rx="12" fill="#14532d" />
      <rect x="18" y="26" width="264" height="150" rx="12" fill="none" stroke="#8a6d3b" strokeWidth="7" />
      <text x="42" y="72" fill="#e9dfc8" fontSize="19" fontFamily="Fraunces,serif">a² + b² = c²</text>
      <text x="42" y="106" fill="#e9dfc8" fontSize="16" opacity=".85">Stack → LIFO</text>
      <clipPath id="wclip"><rect className="wclip-rect" x="38" y="118" width="0" height="28" /></clipPath>
      <text className="board-write" clipPath="url(#wclip)" x="42" y="139" fill="#f4c95d" fontSize="17" fontWeight="600">Tree → BST</text>
      <circle className="chalk-dot" cx="42" cy="132" r="3.6" fill="#fff" opacity="0" />
      <text x="196" y="80" fill="#f4c95d" fontSize="26">★</text>
      {/* body */}
      <g className="t-body">
        <path d="M108 300c0-52 18-84 42-84s42 32 42 84z" fill="#b3543f" />
        <path d="M150 216l-13 16 13 30 13-30z" fill="#faf6ee" />
        <path d="M150 232l-6 8 6 16 6-16z" fill="#14532d" />
        {/* waving arm */}
        <g className="t-wave">
          <path d="M186 240c20-6 30-20 34-38" stroke="#8a5a3b" strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="222" cy="196" r="10" fill="#a06a42" />
        </g>
        {/* pointer arm — board par likhne wala haath */}
        <g className="t-write-arm">
          <path d="M114 242c-18-2-30-12-38-28" stroke="#8a5a3b" strokeWidth="13" strokeLinecap="round" fill="none" />
          <rect x="30" y="176" width="52" height="6" rx="3" fill="#f0ead8" transform="rotate(-38 56 179)" />
        </g>
        {/* head */}
        <circle cx="150" cy="168" r="42" fill="#a06a42" />
        <path d="M108 160a42 42 0 0 1 84 0l0-8a42 34 0 0 0-84 0z" fill="#2b2118" />
        <g className="t-eyes">
          <circle cx="134" cy="170" r="4.6" fill="#221709" />
          <circle cx="166" cy="170" r="4.6" fill="#221709" />
        </g>
        <path d="M136 192q14 11 28 0" stroke="#5b3a22" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="118" cy="184" r="6" fill="#c96f4a" opacity=".55" />
        <circle cx="182" cy="184" r="6" fill="#c96f4a" opacity=".55" />
        {/* graduation cap */}
        <g className="t-cap">
          <path d="M104 128l46-20 46 20-46 20z" fill="#22303c" />
          <path d="M126 139v16c0 8 48 8 48 0v-16l-24 10z" fill="#2e4152" />
          <path d="M196 128v26" stroke="#f4c95d" strokeWidth="4" strokeLinecap="round" />
          <circle cx="196" cy="158" r="5" fill="#f4c95d" />
        </g>
      </g>
    </svg>
  );
}

export default function Home() {
  const root = useRef(null);
  const [typed, setTyped] = useState("");
  const [counts, setCounts] = useState({ gate: 0, lang: 0, xp: 0 });

  // Typewriter — teacher bolta hai
  useEffect(() => {
    let li = 0, ci = 0, del = false, timer;
    const tick = () => {
      const line = LINES[li];
      if (!del) {
        ci++;
        setTyped(line.slice(0, ci));
        if (ci === line.length) { del = true; timer = setTimeout(tick, 2100); return; }
        timer = setTimeout(tick, 55);
      } else {
        ci -= 3;
        if (ci <= 0) { ci = 0; del = false; li = (li + 1) % LINES.length; }
        setTyped(line.slice(0, Math.max(0, ci)));
        timer = setTimeout(tick, 22);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, []);

  // GSAP entrance + floating chips + scroll reveals + counters
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".h-line", { y: 44, opacity: 0 }, { y: 0, opacity: 1, stagger: .13, duration: .8, ease: "power3.out", delay: .1 });
      gsap.fromTo(".h-fade", { y: 18, opacity: 0 }, { y: 0, opacity: 1, stagger: .12, duration: .6, ease: "power2.out", delay: .55 });
      gsap.fromTo(".teacher-stage", { scale: .92, opacity: 0, rotate: -2 }, { scale: 1, opacity: 1, rotate: 0, duration: .9, ease: "back.out(1.4)", delay: .3 });
      gsap.to(".chip-float", { y: -10, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: .35 });
      gsap.to(".t-body", { y: -4, duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: -1 });

      // Board par LIVE likhna — chalk aage badhta hai, text peeche se khulta hai
      const writeLines = ["Tree → BST", "Queue → FIFO", "Recursion ↻", "Big-O: O(n log n)", "Graph → BFS · DFS"];
      const wtext = root.current?.querySelector(".board-write");
      const wrect = root.current?.querySelector(".wclip-rect");
      const chalk = root.current?.querySelector(".chalk-dot");
      if (wtext && wrect && chalk) {
        let wi = writeLines.length - 1;
        const writeNext = () => {
          wi = (wi + 1) % writeLines.length;
          wtext.textContent = writeLines[wi];
          const len = wtext.getComputedTextLength();
          const prog = { w: 0 };
          const tl = gsap.timeline({ onComplete: () => gsap.delayedCall(1.6, writeNext) });
          tl.set(chalk, { opacity: 1 })
            .to(".t-write-arm", { rotation: 2.5, duration: .09, yoyo: true, repeat: 15, ease: "sine.inOut", transformOrigin: "85% 90%" }, 0)
            .to(prog, { w: len + 8, duration: 1.5, ease: "none",
                onUpdate: () => { wrect.setAttribute("width", prog.w); chalk.setAttribute("cx", 40 + prog.w); } }, 0)
            .to(chalk, { opacity: 0, duration: .3 }, "+=0.9")
            .to(wrect, { attr: { width: 0 }, duration: .45, ease: "power2.in" }, "+=0.55");
        };
        gsap.delayedCall(1.2, writeNext);
      }
    }, root);

    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      gsap.fromTo(el, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: "power3.out", stagger: .1 });
      io.unobserve(el);
      if (el.classList.contains("stats-band")) {
        const obj = { gate: 0, lang: 0, xp: 0 };
        gsap.to(obj, { gate: 80, lang: 4, xp: 50, duration: 1.4, ease: "power2.out",
          onUpdate: () => setCounts({ gate: Math.round(obj.gate), lang: Math.round(obj.lang), xp: Math.round(obj.xp) }) });
      }
    }), { threshold: .18 });
    root.current?.querySelectorAll(".reveal, .stats-band").forEach(el => io.observe(el));
    return () => { ctx.revert(); io.disconnect(); };
  }, []);

  return (<div ref={root} className="landing">
    <header className="land-nav wrap">
      <div className="brand"><span className="mark">S</span> StudyQuest</div>
      <div style={{ display: "flex", gap: 10 }}>
        <Link className="btn ghost" to="/login">Login</Link>
        <Link className="btn" to="/register">Free me shuru karo</Link>
      </div>
    </header>

    <section className="hero wrap">
      <div className="hero-copy">
        <div className="h-line eyebrow">🎓 COLLEGE STUDENTS KE LIYE AI TEACHER</div>
        <h1 className="hero-h">
          <span className="h-line">Tumhara syllabus.</span>
          <span className="h-line">Tumhara <em>AI teacher.</em></span>
          <span className="h-line">Ek game ki tarah.</span>
        </h1>
        <p className="h-fade hero-sub">Syllabus ki PDF ya photo upload karo — AI use Units, Chapters aur Topics me todega, har chapter tumhari bhasha me padhayega, notes banayega aur test lega. <b>80% pass kiye bina agla chapter nahi khulega.</b></p>
        <div className="h-fade" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <Link className="btn big" to="/register">🚀 Free me shuru karo</Link>
          <Link className="btn ghost big" to="/login">Login karo</Link>
        </div>
        <div className="h-fade lang-chips">
          <span>Teacher ki bhasha:</span>
          <b>हिंदी</b><b>اردو</b><b>Hinglish</b><b>English</b>
        </div>
      </div>

      <div className="teacher-stage">
        <div className="stage-ring" />
        <TeacherSVG />
        <div className="speech"><span>{typed}</span><span className="caret" /></div>
        <div className="chip-float chip1">⭐ +50 XP</div>
        <div className="chip-float chip2">🔥 Daily Streak</div>
        <div className="chip-float chip3">🏆 Chapter Mastered</div>
      </div>
    </section>

    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[...Array(2)].map((_, k) => (
          <span key={k}>Data Structures ✦ DBMS ✦ Operating Systems ✦ Computer Networks ✦ Maths ✦ OOP ✦ DBMS Lab ✦ English ✦ Physics ✦ Digital Electronics ✦ </span>
        ))}
      </div>
    </div>

    <section className="wrap section">
      <h2 className="reveal sec-h">Kaise kaam karta hai?</h2>
      <div className="steps">
        {[["📤", "1. Syllabus upload karo", "PDF ya photo do — badi file bhi chalegi, system apne aap compress kar lega. AI use Units → Chapters → Topics me tod dega."],
          ["🎓", "2. Teacher se padho", "Har chapter ka dostana lesson, usi chapter par doubt chat, aur exam-ready notes — PDF download ke saath."],
          ["📝", "3. Test do, gate kholo", "6 MCQ + 2 short sawal. 80% se kam aaye to AI weak topics dobara alag tareeke se padhayega."],
          ["🏆", "4. XP aur badges kamao", "Har mastery par XP, pehli koshish par bonus, daily streak aur leaderboard — padhai ek game jaisi."]].map(([i, t, d]) => (
          <div key={t} className="step-card reveal"><div className="step-ic">{i}</div><b>{t}</b><p>{d}</p></div>))}
      </div>
    </section>

    <section className="wrap section stats-band">
      <div className="stat-big"><b>{counts.gate}%</b><span>Mastery gate — bina pass kiye aage nahi</span></div>
      <div className="stat-big"><b>{counts.lang}</b><span>Bhashaein — Hindi, Urdu, Hinglish, English</span></div>
      <div className="stat-big"><b>+{counts.xp} XP</b><span>Har mastered chapter par, bonus alag</span></div>
    </section>

    <section className="wrap section">
      <h2 className="reveal sec-h">Sab kuch ek hi jagah</h2>
      <div className="steps">
        {[["🧩", "Syllabus → Structure", "AI sirf tumhare syllabus se padhata hai — bahar ka content nahi. Har topic traceable."],
          ["💬", "Doubt Chat", "Sawal sirf usi chapter ke topics par — teacher topic se bahar nahi bhatakta."],
          ["📄", "Notes + PDF", "Exam-ready short notes ek click me, PDF download ke saath revision ke liye."],
          ["🔁", "Galti par dobara padhai", "Fail hue to weak topics pehchan kar AI naye examples se dobara samjhata hai."]].map(([i, t, d]) => (
          <div key={t} className="step-card reveal"><div className="step-ic">{i}</div><b>{t}</b><p>{d}</p></div>))}
      </div>
    </section>

    <section className="wrap section">
      <div className="cta-band reveal">
        <h2>Apne syllabus ko game bana lo 🎮</h2>
        <p>Account banao, apni Student ID lo, aur pehla chapter aaj hi master karo.</p>
        <Link className="btn big light" to="/register">Free account banao →</Link>
      </div>
      <p className="foot">StudyQuest — AI Teacher · Bhasha: हिंदी · اردو · Hinglish · English</p>
    </section>
  </div>);
}
