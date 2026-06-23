const registerForm = document.querySelector("[data-register-form]");
const loginForm = document.querySelector("[data-login-form]");
const resetForm = document.querySelector("[data-reset-form]");
const countrySelect = document.querySelector("[data-country-select]");
const phonePrefix = document.querySelector("[data-phone-prefix]");

const selectedCountry = () => {
  const code = countrySelect?.value || "US";
  return (window.APEX_COUNTRIES || []).find((country) => country[0] === code) || ["US", "United States", "+1", 10];
};

const populateCountries = () => {
  if (!countrySelect || !window.APEX_COUNTRIES) return;
  countrySelect.innerHTML = window.APEX_COUNTRIES
    .map(([code, name, prefix]) => `<option value="${code}">${name} (${prefix})</option>`)
    .join("");
  countrySelect.value = "US";
  phonePrefix.textContent = selectedCountry()[2];
};

populateCountries();

countrySelect?.addEventListener("change", () => {
  phonePrefix.textContent = selectedCountry()[2];
});

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(registerForm).entries());
    const country = selectedCountry();
    const digits = String(body.phone || "").replace(/\D/g, "");
    if (!digits || digits.length < 7 || digits.length > 14) {
      return setStatus("[data-auth-status]", "Enter a valid phone number using digits only.", false);
    }
    body.countryCode = country[0];
    body.country = country[1];
    body.phonePrefix = country[2];
    body.phone = `${country[2]} ${digits}`;
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

document.querySelector("[data-send-reset-code]")?.addEventListener("click", async () => {
  const email = resetForm?.querySelector("[name='email']")?.value || "";
  try {
    const result = await api("/api/password/send-code", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    const extra = result.devCode ? ` Local code: ${result.devCode}` : "";
    setStatus("[data-reset-status]", `Reset code requested. Delivery: ${result.emailDelivery ? "sent" : "not configured"}.${extra}`);
  } catch (error) {
    setStatus("[data-reset-status]", error.message, false);
  }
});

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(resetForm).entries());
  try {
    await api("/api/password/reset", {
      method: "POST",
      body: JSON.stringify(body)
    });
    setStatus("[data-reset-status]", "Password reset complete. You can log in now.");
    resetForm.reset();
  } catch (error) {
    setStatus("[data-reset-status]", error.message, false);
  }
});
