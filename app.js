const el = (id) => document.getElementById(id);

function setStatus(text, ok = false) {
  el("sub").textContent = text;
  el("statusPill").textContent = ok ? "Loaded" : "Waiting";
  el("statusPill").className = ok ? "pill pillOk" : "pill";
}

function parsePayloadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let b64 = params.get("data");

  if (!b64) {
    return { ok: false, error: "Missing ?data= parameter." };
  }

  // Very common issue: '+' becomes space somewhere → atob fails.
  b64 = b64.replace(/ /g, "+").trim();

  try {
    const jsonStr = atob(b64);
    const obj = JSON.parse(jsonStr);
    return { ok: true, obj, jsonStr, b64 };
  } catch (e) {
    return { ok: false, error: String(e), b64 };
  }
}

function render(data) {
  // Weather
  const w = data.weather || {};
  el("wTemp").textContent = (w.tempC ?? "—") + (w.tempC != null ? "°" : "");
  el("wCond").textContent = w.condition ?? "—";
  el("wFeels").textContent = (w.feelsLike ?? "—") + (w.feelsLike != null ? "°" : "");

  // Health
  const h = data.health || {};
  el("hSteps").textContent = h.steps ?? "—";
  
  function formatSleep(minutes) {
  if (!minutes || minutes <= 0) return "—";

  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

  el("hSleep").textContent = h.sleep ?? "—";
  el("hHr").textContent = h.heartRate != null ? `${h.heartRate} bpm` : "—";
}

function main() {
  const result = parsePayloadFromUrl();

  const debugObj = {
    url: window.location.href,
    ok: result.ok,
    error: result.error,
    b64Preview: result.b64 ? result.b64.slice(0, 60) + "..." : null,
    decodedJsonPreview: result.jsonStr ? result.jsonStr.slice(0, 200) + "..." : null,
    payload: result.ok ? result.obj : null
  };

  el("debugText").textContent = JSON.stringify(debugObj, null, 2);

  el("btnDebug").addEventListener("click", () => {
    el("debug").classList.toggle("hidden");
  });

  if (!result.ok) {
    setStatus("Waiting for data… (Open with ?data=BASE64)", false);
    return;
  }

  setStatus("Data received ✅", true);
  render(result.obj);
}

main();
