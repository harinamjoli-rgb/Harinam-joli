(() => {
  const initialized = new WeakMap();
  const initSocial = (root) => {
    if (!root.querySelector(".auth-social-login")) return;
    const buttons = [...root.querySelectorAll("[data-social-provider]")];
    const status = root.querySelector("#auth-social-status");
    const cancel = root.querySelector("#auth-social-cancel");
    let providers = {};
    let pending = false;
    const updateButtons = () => buttons.forEach((button) => {
      button.disabled = pending || providers[button.dataset.socialProvider] !== true;
    });
    HarinamShop.request("/auth/social/providers", { auth: false }).then((data) => {
      providers = data;
      updateButtons();
      status.textContent = data.google === true && data.facebook === true ? "" :
        data.google === true ? "Facebook sign-in is currently unavailable. Please use Google or email." :
        data.facebook === true ? "Google sign-in is currently unavailable. Please use Facebook or email." :
        "Google and Facebook sign-in are currently unavailable. Please use email.";
    }).catch(() => {
      status.textContent = "Google and Facebook sign-in are currently unavailable. Please use email.";
    });
    buttons.forEach((button) => button.addEventListener("click", async () => {
      if (pending || button.disabled) return;
      const popup = window.open("about:blank", "_blank", "popup,width=520,height=720");
      if (!popup) {
        status.textContent = "Please allow the sign-in window in your browser, then try again.";
        return;
      }
      pending = true;
      updateButtons();
      cancel.hidden = false;
      const provider = button.dataset.socialProvider;
      status.textContent = `Complete ${provider === "google" ? "Google" : "Facebook"} sign-in in the new window.`;
      let cancelled = false;
      let rejectWait;
      let channel;
      let timeout;
      let onMessage;
      const onCancel = () => {
        cancelled = true;
        popup.close();
        rejectWait?.(new Error("Sign-in cancelled. You can try again or use email."));
      };
      cancel.addEventListener("click", onCancel);
      try {
        const flow = await HarinamShop.beginSocialLogin(provider);
        if (cancelled) throw new Error("Sign-in cancelled. You can try again or use email.");
        const url = new URL(flow.url);
        if (!/^[A-Za-z0-9]{64}$/.test(flow.state || "") || url.origin !== "https://admin.harinamjoli.in" ||
            url.pathname !== "/wp-login.php" || url.searchParams.get("loginSocial") !== provider) {
          throw new Error("The sign-in service returned an invalid address. Please try again.");
        }
        const grant = await new Promise((resolve, reject) => {
          rejectWait = reject;
          const receive = (data) => {
            if (data?.type !== "harinam:social-login" || data.state !== flow.state) return;
            if (data.error === "customer_required") reject(new Error("Please sign in with a customer account."));
            else if (/^[A-Za-z0-9]{64}$/.test(data.grant || "")) resolve(data.grant);
          };
          onMessage = (event) => {
            if (event.origin === location.origin && event.source === popup) receive(event.data);
          };
          window.addEventListener("message", onMessage);
          if (typeof BroadcastChannel !== "undefined") {
            try {
              channel = new BroadcastChannel("harinam-social-login");
              channel.onmessage = (event) => receive(event.data);
            } catch { /* A browser privacy setting can disable BroadcastChannel; postMessage still works. */ }
          }
          timeout = setTimeout(() => reject(new Error("Sign-in timed out. Please try again.")), 10 * 60 * 1000);
          popup.location.replace(url.href);
        });
        if (cancelled) throw new Error("Sign-in cancelled. You can try again or use email.");
        await flow.finish(grant);
        status.textContent = "You’re signed in. Welcome to Harinam Joli.";
        await initialized.get(root)();
      } catch (error) {
        status.textContent = error.message || "Sign-in could not be completed. Please try again.";
      } finally {
        clearTimeout(timeout);
        if (onMessage) window.removeEventListener("message", onMessage);
        channel?.close();
        cancel.removeEventListener("click", onCancel);
        popup.close();
        pending = false;
        cancel.hidden = true;
        updateButtons();
      }
    }));
  };
  const show = (root, view) => {
    root.querySelector(".auth-tabs").hidden = view === "reset-request";
    root.querySelectorAll("[data-auth-tab]").forEach((tab) => {
      const active = tab.dataset.authTab === view;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    root.querySelectorAll(".auth-form").forEach((form) => {
      form.hidden = form.id !== `${view}-form`;
    });
  };

  const init = (root, onSuccess) => {
    if (initialized.has(root)) {
      if (onSuccess) initialized.set(root, onSuccess);
      return;
    }
    initialized.set(root, onSuccess || (() => {}));
    initSocial(root);
    const tabs = [...root.querySelectorAll("[data-auth-tab]")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => show(root, tab.dataset.authTab));
      tab.addEventListener("keydown", (event) => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        show(root, tabs[next].dataset.authTab);
        tabs[next].focus();
      });
    });
    root.querySelectorAll("[data-password-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = root.querySelector(`#${button.dataset.passwordToggle}`);
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        button.textContent = visible ? "Hide" : "Show";
        button.setAttribute("aria-pressed", String(visible));
        button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      });
    });

    const submit = async (form, action, pendingLabel) => {
      const button = form.querySelector("button[type=submit]");
      if (button.disabled) return;
      const message = form.querySelector(".form-message");
      const values = Object.fromEntries(new FormData(form));
      message.classList.remove("success");
      message.textContent = "";
      if (form.id === "create-form" && values.password !== values.confirmPassword) {
        message.textContent = "Passwords do not match.";
        return;
      }
      const label = button.textContent;
      button.disabled = true;
      button.textContent = pendingLabel;
      try {
        const result = await action(values);
        message.classList.add("success");
        message.textContent = form.id === "reset-request-form" ? result.message : "You’re signed in. Welcome to Harinam Joli.";
        if (form.id !== "reset-request-form") await initialized.get(root)();
      } catch (error) {
        message.classList.remove("success");
        message.textContent = error.message || "Please try again.";
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    };
    for (const [id, action, label] of [
      ["login-form", HarinamShop.signIn, "Signing in…"],
      ["create-form", HarinamShop.createUser, "Creating account…"],
      ["reset-request-form", (values) => HarinamShop.requestPasswordReset(values.email), "Sending…"],
    ]) {
      root.querySelector(`#${id}`).addEventListener("submit", (event) => {
        event.preventDefault();
        return submit(event.currentTarget, action, label);
      });
    }
    root.querySelector("#forgot-password-button").addEventListener("click", () => {
      const email = root.querySelector("#login-form").elements.email.value;
      const resetEmail = root.querySelector("#reset-request-form").elements.email;
      resetEmail.value = email;
      show(root, "reset-request");
      resetEmail.focus();
    });
    root.querySelectorAll("[data-back-to-login]").forEach((button) => {
      button.addEventListener("click", () => {
        show(root, "login");
        root.querySelector("#login-form").elements.email.focus();
      });
    });
    show(root, "login");
  };
  window.HarinamAuth = { init, show };

  let authDialog;
  let authRootPromise;
  let returnMarker;
  let returnHidden;
  let openedThisPage = false;
  let promptDue = false;
  const getAuthRoot = () => {
    const existing = document.querySelector("#auth-guest");
    if (existing) return Promise.resolve(existing);
    if (!authRootPromise) authRootPromise = fetch("account.html", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("Account form unavailable");
        return response.text();
      })
      .then((html) => {
        const root = new DOMParser().parseFromString(html, "text/html").querySelector("#auth-guest");
        if (!root) throw new Error("Account form unavailable");
        return document.importNode(root, true);
      })
      .catch((error) => { authRootPromise = undefined; throw error; });
    return authRootPromise;
  };
  const open = async () => {
    if (HarinamShop.currentUser()) return;
    const root = await getAuthRoot();
    if (HarinamShop.currentUser() || authDialog?.open) return;
    if (!authDialog) {
      authDialog = document.createElement("dialog");
      authDialog.className = "auth-dialog";
      authDialog.setAttribute("aria-label", "Sign in or create an account");
      authDialog.innerHTML = '<button class="auth-dialog-close" type="button" aria-label="Close account popup">×</button>';
      authDialog.querySelector("button").addEventListener("click", () => authDialog.close());
      authDialog.addEventListener("click", (event) => { if (event.target === authDialog) authDialog.close(); });
      authDialog.addEventListener("close", () => {
        if (returnMarker) {
          returnMarker.replaceWith(root);
          root.hidden = returnHidden;
          returnMarker = undefined;
        }
        document.querySelector("[data-account-link]")?.focus();
      });
      document.body.append(authDialog);
    }
    if (root.isConnected && root.parentElement !== authDialog) {
      returnHidden = root.hidden;
      returnMarker = document.createComment("Account form");
      root.before(returnMarker);
    }
    root.hidden = false;
    authDialog.append(root);
    init(root);
    show(root, "login");
    authDialog.showModal();
    openedThisPage = true;
    requestAnimationFrame(() => {
      if (authDialog.open) root.querySelector("#login-form").elements.email.focus();
    });
  };
  window.HarinamAuth.open = open;
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-account-menu-auth]");
    if (!link || HarinamShop.currentUser() || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    document.querySelectorAll('[data-account-link][aria-expanded="true"], #home-menu-button[aria-expanded="true"], #mobile-menu-button[aria-expanded="true"]').forEach((button) => button.click());
    open().catch(() => { location.href = link.href; });
  });
  window.addEventListener("harinam:account", () => {
    if (HarinamShop.currentUser() && authDialog?.open) authDialog.close();
  });
  const autoOpen = () => {
    if (!promptDue || HarinamShop.currentUser() || openedThisPage || document.hidden || document.querySelector("dialog[open]")) return;
    return open().catch(() => {});
  };
  setTimeout(() => {
    promptDue = true;
    return autoOpen();
  }, 10000);
  document.addEventListener("visibilitychange", autoOpen);
  document.addEventListener("close", autoOpen, true);
})();
