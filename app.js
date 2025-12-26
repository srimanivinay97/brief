/* script.js — Brief (robust)
   - Decodes ?data=BASE64 (supports URL-safe Base64)
   - Parses JSON
   - Fixes weird encoding (Â°C, â¯)
   - Fixes broken sleep like "${575.19}h ${11.55}m" -> "9h 35m"
   - Updates UI safely even if some elements are missing
*/

(() => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function setText(id, value) {
    const el = $(id);
    if (!el) return;
    el.textContent = value ?? "—";
  }

  function setVisible(id, visible) {
    const el = $(id);
    if (!el) return;
    el.style.display = visible ? "" : "none";
  }

  function cleanWeirdText(s) {
    // Fix iOS/Shortcut encoding artifacts seen in your debug:
    // - "4Â°C" -> "4°C"
    // - "7:04â¯am" -> "7:04 am"
    return String(s ?? "")
      .replace(/Â/g, "")
      .replace(/â¯/g, " ")
      .replace(/[\u00A0\u202F]/g, " ")
      .trim();
  }

  function decodeBase64UrlSafe(b64) {
    // handle URL encoding + urlsafe base64
    const normalized = decodeURIComponent(String(b64 || ""))
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    // pad to multiple of 4
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLen);

    // atob expects latin1; JSON is ASCII-safe here
    return atob(padded);
  }

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function extractFirstNumber(str) {
    const m = String(str ?? "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  function formatMinutesToHM(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  function normalizeSleep(sleepValue) {
    // If already good like "9h 35m"
    const raw = cleanWeirdText(sleepValue);
    if (/^\s*\d+\s*h\s*\d+\s*m\s*$/i.test(raw)) return raw;

    // Your payload currently sends: "${575.19}h ${11.55}m"
    // We will treat FIRST number as minutes (575.19 minutes)
    const minutes = extractFirstNumber(raw);
    return formatMinutesToHM(minutes);
  }

  function normalizeTemp(tempValue) {
    // Accept numbers or strings like "4°C" / "4Â°C"
    const raw = cleanWeirdText(tempValue);
    const n = extractFirstNumber(raw);
    return Number.isFinite(n) ? `${Math.round(n)}°C` : "—";
  }

  function normalizeSteps(stepsValue) {
    const n = extractFirstNumber(stepsValue);
    return Number.isFinite(n) ? String(Math.round(n)) : "—";
  }

  function normalizeHeartRate(hrValue) {
    const n = extractFirstNumber(hrValue);
    return Number.isFinite(n) ? String(Math.round(n)) : "—";
  }

  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  // ---------- UI wiring ----------
  function setStatusLoaded(loaded) {
    // OPTIONAL IDs (use whatever exists in your HTML)
    // statusPill: right-side pill "Loaded"
    // dataReceivedIcon: the ✅ icon / label
    const pill = $("statusPill");
    if (pill) {
      pill.textContent = loaded ? "Loaded" : "Waiting";
      pill.classList.toggle("ok", !!loaded);
    }

    const received = $("dataReceived");
    if (received) received.textContent = loaded ? "Data received ✅" : "No data";

    // Some builds use a single element for the icon:
    const icon = $("dataReceivedIcon");
    if (icon) icon.style.opacity = loaded ? "1" : "0.35";
  }

  function render(payload) {
    // Health
    setText("stepsValue", normalizeSteps(payload?.health?.steps));
    setText("sleepValue", normalizeSleep(payload?.health?.sleep));
    setText("heartRateValue", normalizeHeartRate(payload?.health?.heartRate));

    // Weather
    setText("tempValue", normalizeTemp(payload?.weather?.tempC));
    setText("feelsLikeValue", payload?.weather?.feelsLike ? `Feels like ${normalizeTemp(payload.weather.feelsLike)}` : "Feels like —");
    setText("conditionValue", payload?.weather?.condition ? cleanWeirdText(payload.weather.condition) : "Condition —");

    // Meta
    if (payload?.location) setText("locationValue", cleanWeirdText(payload.location));
    if (payload?.updatedAt) setText("updatedAtValue", cleanWeirdText(payload.updatedAt));
  }

  function showDebug(debugObj) {
    // OPTIONAL debug area IDs
    // debugSection: wrapper
    // debugPre: <pre> element
    const pre = $("debugPre");
    if (pre) pre.textContent = JSON.stringify(debugObj, null, 2);
    setVisible("debugSection", true);
  }

  function hideDebug() {
    setVisible("debugSection", false);
  }

  function wireDebugToggle(state) {
    const btn = $("debugToggle");
    if (!btn) return;

    btn.addEventListener("click", () => {
      state.debugVisible = !state.debugVisible;
      if (state.debugVisible) {
        showDebug(state.lastDebug || { ok: false, message: "No debug data yet." });
        btn.textContent = "Hide Debug";
      } else {
        hideDebug();
        btn.textContent = "Show Debug";
      }
    });
  }

  // ---------- main ----------
  document.addEventListener("DOMContentLoaded", () => {
    const state = { debugVisible: false, lastDebug: null };

    wireDebugToggle(state);
    hideDebug();
    setStatusLoaded(false);

    const dataParam = getQueryParam("data");
    const debug = {
      url: window.location.href,
      ok: false,
      b64Preview: dataParam ? String(dataParam).slice(0, 60) + "..." : "",
      decodedJsonPreview: "",
      payload: null,
      error: null,
    };

    if (!dataParam) {
      debug.error = "Missing ?data=BASE64 in URL";
      state.lastDebug = debug;
      // keep UI as —
      setStatusLoaded(false);
      return;
    }

    try {
      const decoded = decodeBase64UrlSafe(dataParam);
      debug.decodedJsonPreview = decoded.slice(0, 200) + (decoded.length > 200 ? "..." : "");

      const payload = safeJsonParse(decoded);
      if (!payload || typeof payload !== "object") {
        debug.error = "Decoded Base64 but JSON parse failed.";
        state.lastDebug = debug;
        setStatusLoaded(false);
        return;
      }

      debug.ok = true;
      debug.payload = payload;
      state.lastDebug = debug;

      // render
      setStatusLoaded(true);
      render(payload);

      // if debug is already visible, refresh it
      if (state.debugVisible) showDebug(debug);
    } catch (e) {
      debug.error = String(e?.message || e);
      state.lastDebug = debug;
      setStatusLoaded(false);
    }
  });
})();
