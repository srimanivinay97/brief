/* ========= Brief UI (single-file logic) =========
   - Reads base64 JSON from ?data=
   - Handles markdown code fences ```json ... ```
   - Supports your current JSON schema:
     {
       updatedAt, location:"lat,lon",
       weather:{ tempC, feelsLike, condition, tonight:{summary,rainChancePercent,windMph}, tomorrow:{...}},
       health:{ steps, distanceKm, caloriesKcal, activeMinutes, heartRateBpm },
       sleep:{ start, end, durationMinutes, quality, notes },
       events:[{title,start,location}],
       news:[{title,source,time}]
     }
   - Also supports canonical schema from earlier
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

  function stripCodeFences(s) {
    if (!s) return s;
    let t = String(s).trim();

    // Remove leading ```json or ``` and trailing ```
    if (t.startsWith("```")) {
      // remove first line starting with ```
      const firstNewline = t.indexOf("\n");
      if (firstNewline !== -1) t = t.slice(firstNewline + 1);
      // remove ending ```
      const lastFence = t.lastIndexOf("```");
      if (lastFence !== -1) t = t.slice(0, lastFence);
      t = t.trim();
    }
    return t;
  }

  function decodeB64(b64) {
    // urlsafe base64 support
    const cleaned = String(b64).replace(/-/g, "+").replace(/_/g, "/");
    try {
      const pad = cleaned.length % 4 ? "=".repeat(4 - (cleaned.length % 4)) : "";
      const raw = atob(cleaned + pad);
      const jsonText = stripCodeFences(raw);
      return JSON.parse(jsonText);
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
    const h = safeNum(String(hhmm).slice(0, 2));
    if (h === null) return "night";
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 18) return "evening";
    return "night";
  }

  function isoToHHMM(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateLine(updatedAtIso) {
    // If updatedAt is ISO, show like "Sat 27 Dec"
    if (!updatedAtIso) return null;
    const d = new Date(updatedAtIso);
    if (isNaN(d.getTime())) return String(updatedAtIso);
    return d.toLocaleDateString([], { weekday: "long", day: "2-digit", month: "short" });
  }

  function formatLocation(loc) {
    // Your loc is "51.54,0.06" -> show "Lat 51.54 • Lon 0.06"
    if (!loc) return "—";
    const parts = String(loc).split(",").map(s => s.trim());
    if (parts.length === 2) {
      const lat = safeNum(parts[0]);
      const lon = safeNum(parts[1]);
      if (lat !== null && lon !== null) {
        return `Lat ${lat.toFixed(2)} • Lon ${lon.toFixed(2)}`;
      }
    }
    return String(loc);
  }

  // ---------- Demo fallback ----------
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

  // ---------- Normalize (supports your schema + canonical + older) ----------
  function normalize(input) {
    if (!input || typeof input !== "object") return demo;

    // Your current schema detected by updatedAt + weather.tonight + sleep.durationMinutes
    const looksLikeYours =
      input.updatedAt && input.weather && input.weather.tonight && input.sleep && (input.sleep.durationMinutes !== undefined);

    if (looksLikeYours) {
      const time = nowLocalTimeHHMM();
      const tod = inferTimeOfDay(time);

      const steps = safeNum(input.health?.steps);
      const distanceKm = safeNum(input.health?.distanceKm);
      const calories = safeNum(input.health?.caloriesKcal);
      const hr = safeNum(input.health?.heartRateBpm);

      const sleepMin = safeNum(input.sleep?.durationMinutes);
      const sleepQuality = input.sleep?.quality ? String(input.sleep.quality) : null;

      // events -> make a compact object with title + time
      const events = Array.isArray(input.events) ? input.events : [];
      const mappedEvents = events.map(e => ({
        title: e.title || "Event",
        time: isoToHHMM(e.start) || null,
        location: e.location || null
      }));

      // news -> list of strings (title • source)
      const newsArr = Array.isArray(input.news) ? input.news : [];
      const mappedNews = newsArr.map(n => {
        if (typeof n === "string") return n;
        const title = n.title ? String(n.title) : "News";
        const src = n.source ? String(n.source) : null;
        return src ? `${title} • ${src}` : title;
      });

      return {
        timeOfDay: tod,
        date: formatDateLine(input.updatedAt) || demo.date,
        time,
        location: formatLocation(input.location),
        weather: {
          tempC: safeNum(input.weather?.tempC),
          feelsLikeC: safeNum(input.weather?.feelsLike),
          condition: input.weather?.condition || input.weather?.tonight?.summary || "—",
          rainChance: safeNum(input.weather?.tonight?.rainChancePercent),
          windMph: safeNum(input.weather?.tonight?.windMph),
          tonightSummary: input.weather?.tonight?.summary || "—"
        },
        health: {
          steps: steps,
          distanceKm: distanceKm,
          calories: calories,
          heartRate: hr,
          stepsGoal: safeNum(input.health?.stepsGoal) ?? null,
          sleep: { durationMinutes: sleepMin }
        },
        // expose extra sleep info for note rendering
        _sleepMeta: {
          quality: sleepQuality,
          notes: input.sleep?.notes ? String(input.sleep.notes) : null,
          start: input.sleep?.start || null,
          end: input.sleep?.end || null
        },
        events: mappedEvents,
        news: mappedNews,
        updatedAt: input.updatedAt
      };
    }

    // Canonical schema from earlier
    if (input.weather && input.health && (input.time || input.date)) {
      const t = input.time || nowLocalTimeHHMM();
      const tod = input.timeOfDay || inferTimeOfDay(t);
      return { ...demo, ...input, time: t, timeOfDay: tod };
    }

    // Fallback: try old nested shortcut style
    if (input.weather && input.health) {
      const t = nowLocalTimeHHMM();
      const tod = inferTimeOfDay(t);

      const tempC = safeNum(input.weather.tempC);
      const feels = safeNum(input.weather.feelsLike);

      const steps = safeNum(input.health.steps);
      const hr = safeNum(input.health.heartRate);

      let sleepMinutes = safeNum(input.health.sleep?.durationMinutes);

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
          steps: steps,
          distanceKm: distanceKm,
          calories: calories,
          heartRate: hr,
          stepsGoal: safeNum(input.health.stepsGoal) ?? null,
          sleep: { durationMinutes: sleepMinutes }
        },
        events: Array.isArray(input.events) ? input.events : [],
        news: Array.isArray(input.news) ? input.news : [],
        updatedAt: input.updatedAt || demo.updatedAt
      };
    }

    return demo;
  }

  // ---------- Greeting ----------
  function getGreeting(tod) {
    if (tod === "morning") return { title: "Good morning", emoji: "☀️🐦🌅" };
    if (tod === "evening") return { title: "Good evening", emoji: "🌆✨" };
    return { title: "Good night", emoji: "🌙⭐🦉" };
  }

  function applyTheme(tod) {
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
    $("tonightLine").textContent = `Tonight: ${data.weather?.tonightSummary || "—"}`;
    $("feelsLike").textContent = fmtC(feels);
    $("rainChance").textContent = fmtPct(rain);
    $("wind").textContent = fmtMph(wind);

    // Steps (IMPORTANT: if null -> show —, not 0)
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

    // Sleep (your schema includes quality/notes)
    const sleepMin = safeNum(data.health?.sleep?.durationMinutes);
    $("sleepBig").textContent = minutesToHM(sleepMin);

    const q = data._sleepMeta?.quality;
    const notes = data._sleepMeta?.notes;
    if (sleepMin === null) {
      $("sleepNote").textContent = "No sleep data";
    } else {
      let s = "Total sleep duration";
      if (q) s = `${q} sleep`;
      if (notes) s = `${s} • ${notes}`;
      $("sleepNote").textContent = s;
    }

    // Events
    const events = Array.isArray(data.events) ? data.events : [];
    if (events.length === 0) {
      $("eventBig").textContent = "No events";
      $("eventNote").textContent = "No upcoming meetings";
    } else {
      const e = events[0];
      $("eventBig").textContent = e.title || "Event";
      if (e.time) $("eventNote").textContent = `Starts at ${e.time}`;
      else $("eventNote").textContent = "Upcoming event";
    }

    // News (now can be strings already)
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

    // Updated at
    $("updatedAt").textContent = data.updatedAt ? `Updated: ${String(data.updatedAt)}` : "";
  }

  // ---------- Boot ----------
  const b64 = getParam("data");
  const decoded = b64 ? decodeB64(b64) : null;
  const data = normalize(decoded || demo);

  applyTheme(data.timeOfDay);
  render(data);
})();
