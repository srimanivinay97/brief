/* =========================
   Brief — Missing Data Fix
   ========================= */

(function () {
  const LAST_KEY = "brief:lastData";

  // --- Helpers ---
  const qs = new URLSearchParams(window.location.search);
  const dataParam = qs.get("data");

  function base64UrlToBase64(b64url) {
    // base64url -> base64
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    // pad
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    return b64;
  }

  function safeJsonParse(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  function decodeBriefData(b64url) {
    try {
      const b64 = base64UrlToBase64(b64url);
      // atob expects latin1; JSON is typically ascii/utf-8 — this is fine for your data
      const jsonText = atob(b64);
      const obj = safeJsonParse(jsonText);
      return obj;
    } catch (e) {
      return null;
    }
  }

  function setRoot(html) {
    const root = document.getElementById("app") || document.body;
    root.innerHTML = html;
  }

  function renderEmptyState(reasonText) {
    setRoot(`
      <div style="max-width:720px;margin:28px auto;padding:0 16px;font-family: ui-sans-serif, -apple-system, system-ui;">
        <div style="font-size:44px;font-weight:800;letter-spacing:-0.02em;margin-bottom:10px;">Brief</div>

        <div style="border-radius:18px;padding:18px 16px;background:#f6f7f9;border:1px solid #e7e9ee;">
          <div style="font-size:18px;font-weight:700;margin-bottom:6px;">No brief data yet</div>
          <div style="opacity:.85;line-height:1.45;margin-bottom:10px;">
            ${reasonText || "Open this page using your Shortcut so it can pass data."}
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
            <button id="copySample" style="border:0;border-radius:12px;padding:10px 12px;font-weight:700;background:#111;color:#fff;">
              Copy sample test URL
            </button>
            <button id="showHelp" style="border:1px solid #d7dbe3;border-radius:12px;padding:10px 12px;font-weight:700;background:#fff;">
              Show Shortcut tip
            </button>
          </div>

          <div id="helpBox" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid #e3e6ed;opacity:.92;">
            <div style="font-weight:700;margin-bottom:6px;">Shortcut URL must be:</div>
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:13px; background:#fff; border:1px solid #e7e9ee; padding:10px; border-radius:12px; overflow:auto;">
              https://srimanivinay97.github.io/brief/?data=BASE64URL_JSON
            </div>
          </div>
        </div>

        <div style="margin-top:12px;opacity:.7;font-size:13px;">
          Updated: —
        </div>
      </div>
    `);

    // sample data: {"meta":{"date":"2025-12-27","greeting":"Good morning"}}
    const sampleB64Url = "eyJtZXRhIjp7ImRhdGUiOiIyMDI1LTEyLTI3IiwiZ3JlZXRpbmciOiJHb29kIG1vcm5pbmcifX0"
    const sampleUrl = `${location.origin}${location.pathname}?data=${sampleB64Url}`;

    const copyBtn = document.getElementById("copySample");
    copyBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(sampleUrl);
        copyBtn.textContent = "Copied ✅";
        setTimeout(() => (copyBtn.textContent = "Copy sample test URL"), 1200);
      } catch {
        alert("Copy failed. Here is the sample URL:\n\n" + sampleUrl);
      }
    });

    document.getElementById("showHelp")?.addEventListener("click", () => {
      const box = document.getElementById("helpBox");
      if (!box) return;
      box.style.display = box.style.display === "none" ? "block" : "none";
    });
  }

  // --- Your existing render function ---
  // Replace this with your real renderer if you already have one.
  function renderBrief(data) {
    // Minimal safe render so the page never breaks.
    const greeting = data?.meta?.greeting || "Hello";
    const date = data?.meta?.date || "—";

    setRoot(`
      <div style="max-width:720px;margin:28px auto;padding:0 16px;font-family: ui-sans-serif, -apple-system, system-ui;">
        <div style="font-size:44px;font-weight:800;letter-spacing:-0.02em;margin-bottom:10px;">Brief</div>

        <div style="border-radius:18px;padding:18px 16px;background:#f6f7f9;border:1px solid #e7e9ee;">
          <div style="font-size:20px;font-weight:800;margin-bottom:8px;">${escapeHtml(greeting)}</div>
          <div style="opacity:.8;">Date: ${escapeHtml(date)}</div>
          <div style="margin-top:12px;opacity:.85;line-height:1.45;">
            Data received ✅
          </div>
        </div>

        <div style="margin-top:12px;opacity:.7;font-size:13px;">
          Updated: ${escapeHtml(data?.meta?.updated_at_local || data?.meta?.updatedAt || "—")}
        </div>
      </div>
    `);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --- Main flow ---
  // 1) If missing ?data=, try localStorage lastData
  if (!dataParam) {
    const last = localStorage.getItem(LAST_KEY);
    if (last) {
      const obj = safeJsonParse(last);
      if (obj) {
        renderBrief(obj);
        return;
      }
    }
    renderEmptyState("Open this page using your Shortcut so it can pass today’s brief data.");
    return;
  }

  // 2) If data exists, decode & parse
  const parsed = decodeBriefData(dataParam);
  if (!parsed) {
    // if decode fails, show UI instead of ugly error
    renderEmptyState("I got a data parameter, but it wasn’t valid Base64URL JSON.");
    return;
  }

  // 3) Save + render
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(parsed));
  } catch (e) {
    // ignore storage issues
  }
  renderBrief(parsed);
})();
