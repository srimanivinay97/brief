/* =========================
   Brief — Robust Data Decode (Base64 + Base64URL)
   Fixes:
   - Accepts BOTH Base64 and Base64URL
   - Handles Safari/URLSearchParams "+" -> " " issue
   - Repairs missing padding "="
   - Strips whitespace/newlines safely
   ========================= */

(function () {
  const LAST_KEY = "brief:lastData";

  // --- Helpers ---
  const qs = new URLSearchParams(window.location.search);
  const dataParam = qs.get("data");

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  // Convert ANY of:
  // - base64url ( - _ no padding )
  // - base64 ( + / with/without padding )
  // - base64 where "+" became " " (Safari/query decoding quirk)
  // into clean Base64 for atob()
  function normalizeToBase64(input) {
    let s = String(input || "").trim();

    // Remove all whitespace/newlines that can break atob
    s = s.replace(/\s+/g, "");

    // Defensive: if any spaces remain (rare), convert to "+"
    // (Sometimes '+' can be interpreted as space by query decoders)
    s = s.replace(/ /g, "+");

    // Convert base64url -> base64
    s = s.replace(/-/g, "+").replace(/_/g, "/");

    // Pad to multiple of 4
    const pad = s.length % 4;
    if (pad) s += "=".repeat(4 - pad);

    return s;
  }

  function decodeBriefData(encoded) {
    try {
      const b64 = normalizeToBase64(encoded);

      // atob expects latin1; your JSON is ASCII-safe (numbers/letters/symbols)
      const jsonText = atob(b64);

      // Optional safety: trim BOM/whitespace
      const cleaned = jsonText.replace(/^\uFEFF/, "").trim();

      return safeJsonParse(cleaned);
    } catch {
      return null;
    }
  }

  function setRoot(html) {
    const root = document.getElementById("app") || document.body;
    root.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
              https://srimanivinay97.github.io/brief/?data=BASE64_OR_BASE64URL_JSON
            </div>
            <div style="margin-top:10px;font-size:13px;opacity:.85;line-height:1.45;">
              Tip: If your Shortcut uses Base64 + URL Encode, this page will decode it correctly.
            </div>
          </div>
        </div>

        <div style="margin-top:12px;opacity:.7;font-size:13px;">
          Updated: —
        </div>
      </div>
    `);

    // sample data: {"meta":{"date":"2025-12-27","greeting":"Good morning"}}
    // This is already base64url-safe (no + / =)
    const sampleB64Url =
      "eyJtZXRhIjp7ImRhdGUiOiIyMDI1LTEyLTI3IiwiZ3JlZXRpbmciOiJHb29kIG1vcm5pbmcifX0";
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
    const greeting = data?.meta?.greeting || "Hello";
    const date = data?.meta?.date || "—";

    setRoot(`
      <div style="max-width:720px;margin:28px auto;padding:0 16px;font-family: ui-sans-serif, -apple-system, system-ui;">
        <div style="font-size:44px;font-weight:800;letter-spacing:-0.02em;margin-bottom:10px;">Brief</div>

        <div style="border-radius:18px;padding:18px 16px;background:#f6f7f9;border:1px solid #e7e9ee;">
          <div style="font-size:20px;font-weight:800;margin-bottom:8px;">${escapeHtml(
            greeting
          )}</div>
          <div style="opacity:.8;">Date: ${escapeHtml(date)}</div>
          <div style="margin-top:12px;opacity:.85;line-height:1.45;">
            Data received ✅
          </div>
        </div>

        <div style="margin-top:12px;opacity:.7;font-size:13px;">
          Updated: ${escapeHtml(
            data?.meta?.updated_at_local || data?.meta?.updatedAt || "—"
          )}
        </div>
      </div>
    `);
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
    renderEmptyState(
      "Open this page using your Shortcut so it can pass today’s brief data."
    );
    return;
  }

  // 2) If data exists, decode & parse
  const parsed = decodeBriefData(dataParam);
  if (!parsed) {
    renderEmptyState(
      "I got a data parameter, but it couldn’t be decoded into JSON (Base64/Base64URL)."
    );
    return;
  }

  // 3) Save + render
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage issues
  }

  renderBrief(parsed);
})();
