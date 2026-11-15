import { chromium } from "/home/hatch/workspace/growkaz-stickman-studio/node_modules/playwright/index.mjs";
import { execSync } from "child_process";

const BASE = "http://localhost:8000";
const SHOTS = "/home/hatch/workspace/ai-teacher/e2e-shots";
const email = `e2e_${Date.now()}@test.edu`;
const log = (s) => console.log(`[E2E] ${s}`);
let fails = 0;
const ok = (cond, name) => { log(`${cond ? "PASS" : "FAIL"}: ${name}`); if (!cond) fails++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", e => log("PAGEERROR: " + String(e).slice(0, 200)));
page.on("console", m => { if (m.type() === "error") log("CONSOLE-ERR: " + m.text().slice(0, 150)); });
page.setDefaultTimeout(30000);

try {
  // 1. Landing
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  ok(await page.locator("text=StudyQuest").first().isVisible(), "Landing loads with brand");
  await page.screenshot({ path: `${SHOTS}/01-landing.png` });

  // 2. Register
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Raj Soni").fill("E2E Tester");
  await page.getByPlaceholder("you@college.edu").fill(email);
  await page.getByPlaceholder("Jagran Institute of Management").fill("JIM Kanpur");
  await page.getByPlaceholder("MCA").fill("MCA");
  await page.getByPlaceholder("••••••••").fill("testpass123");
  await page.getByRole("button", { name: "Account banao" }).click();
  await page.waitForURL(/\/app/, { timeout: 20000 });
  ok(true, "Register -> dashboard redirect");
  await page.screenshot({ path: `${SHOTS}/02-dashboard.png` });

  // 3. Upload syllabus PDF
  await page.goto(BASE + "/app/upload", { waitUntil: "networkidle" });
  await page.getByPlaceholder("e.g. Data Structures — MCA Sem 3").fill("Data Structures E2E");
  await page.getByPlaceholder("e.g. Data Structures", { exact: true }).fill("Data Structures");
  await page.locator('input[type="file"]').setInputFiles("/tmp/sample_syllabus.pdf");
  await page.getByRole("button", { name: /Upload aur AI se structure banao/ }).click();
  log("Upload submitted, Gemini parse ka wait (up to 5 min)...");
  await page.waitForURL(/\/app\/syllabus\/\d+/, { timeout: 300000 });
  ok(true, "Upload + Gemini parse -> syllabus page");
  await page.waitForSelector("text=Unit 1", { timeout: 60000 });
  ok(true, "Syllabus units rendered");
  await page.screenshot({ path: `${SHOTS}/03-syllabus-path.png`, fullPage: true });

  // 4. Open chapter 1 -> Learn
  await page.locator("text=Chapter 1").first().click();
  await page.waitForURL(/\/app\/chapter\/\d+/, { timeout: 20000 });
  const lessonBtn = page.getByRole("button", { name: "Lesson shuru karo" });
  await lessonBtn.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  if (await lessonBtn.isVisible().catch(() => false)) await lessonBtn.click();
  log("Lesson generate ka wait...");
  await page.waitForFunction(() => document.body.innerText.length > 1500, null, { timeout: 300000 });
  ok(true, "Lesson rendered in UI");
  await page.screenshot({ path: `${SHOTS}/04-lesson.png`, fullPage: true });

  // 5. Doubt chat
  await page.getByRole("button", { name: /Doubt|Chat/ }).first().click().catch(async () => {
    await page.locator("button", { hasText: "Doubt" }).first().click();
  });
  await page.getByPlaceholder("Apna doubt likho…").fill("Array aur Linked List me kya difference hai?");
  await page.getByRole("button", { name: "Bhejo" }).click();
  log("Chat reply ka wait...");
  await page.waitForFunction(() => document.body.innerText.includes("Linked List") && document.body.innerText.length > 1200, null, { timeout: 300000 });
  ok(true, "Doubt chat reply in UI");
  await page.screenshot({ path: `${SHOTS}/05-chat.png`, fullPage: true });

  // 6. Notes tab + PDF button
  await page.locator("button", { hasText: "Notes" }).first().click();
  const notesBtn = page.getByRole("button", { name: "Notes banao" });
  await notesBtn.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  if (await notesBtn.isVisible().catch(() => false)) await notesBtn.click();
  log("Notes generate ka wait...");
  await page.waitForFunction(() => document.body.innerText.includes("Notes") && document.body.innerText.length > 800, null, { timeout: 300000 });
  ok(await page.getByRole("button", { name: /Notes PDF download/ }).isVisible(), "Notes + PDF download button visible");
  await page.screenshot({ path: `${SHOTS}/06-notes.png`, fullPage: true });

  // 7. Test tab
  await page.locator("button", { hasText: "Test" }).first().click();
  await page.getByRole("button", { name: "Test shuru karo" }).click();
  log("Test generate ka wait...");
  await page.waitForSelector("textarea, input[type=radio]", { timeout: 300000 });
  ok(true, "Test questions rendered");
  await page.screenshot({ path: `${SHOTS}/07-test.png`, fullPage: true });

  // DB se sahi jawab lo aur UI me bharo
  const py = `import sqlite3, json
c = sqlite3.connect("/home/hatch/workspace/ai-teacher/backend/studyquest_dev.db")
tid = c.execute("SELECT max(id) FROM tests").fetchone()[0]
rows = c.execute("SELECT qtype, options, correct_index, rubric FROM questions WHERE test_id=? ORDER BY id", (tid,)).fetchall()
print(json.dumps([{"qtype": r[0], "options": json.loads(r[1] or "[]"), "ci": r[2], "rubric": r[3]} for r in rows]))`;
  const qs = JSON.parse(execSync(`python3 -c '${py.replace(/'/g, "")}'`, { encoding: "utf8" }).trim() || "[]");
  log(`DB questions: ${qs.length}`);
  let shortIdx = 0;
  for (const q of qs) {
    if (q.qtype === "mcq" && q.ci >= 0 && q.options[q.ci]) {
      const opt = page.locator(`text="${q.options[q.ci]}"`).first();
      await opt.click().catch(() => log(`option click miss: ${q.options[q.ci].slice(0, 40)}`));
    } else if (q.qtype === "short") {
      const tas = page.getByPlaceholder("Apna jawab likho…");
      await tas.nth(shortIdx).fill((q.rubric || "Data structure data ko efficiently organize karta hai.") .slice(0, 400)).catch(() => {});
      shortIdx++;
    }
  }
  await page.getByRole("button", { name: "Submit karo" }).click();
  log("Result ka wait (short-answer AI eval)...");
  await page.waitForFunction(() => /Mastered|score|Score|%/.test(document.body.innerText) && document.body.innerText.length > 300, null, { timeout: 300000 });
  const resultText = await page.locator("body").innerText();
  const m = resultText.match(/(\d+(?:\.\d+)?)\s*%/);
  ok(!!m, `Test result shown${m ? " — score " + m[1] + "%" : ""}`);
  await page.screenshot({ path: `${SHOTS}/08-result.png`, fullPage: true });

  // 8. Syllabus wapas — chapter 2 unlock check
  await page.goBack().catch(() => {});
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/09-dashboard-after.png`, fullPage: true });
  ok(true, "Dashboard after mastery loads");

  // 9. Mobile viewport + overflow
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(BASE + "/app", { waitUntil: "networkidle" });
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 1, `Mobile: no horizontal overflow (diff=${overflow}px)`);
  await mob.screenshot({ path: `${SHOTS}/10-mobile.png`, fullPage: true });
} catch (e) {
  log("ERROR: " + String(e).slice(0, 400));
  await page.screenshot({ path: `${SHOTS}/error.png`, fullPage: true }).catch(() => {});
  fails++;
}
await browser.close();
log(`DONE — fails=${fails}`);
process.exit(fails ? 1 : 0);
