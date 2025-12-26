function q(id){ return document.getElementById(id); }

function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmtInt(v, fallback="—"){
  const n = safeNum(v);
  return n === null ? fallback : String(Math.round(n));
}
function fmt1(v, fallback="—"){
  const n = safeNum(v);
  return n === null ? fallback : (Math.round(n * 10) / 10).toFixed(1);
}
function pick(obj, paths, fallback=null){
  for (const p of paths){
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const part of parts){
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined) return cur;
  }
  return fallback;
}

function parseDataFromUrl(){
  const sp = new URLSearchParams(location.search);
  const b64 = sp.get("data");
  if (!b64) return {};
  try{
    const jsonStr = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(jsonStr);
  }catch(e){
    console.log("Bad data param", e);
    return {};
  }
}

function getTheme(hour){
  // morning 5-11, evening 12-18, night 19-4
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 18) return "evening";
  return "night";
}

function headerEmoji(theme){
  if (theme === "morning") return "☀️🐦🌅";
  if (theme === "evening") return "🌇✨";
  return "🌙⭐️🦉";
}

function applyTheme(theme){
  document.body.dataset.theme = theme;
  // stars only at night
  q("stars").style.opacity = theme === "night" ? "1" : "0";
}

function render(data){
  // ---- time / meta ----
  const hour =
    safeNum(pick(data, ["meta.local_time_hour","local_time_hour"], null))
    ?? new Date().getHours();

  const theme = getTheme(hour);
  applyTheme(theme);

  const greeting =
    pick(data, ["meta.greeting"], null) ||
    (theme === "morning" ? "Good morning" : theme === "evening" ? "Good evening" : "Good night");

  q("greeting").textContent = `${greeting} ${headerEmoji(theme)}`;

  const dateLine = pick(data, ["meta.date_human","date_human","date"], null);
  if (dateLine) q("dateLine").textContent = String(dateLine);

  const timeText = pick(data, ["meta.time_hhmm","time_hhmm"], null);
  if (timeText) q("timePill").textContent = String(timeText);

  const briefType = pick(data, ["meta.brief_type","brief_type"], null);
  if (briefType) q("briefPill").textContent = `${briefType[0].toUpperCase()}${briefType.slice(1)} brief`;

  // ---- weather ----
  // FIX FOR “MANY DIGITS”: show location, NOT raw coords
  const loc = pick(data, ["meta.location","location","weather.location_name"], "—");
  q("weatherMeta").textContent = loc;

  const tempNow = pick(data, ["weather.now.temp_c","current_temperature_c"], null);
  q("tempNow").textContent = fmtInt(tempNow, "—");

  const feels = pick(data, ["weather.now.feels_like_c","feels_like_c"], null);
  q("feelsLike").textContent = (feels === null ? "—" : `${fmtInt(feels)}°C`);

  const nowSummary = pick(data, ["weather.now.summary","current_summary","weather_now_summary"], "—");
  q("condNow").textContent = String(nowSummary);

  const tonightSummary = pick(data, ["weather.tonight.summary","tonight_summary"], "—");
  q("tonightSummary").textContent = String(tonightSummary);

  const rain = pick(data, ["weather.tonight.chance_of_rain_percent","tonight_rain_percent"], null);
  q("rainChance").textContent = (rain === null ? "—" : `${fmtInt(rain)}%`);

  const wind = pick(data, ["weather.tonight.wind_speed_mph","tonight_wind_mph"], null);
  q("windMph").textContent = (wind === null ? "—" : `${fmtInt(wind)} mph`);

  // ---- steps (FIX: accept multiple keys) ----
  const steps =
    pick(data, ["health.steps.count","steps_today","stepsToday","health.steps_today"], null);

  q("stepsCount").textContent = fmtInt(steps, "—");

  // optional extras (show — if missing)
  q("stepsDistance").textContent = pick(data, ["health.steps.distance_km","steps_distance_km"], "—");
  q("stepsCalories").textContent = pick(data, ["health.steps.calories","steps_calories"], "—");
  q("stepsActiveMin").textContent = pick(data, ["health.steps.duration_min","steps_duration_min"], "—");

  // ---- heart ----
  const bpm = pick(data, ["health.heart_rate.bpm","heart_rate_bpm"], null);
  q("hrBpm").textContent = bpm === null ? "—" : fmtInt(bpm);

  // ---- sleep ----
  const sleepDur = pick(data, ["health.sleep.duration_text","sleep_duration_text"], null);
  q("sleepDuration").textContent = sleepDur ? String(sleepDur) : "—";

  q("sleepQuality").textContent = pick(data, ["health.sleep.quality","sleep_quality"], "—");
  q("sleepNotes").textContent = pick(data, ["health.sleep.notes","sleep_notes"], "—");

  const start = pick(data, ["health.sleep.start_local","sleep_start_local"], null);
  const end = pick(data, ["health.sleep.end_local","sleep_end_local"], null);
  q("sleepWindow").textContent = (start && end) ? `${start} → ${end}` : "—";

  // ---- events ----
  const nextTitle = pick(data, ["calendar.next_event.title","next_event_title"], null);
  const nextTime  = pick(data, ["calendar.next_event.start_local","next_event_start_local"], null);

  const eventBox = q("nextEvent");
  if (nextTitle){
    eventBox.querySelector(".event-title").textContent = nextTitle;
    eventBox.querySelector(".event-time").textContent = nextTime || "—";
  } else {
    eventBox.querySelector(".event-title").textContent = "No upcoming events";
    eventBox.querySelector(".event-time").textContent = "—";
  }

  // ---- news ----
  const items = pick(data, ["news.top_items"], []);
  const newsBox = q("newsBox");
  if (Array.isArray(items) && items.length){
    newsBox.innerHTML = items.slice(0,4).map(x => `• ${String(x)}`).join("<br>");
  } else {
    newsBox.textContent = "No news items";
  }

  // ---- brief text + updated ----
  const brief = pick(data, ["brief_text.evening","brief_text.morning","brief","brief_text"], null);
  q("briefText").textContent = brief ? String(brief) : "—";

  const updated = pick(data, ["meta.updated_at_local","updated_at"], null);
  q("updatedAt").textContent = updated ? `Updated: ${updated}` : "Updated: —";
}

// Run
render(parseDataFromUrl());
