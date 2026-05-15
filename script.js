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

  // Offsets are in minutes east of UTC. Add more labels as needed.
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
    CST: 8 * 60, // China Standard Time
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

  function parseOffsetStr(str) {
    if (!str) return null;
    if (str === "Z") return 0;
    const m = str.match(/^([+-])(\d{2}):?(\d{2})$/);
    if (!m) return null;
    return (m[1] === "+" ? 1 : -1) * (+m[2] * 60 + +m[3]);
  }

  function parseIsoParts(value) {
    if (!value) return null;
    const m = String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?$/
    );
    if (!m) return null;
    return {
      y: +m[1],
      mo: +m[2] - 1,
      d: +m[3],
      h: +m[4],
      mi: +m[5],
      s: +(m[6] || 0),
      offsetStr: m[7] || null,
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

  // Display Date: UTC fields equal the literal wall-clock from the ISO string.
  // Formatting with `timeZone: "UTC"` renders those numbers verbatim, regardless
  // of the viewer's local timezone.
  function wallClockDate(value) {
    const p = parseIsoParts(value);
    if (!p) {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d) ? null : d;
    }
    return new Date(Date.UTC(p.y, p.mo, p.d, p.h, p.mi, p.s));
  }

  // Math Date: the actual instant of the deadline.
  // Uses the explicit offset in the ISO string if present, otherwise derives
  // the offset from the conf's `timezone` label. Falls back to local time
  // if neither is available.
  function parseDate(value, timezone) {
    const p = parseIsoParts(value);
    if (!p) {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d) ? null : d;
    }
    let offsetMin = parseOffsetStr(p.offsetStr);
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
  }

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
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

  render();
})();
