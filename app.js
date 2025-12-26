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
  const w = d.toLocaleDateString(undefined, { weekday: "long" });
  const day = d.toLocaleDateString(undefined, { day: "2-digit" });
  const mon = d.toLocaleDateString(undefined, { month: "short" });
  return `${w} ${day} ${mon}`;
}

function greetingAndMode(hours){
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
    // URL-safe base64 fix
    const fixed = b64.replace(/-/g, "+").replace(/_/g, "/");

    // Decode
    const jsonStr = decodeURIComponent(escape(atob(fixed)));
    return JSON.parse(jsonStr);
  }catch(e){
    console.error("Decode error:", e);
    return null;
  }
}

/* Sleep parsing supports:
   - sleep.start, sleep.end (ISO)
   - sleep.durationMinutes (number)
   - sleep.duration string like "7h 15m"
*/
function parseSleepDurationMinutes(sleep){
  if (!sleep) return null;

  const dm = safeNum(sleep.durationMinutes);
  if (dm != null) return Math.max(0, Math.round(dm));

  // start/end
  if (sleep.start && sleep.end){
    const a = new Date(sleep.start);
    const b = new Date(sleep.end);
    if (!isNaN(a) && !isNaN(b)){
      const diffMin = Math.round((b - a) / 60000);
      if (Number.isFinite(diffMin)) return diffMin >= 0 ? diffMin : null;
    }
  }

  // duration string
  const s = (sleep.duration || "").toString().trim();
  if (s){
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

/* Steps estimates if not provided */
function estimateDistanceKm(steps){
  if (!Number.isFinite(steps) || steps <= 0) return null;
  return steps * 0.00075; // rough average
}

function estimateCalories(steps){
  if (!Number.isFinite(steps) || steps <= 0) return null;
  return Math.round(steps * 0.04); // rough
}

function estimateActiveMinutes(steps){
  if (!Number.isFinite(steps) || steps <= 0) return null;
  return Math.max(1, Math.round(steps / 100));
}

/* Events + News */
function parseEvents(data){
  const arr = data?.events || data?.calendar?.events || [];
  return Array.isArray(arr) ? arr : [];
}

function parseNews(data){
  const arr = data?.news || [];
  return Array.isArray(arr) ? arr : [];
}

function toTimeLabel(v){
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (!isNaN(d)) return formatTimeHHMM(d);

  return s;
}

function setText(id, val){
  const el = $(id);
  if (!el) return;
  el.textContent = (val === null || val === undefined || val === "") ? "—" : String(val);
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

function render(data){
  const now = new Date();
  const gm = greetingAndMode(now.getHours());

  setText("greeting", gm.greet);
  setText("briefMode", gm.mode);
  setText("dateLine", formatDateLine(now));
  setText("timeNow", formatTimeHHMM(now));
  setText("updatedAt", data?.updatedAt ? `Updated: ${data.updatedAt}` : "");

  /* WEATHER */
  const w = data?.weather || {};
  const loc = data?.location || w.location || "Now";
  setText("weatherLocation", loc);

  const tempC = round1(safeNum(w.tempC));
  const feels = round1(safeNum(w.feelsLike));
  const condNow = w.condition || "—";

  setText("tempNow", tempC ?? "—");
  setText("tempFeels", feels != null ? `${feels}°C` : "—");
  setText("condNow", condNow || "—");

  const tonightSummary = w?.tonight?.summary ?? null;
  const tonightRain = safeNum(w?.tonight?.rainChancePercent);
  const tonightWind = round1(safeNum(w?.tonight?.windMph));

  setText("tonightSummary", tonightSummary || "—");
  setText("tonightRain", tonightRain != null ? Math.round(tonightRain) : "—");
  setText("tonightWind", tonightWind ?? "—");

  // Tomorrow (optional)
  const tmr = w?.tomorrow || {};
  const tomorrowDate = tmr.date || null;
  const tomorrowMin = round1(safeNum(tmr.minC));
  const tomorrowMax = round1(safeNum(tmr.maxC));
  const tomorrowSummary = tmr.summary || null;

  /* STEPS */
  const steps = safeNum(data?.health?.steps);
  setText("stepsToday", steps != null ? Math.round(steps) : "—");

  const distKm =
    safeNum(data?.health?.distanceKm) ??
    (steps != null ? estimateDistanceKm(steps) : null);

  const cals =
    safeNum(data?.health?.caloriesKcal) ??
    (steps != null ? estimateCalories(steps) : null);

  const mins =
    safeNum(data?.health?.activeMinutes) ??
    (steps != null ? estimateActiveMinutes(steps) : null);

  setText("stepsDistance", distKm != null ? `${round1(distKm)} km` : "—");
  setText("stepsCalories", cals != null ? `${Math.round(cals)} kcal` : "—");
  setText("stepsMinutes", mins != null ? `${Math.round(mins)} min` : "—");

  /* HEART RATE */
  const hr = safeNum(data?.health?.heartRateBpm);
  setText("hrValue", hr != null ? Math.round(hr) : "—");
  setText("hrNote", hr != null ? "Latest reading" : "No heart rate data");

  /* SLEEP */
  const sleep = data?.sleep || null;
  const sleepMins = parseSleepDurationMinutes(sleep);
  setText("sleepDuration", sleepMins != null ? formatDuration(sleepMins) : "—");
  setText("sleepQuality", sleep?.quality ?? "—");
  setText("sleepNotes", sleep?.notes ?? "—");

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
    const sorted = [...events].sort((a,b)=>{
      // Prefer ISO datetime; HH:MM sorts as string fallback later
      const da = new Date(a.start || a.time || 0);
      const db = new Date(b.start || b.time || 0);
      const ta = isNaN(da) ? null : da.getTime();
      const tb = isNaN(db) ? null : db.getTime();
      if (ta != null && tb != null) return ta - tb;

      const sa = String(a.start || a.time || "");
      const sb = String(b.start || b.time || "");
      return sa.localeCompare(sb);
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

  /* BRIEF (Morning vs Evening, ONLY uses provided data) */
  const lines = [];
  const h = now.getHours();
  const isMorning = (h >= 5 && h < 12);
  const isEvening = (h >= 17 && h < 22);

  // Weather now (always)
  if (tempC != null || condNow){
    const parts = [];
    if (tempC != null) parts.push(`${tempC}°C`);
    if (condNow) parts.push(condNow);
    if (feels != null) parts.push(`(feels like ${feels}°C)`);
    lines.push(`Weather now: ${parts.filter(Boolean).join(" ")}.`);
  }

  if (isMorning){
    // Sleep first
    if (sleepMins != null) lines.push(`Sleep: ${formatDuration(sleepMins)}.`);
    else lines.push("Sleep: no data.");

    // Steps + HR
    if (steps != null){
      const parts = [`Steps: ${Math.round(steps)}`];
      if (distKm != null) parts.push(`${round1(distKm)} km`);
      if (cals != null) parts.push(`${Math.round(cals)} kcal`);
      lines.push(parts.join(" • ") + ".");
    } else {
      lines.push("Steps: no data.");
    }

    if (hr != null) lines.push(`Heart rate: ${Math.round(hr)} bpm.`);

    // First meeting
    if (events.length){
      const sorted = [...events].sort((a,b)=>{
        const sa = String(a.start || a.time || "");
        const sb = String(b.start || b.time || "");
        return sa.localeCompare(sb);
      });
      const first = sorted[0];
      const firstTime = toTimeLabel(first.start || first.time);
      const firstTitle = first.title || first.summary || "Meeting";
      lines.push(firstTime ? `First meeting: ${firstTime} • ${firstTitle}.` : `First meeting: ${firstTitle}.`);
    } else {
      lines.push("Events: none today.");
    }

    // Tomorrow outlook
    if (tomorrowMin != null || tomorrowMax != null || tomorrowSummary){
      const range =
        (tomorrowMin != null && tomorrowMax != null) ? `${tomorrowMin}–${tomorrowMax}°C` :
        (tomorrowMin != null) ? `min ${tomorrowMin}°C` :
        (tomorrowMax != null) ? `max ${tomorrowMax}°C` : null;

      const tParts = [];
      if (tomorrowDate) tParts.push(`${tomorrowDate}`);
      if (range) tParts.push(range);
      if (tomorrowSummary) tParts.push(tomorrowSummary);

      lines.push(`Tomorrow: ${tParts.join(" • ")}.`);
    }

    // Top news
    if (news.length){
      const top = news[0];
      lines.push(`Top news: ${top.title || top.headline || "—"}.`);
    } else {
      lines.push("News: none provided.");
    }
  }
  else if (isEvening){
    // Tonight focus
    if (tonightSummary || tonightRain != null || tonightWind != null){
      const tParts = [];
      if (tonightSummary) tParts.push(tonightSummary);
      if (tonightRain != null) tParts.push(`${Math.round(tonightRain)}% rain`);
      if (tonightWind != null) tParts.push(`${tonightWind} mph wind`);
      lines.push(`Tonight: ${tParts.join(" • ")}.`);
    }

    // Steps so far + HR
    if (steps != null){
      const parts = [`Steps so far: ${Math.round(steps)}`];
      if (distKm != null) parts.push(`${round1(distKm)} km`);
      if (cals != null) parts.push(`${Math.round(cals)} kcal`);
      if (mins != null) parts.push(`${Math.round(mins)} min active`);
      lines.push(parts.join(" • ") + ".");
    } else {
      lines.push("Steps: no data.");
    }

    if (hr != null) lines.push(`Heart rate: ${Math.round(hr)} bpm.`);

    // Next event (best effort)
    if (events.length){
      const sorted = [...events].sort((a,b)=>{
        const sa = String(a.start || a.time || "");
        const sb = String(b.start || b.time || "");
        return sa.localeCompare(sb);
      });
      const next = sorted[0];
      const nextTime = toTimeLabel(next.start || next.time);
      const nextTitle = next.title || next.summary || "Event";
      lines.push(nextTime ? `Next event: ${nextTime} • ${nextTitle}.` : `Next event: ${nextTitle}.`);
    } else {
      lines.push("Events: none today.");
    }

    // Tomorrow quick look
    if (tomorrowMin != null || tomorrowMax != null || tomorrowSummary){
      const range =
        (tomorrowMin != null && tomorrowMax != null) ? `${tomorrowMin}–${tomorrowMax}°C` :
        (tomorrowMin != null) ? `min ${tomorrowMin}°C` :
        (tomorrowMax != null) ? `max ${tomorrowMax}°C` : null;

      const tParts = [];
      if (range) tParts.push(range);
      if (tomorrowSummary) tParts.push(tomorrowSummary);
      lines.push(`Tomorrow: ${tParts.join(" • ")}.`);
    }

    // Top news
    if (news.length){
      const top = news[0];
      lines.push(`Top news: ${top.title || top.headline || "—"}.`);
    } else {
      lines.push("News: none provided.");
    }
  }
  else{
    // Midday/Night: keep it minimal
    if (steps != null) lines.push(`Steps: ${Math.round(steps)}.`);
    if (hr != null) lines.push(`Heart rate: ${Math.round(hr)} bpm.`);
    if (sleepMins != null) lines.push(`Sleep: ${formatDuration(sleepMins)}.`);
    if (events.length){
      const first = events[0];
      const firstTime = toTimeLabel(first.start || first.time);
      const firstTitle = first.title || first.summary || "Event";
      lines.push(firstTime ? `Next event: ${firstTime} • ${firstTitle}.` : `Next event: ${firstTitle}.`);
    } else {
      lines.push("Events: none.");
    }
    if (news.length) lines.push(`Top news: ${news[0].title || news[0].headline || "—"}.`);
  }

  setText("briefText", lines.join("\n"));
}

/* Boot */
(function init(){
  const data = decodeDataParam() || {};
  render(data);
})();
