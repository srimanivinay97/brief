<script>
(() => {
  const LAST_KEY = "brief:lastData";
  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get("data");

  const $status = document.querySelector(".status");
  const $updated = document.querySelector(".updated");

  function base64UrlToBase64(str) {
    let s = str.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return s;
  }

  function tryParseJSON(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  function decodeData(input) {
    if (!input) return null;

    // 1️⃣ Raw JSON
    if (input.trim().startsWith("{")) {
      return tryParseJSON(input);
    }

    // 2️⃣ Base64URL → Base64
    try {
      const b64 = base64UrlToBase64(input);
      const text = decodeURIComponent(
        atob(b64)
          .split("")
          .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join("")
      );
      return tryParseJSON(text);
    } catch {
      return null;
    }
  }

  function render(data) {
    document.querySelector(".status-title").textContent = "Brief";
    document.querySelector(".status-text").textContent =
      "Your brief loaded successfully.";
    $updated.textContent = "Updated: " + (data.meta?.updated_at_local || "—");
  }

  // ---- MAIN ----
  let decoded = decodeData(dataParam);

  if (!decoded) {
    const cached = localStorage.getItem(LAST_KEY);
    if (cached) {
      decoded = tryParseJSON(cached);
    }
  }

  if (decoded) {
    localStorage.setItem(LAST_KEY, JSON.stringify(decoded));
    render(decoded);
  } else {
    // Keep your existing error UI
    console.warn("Brief: No valid data received");
  }
})();
</script>
