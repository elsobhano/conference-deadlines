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
  const modalWebsite = document.getElementById("modal-website");
  const modalWarning = document.getElementById("modal-warning");
  const modalWarningText = document.getElementById("modal-warning-text");
  const modalStats = document.getElementById("modal-stats");
  const compareModal = document.getElementById("compare-modal");
  const compareBtn = document.getElementById("compare-btn");
  const compareClose = document.getElementById("compare-close");

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

  let countdownTimer = null;
  const liveBadges = [];
  let badgeTickerStarted = false;
  let activeFilter = "all";

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
  const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Parse the wall-clock fields from the ISO string into a Date in the
  // viewer's local timezone. Any offset in the string (`+02:00`, `Z`, etc.)
  // and the conf's `timezone` label are ignored for math — they're treated as
  // labels only. This keeps the countdown consistent with the displayed date:
  // "May 22, 23:59" reads as May 22 in your local time, and the timer ticks
  // down to that exact moment.
  function parseDate(value, _timezone) {
    if (!value) return null;
    const m = String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (!m) {
      const d = new Date(value);
      return isNaN(d) ? null : d;
    }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }

  function formatDate(value) {
    const d = parseDate(value);
    return d ? dateFormatter.format(d) : "TBA";
  }

  function formatShortDate(value) {
    const d = parseDate(value);
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

  function kindLabel(kind, short) {
    if (kind === "registration") return short ? "abstract" : "abstract submission";
    return short ? "full paper" : "full paper submission";
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
        <span class="${regCls}">${formatShortDate(conf.registrationDeadline)}</span>
      </div>
      <div class="card-row">
        <span>Full Paper</span>
        <span class="${subCls}">${formatShortDate(conf.submissionDeadline)}</span>
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

  function updateCountdown(targetDate, kind, tz) {
    const now = new Date();
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

    const label = kindLabel(kind, false);
    const tzSuffix = tz ? ` (${tz})` : "";
    countdownEl.classList.toggle("passed", passed);
    countdownTargetEl.textContent = passed
      ? `${capitalize(label)} deadline passed on ${dateFormatter.format(targetDate)}${tzSuffix}`
      : `Time until ${label} deadline · ${dateFormatter.format(targetDate)}${tzSuffix}`;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
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
      updateCountdown(active.date, active.kind, conf.timezone);
      countdownTimer = setInterval(
        () => updateCountdown(active.date, active.kind, conf.timezone),
        1000
      );
    } else {
      countdownEl.hidden = true;
      countdownEl.classList.remove("passed");
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
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!compareModal.hidden) closeCompareModal();
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
