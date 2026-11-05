(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname);
  const state = params.get("state");
  const grant = params.get("grant");
  const error = params.get("error");
  const status = document.querySelector("#auth-callback-status");
  document.querySelector("#auth-callback-close").addEventListener("click", () => window.close());
  const validGrant = params.getAll("grant").length === 1 && /^[A-Za-z0-9]{64}$/.test(grant || "") && !params.has("error");
  const validError = params.getAll("error").length === 1 && error === "customer_required" && !params.has("grant");
  if (params.getAll("state").length !== 1 || !/^[A-Za-z0-9]{64}$/.test(state || "") || (!validGrant && !validError)) {
    status.textContent = "This sign-in link is invalid or expired. Return to the store and try again.";
    return;
  }
  const result = { type: "harinam:social-login", state, ...(validError ? { error } : { grant }) };
  if (window.opener) window.opener.postMessage(result, location.origin);
  // Google can sever window.opener through Cross-Origin-Opener-Policy.
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel("harinam-social-login");
      channel.postMessage(result);
      channel.close();
    } catch { /* The original window can still receive postMessage. */ }
  }
  status.textContent = "Sign-in received. Please return to your original store window.";
  window.close();
})();
