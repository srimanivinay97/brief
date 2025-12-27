/* =========================
   Brief — app.js (FULL, FIXED)
   - Decodes Base64URL or Base64 (handles + turned into spaces)
   - Also supports raw JSON in ?data={...}
   - Null/0-safe rendering (never hides 0)
   - Saves last good payload to localStorage for fallback
   ========================= */

(() => {
  const LAST_KEY = "brief:lastData";

  // ---------- Helpers ----------
  const qs = new URLSearchParams(location.search);
  let dataParam = qs.get("data");

  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const isStr = (v) => typeof v === "string" && v.trim().length > 0;

  const safe = (v, fallback = "—") => (v ?? fallback); // keeps 0
  const round1 = (n) => (isNum(n) ? Math.round(n * 10) / 10 : null);

  // IMPORTANT:
  // URLSearchParams can convert '+' into ' ' in some cases.
  // This fixes that for Base64 strings.
  function fixPlusAsSpace(s) {
    return String(s).replace(/ /g, "+");
  }

  function base64UrlToBase64(b64url) {
    let b64 = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
    // pad
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    return b64;
  }

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function decodeDataParam(raw) {
    if (!raw) return null;

    // 1) If someone passes raw JSON directly
    const trimmed = String(raw).trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const obj = safeJsonParse(trimmed);
      if (obj) return obj;
    }

    // 2) Otherwise treat as Base64/Base64URL
    // Fix '+' that became spaces
    const fixed = fixPlusAsSpace(trimmed);

    // Try Base64URL -> Base64
    const b64 = base64UrlToBase64(fixed);

    // atob
    const jsonText = atob(b64);
    const obj = safeJsonParse(jsonText);
    return obj;
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

  // ---------- Normalize to your schema ----------
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

    return {
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
  }

  // ---------- Theme ----------
  function applyTheme(hour) {
    const h = clampHour(hour) ?? 12;

    let bg = "linear-gradient(180deg, rgba(3,7,18,1) 0%, rgba(2,6,23,1) 100%)";
    let accent = "#a78bfa";

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
    }

    const style = document.createElement("style");
    style.id = "brief-theme";
    style.textContent = `
      :root{
        --accent:${accent};
        --bg:${bg};
        --card: rgba(255,255,255,0.10);
        --border: rgba(255,255,255,0.12);
        --text: rgba(255,255,255,0.92);
        --sub: rgba(255,255,255,0.72);
      }
      html,body{
        margin:0; height:100%;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        background: var(--bg);
        color: var(--text);
      }
      .wrap{max-width:720px;margin:0 auto;padding:18px 16px 32px;}
      .header{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px;}
      .title{font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin:4px 0 0;}
      .meta{font-size:13px;color:var(--sub);margin-top:8px;}
      .pill{display:inline-flex;gap:8px;align-items:center;padding:8px 10px;background:rgba(0,0,0,.18);
        border:1px solid var(--border);border-radius:999px;color:var(--sub);font-size:12px;white-space:nowrap;}
      .grid{display:grid;grid-template-columns:1fr;gap:12px;}
      @media (min-width:640px){.grid{grid-template-columns:1fr 1fr;}}
      .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px 14px 12px;
        backdrop-filter: blur(10px);-webkit-backdrop-filter: blur(10px);}
      .card h2{margin:0 0 10px 0;font-size:15px;font-weight:750;display:flex;justify-content:space-between;}
      .badge{font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid var(--border);
        background:rgba(0,0,0,.12);color:var(--sub);}
      .rows{display:grid;gap:8px;}
      .row{display:flex;justify-content:space-between;gap:12px;}
      .k{color:var(--sub);font-size:13px;}
      .v{font-size:14px;font-weight:650;text-align:right;}
      .divider{height:1px;background:rgba(255,255,255,.10);margin:10px 0;}
      .accent{color:var(--accent);}
      .small{font-size:12px;color:var(--sub);}
      .error{background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.35);padding:12px 14px;border-radius:14px;}
    `;
    document.getElementById("brief-theme")?.remove();
    document.head.appendChild(style);
  }

  // ---------- UI ----------
  function el(tag, attrs = {}, kids = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    kids.forEach((k) => node.appendChild(k));
    return node;
  }

  function row(k, v) {
    return el("div", { class: "row" }, [
      el("div", { class: "k", text: k }),
      el("div", { class: "v", text: v }),
    ]);
  }

  function card(title, badgeText, contentNode) {
    return el("section", { class: "card" }, [
      el("h2", {}, [
        el("span", { text: title }),
        badgeText ? el("span", { class: "badge", text: badgeText }) : el("span"),
      ]),
      contentNode,
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
    const wrap = el("div", { class: "wrap" });

    const location = isStr(data.meta.location) ? data.meta.location : "Your area";
    const updated = isStr(data.meta.updated_at_local) ? data.meta.updated_at_local : null;

    wrap.appendChild(
      el("div", { class: "header" }, [
        el("div", {}, [
          el("div", { class: "title", text: `${emojiForTime(data.meta.local_time_hour)} ${safe(data.meta.greeting, "Brief")}` }),
          el("div", {
            class: "meta",
            text: `${location}${updated ? ` • Updated ${updated.replace("T", " ")}` : ""}`,
          }),
        ]),
        el("div", {}, [
          el("div", { class: "pill" }, [
            el("span", { class: "accent", text: safe(data.meta.date, "—") }),
            el("span", { text: `• ${safe(data.meta.brief_type, "—")}` }),
          ]),
        ]),
      ])
    );

    // Weather
    const wNow = data.weather.now;
    const wTonight = data.weather.tonight;
    const wAQ = data.weather.air_quality;
    const wTom = data.weather.tomorrow;

    const weatherNode = el("div", { class: "rows" }, [
      row("Now", `${safe(wNow.summary, "—")}${isNum(wNow.temp_c) ? `, ${formatTempC(wNow.temp_c)}` : ""}`),
      row("Feels like", formatTempC(wNow.feels_like_c)),
      row("Tonight", safe(wTonight.summary, "—")),
      row("Rain chance", formatPercent(wTonight.chance_of_rain_percent)),
      row("Wind", formatMph(wTonight.wind_speed_mph)),
      row("Air quality", `${safe(wAQ.level, "—")}${wAQ.index != null ? ` (AQI ${wAQ.index})` : ""}`),
      el("div", { class: "divider" }),
      row("Tomorrow", `${safe(wTom.summary, "—")}${isNum(wTom.min_c) && isNum(wTom.max_c) ? ` • ${formatTempC(wTom.min_c)}–${formatTempC(wTom.max_c)}` : ""}`),
    ]);

    // Steps
    const steps = data.health.steps;
    const stepsNode = el("div", { class: "rows" }, [
      row("Today", steps.count != null ? String(steps.count) : "—"),
      row("Duration", steps.duration_min != null ? formatMinutesToHM(steps.duration_min) : "—"),
      row("Calories", steps.calories != null ? String(steps.calories) : "—"),
    ]);

    // Heart rate
    const hr = data.health.heart_rate;
    const hrNode = el("div", { class: "rows" }, [
      row("Latest", hr.bpm != null ? `${hr.bpm} bpm` : "—"),
    ]);

    // Sleep
    const sleep = data.health.sleep;
    const sleepNode = el("div", { class: "rows" }, [
      row("Last night", sleep.duration_min != null ? formatMinutesToHM(sleep.duration_min) : "—"),
    ]);

    // Next event
    const ne = data.calendar.next_event;
    const nextTime = formatTimeFromIso(ne.start_local);
    const nextBadge = nextTime ? nextTime : null;
    const nextNode = el("div", { class: "rows" }, [
      row("Next", ne.title ?? "No upcoming events"),
      row("When", ne.start_local ? ne.start_local.replace("T", " ") : "—"),
      row("Where", safe(ne.location, "—")),
    ]);

    // News
    const items = data.news.top_items;
    const newsNode =
      Array.isArray(items) && items.length
        ? el("div", { class: "rows" }, items.slice(0, 6).map((it) => row("•", safe(it?.title, "—"))))
        : el("div", { class: "rows" }, [
            row("Status", "Nothing urgent"),
            el("div", { class: "small", text: "No top items in this update." }),
          ]);

    const grid = el("div", { class: "grid" }, [
      card("Weather", wTom?.date ? `Tomorrow ${wTom.date}` : null, weatherNode),
      card("Steps", null, stepsNode),
      card("Heart rate", null, hrNode),
      card("Sleep", null, sleepNode),
      card("Next event", nextBadge, nextNode),
      card("News", null, newsNode),
    ]);

    wrap.appendChild(grid);
    return wrap;
  }

  function showError(msg, detail) {
    applyTheme(new Date().getHours());
    document.body.innerHTML = "";
    document.body.appendChild(
      el("div", { class: "wrap" }, [
        el("div", { class: "error" }, [
          el("div", { text: msg }),
          detail ? el("div", { class: "small", text: detail }) : el("div"),
          el("div", { class: "small", text: "Tip: pass data as ?data=BASE64URL_JSON (URL-safe base64)" }),
        ]),
      ])
    );
  }

  function loadData() {
    // 1) URL param
    if (dataParam) {
      try {
        const obj = decodeDataParam(dataParam);
        if (obj) {
          localStorage.setItem(LAST_KEY, JSON.stringify(obj));
          return obj;
        }
      } catch (e) {
        console.warn("Decode failed, will try cache.", e);
      }
    }

    // 2) cache fallback
    const last = localStorage.getItem(LAST_KEY);
    const parsed = last ? safeJsonParse(last) : null;
    return parsed;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const raw = loadData();
    if (!raw) {
      showError("Missing or invalid data parameter.", "Could not decode ?data= payload and no cached data found.");
      return;
    }

    const data = normalize(raw);
    applyTheme(data.meta.local_time_hour);

    document.body.innerHTML = "";
    document.body.appendChild(buildApp(data));
  });
})();
