// auth.js
function a360BasePath() {
  const cfg = window.A360 || {};
  const configured = String(cfg.APP_BASE_PATH || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  return window.location.pathname.includes("/academia360/") ? "/academia360" : "";
}

function a360Path(path) {
  const clean = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
  return `${a360BasePath()}${clean}`;
}

async function getSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) console.error(error);
  return data?.session ?? null;
}

async function requireAuthOrRedirect() {
  const session = await getSession();
  if (!session) {
    window.location.href = a360Path("/login.html");
    return null;
  }
  return session;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = a360Path("/index.html");
}

function qs(id) { return document.getElementById(id); }

window.A360Auth = { getSession, requireAuthOrRedirect, signOut, qs, basePath: a360BasePath, path: a360Path };
