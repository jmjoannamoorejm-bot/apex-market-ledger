const registerForm = document.querySelector("[data-register-form]");
const loginForm = document.querySelector("[data-login-form]");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(registerForm).entries());
    try {
      const result = await api("/api/register", {
        method: "POST",
        body: JSON.stringify(body)
      });
      const extra = result.devCode ? ` Local code: ${result.devCode}` : "";
      setStatus("[data-auth-status]", `Account created. Verification email delivery: ${result.emailDelivery ? "sent" : "not configured"}.${extra}`);
      setTimeout(() => {
        window.location.href = "/dashboard/";
      }, 900);
    } catch (error) {
      setStatus("[data-auth-status]", error.message, false);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(loginForm).entries());
    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify(body)
      });
      window.location.href = "/dashboard/";
    } catch (error) {
      setStatus("[data-auth-status]", error.message, false);
    }
  });
}
