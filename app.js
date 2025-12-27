/* Brief UI
   Input: ?data=BASE64URL_JSON
   Expected JSON (works with your current structure):
   {
     "meta": { "date":"2025-12-27", "updated_at_local":"2025-12-27T00:27:00", "brief_type":"evening", "greeting":"Good evening" },
     "weather": {
       "now": { "temp_c":3.13, "feels_like_c":-0.32, "summary":"Mostly clear" },
       "tonight": { "summary":"Mostly clear", "chance_of_rain_percent":0, "wind_speed_mph":7 },
       "air_quality": { "level":"Low", "index":2 }
     },
     "health": {
       "steps": { "count":210, "goal":6000, "duration_min":null, "calories":null },
       "heart_rate": { "bpm": null },
       "sleep": { "duration_min": 360 }
     },
     "calendar": {
       "next_event": { "title":"Deliver on Wednesday 31", "start_local":"2025-12-29T14:00:00", "location": null }
     },
     "news": { "top_items": [] }
   }
*/

(function () {
  const $ = (id) => document.getElementById(id);

  function safeNum(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }

  function round1(x) {
    const n = safeNum(x);
    if (n === null) return null;
    return Math.round(n * 10) / 10;
  }

  function fmtTempC(x) {
    const n = round1(x);
    if (n === null) return "—";
    // show as integer if .0
    const isInt = Math.abs(n - Math.round(n)) < 1e-9;
    return (isInt ? String(Math.round(n)) : String(n)) + "°C";
  }

  function fmtMph(x) {
    const n = round1(x);
    if (n === null) return "—";
    const isInt = Math.abs(n - Math.round(n)) < 1e-9;
    return (isInt ? String(Math.round(n)) : String(n)) + " mph";
  }

  function fmtPercent(x) {
    const n = safeNum(x);
    if (n === null) return "—";
    return Math.round(n) + "%";
  }

  function minutesToHM(mins) {
    const n = safeNum(mins);
    if (n === null || n <= 0) return null;
    const h = Math.floor(n / 60);
    const m = Math.round(n % 60);
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function parseBase64Url(str) {
    // base64url -> base64
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    // pad
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);

    // decode
    const jsonText = decodeURIComponent(
      Array.prototype.map
        .call(atob(padded), (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonText);
  }

  function pickTheme(meta) {
    // priority: meta.brief_type, else time-of-day from updated_at_local
    const t = (meta && (meta.brief_type || "")).toLowerCase();
    if (t.includes("morning")) return "morning";
    if (t.includes("evening")) return "evening";
    if (t.includes("night")) return "night";

    const ts = meta && meta.updated_at_local ? new Date(meta.updated_at_local) : null;
    const hour = ts && !isNaN(ts.getTime()) ? ts.getHours() : null;

    if (hour === null) return "evening";
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 19) return "evening";
    return "night";
  }

  function themeEmoji(theme) {
    if (theme === "morning") return "☀️🐦🌅";
    if (theme === "evening") return "🌆✨";
    return "🌙⭐🦉";
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function hide(id) {
    const el = $(id);
    if (el) el.style.display = "none";
  }

  function show(id) {
    const el = $(id);
    if (el) el.style.display = "";
  }

  function fmtDateTimeLocal(isoOrText) {
    if (!isoOrText) return null;
    const d = new Date(isoOrText);
    if (isNaN(d.getTime())) return String(isoOrText);

    // iOS Safari friendly formatting
    const opts = { weekday: "short", day: "2-digit", month: "short" };
    const datePart = d.toLocaleDateString(undefined, opts);
    const timePart = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${datePart} · ${timePart}`;
  }

  function buildSleepNote(durationMin, theme) {
    const hm = minutesToHM(durationMin);
    if (!hm) return "Not recorded";
    const hours = durationMin / 60;

    if (hours >= 7.0) return theme === "night" ? "Good — keep the same schedule 🌙" : "Good — keep the same schedule";
    if (hours >= 6.0) return theme === "night" ? "Adequate — try to reach 7h 🌙" : "Adequate — try to reach 7h";
    return theme === "night" ? "Short — aim for more rest 🌙" : "Short — aim for more rest";
  }

  function summariseNews(news) {
    const items = news && Array.isArray(news.top_items) ? news.top_items : [];
    if (!items.length) return "Nothing urgent tonight";
    // keep it short; you can format better later
    return items.slice(0, 3).map((x) => (typeof x === "string" ? x : (x.title || "Update"))).join(" • ");
  }

  function main() {
    const params = new URLSearchParams(location.search);
    const encoded = params.get("data");

    if (!encoded) {
      setText("greeting", "Brief");
      setText("metaLine", "Missing ?data=BASE64URL_JSON");
      setText("topSummary", "No data provided.");
      hide("weatherCard");
      hide("stepsCard");
      hide("hrCard");
      hide("sleepCard");
      hide("eventsCard");
      hide("newsCard");
      return;
    }

    let data;
    try {
      data = parseBase64Url(encoded);
    } catch (e) {
      setText("greeting", "Brief");
      setText("metaLine", "Could not decode data");
      setText("topSummary", "Invalid base64url JSON in ?data");
      hide("weatherCard");
      hide("stepsCard");
      hide("hrCard");
      hide("sleepCard");
      hide("eventsCard");
      hide("newsCard");
      return;
    }

    const meta = data.meta || {};
    const theme = pickTheme(meta);
    document.documentElement.setAttribute("data-theme", theme);

    const greetingBase = meta.greeting || (theme === "morning" ? "Good morning" : theme === "evening" ? "Good evening" : "Good night");
    setText("greeting", `${greetingBase} ${themeEmoji(theme)}`);

    // meta line: date + time if possible
    const updated = meta.updated_at_local || meta.updatedAt || meta.updated_at || null;
    const dt = updated ? new Date(updated) : null;
    const metaLine = dt && !isNaN(dt.getTime())
      ? dt.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : (meta.date ? String(meta.date) : "—");
    setText("metaLine", metaLine);

    // Top summary (one clean line like Samsung brief)
    const wNow = data.weather && data.weather.now ? data.weather.now : {};
    const nowTemp = fmtTempC(wNow.temp_c);
    const nowSummary = (wNow.summary || "—");
    const feels = fmtTempC(wNow.feels_like_c);

    const topLine1 = theme === "morning"
      ? "Your morning brief"
      : theme === "evening"
        ? "Your evening brief"
        : "Your night brief";

    const topLine2 = `${theme === "night" ? "🌙" : theme === "morning" ? "☀️" : "🌆"} Weather now: ${nowTemp} · ${nowSummary} · Feels like ${feels}`;

    const topSummaryEl = $("topSummary");
    topSummaryEl.innerHTML = `
      <div class="line1">${escapeHtml(topLine1)}</div>
      <div class="line2">${escapeHtml(topLine2)}</div>
    `;

    // Weather section (details)
    setText("weatherNow", `${nowTemp} · ${nowSummary}`);
    setText("weatherFeels", feels);

    const tonight = data.weather && data.weather.tonight ? data.weather.tonight : {};
    setText("weatherTonight", tonight.summary || "—");
    setText("weatherRain", fmtPercent(tonight.chance_of_rain_percent));
    setText("weatherWind", fmtMph(tonight.wind_speed_mph));

    const aq = data.weather && data.weather.air_quality ? data.weather.air_quality : null;
    if (aq && (aq.level || aq.index !== undefined)) {
      show("aqWrap");
      const lvl = aq.level ? String(aq.level) : "—";
      const idx = (aq.index !== undefined && aq.index !== null) ? String(aq.index) : "";
      setText("airQuality", idx ? `${lvl} (${idx})` : lvl);
    } else {
      hide("aqWrap");
    }

    // Steps
    const steps = data.health && data.health.steps ? data.health.steps : {};
    const stepsCount = safeNum(steps.count);
    const goal = safeNum(steps.goal) ?? 6000;

    if (stepsCount === null) {
      setText("stepsToday", "Not recorded");
      setText("stepsGoal", goal ? goal.toLocaleString() : "—");
    } else {
      const pct = goal ? Math.round((stepsCount / goal) * 100) : null;
      setText("stepsToday", pct !== null ? `${stepsCount.toLocaleString()} steps (${pct}%)` : `${stepsCount.toLocaleString()} steps`);
      setText("stepsGoal", goal.toLocaleString());
    }

    // Heart rate (hide 0 / null)
    const hr = data.health && data.health.heart_rate ? data.health.heart_rate : {};
    const bpm = safeNum(hr.bpm);
    if (bpm === null || bpm <= 0) {
      setText("heartRate", "Not recorded");
    } else {
      setText("heartRate", `${Math.round(bpm)} bpm`);
    }

    // Sleep
    const sleep = data.health && data.health.sleep ? data.health.sleep : {};
    const durMin = safeNum(sleep.duration_min);
    const durHM = minutesToHM(durMin);
    setText("sleepDuration", durHM || "Not recorded");
    setText("sleepNote", buildSleepNote(durMin, theme));

    // Next event
    const next = data.calendar && data.calendar.next_event ? data.calendar.next_event : null;
    if (!next || !next.title) {
      setText("nextEvent", "No upcoming events");
    } else {
      const when = fmtDateTimeLocal(next.start_local) || "—";
      const loc = next.location ? ` · ${next.location}` : "";
      // Cleaner Samsung-ish format
      $("nextEvent").innerHTML = `
        <div style="font-weight:700; font-size:16px;">${escapeHtml(next.title)}</div>
        <div style="margin-top:6px; color: var(--muted); font-weight:600;">${escapeHtml(when)}${escapeHtml(loc)}</div>
      `;
    }

    // News
    const newsText = summariseNews(data.news || {});
    setText("newsBox", newsText);

    // Updated footer
    const updatedLine = dt && !isNaN(dt.getTime())
      ? dt.toLocaleString()
      : (updated ? String(updated) : "—");
    setText("updatedLine", `Updated: ${updatedLine}`);

    // Optional: if everything is empty, still keep UI.
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  main();
})();
