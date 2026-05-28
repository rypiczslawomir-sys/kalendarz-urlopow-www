(function () {
  "use strict";

  const form = document.getElementById("loginForm");
  const errEl = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginSubmit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Logowanie…";

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: document.getElementById("loginUser").value.trim(),
          password: document.getElementById("loginPass").value,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errEl.textContent = data.error || "Logowanie nie powiodło się";
        errEl.hidden = false;
        return;
      }

      window.location.href = "/";
    } catch (err) {
      errEl.textContent = "Brak połączenia z serwerem";
      errEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Zaloguj";
    }
  });
})();
