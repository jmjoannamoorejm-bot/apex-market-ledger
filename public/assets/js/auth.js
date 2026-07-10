const registerForm = document.querySelector("[data-register-form]");
const loginForm = document.querySelector("[data-login-form]");
const resetForm = document.querySelector("[data-reset-form]");
const countrySelect = document.querySelector("[data-country-select]");
const countryInput = document.querySelector("[data-country-input]");
const countryOptions = document.querySelector("[data-country-options]");
const phonePrefix = document.querySelector("[data-phone-prefix]");

const selectedCountry = () => {
  const code = countrySelect?.value || "US";
  return (window.APEX_COUNTRIES || []).find((country) => country[0] === code) || ["US", "United States", "+1"];
};

const localeCountryCode = () => {
  const locale = navigator.languages?.[0] || navigator.language || "";
  try {
    return new Intl.Locale(locale).region || "US";
  } catch {
    return locale.split("-")[1]?.toUpperCase() || "US";
  }
};

const normalizedCallingCode = (prefix) => `+${String(prefix).replace(/\D/g, "")}`;

const countryLabel = ([code, name, prefix]) => `${name} (${code}, ${prefix})`;

const syncCountryFields = () => {
  const country = selectedCountry();
  if (countryInput) countryInput.value = countryLabel(country);
  if (phonePrefix) phonePrefix.textContent = country[2];
};

const syncPhonePrefix = () => {
  if (phonePrefix) phonePrefix.textContent = selectedCountry()[2];
};

const findCountry = (query) => {
  const value = String(query || "").trim().toLowerCase();
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ");
  const digits = value.replace(/\D/g, "");
  return (window.APEX_COUNTRIES || []).find(([code, name, prefix]) => {
    const codeValue = code.toLowerCase();
    const nameValue = name.toLowerCase();
    const prefixDigits = String(prefix).replace(/\D/g, "");
    return (
      codeValue === compact ||
      nameValue === compact ||
      countryLabel([code, name, prefix]).toLowerCase() === compact ||
      (compact.length >= 2 && nameValue.includes(compact)) ||
      (digits && prefixDigits === digits)
    );
  });
};

const populateCountries = () => {
  if (!countrySelect || !window.APEX_COUNTRIES) return;
  countrySelect.innerHTML = window.APEX_COUNTRIES
    .map(([code, name, prefix]) => `<option value="${code}">${name} (${prefix})</option>`)
    .join("");
  if (countryOptions) {
    countryOptions.innerHTML = window.APEX_COUNTRIES
      .map((country) => `<option value="${countryLabel(country)}"></option>`)
      .join("");
  }
  const localeCode = localeCountryCode();
  countrySelect.value = window.APEX_COUNTRIES.some(([code]) => code === localeCode) ? localeCode : "US";
  syncCountryFields();
};

populateCountries();

countrySelect?.addEventListener("change", () => {
  syncCountryFields();
});

countryInput?.addEventListener("input", () => {
  const country = findCountry(countryInput.value);
  if (!country || !countrySelect) return;
  countrySelect.value = country[0];
  syncPhonePrefix();
});

countryInput?.addEventListener("blur", () => {
  const country = findCountry(countryInput.value);
  if (!country || !countrySelect) return;
  countrySelect.value = country[0];
  syncCountryFields();
});

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(registerForm).entries());
    const typedCountry = findCountry(countryInput?.value);
    if (typedCountry && countrySelect) countrySelect.value = typedCountry[0];
    const country = selectedCountry();
    const nationalDigits = String(body.phone || "").replace(/\D/g, "");
    const callingCode = normalizedCallingCode(country[2]);
    const internationalDigits = `${callingCode.replace(/\D/g, "")}${nationalDigits}`;
    if (nationalDigits.length < 4 || internationalDigits.length < 7 || internationalDigits.length > 15) {
      return setStatus("[data-auth-status]", "Enter a valid national phone number. Do not repeat the country code.", false);
    }
    body.countryCode = country[0];
    body.country = country[1];
    body.phonePrefix = callingCode;
    body.phone = `+${internationalDigits}`;
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
