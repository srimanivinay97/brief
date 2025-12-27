/* Brief UI (Morning/Evening/Night) - supports your JSON schema
   Data input: ?data=BASE64URL(JSON)
*/

(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- Base64URL decode ----------
  function base64UrlToUtf8(b64url) {
    const b64 = (b64url || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(b64url.length / 4) * 4, "=");
    const binary = atob(b64);
    const bytes = new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  }

  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  // ---------- format helpers ----------
  function safeNumber(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  function fmtTempC(n) {
    const v = safeNumber(n);
    if (v === null) return null;
    return `${Math.round(v)}°C`; // no long decimals
  }
  function fmtPercent(n) {
    const v = safeNumber(n);
    if (v === null) return null;
    return `${Math.round(v)}%`;
  }
  function fmtMph(n) {
    const v = safeNumber(n);
    if (v === null) return null;
    return `${Math.round(v)} mph`;
  }
  function fmtBpm(n) {
    const v = safeNumber(n);
    if (v === null) return null;
    return `${Math.round(v)} bpm`;
  }
  function minutesToHuman(mins) {
    const m = safeNumber(mins);
    if (m === null) return null;
    const h = Math.floor(m / 60);
    const r = Math.round(m % 60);
    if (h <= 0) return `${r}m`;
    if (r <= 0) return `${h}h`;
    return `${h}h ${r}m`;
  }
  function parseLocalISO(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDateTime(d) {
    if (!d) return "";
    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ---------- period + theme ----------
  function inferPeriodFromHour(hour) {
    const h = safeNumber(hour);
    if (h === null) return "night";
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 19) return "evening";
    return "night";
  }

  function normalizeBriefType(meta) {
    // If meta.brief_type is wrong (like evening at 0:00), trust local_time_hour first
    const byHour = inferPeriodFromHour(meta?.local_time_hour);
    return byHour;
  }

  function greetingFor(period) {
    if (period === "morning") return "Good morning ☀️🌅🐦";
    if (period === "evening") return "Good evening 🌆✨";
    return "Good night 🌙⭐🦉";
  }

  function setTheme(period) {
    document.documentElement.classList.remove("theme-morning", "theme-evening", "theme-night");
    document.documentElement.classList.add(`theme-${period}`);
  }

  // ---------- UI helpers ----------
  function card(title, rowsHtml, noteHtml = "") {
    return `
      <article class="card">
        <h2>${title}</h2>
        <div class="rows">${rowsHtml}</div>
        ${noteHtml ? `<div class="note">${noteHtml}</div>` : ""}
      </article>
    `;
  }

  function row(label, value) {
    return `
      <div class="row">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      </div>
    `;
  }

  function badge(text) {
    return `<span class="badge">${text}</span>`;
  }

  // ---------- render ----------
  function render(data) {
    const meta = data?.meta || {};
    const period = normalizeBriefType(meta);
    setTheme(period);

    $("greeting").textContent = greetingFor(period);

    // Meta text: DO NOT show coordinates
    const updatedLocal = meta?.updated_at_local ? parseLocalISO(meta.updated_at_local) : new Date();
    const metaLine1 = "Brief"; // keep clean (you can change to "London" if you later provide a city name)
    const metaLine2 = updatedLocal
      ? updatedLocal.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "";

    $("meta").innerHTML = `<div>${metaLine1}</div><div>${metaLine2}</div>`;

    // WEATHER headline strip
    const w = data?.weather || {};
    const now = w?.now || {};
    const tonight = w?.tonight || {};

    const temp = fmtTempC(now?.temp_c);
    const feels = fmtTempC(now?.feels_like_c);
    const cond = now?.summary || tonight?.summary || "Weather";
    const rain = fmtPercent(tonight?.chance_of_rain_percent ?? 0);
    const wind = fmtMph(tonight?.wind_speed_mph);

    $("heroStrip").innerHTML = `
      <div class="strip-left">
        <div class="strip-title">Weather</div>
        <div class="strip-sub">
          ${cond}
          ${feels ? ` · Feels like ${feels}` : ""}
          ${rain ? ` · Rain ${rain}` : ""}
          ${wind ? ` · Wind ${wind}` : ""}
        </div>
      </div>
      <div class="strip-right">${temp ? temp : "—"}</div>
    `;

    const cards = [];

    // 1) Weather card
    {
      const rows = [];
      rows.push(row("Now", `${temp || "—"} · ${now?.summary || cond || "—"}`));
      if (feels) rows.push(row("Feels like", feels));
      rows.push(row("Tonight", `${tonight?.summary || "—"}`));
      rows.push(row("Rain chance", rain || "0%"));
      rows.push(row("Wind", wind || "—"));

      // Air quality
      const aq = w?.air_quality || {};
      if (aq?.level || aq?.index !== undefined) {
        const aqText = `${aq?.level || "—"}${aq?.index !== undefined ? ` · ${aq.index}` : ""}`;
        rows.push(row("Air quality", aqText));
      }

      // Tomorrow (optional)
      const tmr = w?.tomorrow || {};
      const tMin = fmtTempC(tmr?.min_c);
      const tMax = fmtTempC(tmr?.max_c);
      if (tmr?.summary || tMin || tMax) {
        rows.push(row("Tomorrow", `${tmr?.summary || "—"}${tMin && tMax ? ` · ${tMin}–${tMax}` : ""}`));
      }

      cards.push(card("Weather", rows.join("")));
    }

    // 2) Steps card
    {
      const s = data?.health?.steps || {};
      const steps = safeNumber(s?.count);
      const durationMin = safeNumber(s?.duration_min);
      const calories = safeNumber(s?.calories);

      const rows = [];
      rows.push(row("Today", steps !== null ? `${Math.round(steps)} steps` : "No step data"));
      if (durationMin !== null) rows.push(row("Duration", minutesToHuman(durationMin)));
      if (calories !== null) rows.push(row("Calories", `${Math.round(calories)} kcal`));
      rows.push(row("Goal", `6,000`)); // you can wire this from JSON later if you add it

      let note = "";
      if (steps === 0) note = "Light activity day — tomorrow we go again 🌙";
      cards.push(card("Steps", rows.join(""), note));
    }

    // 3) Heart rate card
    {
      const hr = data?.health?.heart_rate || {};
      const bpm = safeNumber(hr?.bpm);

      const rows = [];
      if (bpm !== null) rows.push(row("Latest", fmtBpm(bpm)));
      else rows.push(row("Status", "No heart-rate data today"));

      cards.push(card("Heart rate", rows.join(""), bpm === null ? "Apple Watch not worn or data unavailable." : ""));
    }

    // 4) Sleep card
    {
      const sl = data?.health?.sleep || {};
      const durationMin = safeNumber(sl?.duration_min);

      const rows = [];
      if (durationMin !== null) rows.push(row("Last night", minutesToHuman(durationMin)));
      else rows.push(row("Status", "No sleep data yet"));

      const note = durationMin !== null ? "Good — keep the same sleep schedule 🌙" : "Sleep will appear after you wake up.";
      cards.push(card("Sleep", rows.join(""), note));
    }

    // 5) Next event card
    {
      const ev = data?.calendar?.next_event || null;
      const rows = [];

      if (ev?.title) rows.push(row("Next", ev.title));
      const d = parseLocalISO(ev?.start_local);
      if (d) rows.push(row("When", fmtDateTime(d)));
      if (ev?.location) rows.push(row("Where", ev.location));

      if (rows.length === 0) rows.push(row("Calendar", "No upcoming events"));

      cards.push(card("Next event", rows.join("")));
    }

    // 6) News card
    {
      const items = Array.isArray(data?.news?.top_items) ? data.news.top_items : [];
      const rows = [];

      if (items.length === 0) {
        rows.push(row("Top", "Nothing urgent tonight"));
        cards.push(card("News", rows.join(""), "Enjoy a peaceful night 🌙⭐🦉"));
      } else {
        for (const it of items.slice(0, 3)) {
          if (typeof it === "string") rows.push(row("•", it));
          else rows.push(row("•", it?.title || "News"));
        }
        cards.push(card("News", rows.join("")));
      }
    }

    $("grid").innerHTML = cards.join("");

    // Footer updated time
    const u = meta?.updated_at_local ? parseLocalISO(meta.updated_at_local) : null;
    $("updatedAt").textContent = u ? `Updated: ${u.toLocaleString()}` : "";
  }

  // ---------- boot ----------
  function boot() {
    const dataParam = getQueryParam("data");
    if (!dataParam) {
      // If no ?data=, show a clean demo
      render({
        meta: { updated_at_local: new Date().toISOString(), local_time_hour: new Date().getHours() },
        weather: { now: { temp_c: 3.1, feels_like_c: -0.3, summary: "Mostly clear" }, tonight: { summary: "Mostly clear", chance_of_rain_percent: 0, wind_speed_mph: 7 } },
        health: { steps: { count: 210 }, heart_rate: { bpm: null }, sleep: { duration_min: 360 } },
        calendar: { next_event: { title: "Deliver on Wednesday 31", start_local: "2025-12-29T14:00:00" } },
        news: { top_items: [] }
      });
      return;
    }

    try {
      const json = base64UrlToUtf8(dataParam);
      const data = JSON.parse(json);
      render(data);
    } catch (e) {
      console.error(e);
      document.body.innerHTML = `
        <div style="padding:20px;font-family:system-ui;color:#fff">
          <h2>Invalid data</h2>
          <p>Could not decode/parse <code>?data=</code>.</p>
        </div>
      `;
    }
  }

  boot();
})();
