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
  const countdownEl = document.getElementById("countdown");
  const countdownTargetEl = document.getElementById("countdown-target");
  const cdDays = document.getElementById("cd-days");
  const cdHours = document.getElementById("cd-hours");
  const cdMinutes = document.getElementById("cd-minutes");
  const cdSeconds = document.getElementById("cd-seconds");

  let countdownTimer = null;
  const liveBadges = [];
  let badgeTickerStarted = false;

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
  const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  function parseDate(value) {
    return value ? new Date(value) : null;
  }

  function formatDate(value) {
    const d = parseDate(value);
    return d && !isNaN(d) ? dateFormatter.format(d) : "TBA";
  }

  function formatShortDate(value) {
    const d = parseDate(value);
    return d && !isNaN(d) ? shortDateFormatter.format(d) : "TBA";
  }

  function daysUntil(date) {
    const now = new Date();
    const ms = date.getTime() - now.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  function isPassed(value) {
    const d = parseDate(value);
    return d && !isNaN(d) && d.getTime() < Date.now();
  }

  // Pick the next relevant deadline: registration if it hasn't passed,
  // otherwise submission. Returns { date, kind } or null.
  function getActiveDeadline(conf) {
    const now = Date.now();
    const reg = parseDate(conf.registrationDeadline);
    const sub = parseDate(conf.submissionDeadline);
    const regValid = reg && !isNaN(reg);
    const subValid = sub && !isNaN(sub);

    if (regValid && reg.getTime() >= now) return { date: reg, kind: "registration" };
    if (subValid) return { date: sub, kind: "submission" };
    if (regValid) return { date: reg, kind: "registration" };
    return null;
  }

  function kindLabel(kind, short) {
    if (kind === "registration") return short ? "reg" : "registration";
    return short ? "sub" : "submission";
  }

  function badgeFor(active) {
    if (!active) return null;
    const action = active.kind === "registration" ? "Register" : "Submit";
    const noun = active.kind === "registration" ? "Registration" : "Submission";
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

    // Upcoming first (soonest → latest), then passed (most recent → oldest).
    copy.sort((a, b) => {
      const da = new Date(a[dateKey]).getTime();
      const db = new Date(b[dateKey]).getTime();
      const aPassed = da < now;
      const bPassed = db < now;
      if (aPassed !== bPassed) return aPassed ? 1 : -1;
      if (aPassed) return db - da;
      return da - db;
    });
    return copy;
  }

  function filterConferences(list, query) {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
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
    const regCls = isPassed(conf.registrationDeadline) ? "passed-date" : "";
    const subCls = isPassed(conf.submissionDeadline) ? "passed-date" : "";
    card.innerHTML = `
      <h3 class="card-name">${escapeHTML(conf.name)}</h3>
      <div class="card-location">📍 ${escapeHTML(conf.location)}</div>
      <div class="card-row">
        <span>Registration</span>
        <span class="${regCls}">${formatShortDate(conf.registrationDeadline)}</span>
      </div>
      <div class="card-row">
        <span>Submission</span>
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
    modalTitle.textContent = conf.name;
    modalLocation.textContent = `${conf.fullName ? conf.fullName + " — " : ""}${conf.location}`;
    const tzSuffix = conf.timezone ? ` (${conf.timezone})` : "";
    modalSubmission.textContent = formatDate(conf.submissionDeadline) + tzSuffix;
    modalRegistration.textContent =
      formatDate(conf.registrationDeadline) + tzSuffix;
    modalSubmission.classList.toggle(
      "passed-date",
      isPassed(conf.submissionDeadline)
    );
    modalRegistration.classList.toggle(
      "passed-date",
      isPassed(conf.registrationDeadline)
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
    if (active) {
      updateCountdown(active.date, active.kind, conf.timezone);
      if (countdownTimer) clearInterval(countdownTimer);
      countdownTimer = setInterval(
        () => updateCountdown(active.date, active.kind, conf.timezone),
        1000
      );
      countdownEl.parentElement
        .querySelector("#countdown")
        .removeAttribute("hidden");
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

  render();
})();
