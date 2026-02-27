(() => {
  "use strict";

  if (!window.sb) {
    alert("Supabase client (sb) no está cargado.");
    return;
  }

  const emailInp = document.getElementById("resetEmail");
  const btn = document.getElementById("resetBtn");
  const msg = document.getElementById("resetMsg");

  function setMsg(text, kind="small"){
    if (!msg) return;
    msg.className = kind; // "small" | "notice" | "error"
    msg.textContent = text || "";
  }

  // IMPORTANTE: URL a donde Supabase te devuelve tras clickear el link del email.
  // Esa página debe manejar el flujo de "update password".
  // Si aún no la tenés, por ahora mandalo a login.html y luego lo perfeccionamos.
  const redirectTo = `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, "")}/login.html`;

  btn?.addEventListener("click", async () => {
    const email = (emailInp?.value || "").trim();
    if (!email) return setMsg("Ingresá tu email.", "error");

    setMsg("Enviando…", "small");

    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setMsg(error.message || "No pude enviar el email.", "error");
      return;
    }

    setMsg("Listo ✅ Revisá tu email (y spam) para continuar.", "notice");
  });
})();