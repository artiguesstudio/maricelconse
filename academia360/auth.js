// auth.js
async function getSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) console.error(error);
  return data?.session ?? null;
}

async function requireAuthOrRedirect() {
  const session = await getSession();
  if (!session) {
    window.location.href = "/login.html";
    return null;
  }
  return session;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = "/index.html";
}

function qs(id) { return document.getElementById(id); }

window.A360Auth = { getSession, requireAuthOrRedirect, signOut, qs };
