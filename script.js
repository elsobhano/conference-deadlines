(function () {
  "use strict";

  const listEl = document.getElementById("conference-list");
  const emptyEl = document.getElementById("empty-state");
  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");
  const modal = document.getElementById("modal");
  const modalClose = document.getElementById("modal-close");
  const modalTitle = document.getElementById("modal-title");
  const modalLocation = document.getElementById("modal-location");
  const modalSubmission = document.getElementById("modal-submission");
  const modalRegistration = document.getElementById("modal-registration");
  const modalDates = document.getElementById("modal-dates");
  const modalNotification = document.getElementById("modal-notification");
  const modalReview = document.getElementById("modal-review");
  const modalReviewLabel = document.getElementById("modal-review-label");
  const planBEl = document.getElementById("modal-plan-b");
  const planBIntro = document.getElementById("plan-b-intro");
  const planBGroups = document.getElementById("plan-b-groups");
  const modalWebsite = document.getElementById("modal-website");
  const modalWarning = document.getElementById("modal-warning");
  const modalWarningText = document.getElementById("modal-warning-text");
  const modalStats = document.getElementById("modal-stats");
  const compareModal = document.getElementById("compare-modal");
  const compareBtn = document.getElementById("compare-btn");
  const compareClose = document.getElementById("compare-close");
  const timelineModal = document.getElementById("timeline-modal");
  const timelineBtn = document.getElementById("timeline-btn");
  const timelineClose = document.getElementById("timeline-close");
  const timelineSelect = document.getElementById("timeline-select");
  const timelineChart = document.getElementById("timeline-chart");
  const timelineSummary = document.getElementById("timeline-summary");

  let chartRate = null;
  let chartSubs = null;
  let compareChartRate = null;
  let compareChartSubs = null;

  const CHART_COLORS = [
    "#38bdf8",
    "#a78bfa",
    "#4ade80",
    "#fbbf24",
    "#f87171",
    "#ec4899",
    "#10b981",
    "#f97316",
    "#06b6d4",
    "#eab308",
    "#8b5cf6",
    "#22d3ee",
    "#f43f5e",
    "#84cc16",
  ];
  const countdownEl = document.getElementById("countdown");
  const countdownTargetEl = document.getElementById("countdown-target");
  const cdDays = document.getElementById("cd-days");
  const cdHours = document.getElementById("cd-hours");
  const cdMinutes = document.getElementById("cd-minutes");
  const cdSeconds = document.getElementById("cd-seconds");
  const cdTargetPanel = document.getElementById("cd-target-panel");
  const cdTargetKind = document.getElementById("cd-target-kind");
  const cdTargetDate = document.getElementById("cd-target-date");
  const cdTargetTz = document.getElementById("cd-target-tz");
  const cdTargetLocal = document.getElementById("cd-target-local");

  let countdownTimer = null;
  const liveBadges = [];
  let badgeTickerStarted = false;
  let activeFilter = "all";

  // Offset of each timezone label in minutes east of UTC.
  const TZ_OFFSETS_MIN = {
    AOE: -12 * 60,
    UTC: 0,
    GMT: 0,
    WET: 0,
    WEST: 60,
    BST: 60,
    CET: 60,
    CEST: 120,
    EET: 120,
    EEST: 180,
    MSK: 180,
    IST: 5.5 * 60,
    PKT: 5 * 60,
    SGT: 8 * 60,
    HKT: 8 * 60,
    CST: 8 * 60,
    JST: 9 * 60,
    KST: 9 * 60,
    AEDT: 11 * 60,
    AEST: 10 * 60,
    NZDT: 13 * 60,
    NZST: 12 * 60,
    EST: -5 * 60,
    EDT: -4 * 60,
    CT: -6 * 60,
    CDT: -5 * 60,
    MST: -7 * 60,
    MDT: -6 * 60,
    PST: -8 * 60,
    PDT: -7 * 60,
    AKST: -9 * 60,
    HST: -10 * 60,
  };

  function tzOffsetMin(label) {
    if (!label) return null;
    const key = String(label).toUpperCase().trim();
    return key in TZ_OFFSETS_MIN ? TZ_OFFSETS_MIN[key] : null;
  }

  function parseIsoParts(value) {
    if (!value) return null;
    // Time part is optional: notification dates are recorded as plain dates.
    const m = String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/
    );
    if (!m) return null;
    let offsetMin = null;
    if (m[7]) {
      if (m[7] === "Z") offsetMin = 0;
      else {
        const mm = m[7].match(/^([+-])(\d{2}):?(\d{2})$/);
        if (mm) offsetMin = (mm[1] === "+" ? 1 : -1) * (+mm[2] * 60 + +mm[3]);
      }
    }
    return {
      y: +m[1],
      mo: +m[2] - 1,
      d: +m[3],
      h: +(m[4] || 0),
      mi: +(m[5] || 0),
      s: +(m[6] || 0),
      offsetMin,
    };
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    dateStyle: "long",
    timeStyle: "short",
  });
  const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const wallClockDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const localDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });

  // For DISPLAY: returns a Date whose UTC fields equal the wall-clock fields
  // of the ISO string. Format with `timeZone: "UTC"` to render those numbers
  // verbatim, regardless of the viewer's local timezone.
  function wallClockDate(value) {
    const p = parseIsoParts(value);
    if (!p) {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d) ? null : d;
    }
    return new Date(Date.UTC(p.y, p.mo, p.d, p.h, p.mi, p.s));
  }

  // For MATH: returns the actual instant of the deadline. Uses the explicit
  // offset in the ISO string if present, else derives it from the conf's
  // `timezone` label, else falls back to the viewer's local time.
  function parseDate(value, timezone) {
    const p = parseIsoParts(value);
    if (!p) {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d) ? null : d;
    }
    let offsetMin = p.offsetMin;
    if (offsetMin === null) offsetMin = tzOffsetMin(timezone);
    if (offsetMin === null) {
      return new Date(p.y, p.mo, p.d, p.h, p.mi, p.s);
    }
    return new Date(Date.UTC(p.y, p.mo, p.d, p.h, p.mi, p.s) - offsetMin * 60000);
  }

  function formatDate(value) {
    const d = wallClockDate(value);
    return d ? dateFormatter.format(d) : "TBA";
  }

  function formatShortDate(value) {
    const d = wallClockDate(value);
    return d ? shortDateFormatter.format(d) : "TBA";
  }

  function isPassed(value, timezone) {
    const d = parseDate(value, timezone);
    return d && !isNaN(d) && d.getTime() < Date.now();
  }

  function estimateText(conf) {
    return (
      conf.estimatedNote ||
      "Last year's dates — current-year deadlines not yet announced."
    );
  }

  function formatNumber(n) {
    if (n == null || isNaN(n)) return "";
    return new Intl.NumberFormat(undefined).format(n);
  }

  function latestStat(conf) {
    if (!Array.isArray(conf.stats) || conf.stats.length === 0) return null;
    return conf.stats
      .slice()
      .sort((a, b) => (b.year || 0) - (a.year || 0))[0];
  }

  function renderStatLine(stat) {
    if (!stat) return "";
    const parts = [];
    if (stat.acceptanceRate != null)
      parts.push(`${stat.acceptanceRate}% accepted`);
    if (stat.submissions != null)
      parts.push(`${formatNumber(stat.submissions)} submissions`);
    if (parts.length === 0) return "";
    return `<div class="card-stats">📊 ${parts.join(" · ")}${
      stat.year ? ` <span class="stat-year">(${stat.year})</span>` : ""
    }</div>`;
  }

  // Pick the next relevant deadline: registration if it hasn't passed,
  // otherwise submission. Returns { date, kind } or null.
  function getActiveDeadline(conf) {
    const now = Date.now();
    const reg = parseDate(conf.registrationDeadline, conf.timezone);
    const sub = parseDate(conf.submissionDeadline, conf.timezone);
    const regValid = reg && !isNaN(reg);
    const subValid = sub && !isNaN(sub);

    if (regValid && reg.getTime() >= now) return { date: reg, kind: "registration" };
    if (subValid) return { date: sub, kind: "submission" };
    if (regValid) return { date: reg, kind: "registration" };
    return null;
  }

  function badgeFor(active) {
    if (!active) return { label: "Deadlines TBA", cls: "tba" };
    const action =
      active.kind === "registration" ? "Submit Abstract" : "Submit Full Paper";
    const noun =
      active.kind === "registration" ? "Abstract" : "Full Paper";
    const diffMs = active.date.getTime() - Date.now();

    if (diffMs < 0) return { label: `${noun} passed`, cls: "passed" };

    const dayMs = 24 * 60 * 60 * 1000;
    if (diffMs < dayMs) {
      const hours = Math.floor(diffMs / (60 * 60 * 1000));
      const minutes = Math.floor((diffMs / (60 * 1000)) % 60);
      const seconds = Math.floor((diffMs / 1000) % 60);
      return {
        label: `Time To ${action} : ${hours}h ${minutes}m ${seconds}s`,
        cls: "urgent",
      };
    }

    const days = Math.floor(diffMs / dayMs);
    const unit = days === 1 ? "day" : "days";
    let cls;
    if (days < 7) cls = "urgent";
    else if (days < 30) cls = "soon";
    else cls = "upcoming";
    return { label: `Time To ${action} : ${days} ${unit}`, cls };
  }

  function sortConferences(list, mode) {
    const copy = list.slice();
    const now = Date.now();

    if (mode === "name") {
      copy.sort((a, b) => a.name.localeCompare(b.name));
      return copy;
    }

    const dateKey =
      mode === "registration" ? "registrationDeadline" : "submissionDeadline";

    // Upcoming first (soonest → latest), then passed (most recent → oldest),
    // then TBA / missing dates last.
    copy.sort((a, b) => {
      const da = parseDate(a[dateKey], a.timezone);
      const db = parseDate(b[dateKey], b.timezone);
      const aValid = da && !isNaN(da);
      const bValid = db && !isNaN(db);
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (!aValid) return 0;
      const ta = da.getTime();
      const tb = db.getTime();
      const aPassed = ta < now;
      const bPassed = tb < now;
      if (aPassed !== bPassed) return aPassed ? 1 : -1;
      if (aPassed) return tb - ta;
      return ta - tb;
    });
    return copy;
  }

  function filterConferences(list, query) {
    const q = query.trim().toLowerCase();
    let filtered = list;
    if (activeFilter !== "all") {
      filtered = filtered.filter(
        (c) => (c.type || "conference") === activeFilter
      );
    }
    if (!q) return filtered;
    return filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.fullName && c.fullName.toLowerCase().includes(q)) ||
        c.location.toLowerCase().includes(q)
    );
  }

  function createCard(conf) {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `View countdown for ${conf.name}`);

    const active = getActiveDeadline(conf);
    const badge = badgeFor(active);

    const tz = conf.timezone ? escapeHTML(conf.timezone) : "local";
    const regCls = isPassed(conf.registrationDeadline, conf.timezone) ? "passed-date" : "";
    const subCls = isPassed(conf.submissionDeadline, conf.timezone) ? "passed-date" : "";
    const estimateBanner = conf.estimated
      ? `<div class="estimate-banner small"><span class="estimate-icon">⚠</span>${escapeHTML(estimateText(conf))}</div>`
      : "";
    const type = conf.type === "workshop" ? "workshop" : "conference";
    const typeTag = `<span class="type-pill type-${type}">${type === "workshop" ? "Workshop" : "Conference"}</span>`;
    const parentLine =
      type === "workshop" && conf.parentConference
        ? `<div class="card-parent">@ ${escapeHTML(conf.parentConference)}</div>`
        : "";
    card.classList.add(`card-${type}`);
    card.innerHTML = `
      <div class="card-header">
        <h3 class="card-name">${escapeHTML(conf.name)}</h3>
        ${typeTag}
      </div>
      <div class="card-location">📍 ${escapeHTML(conf.location)}</div>
      ${parentLine}
      ${estimateBanner}
      <div class="card-row">
        <span>Abstract</span>
        <span class="${regCls}">${formatShortDate(conf.registrationDeadline)}${tz !== "local" ? ` <span class="date-tz">${tz}</span>` : ""}</span>
      </div>
      <div class="card-row">
        <span>Full Paper</span>
        <span class="${subCls}">${formatShortDate(conf.submissionDeadline)}${tz !== "local" ? ` <span class="date-tz">${tz}</span>` : ""}</span>
      </div>
      <div class="card-row">
        <span>Timezone</span>
        <span class="tz-pill">${tz}</span>
      </div>
      ${renderStatLine(latestStat(conf))}
      ${badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : ""}
    `;

    const open = () => openModal(conf);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    const badgeEl = card.querySelector(".badge");
    if (badgeEl) liveBadges.push({ el: badgeEl, conf });

    return card;
  }

  function tickBadges() {
    for (const entry of liveBadges) {
      const info = badgeFor(getActiveDeadline(entry.conf));
      if (!info) continue;
      entry.el.className = `badge ${info.cls}`;
      entry.el.textContent = info.label;
    }
  }

  function startBadgeTicker() {
    if (badgeTickerStarted) return;
    badgeTickerStarted = true;
    setInterval(tickBadges, 1000);
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function render() {
    const query = searchEl.value;
    const sort = sortEl.value;
    const filtered = filterConferences(window.CONFERENCES || [], query);
    const sorted = sortConferences(filtered, sort);

    listEl.innerHTML = "";
    liveBadges.length = 0;
    if (sorted.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    const frag = document.createDocumentFragment();
    sorted.forEach((c) => frag.appendChild(createCard(c)));
    listEl.appendChild(frag);
    startBadgeTicker();
  }

  function updateCountdown(conf, active) {
    const now = new Date();
    const targetDate = active.date;
    let diff = targetDate.getTime() - now.getTime();
    const passed = diff < 0;
    if (passed) diff = -diff;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    cdDays.textContent = days;
    cdHours.textContent = String(hours).padStart(2, "0");
    cdMinutes.textContent = String(minutes).padStart(2, "0");
    cdSeconds.textContent = String(seconds).padStart(2, "0");

    // Target panel — deadline-tz wall-clock + viewer-local equivalent.
    const rawValue =
      active.kind === "registration"
        ? conf.registrationDeadline
        : conf.submissionDeadline;
    const kindHeading =
      active.kind === "registration"
        ? "Abstract deadline"
        : "Full paper deadline";
    const wallDate = wallClockDate(rawValue);
    cdTargetPanel.classList.toggle("passed", passed);
    cdTargetKind.textContent = passed
      ? `${kindHeading} · passed`
      : kindHeading;
    cdTargetDate.textContent = wallDate
      ? wallClockDateTimeFormatter.format(wallDate)
      : "";
    cdTargetTz.textContent = conf.timezone || "local";
    cdTargetTz.style.display = conf.timezone ? "" : "none";

    const offsetMin = tzOffsetMin(conf.timezone);
    // Only show local equivalent if the deadline tz differs from the viewer's.
    if (offsetMin != null && offsetMin !== -now.getTimezoneOffset()) {
      const localStr = localDateTimeFormatter.format(targetDate);
      cdTargetLocal.textContent = `≈ ${localStr} in your local time`;
      cdTargetLocal.style.display = "";
    } else {
      cdTargetLocal.textContent = "";
      cdTargetLocal.style.display = "none";
    }

    countdownEl.classList.toggle("passed", passed);
    countdownTargetEl.style.display = "none";
  }

  function stripYear(name) {
    return String(name)
      .replace(/\s*\(estimated\)/i, "")
      .replace(/\s+(?:19|20|21)\d{2}\b/g, "")
      .trim();
  }

  const legendHoverHandlers = {
    onHover(_e, item, legend) {
      const datasets = legend.chart.data.datasets;
      datasets.forEach((ds, i) => {
        if (!ds._origColor) ds._origColor = ds.borderColor;
        if (i === item.datasetIndex) {
          ds.borderWidth = 4.5;
          ds.borderColor = ds._origColor;
          ds.pointRadius = 4;
        } else {
          ds.borderWidth = 1;
          ds.borderColor = ds._origColor + "33";
          ds.pointRadius = 0;
        }
      });
      legend.chart.update("none");
    },
    onLeave(_e, _item, legend) {
      const datasets = legend.chart.data.datasets;
      datasets.forEach((ds) => {
        ds.borderWidth = 2;
        ds.pointRadius = 2;
        if (ds._origColor) ds.borderColor = ds._origColor;
      });
      legend.chart.update("none");
    },
  };

  function chartOptions({ yLabel, showLegend = false, legendHover = false } = {}) {
    const legend = {
      display: showLegend,
      position: "bottom",
      labels: {
        color: "#e2e8f0",
        boxWidth: 12,
        font: { size: 11 },
        padding: 8,
      },
    };
    if (legendHover) Object.assign(legend, legendHoverHandlers);
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend,
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148, 163, 184, 0.1)" },
        },
        y: {
          beginAtZero: true,
          title: yLabel
            ? { display: true, text: yLabel, color: "#94a3b8" }
            : undefined,
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148, 163, 184, 0.1)" },
        },
      },
    };
  }

  function renderModalCharts(conf) {
    if (chartRate) {
      chartRate.destroy();
      chartRate = null;
    }
    if (chartSubs) {
      chartSubs.destroy();
      chartSubs = null;
    }
    const stats = Array.isArray(conf.stats) ? conf.stats.slice() : [];
    if (stats.length === 0 || typeof Chart === "undefined") {
      modalStats.hidden = true;
      return;
    }
    modalStats.hidden = false;
    stats.sort((a, b) => (a.year || 0) - (b.year || 0));
    const labels = stats.map((s) => s.year);
    const rates = stats.map((s) => (s.acceptanceRate != null ? s.acceptanceRate : null));
    const subs = stats.map((s) => (s.submissions != null ? s.submissions : null));

    chartRate = new Chart(document.getElementById("modal-chart-rate"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Acceptance %",
            data: rates,
            borderColor: "#a78bfa",
            backgroundColor: "rgba(167, 139, 250, 0.18)",
            fill: true,
            tension: 0.25,
            spanGaps: true,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: chartOptions({ yLabel: "%" }),
    });

    chartSubs = new Chart(document.getElementById("modal-chart-subs"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Submissions",
            data: subs,
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.18)",
            fill: true,
            tension: 0.25,
            spanGaps: true,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: chartOptions(),
    });
  }

  function renderCompareCharts() {
    if (compareChartRate) {
      compareChartRate.destroy();
      compareChartRate = null;
    }
    if (compareChartSubs) {
      compareChartSubs.destroy();
      compareChartSubs = null;
    }
    if (typeof Chart === "undefined") return;

    const confs = (window.CONFERENCES || []).filter(
      (c) => Array.isArray(c.stats) && c.stats.length > 0
    );
    if (confs.length === 0) return;

    const yearSet = new Set();
    confs.forEach((c) => c.stats.forEach((s) => yearSet.add(s.year)));
    const labels = Array.from(yearSet)
      .filter((y) => typeof y === "number")
      .sort((a, b) => a - b);

    const makeDatasets = (key) =>
      confs.map((c, i) => ({
        label: stripYear(c.name),
        data: labels.map((y) => {
          const stat = c.stats.find((s) => s.year === y);
          return stat && stat[key] != null ? stat[key] : null;
        }),
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: "transparent",
        spanGaps: true,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      }));

    compareChartRate = new Chart(
      document.getElementById("compare-chart-rate"),
      {
        type: "line",
        data: { labels, datasets: makeDatasets("acceptanceRate") },
        options: chartOptions({ yLabel: "%", showLegend: true, legendHover: true }),
      }
    );

    compareChartSubs = new Chart(
      document.getElementById("compare-chart-subs"),
      {
        type: "line",
        data: { labels, datasets: makeDatasets("submissions") },
        options: chartOptions({ showLegend: true, legendHover: true }),
      }
    );
  }

  // ---- Plan B timeline -----------------------------------------------------

  const monthFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
  });
  const monthYearFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  });
  // Row labels are tight on space and the axis already carries the year.
  const dayMonthFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });

  function formatDayMonth(value) {
    const d = wallClockDate(value);
    return d ? dayMonthFormatter.format(d) : "TBA";
  }

  // Month gridlines across [t0, t1], thinned out so a long span stays legible.
  function monthTicks(t0, t1) {
    const spanDays = (t1 - t0) / DAY_MS;
    const step = spanDays > 550 ? 3 : spanDays > 300 ? 2 : 1;
    const start = new Date(t0);
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth() + 1;
    const ticks = [];
    for (let guard = 0; guard < 200; guard++) {
      const t = Date.UTC(y, m, 1);
      if (t >= t1) break;
      ticks.push(t);
      m += step;
      while (m > 11) {
        m -= 12;
        y += 1;
      }
    }
    return ticks;
  }

  function tickLabel(t) {
    const d = new Date(t);
    return d.getUTCMonth() === 0
      ? monthYearFormatter.format(d)
      : monthFormatter.format(d);
  }

  // Which conference is the user most likely waiting on? The one whose paper
  // deadline has passed but whose decision has not landed yet.
  function defaultTimelineConf(list) {
    const now = Date.now();
    const waiting = list
      .filter((c) => {
        const sub = parseDate(c.submissionDeadline, c.timezone);
        const notif = parseDate(c.notificationDate, c.timezone);
        return (
          sub && !isNaN(sub) && sub.getTime() <= now &&
          notif && !isNaN(notif) && notif.getTime() >= now
        );
      })
      .sort(
        (a, b) =>
          parseDate(a.notificationDate, a.timezone) -
          parseDate(b.notificationDate, b.timezone)
      );
    if (waiting.length) return waiting[0];
    // Otherwise the next deadline coming up.
    const upcoming = sortConferences(list, "submission")[0];
    return upcoming || list[0] || null;
  }

  function populateTimelineSelect() {
    const list = (window.CONFERENCES || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    timelineSelect.innerHTML = list
      .map(
        (c, i) =>
          `<option value="${i}">${escapeHTML(c.name)}${
            c.notificationDate ? "" : " — no decision date"
          }</option>`
      )
      .join("");
    timelineSelect._list = list;
    const preferred = defaultTimelineConf(list);
    const idx = preferred ? list.indexOf(preferred) : -1;
    if (idx >= 0) timelineSelect.value = String(idx);
  }

  function renderTimeline(conf) {
    if (!conf) {
      timelineChart.innerHTML = "";
      timelineSummary.textContent = "No conference data loaded.";
      return;
    }

    const plan = buildPlanB(conf);
    if (!plan) {
      timelineChart.innerHTML = "";
      timelineSummary.innerHTML = `<strong>${escapeHTML(
        conf.name
      )}</strong> has no decision-notification date on file, so there is nothing to anchor a timeline to. Add <code>notificationDate</code> to its file in <code>conferences/</code>.`;
      return;
    }

    const notifT = plan.notif.getTime();
    const entries = plan.clear
      .concat(plan.overlapping)
      .sort((a, b) => a.submission.getTime() - b.submission.getTime());

    if (entries.length === 0) {
      timelineChart.innerHTML = "";
      timelineSummary.innerHTML = `Decisions for <strong>${escapeHTML(
        conf.name
      )}</strong> land around <strong>${formatShortDate(
        conf.notificationDate
      )}</strong>, but no tracked venue has a deadline after that. Add later-cycle conferences to see fallbacks here.`;
      return;
    }

    // Span the chart from this submission (or a month before the verdict) to
    // the last fallback deadline, with a little breathing room either side.
    const own = parseDate(conf.submissionDeadline, conf.timezone);
    const ownT = own && !isNaN(own) ? own.getTime() : notifT - 30 * DAY_MS;
    const reviewStart = reviewInstant(conf);
    const lastT = entries[entries.length - 1].submission.getTime();
    const pad = Math.max((lastT - ownT) * 0.04, 3 * DAY_MS);
    const t0 =
      Math.min(
        ownT,
        notifT,
        reviewStart ? reviewStart.getTime() : Infinity
      ) - pad;
    const t1 = lastT + pad;
    const span = t1 - t0 || 1;
    const pct = (t) => ((Math.min(Math.max(t, t0), t1) - t0) / span) * 100;

    // Drop ticks hugging the right edge — their label would be clipped.
    const tickTimes = monthTicks(t0, t1).filter((t) => pct(t) <= 96);
    const ticks = tickTimes
      .map(
        (t) =>
          `<div class="tl-tick" style="left:${pct(t).toFixed(
            3
          )}%"><span>${tickLabel(t)}</span></div>`
      )
      .join("");
    const gridlines = tickTimes
      .map(
        (t) => `<div class="tl-gridline" style="left:${pct(t).toFixed(3)}%"></div>`
      )
      .join("");

    const now = Date.now();
    const todayLine =
      now > t0 && now < t1
        ? `<div class="tl-line tl-today" style="left:${pct(now).toFixed(
            3
          )}%" title="Today"></div>`
        : "";
    const decisionLine = `<div class="tl-line tl-decision" style="left:${pct(
      notifT
    ).toFixed(3)}%" title="Decision: ${formatShortDate(
      conf.notificationDate
    )}"></div>`;

    // Reviews, where the venue has them, are the early warning: you can start
    // on a fallback from this date rather than waiting for the verdict.
    const review = reviewInstant(conf);
    const reviewT = review ? review.getTime() : null;
    const reviewLine = review
      ? `<div class="tl-line tl-review" style="left:${pct(reviewT).toFixed(
          3
        )}%" title="Reviews released: ${formatShortDate(conf.reviewDate)}${
          conf.reviewEstimated ? " (estimated)" : ""
        }"></div>`
      : "";

    // Row 0: the paper currently under review at `conf`. When reviews land
    // before the verdict, the bar is split so the rebuttal window is visible.
    const ownStart = pct(ownT);
    const ownEnd = pct(notifT);
    const ownBars = review
      ? `<div class="tl-bar tl-bar-review" style="left:${ownStart.toFixed(
          3
        )}%;width:${Math.max(pct(reviewT) - ownStart, 0.5).toFixed(
          3
        )}%" title="Under review"></div>
         <div class="tl-bar tl-bar-rebuttal" style="left:${pct(reviewT).toFixed(
           3
         )}%;width:${Math.max(ownEnd - pct(reviewT), 0.5).toFixed(
          3
        )}%" title="Reviews out → decision (rebuttal window)"></div>
         <div class="tl-dot tl-dot-review" style="left:${pct(reviewT).toFixed(
           3
         )}%" title="Reviews released ${formatShortDate(conf.reviewDate)}"></div>`
      : `<div class="tl-bar tl-bar-review" style="left:${ownStart.toFixed(
          3
        )}%;width:${Math.max(ownEnd - ownStart, 0.5).toFixed(
          3
        )}%" title="Under review"></div>`;
    const ownDates = review
      ? `reviews ${formatDayMonth(conf.reviewDate)} → decision ${formatDayMonth(
          conf.notificationDate
        )}`
      : `under review → ${formatShortDate(conf.notificationDate)}${
          conf.notificationEstimated ? " (est.)" : ""
        }`;
    const ownRow = `
      <div class="tl-row tl-row-own">
        <div class="tl-label">
          <span class="tl-name">${escapeHTML(conf.name)}</span>
          <span class="tl-dates">${ownDates}</span>
        </div>
        <div class="tl-track">${ownBars}</div>
      </div>
    `;

    const rows = entries
      .map((e) => {
        const c = e.conf;
        const overlaps = e.days < 0;
        const subT = e.submission.getTime();
        const regT = e.registration ? e.registration.getTime() : subT;
        const left = pct(Math.min(regT, subT));
        const width = Math.max(pct(subT) - left, 0.6);
        const cls = [
          "tl-row",
          overlaps ? "tl-row-overlap" : "tl-row-clear",
          e.passed ? "tl-row-passed" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const regDot =
          e.registration && regT !== subT
            ? `<div class="tl-dot tl-dot-abstract" style="left:${pct(
                regT
              ).toFixed(3)}%" title="Abstract due ${formatShortDate(
                c.registrationDeadline
              )}"></div>`
            : "";
        const dates = e.registration
          ? `abstract ${formatDayMonth(
              c.registrationDeadline
            )} · paper ${formatDayMonth(c.submissionDeadline)}`
          : `paper ${formatDayMonth(c.submissionDeadline)}`;
        const gap = overlaps
          ? `<span class="tl-gap" title="Abstract closes ${-e.days} day${
              e.days === -1 ? "" : "s"
            } before your verdict">${-e.days}d early</span>`
          : `<span class="tl-gap" title="${
              e.daysToPaper
            } days between the verdict and this paper deadline">+${
              e.daysToPaper
            }d</span>`;
        return `
          <div class="${cls}">
            <div class="tl-label">
              <span class="tl-name">${escapeHTML(c.name)} ${gap}</span>
              <span class="tl-dates">${dates}</span>
            </div>
            <div class="tl-track">
              <div class="tl-bar" style="left:${left.toFixed(
                3
              )}%;width:${width.toFixed(3)}%" title="${escapeHTML(
                c.name
              )}: submission window"></div>
              ${regDot}
              <div class="tl-dot tl-dot-paper" style="left:${pct(subT).toFixed(
                3
              )}%" title="Full paper due ${formatShortDate(
                c.submissionDeadline
              )}"></div>
            </div>
          </div>
        `;
      })
      .join("");

    const clearCount = plan.clear.length;
    const openCount = entries.filter((e) => !e.passed).length;
    const reviewNote = review
      ? ` Reviews arrive around <strong>${formatShortDate(
          conf.reviewDate
        )}</strong>, ${Math.round(
          (notifT - reviewT) / DAY_MS
        )} days earlier — that is your first real signal.`
      : "";
    timelineSummary.innerHTML = `Decisions land around <strong>${formatShortDate(
      conf.notificationDate
    )}</strong>${
      conf.notificationEstimated
        ? ' <span class="plan-b-flag">estimated</span>'
        : ""
    } — ${clearCount} venue${clearCount === 1 ? "" : "s"} clear of your review,
      ${plan.overlapping.length} overlapping it, ${openCount} still open
      today.${reviewNote}`;

    timelineChart.innerHTML = `
      <div class="tl-axis">
        <div class="tl-label"></div>
        <div class="tl-track">${ticks}</div>
      </div>
      <div class="tl-body">
        <div class="tl-overlay">${gridlines}${reviewLine}${decisionLine}${todayLine}</div>
        ${ownRow}
        ${rows}
      </div>
    `;
  }

  function currentTimelineConf() {
    const list = timelineSelect._list || window.CONFERENCES || [];
    return list[+timelineSelect.value] || null;
  }

  function openTimelineModal() {
    timelineModal.hidden = false;
    document.body.style.overflow = "hidden";
    populateTimelineSelect();
    renderTimeline(currentTimelineConf());
    timelineClose.focus();
  }

  function closeTimelineModal() {
    timelineModal.hidden = true;
    document.body.style.overflow = "";
  }

  function openCompareModal() {
    compareModal.hidden = false;
    document.body.style.overflow = "hidden";
    renderCompareCharts();
  }

  function closeCompareModal() {
    compareModal.hidden = true;
    document.body.style.overflow = "";
    if (compareChartRate) {
      compareChartRate.destroy();
      compareChartRate = null;
    }
    if (compareChartSubs) {
      compareChartSubs.destroy();
      compareChartSubs = null;
    }
  }

  const DAY_MS = 24 * 60 * 60 * 1000;

  // Some venues release reviews (opening a rebuttal window) before the final
  // verdict. The field is optional and may be null — treat anything that is
  // missing, unparseable, or not strictly before the notification as absent.
  function reviewInstant(conf) {
    if (!conf || !conf.reviewDate) return null;
    const r = parseDate(conf.reviewDate, conf.timezone);
    if (!r || isNaN(r)) return null;
    const n = parseDate(conf.notificationDate, conf.timezone);
    if (n && !isNaN(n) && r.getTime() >= n.getTime()) return null;
    return r;
  }

  // "If this paper is rejected, where can it go next?"
  //
  // Anchor is this conference's decision-notification date. A venue is only a
  // real fallback if its own deadlines still lie ahead of that moment —
  // otherwise you would have to submit before you know the outcome here, which
  // most venues forbid as a dual submission.
  //
  // Returns { notif, clear: [...], overlapping: [...] } or null when this
  // conference has no notification date on file.
  function buildPlanB(conf) {
    const notif = parseDate(conf.notificationDate, conf.timezone);
    if (!notif || isNaN(notif)) return null;

    const now = Date.now();
    const clear = [];
    const overlapping = [];

    for (const other of window.CONFERENCES || []) {
      if (other === conf) continue;

      const sub = parseDate(other.submissionDeadline, other.timezone);
      const reg = parseDate(other.registrationDeadline, other.timezone);
      if (!sub || isNaN(sub)) continue;

      // A venue that closes before the decision lands is no fallback at all.
      if (sub.getTime() < notif.getTime()) continue;

      const regValid = reg && !isNaN(reg);
      const gate = regValid ? reg : sub;
      const entry = {
        conf: other,
        submission: sub,
        registration: regValid ? reg : null,
        // Days between hearing back here and the deadline you must hit there.
        days: Math.floor((gate.getTime() - notif.getTime()) / DAY_MS),
        daysToPaper: Math.floor((sub.getTime() - notif.getTime()) / DAY_MS),
        // Still a valid fallback in the cycle's own timeline, but not something
        // you can act on today.
        passed: gate.getTime() < now,
      };

      // Abstract/registration closes while the paper is still under review:
      // usable, but you must register there before the verdict arrives.
      if (regValid && reg.getTime() < notif.getTime()) overlapping.push(entry);
      else clear.push(entry);
    }

    // Actionable options first, each block by soonest deadline.
    const byDeadline = (a, b) =>
      a.passed !== b.passed
        ? a.passed - b.passed
        : a.submission.getTime() - b.submission.getTime();
    clear.sort(byDeadline);
    overlapping.sort(byDeadline);
    return { notif, clear, overlapping };
  }

  function turnaroundLabel(days) {
    if (days < 0) return "already open";
    if (days === 0) return "same day";
    if (days < 14) return `${days} ${days === 1 ? "day" : "days"} to rewrite`;
    if (days < 60) {
      const weeks = Math.round(days / 7);
      return `~${weeks} ${weeks === 1 ? "week" : "weeks"} to rewrite`;
    }
    const months = Math.round(days / 30);
    return `~${months} ${months === 1 ? "month" : "months"} to rewrite`;
  }

  function turnaroundClass(days) {
    if (days < 14) return "urgent";
    if (days < 45) return "soon";
    return "upcoming";
  }

  function planBRow(entry) {
    const c = entry.conf;
    const tz = c.timezone ? ` <span class="date-tz">${escapeHTML(c.timezone)}</span>` : "";
    const estimateFlag = c.estimated
      ? ` <span class="plan-b-flag" title="${escapeHTML(estimateText(c))}">est.</span>`
      : "";
    const regNote =
      entry.registration && entry.days !== entry.daysToPaper
        ? `<div class="plan-b-sub${
            entry.days < 0 ? " warn" : ""
          }">Abstract due ${formatShortDate(
            c.registrationDeadline
          )}${
            entry.days < 0
              ? ` — ${-entry.days} ${
                  entry.days === -1 ? "day" : "days"
                } before you hear back`
              : ""
          }</div>`
        : "";
    // Turnaround is measured to the full-paper deadline — that is the work.
    // The abstract deadline, when it lands earlier, is called out separately.
    const badge = entry.passed
      ? `<span class="badge passed">deadline gone by</span>`
      : `<span class="badge ${turnaroundClass(
          entry.daysToPaper
        )}">${turnaroundLabel(entry.daysToPaper)}</span>`;
    return `
      <li class="plan-b-row${entry.passed ? " is-passed" : ""}">
        <div class="plan-b-main">
          <span class="plan-b-name">${escapeHTML(c.name)}${estimateFlag}</span>
          ${badge}
        </div>
        <div class="plan-b-meta">
          <span>Full paper ${formatShortDate(c.submissionDeadline)}${tz}</span>
          <span class="plan-b-loc">${escapeHTML(c.location)}</span>
        </div>
        ${regNote}
      </li>
    `;
  }

  // Every still-open option is worth listing; historical ones are context, so
  // only a handful are shown before collapsing into a count.
  const MAX_PASSED_ROWS = 5;

  function planBList(entries) {
    const shown = [];
    let hiddenPassed = 0;
    for (const e of entries) {
      if (e.passed && shown.filter((x) => x.passed).length >= MAX_PASSED_ROWS) {
        hiddenPassed++;
        continue;
      }
      shown.push(e);
    }
    const more = hiddenPassed
      ? `<li class="plan-b-more">+ ${hiddenPassed} more whose deadline has already gone by</li>`
      : "";
    return `<ul class="plan-b-list">${shown.map(planBRow).join("")}${more}</ul>`;
  }

  function renderPlanB(conf) {
    const plan = buildPlanB(conf);
    if (!plan) {
      planBEl.hidden = true;
      return;
    }

    const estNote = conf.notificationEstimated
      ? ' <span class="plan-b-flag">estimated</span>'
      : "";
    const review = reviewInstant(conf);
    const reviewLead = review
      ? ` Reviews land earlier, around <strong>${formatShortDate(
          conf.reviewDate
        )}</strong>${
          conf.reviewEstimated
            ? ' <span class="plan-b-flag">estimated</span>'
            : ""
        }, so you get ${Math.round(
          (plan.notif.getTime() - review.getTime()) / DAY_MS
        )} days of warning before the verdict.`
      : "";
    planBIntro.innerHTML =
      `Decisions land around <strong>${formatShortDate(
        conf.notificationDate
      )}</strong>${estNote}. Every venue below has a deadline that falls after that, so a rejected paper could go there next — soonest first, ones whose deadline has already gone by are dimmed.${reviewLead}`;

    const sections = [];
    if (plan.clear.length) {
      sections.push(`
        <div class="plan-b-group">
          <h4 class="plan-b-group-title clear">✓ No overlap — every deadline is after you hear back</h4>
          ${planBList(plan.clear)}
        </div>
      `);
    }
    if (plan.overlapping.length) {
      sections.push(`
        <div class="plan-b-group">
          <h4 class="plan-b-group-title overlap">⚠ Overlaps your review — abstract closes before the verdict</h4>
          <p class="plan-b-group-note">The full paper is due later, but you would have to register the abstract while this submission is still under review. Check the dual-submission policy first.</p>
          ${planBList(plan.overlapping)}
        </div>
      `);
    }
    if (sections.length === 0) {
      sections.push(
        `<p class="plan-b-empty">No tracked venue has a deadline left after this decision date. Add more conferences to <code>conferences/</code>.</p>`
      );
    }

    planBGroups.innerHTML = sections.join("");
    planBEl.hidden = false;
  }

  function openModal(conf) {
    const type = conf.type === "workshop" ? "workshop" : "conference";
    const typeLabel = type === "workshop" ? "Workshop" : "Conference";
    const parentSuffix =
      type === "workshop" && conf.parentConference
        ? ` · @ ${conf.parentConference}`
        : "";
    modalTitle.textContent = `${conf.name}`;
    modalLocation.textContent = `${typeLabel}${parentSuffix} — ${
      conf.fullName ? conf.fullName + " — " : ""
    }${conf.location}`;

    if (conf.estimated) {
      modalWarningText.textContent = estimateText(conf);
      modalWarning.hidden = false;
    } else {
      modalWarning.hidden = true;
    }
    const tzSuffix = conf.timezone ? ` (${conf.timezone})` : "";
    modalSubmission.textContent = formatDate(conf.submissionDeadline) + tzSuffix;
    modalRegistration.textContent =
      formatDate(conf.registrationDeadline) + tzSuffix;
    modalSubmission.classList.toggle(
      "passed-date",
      isPassed(conf.submissionDeadline, conf.timezone)
    );
    modalRegistration.classList.toggle(
      "passed-date",
      isPassed(conf.registrationDeadline, conf.timezone)
    );
    modalDates.textContent = conf.conferenceDates || "TBA";

    // The reviews row only exists for venues that have an author-response
    // phase, so hide the whole pair rather than showing an empty value.
    const review = reviewInstant(conf);
    if (review) {
      modalReview.textContent =
        formatShortDate(conf.reviewDate) +
        (conf.reviewEstimated ? " (estimated)" : "");
      modalReview.classList.toggle("estimated-value", !!conf.reviewEstimated);
      modalReview.classList.toggle(
        "passed-date",
        review.getTime() < Date.now()
      );
      modalReview.style.display = "";
      modalReviewLabel.style.display = "";
    } else {
      modalReview.textContent = "";
      modalReview.classList.remove("estimated-value", "passed-date");
      modalReview.style.display = "none";
      modalReviewLabel.style.display = "none";
    }

    if (conf.notificationDate) {
      modalNotification.textContent =
        formatShortDate(conf.notificationDate) +
        (conf.notificationEstimated ? " (estimated)" : "");
      modalNotification.classList.toggle(
        "estimated-value",
        !!conf.notificationEstimated
      );
      modalNotification.classList.toggle(
        "passed-date",
        isPassed(conf.notificationDate, conf.timezone)
      );
    } else {
      modalNotification.textContent = "TBA";
      modalNotification.classList.remove("estimated-value", "passed-date");
    }

    renderPlanB(conf);
    renderModalCharts(conf);

    if (conf.website) {
      modalWebsite.href = conf.website;
      modalWebsite.textContent = conf.website;
      modalWebsite.parentElement.style.display = "";
    } else {
      modalWebsite.parentElement.style.display = "none";
    }

    const active = getActiveDeadline(conf);
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (active) {
      countdownEl.hidden = false;
      cdTargetPanel.hidden = false;
      updateCountdown(conf, active);
      countdownTimer = setInterval(() => updateCountdown(conf, active), 1000);
    } else {
      countdownEl.hidden = true;
      countdownEl.classList.remove("passed");
      cdTargetPanel.hidden = true;
      countdownTargetEl.style.display = "";
      countdownTargetEl.textContent = "Deadlines have not been announced yet.";
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modalClose.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (chartRate) {
      chartRate.destroy();
      chartRate = null;
    }
    if (chartSubs) {
      chartSubs.destroy();
      chartSubs = null;
    }
  }

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  compareBtn.addEventListener("click", openCompareModal);
  compareClose.addEventListener("click", closeCompareModal);
  compareModal.addEventListener("click", (e) => {
    if (e.target === compareModal) closeCompareModal();
  });
  timelineBtn.addEventListener("click", openTimelineModal);
  timelineClose.addEventListener("click", closeTimelineModal);
  timelineModal.addEventListener("click", (e) => {
    if (e.target === timelineModal) closeTimelineModal();
  });
  timelineSelect.addEventListener("change", () =>
    renderTimeline(currentTimelineConf())
  );
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!timelineModal.hidden) closeTimelineModal();
    else if (!compareModal.hidden) closeCompareModal();
    else if (!modal.hidden) closeModal();
  });

  searchEl.addEventListener("input", render);
  sortEl.addEventListener("change", render);

  document.querySelectorAll(".filter-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll(".filter-tab").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      render();
    });
  });

  async function loadConferences() {
    try {
      const manifest = await fetch("conferences/manifest.json", {
        cache: "no-cache",
      }).then((r) => {
        if (!r.ok) throw new Error("manifest " + r.status);
        return r.json();
      });
      const files = manifest.conferences || [];
      const results = await Promise.all(
        files.map(async (f) => {
          try {
            const r = await fetch(`conferences/${f}`, { cache: "no-cache" });
            if (!r.ok) throw new Error(`${f} ${r.status}`);
            return await r.json();
          } catch (err) {
            console.warn(`Failed to load conferences/${f}:`, err);
            return null;
          }
        })
      );
      window.CONFERENCES = results.filter(Boolean);
    } catch (err) {
      console.error("Failed to load conferences manifest:", err);
      window.CONFERENCES = [];
      emptyEl.textContent =
        "Could not load conference data. Are you running this through a web server?";
      emptyEl.hidden = false;
    }
    render();
  }

  loadConferences();
})();
