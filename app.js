function b64DecodeUnicode(str) {
  // base64 -> utf8
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function fmtNum(x) {
  if (x === null || x === undefined || x === "") return "—";
  return String(x);
}

function addChip(container, label, value, suffix="") {
  if (value === null || value === undefined || value === "" || value === "—") return;
  const div = document.createElement("div");
  div.className = "chip";
  div.textContent = `${label}: ${value}${suffix}`;
  container.appendChild(div);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (val === null || val === undefined || val === "") ? "—" : val;
}

function safeArray(a){ return Array.isArray(a) ? a : []; }

(function init(){
  const params = new URLSearchParams(location.search);
  const dataParam = params.get("data");

  if (!dataParam) {
    document.getElementById("meta").textContent = "No data provided";
    return;
  }

  let data;
  try {
    const jsonText = b64DecodeUnicode(dataParam);
    data = JSON.parse(jsonText);
  } catch (e) {
    document.getElementById("meta").textContent = "Invalid data";
    return;
  }

  setText("title", data.title || "Good Morning Brief");

  const metaParts = [];
  if (data.date) metaParts.push(data.date);
  if (data.time) metaParts.push(data.time);
  if (data.location) metaParts.push(data.location);
  document.getElementById("meta").textContent = metaParts.join(" • ");

  // Health
  setText("sleepDuration", data?.health?.sleepDuration || "—");
  setText("stepsToday", fmtNum(data?.health?.stepsToday));
  setText("distance", data?.health?.distance || "—");

  // Weather
  setText("weatherCondition", data?.weather?.condition || "—");
  const t = data?.weather?.tempC;
  const f = data?.weather?.feelsLikeC;
  setText("tempC", (t === null || t === undefined) ? "—" : `${t}°C`);
  setText("feelsLike", (f === null || f === undefined) ? "—" : `Feels like ${f}°C`);

  const chips = document.getElementById("weatherChips");
  chips.innerHTML = "";
  addChip(chips, "High/Low", (data?.weather?.highC!=null && data?.weather?.lowC!=null) ? `${data.weather.highC}° / ${data.weather.lowC}°` : "");
  addChip(chips, "Humidity", data?.weather?.humidityPct, "%");
  addChip(chips, "Wind", (data?.weather?.windMph!=null) ? `${data.weather.windMph} mph` : "");
  addChip(chips, "AQI", data?.weather?.aqi);
  addChip(chips, "UV", data?.weather?.uv);
  addChip(chips, "Visibility", data?.weather?.visibility);

  // Events
  const events = safeArray(data.calendarEvents);
  const eventsList = document.getElementById("eventsList");
  eventsList.innerHTML = "";
  if (events.length === 0) {
    eventsList.innerHTML = `<div class="item"><div class="itemTitle">No events</div></div>`;
  } else {
    events.forEach(ev => {
      const item = document.createElement("div");
      item.className = "item";
      const time = [ev.start, ev.end].filter(Boolean).join(" – ");
      item.innerHTML = `
        <div class="itemTop">
          <div class="itemTitle">${ev.title || "Event"}</div>
          <div class="itemTime">${time || ""}</div>
        </div>
        ${ev.location ? `<div class="itemSub">${ev.location}</div>` : ``}
      `;
      eventsList.appendChild(item);
    });
  }

  // Magazine
  const mags = safeArray(data.magazineIssues);
  const magList = document.getElementById("magList");
  magList.innerHTML = "";
  if (mags.length === 0) {
    magList.innerHTML = `<div class="item"><div class="itemTitle">No downloads</div></div>`;
  } else {
    mags.forEach(m => {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="itemTop">
          <div class="itemTitle">${m.title || "Issue"}</div>
          <div class="itemTime">${m.status || ""}</div>
        </div>
      `;
      magList.appendChild(item);
    });
  }

  // footer (no extra suggestions; just show last updated if you include it)
  setText("foot", data.updatedAt || "");
})();
