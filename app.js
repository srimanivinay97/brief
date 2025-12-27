(function () {
  const CACHE_KEY = "brief:lastData";

  const qs = new URLSearchParams(window.location.search);
  const dataParam = qs.get("data");

  function base64UrlToBase64(b64url) {
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    return b64;
  }

  function decodeData(b64url) {
    const json = atob(base64UrlToBase64(b64url));
    return JSON.parse(json);
  }

  function showError(msg) {
    document.body.innerHTML = `
      <div style="
        margin:20px;
        padding:16px;
        border-radius:14px;
        background:#2a0f14;
        color:#ffd7dc;
        font-family:-apple-system;
      ">
        <strong>Brief unavailable</strong><br/>
        ${msg}
      </div>
    `;
  }

  try {
    if (dataParam) {
      const data = decodeData(dataParam);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      renderBrief(data);
      return;
    }

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      renderBrief(JSON.parse(cached));
      return;
    }

    showError("No brief data received yet. Run the Shortcut again.");

  } catch (e) {
    console.error(e);
    showError("Data was corrupted. Please run the Shortcut again.");
  }
})();
