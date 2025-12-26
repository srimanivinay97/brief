/* ========= Brief UI (single-file logic) =========
   - Reads base64 JSON from ?data=
   - Fallback to demo data
   - Formats numbers + fixes the "many digits" issue
   - Supports both "canonical" model2 format AND your older nested format
*/

(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- Helpers ----------
  function safeNum(v) {
    if (v === null || v === undefined) return null;
    const n = Number(String(v).replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function round1(n) { return Math.round(n * 10) / 10; }
  function round0(n) { return Math.round(n); }

  function fmtC(n) {
    if (n === null) return "—";
    return `${round0(n)}°C`;
  }

  function fmtPct(n) {
    if (n === null) return "—";
    return `${round0(n)}%`;
  }

  function fmtMph(n) {
    if (n === null) return "—";
    return `${round0(n)} mph`;
  }

  function fmtKm(n) {
    if (n === null) return "—";
    // show 2 decimals if small, else 1
    const abs = Math.abs(n);
    const d = abs < 1 ? 2 : 1;
    return `${n.toFixed(d)} km`;
  }

  function minutesToHM(mins) {
    const m = safeNum(mins);
    if (m === null) return "—";
    const h = Math.floor(m / 60);
    const r = Math.round(m % 60);
    if (h <= 0) return `${r}m`;
    return `${h}h ${r}m`;
  }

  function decodeB64(b64) {
    // urlsafe base64 support
    const cleaned = String(b64).replace(/-/g, "+").replace(/_/g, "/");
    try {
      // handle missing padding
      const pad = cleaned.length % 4 ? "=".repeat(4 - (cleaned.length % 4)) : "";
      const json = atob(cleaned + pad);
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function nowLocalTimeHHMM() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function inferTimeOfDay(hhmm) {
    // hhmm "20:40"
    const h = safeNum(String(hhmm).slice(0, 2));
    if (h === null) return "night";
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 18) return "evening";
    return "night";
  }

  // ---------- Canonical demo data ----------
  const demo = {
    timeOfDay: "night",
    date: "Friday, 26 Dec",
    time: "20:40",
    location: "London",
    weather: {
      tempC: 4,
      feelsLikeC: 1,
      condition: "Mostly clear",
      rainChance: 0,
      windMph: 7,
      tonightSummary: "Mostly clear"
    },
    health: {
      steps: 210,
      distanceKm: 0.16,
      calories: 18,
      heartRate: 72,
      stepsGoal: 6000,
      sleep: { durationMinutes: 415 }
    },
    events: [{ title: "Team sync", time: "09:30" }],
    news: ["UK inflation eases slightly ahead of New Year"],
    updatedAt: "Updated just now"
  };

  // ---------- Compatibility mapper ----------
  // Accepts:
  // A) canonical:
  // { timeOfDay, date, time, location, weather:{tempC,...}, health:{steps,...}, events:[], news:[] }
  //
  // B) your old shortcut nested:
  // { updatedAt, location, weather:{ tempC:"4°C", condition:"Mostly Cloudy", feelsLike:"-0°C" }, health:{steps:"82", sleep:"{...}h {...}m", heartRate:"72"} }
  //
  // C) model1-ish flattened:
  // { current_temperature_c, feels_like_c, tonight_summary, tonight_rain_percent, tonight_wind_mph, steps_today, ...}
  function normalize(input) {
    if (!input || typeof input !== "object") return demo;

    // If it already looks canonical
    if (input.weather && input.health && (input.time || input.date)) {
      const t = input.time || nowLocalTimeHHMM();
      const tod = input.timeOfDay || inferTimeOfDay(t);
      return {
        ...demo,
        ...input,
        time: t,
        timeOfDay: tod,
        location: input.location || demo.location,
      };
    }

    // Old nested shortcut style
    if (input.weather && input.health) {
      const t = nowLocalTimeHHMM();
      const tod = inferTimeOfDay(t);

      const tempC = safeNum(input.weather.tempC);
      const feels = safeNum(input.weather.feelsLike);

      const steps = safeNum(input.health.steps);
      const hr = safeNum(input.health.heartRate);

      // sleep might be string like "{575.19}h {11.55}m" (broken)
      // If it is already minutes -> great; otherwise try to extract h/m.
      let sleepMinutes = safeNum(input.health.sleep?.durationMinutes);
      if (sleepMinutes === null && typeof input.health.sleep === "string") {
        const s = input.health.sleep;
        const hh = safeNum((s.match(/(\d+(\.\d+)?)\s*h/i) || [])[1]);
        const mm = safeNum((s.match(/(\d+(\.\d+)?)\s*m/i) || [])[1]);
        if (hh !== null || mm !== null) {
          sleepMinutes = Math.round((hh || 0) * 60 + (mm || 0));
        }
      }

      // auto distance/calories if missing
      const distanceKm = safeNum(input.health.distanceKm) ?? (steps !== null ? steps * 0.00075 : null);
      const calories = safeNum(input.health.calories) ?? (steps !== null ? Math.round(steps * 0.04) : null);

      return {
        timeOfDay: tod,
        date: input.updatedAt ? String(input.updatedAt).split(" at ")[0] : demo.date,
        time: t,
        location: input.location || demo.location,
        weather: {
          tempC,
          feelsLikeC: feels,
          condition: input.weather.condition || "—",
          rainChance: safeNum(input.weather.rainChance),
          windMph: safeNum(input.weather.windMph),
          tonightSummary: input.weather.tonightSummary || input.weather.condition || "—"
        },
        health: {
          steps: steps ?? 0,
          distanceKm: distanceKm ?? 0,
          calories: calories ?? 0,
          heartRate: hr,
          stepsGoal: safeNum(input.health.stepsGoal) ?? 6000,
          sleep: { durationMinutes: sleepMinutes }
        },
        events: Array.isArray(input.events) ? input.events : [],
        news: Array.isArray(input.news) ? input.news : [],
        updatedAt: input.updatedAt || demo.updatedAt
      };
    }

    // Model1-ish flattened keys
    if (input.current_temperature_c !== undefined || input.steps_today !== undefined) {
      const t = nowLocalTimeHHMM();
      const tod = inferTimeOfDay(t);
      const steps = safeNum(input.steps_today);

      return {
        timeOfDay: tod,
        date: input.date || demo.date,
        time: t,
        location: input.location || demo.location,
        weather: {
          tempC: safeNum(input.current_temperature_c),
          feelsLikeC: safeNum(input.feels_like_c),
          condition: input.tonight_summary || input.today_summary || "—",
          rainChance: safeNum(input.tonight_rain_percent),
          windMph: safeNum(input.tonight_wind_mph),
          tonightSummary: input.tonight_summary || "—"
        },
        health: {
          steps: steps ?? 0,
          distanceKm: steps !== null ? steps * 0.00075 : 0,
          calories: steps !== null ? Math.round(steps * 0.04) : 0,
          heartRate: safeNum(input.heart_rate),
          stepsGoal: 6000,
          sleep: { durationMinutes: safeNum(input.sleep_minutes) }
        },
        events: Array.isArray(input.events) ? input.events : [],
        news: Array.isArray(input.news) ? input.news : [],
        updatedAt: input.updatedAt || demo.updatedAt
      };
    }

    return demo;
  }

  // ---------- Theme / Greeting ----------
  function getGreeting(tod) {
    if (tod === "morning") return { title: "Good morning", emoji: "☀️🐦🌅" };
    if (tod === "evening") return { title: "Good evening", emoji: "🌆✨" };
    return { title: "Good night", emoji: "🌙⭐🦉" };
  }

  function applyTheme(tod) {
    // Just adjust background intensity using CSS variables if you want later.
    // For now: we keep a premium night style always, because you said night should be dark.
    // (We’ll add morning/evening gradients once the data/UI is stable.)
    const briefLabel = tod === "morning" ? "Morning brief" : (tod === "evening" ? "Evening brief" : "Night brief");
    $("briefPill").textContent = briefLabel;
  }

  // ---------- Render ----------
  function render(data) {
    const { title, emoji } = getGreeting(data.timeOfDay);
    $("greeting").textContent = `${title} ${emoji}`;

    $("timePill").textContent = data.time || "—";
    $("dateLine").textContent = data.date || "—";
    $("locationPill").textContent = data.location || "—";

    // Weather
    const tempC = safeNum(data.weather?.tempC);
    const feels = safeNum(data.weather?.feelsLikeC);
    const rain = safeNum(data.weather?.rainChance);
    const wind = safeNum(data.weather?.windMph);

    $("tempBig").textContent = fmtC(tempC);
    $("condBig").textContent = data.weather?.condition || "—";
    $("tonightLine").textContent = `Tonight: ${data.weather?.tonightSummary || data.weather?.condition || "—"}`;
    $("feelsLike").textContent = fmtC(feels);
    $("rainChance").textContent = fmtPct(rain);
    $("wind").textContent = fmtMph(wind);

    // Steps
    const steps = safeNum(data.health?.steps);
    $("stepsBig").textContent = steps === null ? "—" : `${round0(steps).toLocaleString()} steps`;

    const distanceKm = safeNum(data.health?.distanceKm);
    const calories = safeNum(data.health?.calories);
    const goal = safeNum(data.health?.stepsGoal);

    $("distance").textContent = distanceKm === null ? "—" : fmtKm(round1(distanceKm));
    $("calories").textContent = calories === null ? "—" : `${round0(calories)} kcal`;
    $("stepsGoal").textContent = goal === null ? "—" : `${round0(goal).toLocaleString()}`;

    // Heart rate
    const hr = safeNum(data.health?.heartRate);
    $("hrBig").textContent = hr === null ? "—" : `${round0(hr)} bpm`;
    $("hrNote").textContent = hr === null ? "No heart-rate data" : "Latest reading";

    // Sleep
    const sleepMin = safeNum(data.health?.sleep?.durationMinutes);
    $("sleepBig").textContent = minutesToHM(sleepMin);
    $("sleepNote").textContent = sleepMin === null ? "No sleep data" : "Total sleep duration";

    // Events
    const events = Array.isArray(data.events) ? data.events : [];
    if (events.length === 0) {
      $("eventBig").textContent = "No events";
      $("eventNote").textContent = "You’re free tomorrow morning";
    } else {
      const e = events[0];
      const time = e.time ? `${e.time}` : "";
      $("eventBig").textContent = e.title || "Event";
      $("eventNote").textContent = time ? `Starts at ${time}` : "Upcoming event";
    }

    // News
    const news = Array.isArray(data.news) ? data.news : [];
    const ul = $("newsList");
    ul.innerHTML = "";
    if (news.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No news items";
      ul.appendChild(li);
    } else {
      news.slice(0, 5).forEach((n) => {
        const li = document.createElement("li");
        li.textContent = String(n);
        ul.appendChild(li);
      });
    }

    $("updatedAt").textContent = data.updatedAt ? String(data.updatedAt) : "";
  }

  // ---------- Boot ----------
  const b64 = getParam("data");
  const decoded = b64 ? decodeB64(b64) : null;
  const data = normalize(decoded || demo);

  applyTheme(data.timeOfDay);
  render(data);
})();
