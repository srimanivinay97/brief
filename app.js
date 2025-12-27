/* =========================
   Brief — app.js (FULL)
   - Robust base64url JSON decode
   - Null/0-safe rendering (never hides 0)
   - Builds a clean modern UI even if your HTML is minimal
   - Saves last good payload to localStorage for fallback
   ========================= */

(() => {
  const LAST_KEY = "brief:lastData";

  // ---------- Utils ----------
  const qs = new URLSearchParams(location.search);
  const dataParam = qs.get("data");

  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const isStr = (v) => typeof v === "string" && v.trim().length > 0;

  const nvl = (v, fallback = null) => (v === undefined ? fallback : v);
  const safe = (v, fallback = "—") => (v ?? fallback); // IMPORTANT: keeps 0

  const round1 = (n) => (isNum(n) ? Math.round(n * 10) / 10 : null);

  function base64UrlToBase64(b64url) {
    let b64 = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    return b64;
  }

  function decodeBase64UrlJson(b64url) {
    const b64 = base64UrlToBase64(b64url);
    const jsonText = atob(b64);
    return JSON.parse(jsonText);
  }

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function clampHour(h) {
    if (!isNum(h)) return null;
    if (h < 0) return 0;
    if (h > 23) return 23;
    return Math.floor(h);
  }

  function computeGreeting(hour) {
    const h = clampHour(hour);
    if (h === null) return null;
    if (h >= 5 && h <= 11) return "Good morning";
    if (h >= 12 && h <= 16) return "Good afternoon";
    if (h >= 17 && h <= 21) return "Good evening";
    return "Good night";
  }

  function computeBriefType(hour) {
    const h = clampHour(hour);
    if (h === null) return null;
    if (h >= 5 && h <= 11) return "morning";
    if (h >= 12 && h <= 16) return "afternoon";
    if (h >= 17 && h <= 21) return "evening";
    return "night";
  }

  function formatTempC(v) {
    if (!isNum(v)) return "—";
    return `${round1(v)}°C`;
  }

  function formatPercent(v) {
    if (!isNum(v)) return "—";
    return `${Math.round(v)}%`;
  }

  function formatMph(v) {
    if (!isNum(v)) return "—";
    return `${round1(v)} mph`;
  }

  function formatMinutesToHM(min) {
    if (!isNum(min)) return "—";
    const m = Math.max(0, Math.round(min));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}h ${r}m`;
  }

  function formatTimeFromIso(iso) {
    if (!isStr(iso)) return null;
    const m = iso.match(/T(\d{2}):(\d{2})/);
    if (!m) return null;
    return `${m[1]}:${m[2]}`;
  }

  // ---------- Schema normalize ----------
  // Accepts your new schema, and can tolerate missing parts.
  function normalize(input) {
    const now = new Date();
    const localHour = now.getHours();

    const metaIn = input?.meta ?? {};
    const weatherIn = input?.weather ?? {};
    const healthIn = input?.health ?? {};
    const calIn = input?.calendar ?? {};
    const newsIn = input?.news ?? {};

    const hour = clampHour(
      isNum(metaIn.local_time_hour) ? metaIn.local_time_hour : localHour
    );

    const greeting =
      (isStr(metaIn.greeting) ? metaIn.greeting : null) ?? computeGreeting(hour);

    const briefType =
      (isStr(metaIn.brief_type) ? metaIn.brief_type : null) ??
      computeBriefType(hour);

    const out = {
      meta: {
        date: metaIn.date ?? null,
        updated_at_local: metaIn.updated_at_local ?? null,
        location: metaIn.location ?? null,
        local_time_hour: hour,
        brief_type: briefType,
        greeting: greeting,
      },
      weather: {
        now: {
          temp_c: round1(weatherIn?.now?.temp_c),
          feels_like_c: round1(weatherIn?.now?.feels_like_c),
          summary: weatherIn?.now?.summary ?? null,
        },
        tonight: {
          summary: weatherIn?.tonight?.summary ?? null,
          chance_of_rain_percent: isNum(weatherIn?.tonight?.chance_of_rain_percent)
            ? Math.round(weatherIn.tonight.chance_of_rain_percent)
            : null,
          wind_speed_mph: round1(weatherIn?.tonight?.wind_speed_mph),
        },
        tomorrow: {
          date: weatherIn?.tomorrow?.date ?? null,
          min_c: round1(weatherIn?.tomorrow?.min_c),
          max_c: round1(weatherIn?.tomorrow?.max_c),
          summary: weatherIn?.tomorrow?.summary ?? null,
        },
        air_quality: {
          level: weatherIn?.air_quality?.level ?? null,
          index: isNum(weatherIn?.air_quality?.index)
            ? Math.round(weatherIn.air_quality.index)
            : null,
        },
      },
      health: {
        steps: {
          count: isNum(healthIn?.steps?.count) ? Math.round(healthIn.steps.count) : null,
          duration_min: isNum(healthIn?.steps?.duration_min)
            ? Math.round(healthIn.steps.duration_min)
            : null,
          calories: isNum(healthIn?.steps?.calories) ? round1(healthIn.steps.calories) : null,
        },
        heart_rate: {
          bpm: isNum(healthIn?.heart_rate?.bpm) ? Math.round(healthIn.heart_rate.bpm) : null,
        },
        sleep: {
          duration_min: isNum(healthIn?.sleep?.duration_min)
            ? Math.round(healthIn.sleep.duration_min)
            : null,
        },
      },
      calendar: {
        next_event: {
          title: calIn?.next_event?.title ?? null,
          start_local: calIn?.next_event?.start_local ?? null,
          location: calIn?.next_event?.location ?? null,
        },
        events_today: Array.isArray(calIn?.events_today) ? calIn.events_today : [],
      },
      news: {
        top_items: Array.isArray(newsIn?.top_items) ? newsIn.top_items : [],
      },
    };

    return out;
  }

  // ---------- Theme (simple Samsung-ish vibe) ----------
  function applyTheme(root, hour) {
    const h = clampHour(hour) ?? 12;

    const theme = document.createElement("style");
    theme.id = "brief-theme";

    // background gradients based on time
    let bg = "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(2,6,23,1) 100%)"; // night
    let accent = "#60a5fa"; // default blue

    if (h >= 5 && h <= 11) {
      bg =
        "linear-gradient(180deg, rgba(255,246,214,1) 0%, rgba(255,204,153,1) 40%, rgba(135,206,235,1) 100%)";
      accent = "#f59e0b";
    } else if (h >= 12 && h <= 16) {
      bg =
        "linear-gradient(180deg, rgba(226,232,240,1) 0%, rgba(148,197,255,1) 100%)";
      accent = "#2563eb";
    } else if (h >= 17 && h <= 21) {
      bg =
        "linear-gradient(180deg, rgba(255,226,196,1) 0%, rgba(239,147,98,1) 40%, rgba(24,39,70,1) 100%)";
      accent = "#fb7185";
    } else {
      bg =
        "radial-gradient(1200px 600px at 20% 0%, rgba(96,165,250,0.25), transparent 60%), " +
        "radial-gradient(900px 500px at 90% 10%, rgba(167,139,250,0.20), transparent 60%), " +
        "linear-gradient(180deg, rgba(3,7,18,1) 0%, rgba(2,6,23,1) 100%)";
      accent = "#a78bfa";
    }

    theme.textContent = `
      :root{
        --brief-accent:${accent};
        --brief-bg:${bg};
        --brief-card: rgba(255,255,255,0.10);
        --brief-card2: rgba(255,255,255,0.07);
        --brief-border: rgba(255,255,255,0.12);
        --brief-text: rgba(255,255,255,0.92);
        --brief-sub: rgba(255,255,255,0.72);
      }
      html, body{
        height:100%;
        margin:0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        background: var(--brief-bg);
        color: var(--brief-text);
      }
      .brief-wrap{
        max-width: 720px;
        margin: 0 auto;
        padding: 18px 16px 32px;
      }
      .brief-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        margin-bottom: 14px;
      }
      .brief-title{
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 4px 0 0;
      }
      .brief-meta{
        font-size: 13px;
        color: var(--brief-sub);
        margin-top: 8px;
      }
      .pill{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding: 8px 10px;
        background: rgba(0,0,0,0.18);
        border: 1px solid var(--brief-border);
        border-radius: 999px;
        color: var(--brief-sub);
        font-size: 12px;
        white-space: nowrap;
      }
      .grid{
        display:grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      @media (min-width: 640px){
        .grid{
          grid-template-columns: 1fr 1fr;
        }
      }
      .card{
        background: var(--brief-card);
        border: 1px solid var(--brief-border);
        border-radius: 16px;
        padding: 14px 14px 12px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      .card h2{
        margin: 0 0 10px 0;
        font-size: 15px;
        font-weight: 750;
        letter-spacing: -0.01em;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .badge{
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid var(--brief-border);
        background: rgba(0,0,0,0.12);
        color: var(--brief-sub);
      }
      .rows{
        display:grid;
        gap: 8px;
      }
      .row{
        display:flex;
        align-items:baseline;
        justify-content:space-between;
        gap: 12px;
      }
      .k{
        color: var(--brief-sub);
        font-size: 13px;
      }
      .v{
        font-size: 14px;
        font-weight: 650;
        text-align:right;
      }
      .divider{
        height:1px;
        background: rgba(255,255,255,0.10);
        margin: 10px 0;
      }
      .accent{
        color: var(--brief-accent);
      }
      .small{
        font-size: 12px;
        color: var(--brief-sub);
      }
      .list{
        margin: 6px 0 0;
        padding: 0 0 0 18px;
        color: var(--brief-text);
      }
      .list li{
        margin: 6px 0;
        color: var(--brief-text);
      }
      .error{
        background: rgba(239,68,68,0.16);
        border: 1px solid rgba(239,68,68,0.35);
        color: rgba(255,255,255,0.95);
        padding: 12px 14px;
        border-radius: 14px;
      }
      a { color: var(--brief-accent); }
    `;

    // replace if exists
    document.getElementById("brief-theme")?.remove();
    document.head.appendChild(theme);
  }

  // ---------- UI Builders ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const ch of children) node.appendChild(ch);
    return node;
  }

  function row(k, v) {
    return el("div", { class: "row" }, [
      el("div", { class: "k", text: k }),
      el("div", { class: "v", text: v }),
    ]);
  }

  function card(title, rightBadgeText, rowsOrNode) {
    const headerKids = [el("span", { text: title })];
    if (rightBadgeText) headerKids.push(el("span", { class: "badge", text: rightBadgeText }));

    const content =
      Array.isArray(rowsOrNode)
        ? el("div", { class: "rows" }, rowsOrNode)
        : rowsOrNode;

    return el("section", { class: "card" }, [
      el("h2", {}, headerKids),
      content,
    ]);
  }

  function emojiForTime(hour) {
    const h = clampHour(hour) ?? 12;
    if (h >= 5 && h <= 11) return "🌅☀️🐦";
    if (h >= 12 && h <= 16) return "☀️";
    if (h >= 17 && h <= 21) return "🌇✨";
    return "🌙⭐️🦉";
  }

  function buildApp(data) {
    const root = el("div", { class: "brief-wrap" });

    const location = isStr(data.meta.location) ? data.meta.location : "Your area";
    const updated = isStr(data.meta.updated_at_local) ? data.meta.updated_at_local : null;

    const headerLeft = el("div", {}, [
      el("div", { class: "brief-title" , text: `${emojiForTime(data.meta.local_time_hour)} ${safe(data.meta.greeting, "Brief")}` }),
      el("div", { class: "brief-meta", text: `${safe(location)}${updated ? ` • Updated ${updated.replace("T", " ")}` : ""}` }),
    ]);

    const headerRight = el("div", {}, [
      el("div", { class: "pill" }, [
        el("span", { class: "accent", text: safe(data.meta.date, "—") }),
        el("span", { text: `• ${safe(data.meta.brief_type, "—")}` }),
      ]),
    ]);

    root.appendChild(el("div", { class: "brief-header" }, [headerLeft, headerRight]));

    // Weather card
    const wNow = data.weather.now;
    const wTonight = data.weather.tonight;
    const wAQ = data.weather.air_quality;
    const wTom = data.weather.tomorrow;

    const weatherRows = [
      row("Now", `${safe(wNow.summary, "—")}${isNum(wNow.temp_c) ? `, ${formatTempC(wNow.temp_c)}` : ""}`),
      row("Feels like", formatTempC(wNow.feels_like_c)),
      row("Tonight", safe(wTonight.summary, "—")),
      row("Rain chance", formatPercent(wTonight.chance_of_rain_percent)),
      row("Wind", formatMph(wTonight.wind_speed_mph)),
      row("Air quality", `${safe(wAQ.level, "—")}${wAQ.index != null ? ` (AQI ${wAQ.index})` : ""}`),
    ];

    const weatherBadge = wTom?.date ? `Tomorrow ${wTom.date}` : null;

    const weatherNode = el("div", { class: "rows" }, [
      ...weatherRows,
      el("div", { class: "divider" }),
      row("Tomorrow", `${safe(wTom.summary, "—")}${isNum(wTom.min_c) && isNum(wTom.max_c) ? ` • ${formatTempC(wTom.min_c)}–${formatTempC(wTom.max_c)}` : ""}`),
    ]);

    // Steps card
    const steps = data.health.steps;
    const stepsRows = [
      row("Today", steps.count != null ? String(steps.count) : "—"),
      row("Duration", steps.duration_min != null ? formatMinutesToHM(steps.duration_min) : "—"),
      row("Calories", steps.calories != null ? String(steps.calories) : "—"),
    ];

    // Heart rate card
    const hr = data.health.heart_rate;
    const hrRows = [row("Latest", hr.bpm != null ? `${hr.bpm} bpm` : "—")];

    // Sleep card
    const sleep = data.health.sleep;
    const sleepRows = [row("Last night", sleep.duration_min != null ? formatMinutesToHM(sleep.duration_min) : "—")];

    // Next event card
    const ne = data.calendar.next_event;
    const nextTime = formatTimeFromIso(ne.start_local);
    const nextEventText = ne.title ? ne.title : "No upcoming events";
    const nextBadge = nextTime ? `${nextTime}` : null;

    const nextRows = [
      row("Next", nextEventText),
      row("When", ne.start_local ? safe(ne.start_local, "—").replace("T", " ") : "—"),
      row("Where", safe(ne.location, "—")),
    ];

    // News card
    const items = data.news.top_items;
    const newsNode = (() => {
      if (!items || items.length === 0) {
        return el("div", { class: "rows" }, [
          row("Status", "Nothing urgent"),
          el("div", { class: "small", text: "No top items in this update." }),
        ]);
      }
      const ul = el("ul", { class: "list" }, []);
      items.slice(0, 6).forEach((it) => {
        const title = isStr(it?.title) ? it.title : null;
        const src = isStr(it?.source) ? ` — ${it.source}` : "";
        if (!title) return;
        ul.appendChild(el("li", { text: `${title}${src}` }));
      });
      return ul;
    })();

    const grid = el("div", { class: "grid" }, [
      card("Weather", weatherBadge, weatherNode),
      card("Steps", null, stepsRows),
      card("Heart rate", null, hrRows),
      card("Sleep", null, sleepRows),
      card("Next event", nextBadge, nextRows),
      card("News", null, newsNode),
    ]);

    root.appendChild(grid);
    return root;
  }

  function showError(message, detail) {
    const wrap = document.createElement("div");
    wrap.className = "brief-wrap";
    wrap.appendChild(
      el("div", { class: "error" }, [
        el("div", { text: message }),
        detail ? el("div", { class: "small", text: detail }) : el("div"),
        el("div", { class: "small", text: "Tip: open the page like ?data=BASE64URL_JSON" }),
      ])
    );
    document.body.innerHTML = "";
    document.body.appendChild(wrap);
  }

  // ---------- Boot ----------
  function loadData() {
    // 1) Try query param
    if (dataParam) {
      try {
        const obj = decodeBase64UrlJson(dataParam);
        localStorage.setItem(LAST_KEY, JSON.stringify(obj));
        return obj;
      } catch (e) {
        // fall through to storage
        console.warn("Decode failed, trying last stored payload.", e);
      }
    }

    // 2) Try localStorage fallback
    const last = localStorage.getItem(LAST_KEY);
    const parsed = last ? safeJsonParse(last) : null;
    if (parsed) return parsed;

    return null;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const raw = loadData();
    if (!raw) {
      applyTheme(document.body, new Date().getHours());
      showError("Missing or invalid data parameter.", "No valid JSON found in URL or cache.");
      return;
    }

    const data = normalize(raw);

    // Apply theme based on local_time_hour (or current hour fallback)
    applyTheme(document.body, data.meta.local_time_hour);

    // Render
    document.body.innerHTML = "";
    document.body.appendChild(buildApp(data));
  });
})();
