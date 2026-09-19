(function (root, factory) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = factory();
  } else {
    root.SupportBeacon = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var HOST_TAG = "support-beacon-host";
  var instance = null;
  var DEFAULTS = {
    owner: "",
    repo: "",
    mode: "github",
    endpoint: "",
    token: "",
    eventType: "support-beacon",
    position: "bottom-right",
    theme: "auto",
    accent: "#6d28d9",
    title: "Report an issue",
    buttonLabel: "Support",
    hideLauncher: false,
    requireEmail: false,
    labels: [],
    types: [
      { value: "bug", label: "Bug" },
      { value: "feature", label: "Feature request" },
      { value: "question", label: "Question" },
    ],
    strings: {
      type: "Type",
      titleField: "Title",
      details: "Details",
      email: "Email (optional)",
      submit: "Submit",
      cancel: "Cancel",
      close: "Close",
      success: "Thanks — your report was submitted.",
      error: "Something went wrong. Please try again.",
      required: "Please fill in the required fields.",
    },
  };

  var CSS = [
    ":host{all:initial;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;}",
    ".wrap{position:fixed;z-index:2147483000;inset:auto 20px 20px auto;display:flex;flex-direction:column;align-items:flex-end;gap:12px;}",
    ".wrap.bottom-left{inset:auto auto 20px 20px;align-items:flex-start;}",
    ".wrap.top-right{inset:20px 20px auto auto;}",
    ".wrap.top-left{inset:20px auto auto 20px;align-items:flex-start;}",
    ".launcher{width:56px;height:56px;border:0;border-radius:50%;cursor:pointer;color:#fff;background:var(--sb-accent,#6d28d9);box-shadow:0 8px 24px rgba(15,23,42,.28);display:inline-flex;align-items:center;justify-content:center;transition:transform .15s ease,filter .15s ease;}",
    ".launcher:hover,.launcher:focus-visible{transform:scale(1.06);filter:brightness(1.08);outline:2px solid #fff;outline-offset:2px;}",
    ".launcher svg{width:24px;height:24px;}",
    ".backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);}",
    ".dialog{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:flex-end;padding:16px;pointer-events:none;}",
    ".panel{pointer-events:auto;width:min(380px,calc(100vw - 32px));max-height:min(640px,calc(100vh - 32px));overflow:auto;background:var(--sb-bg,#fff);color:var(--sb-fg,#0f172a);border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.28);padding:16px 16px 12px;}",
    "h2{margin:0;font-size:18px;font-weight:700;}",
    "header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;}",
    "form{display:grid;gap:10px;}",
    "label{display:grid;gap:6px;font-size:13px;font-weight:600;}",
    "input,select,textarea{font:inherit;color:inherit;background:var(--sb-input,#f8fafc);border:1px solid var(--sb-border,#dbe3ef);border-radius:10px;padding:10px 12px;width:100%;box-sizing:border-box;}",
    "input:focus,select:focus,textarea:focus{outline:2px solid var(--sb-accent,#6d28d9);border-color:transparent;}",
    "textarea{resize:vertical;min-height:96px;}",
    ".actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}",
    ".actions button,.icon-btn{font:inherit;border-radius:10px;padding:8px 12px;cursor:pointer;}",
    ".icon-btn{border:0;background:transparent;color:inherit;font-size:20px;line-height:1;padding:4px 8px;}",
    ".cancel{border:1px solid var(--sb-border,#dbe3ef);background:transparent;color:inherit;}",
    ".submit{border:0;background:var(--sb-accent,#6d28d9);color:#fff;font-weight:700;}",
    ".submit:disabled{opacity:.65;cursor:wait;}",
    ".status{min-height:1.2em;font-size:13px;font-weight:500;margin:0;}",
    ".status.error{color:#b91c1c;}",
    ".status.ok{color:#047857;}",
    ".hidden{display:none !important;}",
    ".wrap[data-theme=dark]{--sb-bg:#0b1220;--sb-fg:#e5eefc;--sb-input:#111827;--sb-border:#1f2a44;}",
    "@media (prefers-reduced-motion:reduce){.launcher{transition:none;}}",
  ].join("");

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i] || {};
      Object.keys(src).forEach(function (key) {
        if (src[key] && typeof src[key] === "object" && !Array.isArray(src[key])) {
          target[key] = assign(target[key] || {}, src[key]);
        } else if (src[key] !== undefined) {
          target[key] = src[key];
        }
      });
    }
    return target;
  }

  function onReady(fn) {
    if (typeof document === "undefined") return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function metadata() {
    return {
      url: typeof location !== "undefined" ? String(location.href) : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      viewport:
        typeof window !== "undefined"
          ? Math.round(window.innerWidth) + "x" + Math.round(window.innerHeight)
          : "",
      timestamp: new Date().toISOString(),
    };
  }

  function formatBody(payload) {
    var meta = payload.metadata || {};
    var lines = [
      payload.body || "_No description provided._",
      "",
      "---",
      "### Environment",
      "- **Page:** " + (meta.url || "n/a"),
      "- **Browser:** " + (meta.userAgent || "n/a"),
      "- **Viewport:** " + (meta.viewport || "n/a"),
      "- **When:** " + (meta.timestamp || new Date().toISOString()),
    ];
    if (payload.email) lines.push("- **Contact:** " + payload.email);
    lines.push("- **Type:** " + (payload.type || "support"));
    lines.push("");
    lines.push("_Submitted via Support Beacon_");
    return lines.join("\n");
  }

  function Beacon(options) {
    this.options = options;
    this.host = null;
    this.shadow = null;
    this.openState = false;
  }

  Beacon.prototype.mount = function () {
    var self = this;
    onReady(function () {
      if (self.host) return;
      self.host = document.createElement(HOST_TAG);
      self.shadow = self.host.attachShadow({ mode: "open" });
      self.shadow.innerHTML =
        "<style>" +
        CSS +
        "</style><div class=\"wrap " +
        self.options.position +
        "\"><button class=\"launcher\" type=\"button\" aria-haspopup=\"dialog\" aria-expanded=\"false\"></button></div><div class=\"backdrop hidden\"></div><div class=\"dialog hidden\" role=\"dialog\" aria-modal=\"true\"><div class=\"panel\"><header><h2></h2><button class=\"icon-btn close\" type=\"button\">×</button></header><form><label><span class=\"l-type\"></span><select name=\"type\"></select></label><label><span class=\"l-title\"></span><input name=\"title\" required maxlength=\"256\" /></label><label><span class=\"l-details\"></span><textarea name=\"body\" required maxlength=\"10000\" rows=\"5\"></textarea></label><label class=\"email-field\"><span class=\"l-email\"></span><input name=\"email\" type=\"email\" maxlength=\"256\" /></label><p class=\"status\" role=\"status\"></p><div class=\"actions\"><button class=\"cancel\" type=\"button\"></button><button class=\"submit\" type=\"submit\"></button></div></form></div></div>";
      document.body.appendChild(self.host);
      self.applyTheme();
      self.bind();
    });
  };

  Beacon.prototype.els = function () {
    var s = this.shadow;
    return {
      wrap: s.querySelector(".wrap"),
      launcher: s.querySelector(".launcher"),
      backdrop: s.querySelector(".backdrop"),
      dialog: s.querySelector(".dialog"),
      form: s.querySelector("form"),
      status: s.querySelector(".status"),
      title: s.querySelector("h2"),
      close: s.querySelector(".close"),
      cancel: s.querySelector(".cancel"),
      submit: s.querySelector(".submit"),
      type: s.querySelector('select[name="type"]'),
    };
  };

  Beacon.prototype.applyTheme = function () {
    var els = this.els();
    var theme = this.options.theme;
    if (theme === "auto" && typeof window !== "undefined" && window.matchMedia) {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    els.wrap.setAttribute("data-theme", theme);
    els.wrap.style.setProperty("--sb-accent", this.options.accent || "#6d28d9");
    this.shadow.querySelector(".panel").style.setProperty("--sb-accent", this.options.accent || "#6d28d9");
    els.launcher.innerHTML = ICON;
    els.launcher.setAttribute("aria-label", this.options.buttonLabel);
    els.launcher.classList.toggle("hidden", !!this.options.hideLauncher);
    els.title.textContent = this.options.title;
    this.shadow.querySelector(".l-type").textContent = this.options.strings.type;
    this.shadow.querySelector(".l-title").textContent = this.options.strings.titleField;
    this.shadow.querySelector(".l-details").textContent = this.options.strings.details;
    this.shadow.querySelector(".l-email").textContent = this.options.requireEmail
      ? "Email"
      : this.options.strings.email;
    els.cancel.textContent = this.options.strings.cancel;
    els.submit.textContent = this.options.strings.submit;
    this.shadow.querySelector(".close").setAttribute("aria-label", this.options.strings.close);
    this.shadow.querySelector('input[name="email"]').required = !!this.options.requireEmail;
    els.type.innerHTML = "";
    (this.options.types || []).forEach(function (type) {
      var opt = document.createElement("option");
      opt.value = type.value;
      opt.textContent = type.label;
      els.type.appendChild(opt);
    });
  };

  Beacon.prototype.bind = function () {
    var self = this;
    var els = this.els();
    els.launcher.addEventListener("click", function () {
      self.open();
    });
    els.backdrop.addEventListener("click", function () {
      self.close();
    });
    els.close.addEventListener("click", function () {
      self.close();
    });
    els.cancel.addEventListener("click", function () {
      self.close();
    });
    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      self.submit();
    });
    this.shadow.addEventListener("keydown", function (event) {
      if (event.key === "Escape") self.close();
    });
  };

  Beacon.prototype.open = function () {
    if (!this.shadow) return;
    var els = this.els();
    this.openState = true;
    els.backdrop.classList.remove("hidden");
    els.dialog.classList.remove("hidden");
    els.launcher.setAttribute("aria-expanded", "true");
    var title = this.shadow.querySelector('input[name="title"]');
    if (title) title.focus();
  };

  Beacon.prototype.close = function () {
    if (!this.shadow) return;
    var els = this.els();
    this.openState = false;
    els.backdrop.classList.add("hidden");
    els.dialog.classList.add("hidden");
    els.launcher.setAttribute("aria-expanded", "false");
  };

  Beacon.prototype.setStatus = function (message, kind) {
    var status = this.els().status;
    status.textContent = message || "";
    status.className = "status" + (kind ? " " + kind : "");
  };

  Beacon.prototype.payload = function () {
    var form = this.els().form;
    var data = new FormData(form);
    return {
      title: String(data.get("title") || "").trim(),
      body: String(data.get("body") || "").trim(),
      type: String(data.get("type") || "support"),
      email: String(data.get("email") || "").trim(),
      labels: this.options.labels || [],
      metadata: metadata(),
    };
  };

  Beacon.prototype.submit = function () {
    var self = this;
    var payload = this.payload();
    var els = this.els();
    if (!payload.title || !payload.body) {
      this.setStatus(this.options.strings.required, "error");
      return Promise.resolve();
    }
    els.submit.disabled = true;
    this.setStatus("");
    return send(this.options, payload)
      .then(function () {
        self.setStatus(self.options.strings.success, "ok");
        els.form.reset();
        setTimeout(function () {
          self.close();
          self.setStatus("");
        }, 1200);
      })
      .catch(function () {
        self.setStatus(self.options.strings.error, "error");
      })
      .then(function () {
        els.submit.disabled = false;
      });
  };

  Beacon.prototype.unmount = function () {
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
  };

  function githubUrl(options, payload) {
    var body = formatBody(payload);
    var labels = (payload.labels || []).concat(payload.type).filter(Boolean).join(",");
    var params = new URLSearchParams({
      title: payload.title.slice(0, 256),
      body: body.slice(0, 5000),
    });
    if (labels) params.set("labels", labels);
    return "https://github.com/" + options.owner + "/" + options.repo + "/issues/new?" + params.toString();
  }

  function send(options, payload) {
    var mode = options.mode || "github";
    if (mode === "github") {
      if (!options.owner || !options.repo) {
        return Promise.reject(new Error("owner and repo are required"));
      }
      window.open(githubUrl(options, payload), "_blank", "noopener");
      return Promise.resolve({ mode: "github" });
    }
    if (mode === "endpoint") {
      if (!options.endpoint) return Promise.reject(new Error("endpoint is required"));
      return fetch(options.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      }).then(function (response) {
        if (!response.ok) throw new Error("endpoint failed");
        return response.json().catch(function () {
          return { ok: true };
        });
      });
    }
    if (mode === "dispatch") {
      if (!options.owner || !options.repo || !options.token) {
        return Promise.reject(new Error("owner, repo, and token are required for dispatch"));
      }
      console.warn("Support Beacon: dispatch mode exposes a token to the browser. Prefer endpoint mode.");
      return fetch("https://api.github.com/repos/" + options.owner + "/" + options.repo + "/dispatches", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + options.token,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: options.eventType || "support-beacon",
          client_payload: payload,
        }),
      }).then(function (response) {
        if (!response.ok && response.status !== 204) throw new Error("dispatch failed");
        return { ok: true };
      });
    }
    return Promise.reject(new Error("Unknown mode"));
  }

  function init(options) {
    destroy();
    instance = new Beacon(assign({}, DEFAULTS, options || {}));
    instance.mount();
    return instance;
  }

  function destroy() {
    if (instance) {
      instance.unmount();
      instance = null;
    }
  }

  return {
    init: init,
    destroy: destroy,
    open: function () {
      if (instance) instance.open();
    },
    close: function () {
      if (instance) instance.close();
    },
    version: "1.0.0",
  };
});
