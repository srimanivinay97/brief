(function () {
  const $ = (id) => document.getElementById(id);

  function safeText(el, value, fallback = "—") {
    el.textContent = (value === undefined || value === null || value === "") ? fallback : String(value);
  }

  function formatDateLabel(dateStr) {
    // accepts "2025-12-26" or "26 Dec 2025"
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short" });
    }
    return dateStr || "Today";
  }

  function parseBase64JsonParam() {
    const url = new URL(window.location.href);
    const b64 = url.searchParams.get("data");
    if (!b64) return null;

    // handle url-safe base64
    const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = norm + "===".slice((norm.length + 3) % 4);

    try {
      const jsonText = decodeURIComponent(escape(atob(pad)));
      return JSON.parse(jsonText);
    } catch (e) {
      try {
        return JSON.parse(atob(pad));
      } catch (e2) {
        console.error("Failed to decode data param", e, e2);
        return null;
      }
    }
  }

  function parseSleepToMinutes(sleepValue) {
    // Supports:
    // - number (seconds OR minutes OR hours-ish)
    // - "7h 30m", "7 h 30 m"
    // - "{575.19}h {11.55}m" (your earlier style)
    // - "450" (minutes) etc.
    if (sleepValue === undefined || sleepValue === null) return null;

    // numeric
    if (typeof sleepValue === "number") {
      // heuristic:
      // if very large -> seconds
      if (sleepValue > 10000) return Math.round(sleepValue / 60);
      // if looks like hours (e.g., 7.5)
      if (sleepValue > 0 && sleepValue < 24) return Math.round(sleepValue * 60);
      // otherwise assume minutes
      return Math.round(sleepValue);
    }

    const s = String(sleepValue).trim();

    // extract all numbers that appear before h/m markers
    // handles "{575.19}h {11.55}m" too
    const hMatch = s.match(/([\d.]+)\s*h/i);
    const mMatch = s.match(/([\d.]+)\s*m/i);

    if (hMatch || mMatch) {
      const hours = hMatch ? parseFloat(hMatch[1]) : 0;
      const mins = mMatch ? parseFloat(mMatch[1]) : 0;
      if (isFinite(hours) || isFinite(mins)) return Math.round(hours * 60 + mins);
    }

    // fallback: if it's just a number in a string
    const n = parseFloat(s.replace(/[^\d.]/g, ""));
    if (isFinite(n)) {
      if (n > 10000) return Math.round(n / 60);
      if (n > 0 && n < 24) return Math.round(n * 60);
      return Math.round(n);
    }

    return null;
  }

  function minutesToHhMm(mins) {
    if (mins === null || mins === undefined || !isFinite(mins)) return null;
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}h ${String(r).padStart(2, "0")}m`;
  }

  function render(data) {
    // Top
    const now = new Date();
    safeText($("pillTime"), now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

    const dateLabel =
      data?.date ? formatDateLabel(data.date) :
      data?.updatedAt ? formatDateLabel(data.updatedAt) :
      formatDateLabel(now.toISOString());

    safeText($("subtitle"), dateLabel, "Today");

    // Location (optional)
    const loc = data?.location || data?.city || null;
    if (loc) {
      $("title").textContent = `Good morning`;
      $("subtitle").textContent = `${dateLabel} • ${loc}`;
    }

    // Sleep
    const sleepRaw =
      data?.health?.sleep ??
      data?.sleepDuration ??
      data?.sleep ??
      null;

    const sleepMin = parseSleepToMinutes(sleepRaw);
    const sleepPretty = sleepMin !== null ? minutesToHhMm(sleepMin) : null;

    safeText($("sleepMain"), sleepPretty || "—");
    safeText($("sleepBadge"), sleepMin !== null ? "Last night" : "No data");

    safeText($("sleepQuality"),
      data?.health?.sleepQuality ?? data?.sleepQuality ?? "—"
    );
    safeText($("sleepNote"),
      data?.health?.sleepNote ?? data?.sleepNote ?? ""
    );

    // Steps
    const steps =
      data?.health?.steps ??
      data?.steps_today ??
      data?.stepsToday ??
      data?.steps ??
      null;

    if (steps !== null && steps !== undefined && steps !== "") {
      const n = Number(steps);
      safeText($("stepsMain"), isFinite(n) ? n.toLocaleString() : steps);
    } else {
      safeText($("stepsMain"), "—");
    }

    safeText($("stepsDistance"),
      data?.health?.distance ??
      data?.distance ??
      data?.distance_km ??
      "—"
    );
    safeText($("stepsCalories"),
      data?.health?.activeCalories ??
      data?.calories ??
      "—"
    );

    // Weather
    const temp =
      data?.weather?.tempC ??
      data?.current_temperature_c ??
      data?.tempC ??
      null;

    const cond =
      data?.weather?.condition ??
      data?.tonight_summary ?? // if only that exists
      data?.condition ??
      null;

    if (temp !== null && temp !== undefined && temp !== "") {
      safeText($("weatherMain"), `${temp}°C${cond ? " • " + cond : ""}`);
    } else {
      safeText($("weatherMain"), cond || "—");
    }

    const feels =
      data?.weather?.feelsLike ??
      data?.feels_like_c ??
      data?.weather?.feelsLikeC ??
      null;

    safeText($("weatherFeels"), feels !== null && feels !== undefined ? `${feels}°C` : "—");

    const tonight =
      data?.tonight_summary ??
      data?.weather?.tonight?.summary ??
      data?.tonight_conditions?.summary ??
      null;

    const rain =
      data?.tonight_rain_percent ??
      data?.weather?.tonight?.chance_of_rain_percent ??
      data?.tonight_conditions?.chance_of_rain_percent ??
      null;

    safeText($("weatherTonight"),
      tonight ? `${tonight}${(rain !== null && rain !== undefined) ? ` • ${rain}%` : ""}` : "—"
    );

    // Events
    const eventsEl = $("events");
    eventsEl.innerHTML = "";
    const events = data?.events ?? data?.calendarEvents ?? [];
    if (Array.isArray(events) && events.length) {
      for (const ev of events.slice(0, 6)) {
        const title = ev.title || ev.name || "Event";
        const time = ev.time || ev.start || "";
        const loc2 = ev.location || "";
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <div class="left">
            <div class="t"></div>
            <div class="s"></div>
          </div>
          <div class="s"></div>
        `;
        item.querySelector(".t").textContent = title;
        item.querySelectorAll(".s")[0].textContent = [time, loc2].filter(Boolean).join(" • ") || "—";
        item.querySelectorAll(".s")[1].textContent = "";
        eventsEl.appendChild(item);
      }
    } else {
      const none = document.createElement("div");
      none.className = "item muted";
      none.textContent = "No events";
      eventsEl.appendChild(none);
    }

    // Magazine downloads
    const magsEl = $("magazines");
    magsEl.innerHTML = "";
    const mags = data?.magazine ?? data?.magazines ?? data?.downloads ?? [];
    if (Array.isArray(mags) && mags.length) {
      for (const m of mags.slice(0, 6)) {
        const title = m.title || m.name || "Issue";
        const status = m.status || m.state || "Downloaded";
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <div class="left">
            <div class="t"></div>
            <div class="s"></div>
          </div>
          <div class="s"></div>
        `;
        item.querySelector(".t").textContent = title;
        item.querySelectorAll(".s")[0].textContent = m.date || m.when || "";
        item.querySelectorAll(".s")[1].textContent = status;
        magsEl.appendChild(item);
      }
    } else {
      const none = document.createElement("div");
      none.className = "item muted";
      none.textContent = "No downloads";
      magsEl.appendChild(none);
    }

    // Updated at
    safeText($("updatedAt"),
      data?.updatedAt ? `Updated: ${data.updatedAt}` : ""
    );
  }

  const data = parseBase64JsonParam();

  if (!data) {
    // show nice empty state but still styled (so you can confirm CSS loads)
    render({
      location: "London",
      date: new Date().toISOString(),
      health: { steps: null, sleep: null },
      weather: { tempC: null, condition: null }
    });
    $("subtitle").textContent = "No data param found • UI loaded";
  } else {
    render(data);
  }
})();
