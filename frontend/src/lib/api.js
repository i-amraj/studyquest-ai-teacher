const API = "";
export function getTokens() {
  try { return JSON.parse(localStorage.getItem("sq_tokens") || "null"); } catch { return null; }
}
export function setTokens(t) { localStorage.setItem("sq_tokens", JSON.stringify(t)); }
export function clearTokens() { localStorage.removeItem("sq_tokens"); }

async function refresh() {
  const t = getTokens(); if (!t?.refresh_token) return null;
  const r = await fetch(API + "/api/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: t.refresh_token }) });
  if (!r.ok) { clearTokens(); return null; }
  const data = await r.json(); setTokens(data); return data;
}

export async function api(path, opts = {}, retry = true) {
  const t = getTokens();
  const r = await fetch(API + path, { ...opts, headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t.access_token } : {}), ...(opts.headers || {}) } });
  if (r.status === 401 && retry && !path.includes("/auth/")) {
    const nt = await refresh();
    if (nt) return api(path, opts, false);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || "Kuch galat ho gaya");
  return data;
}
export const authApi = {
  register: (body) => fetch(API + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async r => { const d = await r.json().catch(()=>({})); if (!r.ok) throw new Error(d.detail || "Register fail"); setTokens(d); return d; }),
  login: (body) => fetch(API + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async r => { const d = await r.json().catch(()=>({})); if (!r.ok) throw new Error(d.detail || "Login fail"); setTokens(d); return d; }),
  me: () => api("/api/auth/me"),
};
