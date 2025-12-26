/* =========================
   Brief UI (simple + clean)
   Reads base64 JSON from:
   ?data=<base64>
   ========================= */

function $(id){ return document.getElementById(id); }

function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round1(n){
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function pad2(n){ return String(n).padStart(2, "0"); }

function formatTimeHHMM(d){
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateLine(d){
  // e.g., Friday 26 Dec
  const w = d.toLocaleDateString(undefined, { weekday: "long" });
  const day = d.toLocaleDateString(undefined, { day: "2-digit" });
  const mon = d.toLocaleDateString(undefined, { month: "short" });
  return `${w} ${day} ${mon}`;
}

function greetingAndMode(hours){
  // Fix: no "Good morning" at 20:00 🙂
  if (hours >= 5 && hours < 12) return { greet: "Good morning", mode: "Morning brief" };
  if (hours >= 12 && hours < 17) return { greet: "Good afternoon", mode: "Midday brief" };
  if (hours >= 17 && hours < 22) return { greet: "Good evening", mode: "Evening brief" };
  return { greet: "Good night", mode: "Night brief" };
}

function decodeDataParam(){
  const params = new URLSearchParams(location.search);
  const b64 = params.get("data");
  if (!b64) return null;

  try{
    // base64 can be URL-safe; fix chars
    const fixed = b64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = decodeURIComponent(escape(atob(fixed)));
    return JSON.parse(jsonStr);
  }catch(e){
    console.error("Decode error:", e);
    return null;
  }
}

/* Sleep parsing:
   Accepts:
   - sleep.start, sleep.end (ISO or readable)
   - sleep.durationMinutes
   - sleep.duration like "7h 15m" or "575.19h 11.55m" (we'll try)
*/
function parseSleepDurationMinutes(sleep){
  if (!sleep) return null;

  const dm = safeNum(sleep.durationMinutes);
  if (dm != null) return Math.max(0, Math.round(dm));

  // If start/end exist, compute diff
  if (sleep.start && sleep.end){
    const a = new Date(sleep.start);
    const b = new Date(sleep.end);
    if (!isNaN(a) && !isNaN(b)){
      const diffMin = Math.round((b - a) / 60000);
      if (Number.isFinite(diffMin)) return diffMin >= 0 ? diffMin : null;
    }
  }

  // Try parsing a duration string
  const s = (sleep.duration || "").toString().trim();
  if (s){
    // common: "7h 15m"
    const mh = s.match(/(\d+(\.\d+)?)\s*h/i);
    const mm = s.match(/(\d+(\.\d+)?)\s*m/i);
    let mins = 0;
    if (mh){
      const h = safeNum(mh[1]);
      if (h != null) mins += Math.round(h * 60);
    }
    if (mm){
      const m = safeNum(mm[1]);
      if (m != null) mins += Math.round(m);
    }
    if (mins > 0) return mins;
  }

  return null;
}

function formatDuration(mins){
  if (!Number.isFinite(mins) || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* Steps helpers (if you don't provide distance/calories/minutes) */
function estimateDistanceKm(steps){
  // rough average: 0.75m stride => 1 step ~0.00075 km
  if (!Number.isFinite(steps) || steps <= 0) return null;
  return steps * 0.00075;
}

function estimateCalories(steps){
  // rough walking estimate, varies a lot; keep simple
  if (!Number.isFinite(steps) || steps <= 0) return null;
  return Math.round(steps * 0.04); // ~40 kcal per 1000 steps
}

function estimateActiveMinutes(steps){
  if (!Number.isFinite(steps) || steps <= 0) return null;
  // ~100 steps/min easy walk
  return Math.max(1, Math.round(steps / 100));
}

/* Events */
function parseEvents(data){
  // accept: data.events (array) or data.calendar.events
  const arr = data?.events || data?.calendar?.events || [];
  return Array.isArray(arr) ? arr : [];
}

function parseNews(data){
  // accept: data.news (array)
  const arr = data?.news || [];
  return Array.isArray(arr) ? arr : [];
}

function toTimeLabel(v){
  // supports "09:30" or ISO date
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d)) return formatTimeHHMM(d);
  return s;
}

/* ============= RENDER ============= */

function setText(id, val){
  const el = $(id);
  if (!el) return;
  el.textContent = (val === null || val === undefined || val === "") ? "—" : String(val);
}

function render(data){
  const now = new Date();
  const gm = greetingAndMode(now.getHours());

  setText("greeting", gm.greet);
  setText("briefMode", gm.mode);
  setText("dateLine", formatDateLine(now));
  setText("timeNow", formatTimeHHMM(now));

  // updatedAt from data if present
  setText("updatedAt", data?.updatedAt ? `Updated: ${data.updatedAt}` : "");

  /* WEATHER (rounded + clean) */
  const w = data?.weather || {};
  const loc = data?.location || w.location || "Now";
  setText("weatherLocation", loc);

  const tempC = round1(safeNum(w.tempC ?? data?.current_temperature_c));
  const feels = round1(safeNum(w.feelsLike ?? w.feelsLikeC ?? data?.feels_like_c));

  // allow both schemas
  const condNow = w.condition ?? w.summary ?? data?.tonight_summary ?? "—";
  setText("tempNow", tempC ?? "—");
  setText("tempFeels", feels != null ? `${feels}°C` : "—");
  setText("condNow", condNow || "—");

  // Tonight fields (condition separate from rain)
  const tonightSummary = w.tonight?.summary ?? w.tonightSummary ?? data?.tonight_summary;
  const tonightRain = safeNum(w.tonight?.chance_of_rain_percent ?? w.tonightRainPercent ?? data?.tonight_rain_percent);
  const tonightWind = round1(safeNum(w.tonight?.wind_speed_mph ?? w.tonightWindMph ?? data?.tonight_wind_mph));

  setText("tonightSummary", tonightSummary || "—");
  setText("tonightRain", tonightRain != null ? Math.round(tonightRain) : "—");
  setText("tonightWind", tonightWind ?? "—");

  /* STEPS */
  const steps = safeNum(data?.health?.steps ?? data?.steps_today ?? data?.stepsToday);
  setText("stepsToday", steps != null ? Math.round(steps) : "—");

  const distKm = safeNum(data?.health?.distanceKm ?? data?.distanceKm) ?? (steps != null ? estimateDistanceKm(steps) : null);
  const cals = safeNum(data?.health?.calories ?? data?.calories) ?? (steps != null ? estimateCalories(steps) : null);
  const mins = safeNum(data?.health?.activeMinutes ?? data?.activeMinutes) ?? (steps != null ? estimateActiveMinutes(steps) : null);

  setText("stepsDistance", distKm != null ? `${round1(distKm)} km` : "—");
  setText("stepsCalories", cals != null ? `${Math.round(cals)} kcal` : "—");
  setText("stepsMinutes", mins != null ? `${Math.round(mins)} min` : "—");

  /* HEART RATE */
  const hr = safeNum(data?.health?.heartRate ?? data?.heartRate ?? data?.heart_rate);
  setText("hrValue", hr != null ? Math.round(hr) : "—");
  setText("hrNote", hr != null ? "Latest reading" : "No heart rate data");

  /* SLEEP */
  const sleep = data?.health?.sleepObj ?? data?.sleep ?? { duration: data?.health?.sleep };
  const sleepMins = parseSleepDurationMinutes(sleep);
  setText("sleepDuration", sleepMins != null ? formatDuration(sleepMins) : "—");

  setText("sleepQuality", sleep?.quality ?? data?.sleepQuality ?? "—");
  setText("sleepNotes", sleep?.notes ?? data?.sleepNotes ?? "—");

  const sStart = sleep?.start ? toTimeLabel(sleep.start) : null;
  const sEnd = sleep?.end ? toTimeLabel(sleep.end) : null;
  setText("sleepWindow", (sStart && sEnd) ? `${sStart} → ${sEnd}` : "—");

  /* EVENTS */
  const events = parseEvents(data);
  const eventsList = $("eventsList");
  eventsList.innerHTML = "";

  if (!events.length){
    setText("firstMeeting", "No events today");
  } else {
    // Sort by start time if possible
    const sorted = [...events].sort((a,b)=>{
      const ta = new Date(a.start || a.time || 0).getTime();
      const tb = new Date(b.start || b.time || 0).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
      return 0;
    });

    const first = sorted[0];
    const firstTime = toTimeLabel(first.start || first.time);
    const firstTitle = first.title || first.summary || "Meeting";
    setText("firstMeeting", firstTime ? `First meeting: ${firstTime} • ${firstTitle}` : `First meeting: ${firstTitle}`);

    for (const ev of sorted.slice(0,5)){
      const title = ev.title || ev.summary || "Event";
      const time = toTimeLabel(ev.start || ev.time) || "—";
      const loc2 = ev.location ? ` • ${ev.location}` : "";
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="itemTitle">${escapeHtml(title)}</div>
        <div class="itemMeta">${escapeHtml(time)}${escapeHtml(loc2)}</div>
      `;
      eventsList.appendChild(item);
    }
  }

  /* NEWS */
  const news = parseNews(data);
  const newsList = $("newsList");
  newsList.innerHTML = "";
  if (!news.length){
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `<div class="itemTitle">No news provided</div><div class="itemMeta">—</div>`;
    newsList.appendChild(item);
  } else {
    for (const n of news.slice(0,5)){
      const title = n.title || n.headline || "News";
      const source = n.source ? ` • ${n.source}` : "";
      const when = n.time ? ` • ${toTimeLabel(n.time)}` : "";
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="itemTitle">${escapeHtml(title)}</div>
        <div class="itemMeta">${escapeHtml((source + when).trim() || "—")}</div>
      `;
      newsList.appendChild(item);
    }
  }

  /* BRIEF (AI vibe, but ONLY uses provided data, no extra “suggestions”) */
  const lines = [];

  // Weather sentence
  if (tempC != null || condNow){
    const wLine = [
      "Weather:",
      tempC != null ? `${tempC}°C` : null,
      condNow ? condNow : null,
      feels != null ? `(feels like ${feels}°C)` : null
    ].filter(Boolean).join(" ");
    lines.push(wLine + ".");
  }

  // Steps + HR
  if (steps != null){
    const parts = [`Steps: ${Math.round(steps)}`];
    if (distKm != null) parts.push(`${round1(distKm)} km`);
    if (cals != null) parts.push(`${Math.round(cals)} kcal`);
    lines.push(parts.join(" • ") + ".");
  }
  if (hr != null){
    lines.push(`Heart rate: ${Math.round(hr)} bpm.`);
  }

  // Sleep
  if (sleepMins != null){
    lines.push(`Sleep: ${formatDuration(sleepMins)}.`);
  } else {
    lines.push("Sleep: no data.");
  }

  // First meeting
  if (events.length){
    const first = events[0];
    const firstTime = toTimeLabel(first.start || first.time);
    const firstTitle = first.title || first.summary || "Meeting";
    lines.push(firstTime ? `First meeting: ${firstTime} • ${firstTitle}.` : `First meeting: ${firstTitle}.`);
  } else {
    lines.push("Events: none today.");
  }

  // News highlight
  if (news.length){
    const top = news[0];
    lines.push(`Top news: ${top.title || top.headline || "—"}.`);
  } else {
    lines.push("News: none provided.");
  }

  setText("briefText", lines.join("\n"));
}

/* Avoid XSS in titles */
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* Boot */
(function init(){
  const data = decodeDataParam() || {};

  // If your old payload is "Debug { url, ok, b64Preview }" etc,
  // you can still pass a proper JSON base64 as ?data=
  render(data);
})();
