/**
 * events.js — Events calendar, CRUD, access control
 */

let allEvents    = [];
let _editEventId = null;
let _calYear     = new Date().getFullYear();
let _calMonth    = new Date().getMonth(); // 0-based
let _eventView   = "calendar"; // "calendar" | "list"

const ECOLL = "events";

// ── Access control ────────────────────────────────────────
function canViewEvent(ev, user) {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;

  const isCreator  = ev.createdBy === user.id;
  const isInvolved = (ev.peopleInvolvedIds||[]).includes(user.id);
  const userOffices= Array.isArray(user.offices) ? user.offices : (user.office ? [user.office] : []);
  const sameOffice = (ev.offices||[]).some(o => userOffices.includes(o));

  if (isGuest(user))            return ev.visibility === "Public";
  if (user.userType === "regular") {
    if (isCreator || isInvolved)  return true;
    if (ev.visibility === "Public") return true;
    if (ev.visibility === "Internal" && sameOffice) return true;
    return false;
  }
  if (user.userType === "admin" || user.userType === "superAdmin") {
    return isCreator || isInvolved || sameOffice;
  }
  return false;
}

function canEditEvent(ev, user) {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  if (isGuest(user)) return false;
  const isCreator  = ev.createdBy === user.id;
  const userOffices= Array.isArray(user.offices) ? user.offices : (user.office ? [user.office] : []);
  const sameOffice = (ev.offices||[]).some(o => userOffices.includes(o));
  if (user.userType === "admin" || user.userType === "superAdmin") {
    return isCreator || sameOffice;
  }
  return isCreator;
}

// ── Fetch events ─────────────────────────────────────────
async function fetchEvents() {
  if (!db) return;
  try {
    const snap = await db.collection(ECOLL).orderBy("startDate","asc").get();
    allEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCalendar();
    filterEventsList();
    populateEventFilterOffices();
    checkEventNotifications();
  } catch(e) { console.error("fetchEvents:", e); }
}

// ── Calendar ─────────────────────────────────────────────
function switchEventView(view) {
  _eventView = view;
  document.getElementById("eventsCalendarView").style.display = view === "calendar" ? "" : "none";
  document.getElementById("eventsListView").style.display     = view === "list"     ? "" : "none";
  document.getElementById("calViewBtn").classList.toggle("active", view === "calendar");
  document.getElementById("listViewBtn").classList.toggle("active", view === "list");
  if (view === "list") filterEventsList();
}

function changeCalMonth(dir) {
  _calMonth += dir;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  if (_calMonth <  0) { _calMonth = 11; _calYear--; }
  renderCalendar();
}

function goToToday() {
  const now  = new Date();
  _calYear   = now.getFullYear();
  _calMonth  = now.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const label = document.getElementById("calMonthLabel");
  if (!label) return;
  const user = getCurrentUser();

  const monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
  label.textContent = `${monthNames[_calMonth]} ${_calYear}`;

  const firstDay  = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMon = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today     = new Date();

  // Visible events for this user
  const visible = allEvents.filter(ev => canViewEvent(ev, user));

  // Group events by date string YYYY-MM-DD
  const byDate = {};
  visible.forEach(ev => {
    const d = ev.startDate ? ev.startDate.toDate ? ev.startDate.toDate() : new Date(ev.startDate) : null;
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(ev);
  });

  const grid = document.getElementById("calGrid");
  if (!grid) return;

  let html = "";

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-cell cal-cell-empty"></div>`;
  }

  for (let d = 1; d <= daysInMon; d++) {
    const key = `${_calYear}-${String(_calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayEvents = byDate[key] || [];
    const isToday   = today.getDate()===d && today.getMonth()===_calMonth && today.getFullYear()===_calYear;

    const evHtml = dayEvents.slice(0,3).map(ev => `
      <div class="cal-event-pill vis-${(ev.visibility||"Public").toLowerCase()}"
           onclick="event.stopPropagation();openEventDetail('${ev.id}')"
           title="${escapeHtml(ev.title||"")}">
        ${escapeHtml((ev.title||"").substring(0,22))}${(ev.title||"").length>22?"…":""}
      </div>`).join("");

    const moreHtml = dayEvents.length > 3
      ? `<div class="cal-more" onclick="event.stopPropagation();openDayEvents('${key}')">+${dayEvents.length-3} more</div>`
      : "";

    html += `
      <div class="cal-cell ${isToday?"cal-today":""}" onclick="openDayModal('${key}')">
        <div class="cal-date ${isToday?"cal-date-today":""}">${d}</div>
        ${evHtml}${moreHtml}
      </div>`;
  }

  // Fill remaining cells
  const total = firstDay + daysInMon;
  const rem   = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 0; i < rem; i++) html += `<div class="cal-cell cal-cell-empty"></div>`;

  grid.innerHTML = html;
}

function openDayModal(dateKey) {
  // Pre-fill the date when clicking a calendar cell
  const eventStart = document.getElementById("eventStart");
  const eventEnd   = document.getElementById("eventEnd");
  if (eventStart) eventStart.value = dateKey + "T08:00";
  if (eventEnd)   eventEnd.value   = dateKey + "T09:00";
  openAddEventModal(dateKey);
}

function openDayEvents(dateKey) {
  // Show all events for a day — switch to list and filter
  switchEventView("list");
  // filter by date
  const input = document.getElementById("eventSearchInput");
  if (input) { input.value = dateKey; filterEventsList(dateKey); }
}

// ── List view ─────────────────────────────────────────────
function populateEventFilterOffices() {
  const sel = document.getElementById("eventFilterOffice");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">All Offices</option>` +
    allOffices.map(o => `<option value="${escapeHtml(o.name)}" ${o.name===current?"selected":""}>${escapeHtml(o.name)}</option>`).join("");
}

function filterEventsList(searchOverride) {
  const user  = getCurrentUser();
  const q     = (searchOverride !== undefined ? searchOverride
    : (document.getElementById("eventSearchInput")?.value || "")).toLowerCase();
  const office= document.getElementById("eventFilterOffice")?.value || "";
  const vis   = document.getElementById("eventFilterVis")?.value || "";

  const visible = allEvents.filter(ev => {
    if (!canViewEvent(ev, user)) return false;
    if (vis    && ev.visibility !== vis) return false;
    if (office && !(ev.offices||[]).includes(office)) return false;
    if (q) {
      const hay = [ev.title, ev.description, ...(ev.offices||[]),
                   ...(ev.peopleInvolvedNames||[])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a,b) => {
    const da = a.startDate?.toDate?.() || new Date(a.startDate||0);
    const db_ = b.startDate?.toDate?.() || new Date(b.startDate||0);
    return da - db_;
  });

  const wrap = document.getElementById("eventsListContainer");
  if (!wrap) return;
  if (!visible.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-calendar-xmark empty-icon"></i><div class="empty-title">No events found</div></div>`;
    return;
  }

  wrap.innerHTML = visible.map(ev => {
    const start = ev.startDate?.toDate?.() || new Date(ev.startDate||0);
    const end   = ev.endDate?.toDate?.()   || new Date(ev.endDate||0);
    const visCls = (ev.visibility||"Public").toLowerCase();
    const canEd  = canEditEvent(ev, user);
    return `
    <div class="event-list-card" onclick="openEventDetail('${ev.id}')">
      <div class="event-list-date-col">
        <div class="event-list-day">${start.getDate()}</div>
        <div class="event-list-mon">${start.toLocaleString("default",{month:"short"})}</div>
        <div class="event-list-yr">${start.getFullYear()}</div>
      </div>
      <div class="event-list-body">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="fw-semibold">${escapeHtml(ev.title||"")}</span>
          <span class="vis-badge vis-${visCls}">${ev.visibility||"Public"}</span>
        </div>
        <div class="text-muted small mb-1">
          <i class="fa-regular fa-clock me-1"></i>
          ${formatDateTime(start)} — ${formatDateTime(end)}
        </div>
        ${ev.offices?.length ? `<div class="text-muted small"><i class="fa-solid fa-building me-1"></i>${escapeHtml(ev.offices.join(", "))}</div>` : ""}
        ${ev.description ? `<div class="event-list-desc">${escapeHtml(ev.description)}</div>` : ""}
      </div>
      <div class="event-list-actions" onclick="event.stopPropagation()">
        ${canEd ? `
          <button class="btn-icon-action" onclick="openEditEventModal('${ev.id}')" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon-action btn-delete" onclick="confirmDeleteEvent('${ev.id}','${escapeHtml(ev.title||"")}')" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>` : ""}
      </div>
    </div>`;
  }).join("");
}

// ── Event detail modal ────────────────────────────────────
function openEventDetail(id) {
  const ev   = allEvents.find(e => e.id === id);
  if (!ev) return;
  const user = getCurrentUser();
  const canEd= canEditEvent(ev, user);

  const start = ev.startDate?.toDate?.() || new Date(ev.startDate||0);
  const end   = ev.endDate?.toDate?.()   || new Date(ev.endDate||0);

  document.getElementById("eventDetailTitle").textContent = ev.title || "Event Details";

  // Attached docs
  const attachedDocs = (ev.attachedDocIds||[]).map(docId => {
    const doc = allDocuments.find(d => d.id === docId);
    return doc ? `
      <span class="tag-pill tag-pill-link" onclick="closeModal('eventDetailModal');openPreviewModal('${docId}')"
            title="Click to preview">
        <i class="${fileTypeIcon(doc.fileType)} me-1"></i>${escapeHtml(doc.fileName||"")}
      </span>` : "";
  }).filter(Boolean).join("") || "<span class='text-muted small'>None</span>";

  document.getElementById("eventDetailBody").innerHTML = `
    <div class="row g-3">
      <div class="col-md-6">
        <div class="meta-label">Start</div>
        <div class="meta-value">${formatDateTime(start)}</div>
      </div>
      <div class="col-md-6">
        <div class="meta-label">End</div>
        <div class="meta-value">${formatDateTime(end)}</div>
      </div>
      <div class="col-md-6">
        <div class="meta-label">Visibility</div>
        <div class="meta-value"><span class="vis-badge vis-${(ev.visibility||"public").toLowerCase()}">${ev.visibility||"Public"}</span></div>
      </div>
      <div class="col-md-6">
        <div class="meta-label">Office(s)</div>
        <div class="meta-value">${escapeHtml((ev.offices||[]).join(", ") || "—")}</div>
      </div>
      ${ev.description ? `
      <div class="col-12">
        <div class="meta-label">Description</div>
        <div class="meta-value">${escapeHtml(ev.description)}</div>
      </div>` : ""}
      <div class="col-12">
        <div class="meta-label">People Involved</div>
        <div class="meta-value">${escapeHtml((ev.peopleInvolvedNames||[]).join(", ") || "—")}</div>
      </div>
      <div class="col-12">
        <div class="meta-label">Attached Documents</div>
        <div class="meta-value d-flex flex-wrap gap-1">${attachedDocs}</div>
      </div>
      <div class="col-12">
        <div class="meta-label">Created By</div>
        <div class="meta-value">${escapeHtml(ev.createdByName||"—")}</div>
      </div>
    </div>`;

  const footer = document.getElementById("eventDetailFooter");
  footer.innerHTML = canEd ? `
    <button type="button" class="btn-dms-secondary" data-bs-dismiss="modal">Close</button>
    <button type="button" class="btn-dms-primary" onclick="closeModal('eventDetailModal');openEditEventModal('${ev.id}')">
      <i class="fa-solid fa-pen me-1"></i>Edit
    </button>
    <button type="button" class="btn-dms-danger" onclick="closeModal('eventDetailModal');confirmDeleteEvent('${ev.id}','${escapeHtml(ev.title||"")}')">
      <i class="fa-solid fa-trash me-1"></i>Delete
    </button>` :
    `<button type="button" class="btn-dms-secondary" data-bs-dismiss="modal">Close</button>`;

  openModal("eventDetailModal");
}

// ── Add / Edit event modal ────────────────────────────────
function openAddEventModal(prefillDate) {
  _editEventId = null;
  document.getElementById("eventModalTitle").textContent = "Add Event";
  document.getElementById("eventForm").reset();
  document.getElementById("eventVisibility").value = "Internal";

  if (!prefillDate) {
    const now = new Date();
    const pad = n => String(n).padStart(2,"0");
    const base = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    document.getElementById("eventStart").value = `${base}T${pad(now.getHours())}:00`;
    document.getElementById("eventEnd").value   = `${base}T${pad(now.getHours()+1)}:00`;
  }

  populateEventOfficeCheckboxes([]);
  populateEventPeople([]);
  populateEventDocs([]);
  openModal("eventModal");
}

function openEditEventModal(id) {
  const ev = allEvents.find(e => e.id === id);
  if (!ev) return;
  _editEventId = id;

  document.getElementById("eventModalTitle").textContent = "Edit Event";
  document.getElementById("eventTitle").value      = ev.title || "";
  document.getElementById("eventDesc").value       = ev.description || "";
  document.getElementById("eventVisibility").value = ev.visibility || "Internal";

  const toLocalDT = (ts) => {
    const d = ts?.toDate?.() || new Date(ts||0);
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  document.getElementById("eventStart").value = toLocalDT(ev.startDate);
  document.getElementById("eventEnd").value   = toLocalDT(ev.endDate);

  populateEventOfficeCheckboxes(ev.offices||[]);
  populateEventPeople(ev.peopleInvolvedIds||[]);
  populateEventDocs(ev.attachedDocIds||[]);
  openModal("eventModal");
}

// ── Populate form fields ──────────────────────────────────
function populateEventOfficeCheckboxes(selected) {
  const wrap = document.getElementById("eventOfficesWrap");
  if (!wrap) return;
  wrap.innerHTML = allOffices.map(o => `
    <label class="checkbox-pill ${selected.includes(o.name)?"active":""}"
           data-name="${escapeHtml(o.name.toLowerCase())}">
      <input type="checkbox" value="${escapeHtml(o.name)}"
             ${selected.includes(o.name)?"checked":""}
             onchange="this.closest('label').classList.toggle('active',this.checked)">
      ${escapeHtml(o.name)}
    </label>`).join("");
}

function filterEventOfficeCheckboxes(q) {
  document.querySelectorAll("#eventOfficesWrap .checkbox-pill").forEach(el => {
    el.style.display = el.dataset.name.includes(q.toLowerCase()) ? "" : "none";
  });
}

function populateEventPeople(selectedIds) {
  const wrap = document.getElementById("eventPeopleWrap");
  if (!wrap) return;
  const active = allUsers.filter(u => u.isActive && u.status === "active");
  wrap.innerHTML = active.map(u => `
    <label class="checkbox-pill ${selectedIds.includes(u.id)?"active":""}">
      <input type="checkbox" value="${u.id}" data-name="${escapeHtml(u.name||"")}"
             ${selectedIds.includes(u.id)?"checked":""}
             onchange="this.closest('label').classList.toggle('active',this.checked)">
      ${escapeHtml(u.name||u.email||"")}
    </label>`).join("");
}

function populateEventDocs(selectedIds) {
  const wrap = document.getElementById("eventDocsWrap");
  if (!wrap) return;
  const user = getCurrentUser();
  const visible = allDocuments.filter(d => canViewDoc(d, user));
  if (!visible.length) {
    wrap.innerHTML = `<div class="text-muted small p-2">No documents available.</div>`;
    return;
  }
  wrap.innerHTML = visible.map(d => `
    <label class="checkbox-pill doc-pill ${selectedIds.includes(d.id)?"active":""}"
           data-name="${escapeHtml((d.fileName||"").toLowerCase())}">
      <input type="checkbox" value="${d.id}"
             ${selectedIds.includes(d.id)?"checked":""}
             onchange="this.closest('label').classList.toggle('active',this.checked)">
      <i class="${fileTypeIcon(d.fileType)} me-1"></i>${escapeHtml(d.fileName||"Untitled")}
    </label>`).join("");
}

function filterEventDocList(q) {
  document.querySelectorAll("#eventDocsWrap .doc-pill").forEach(el => {
    el.style.display = el.dataset.name.includes(q.toLowerCase()) ? "" : "none";
  });
}

// ── Save event ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("eventForm");
  if (form) form.addEventListener("submit", handleEventSubmit);
});

async function handleEventSubmit(e) {
  e.preventDefault();
  const user  = getCurrentUser();
  const title = document.getElementById("eventTitle").value.trim();
  const start = document.getElementById("eventStart").value;
  const end   = document.getElementById("eventEnd").value;
  const desc  = document.getElementById("eventDesc").value.trim();
  const vis   = document.getElementById("eventVisibility").value;

  if (!title) { showToast("Event title is required.", "error"); return; }
  if (!start) { showToast("Start date is required.", "error"); return; }
  if (!end)   { showToast("End date is required.", "error"); return; }
  if (new Date(end) < new Date(start)) { showToast("End must be after start.", "error"); return; }

  const offices = Array.from(document.querySelectorAll("#eventOfficesWrap input:checked")).map(cb => cb.value);

  const peopleChecked = Array.from(document.querySelectorAll("#eventPeopleWrap input:checked"));
  const peopleInvolvedIds   = peopleChecked.map(cb => cb.value);
  const peopleInvolvedNames = peopleChecked.map(cb => cb.dataset.name);

  const attachedDocIds = Array.from(document.querySelectorAll("#eventDocsWrap input:checked")).map(cb => cb.value);

  const data = {
    title, description: desc, visibility: vis,
    offices, peopleInvolvedIds, peopleInvolvedNames, attachedDocIds,
    startDate : new Date(start),
    endDate   : new Date(end),
    updatedAt : nowTimestamp()
  };

  try {
    if (_editEventId) {
      await db.collection(ECOLL).doc(_editEventId).update(data);
      await logAudit("update","event",_editEventId,title,"Event updated");
      showToast("Event updated.", "success");
    } else {
      data.createdBy     = user.id;
      data.createdByName = user.name;
      data.createdAt     = nowTimestamp();
      const ref = await db.collection(ECOLL).add(data);
      await logAudit("create","event",ref.id,title,"Event created");
      showToast("Event created.", "success");
    }
    closeModal("eventModal");
    await fetchEvents();
    checkEventNotifications();
  } catch(err) { showToast("Error: " + err.message, "error"); }
}

// ── Delete event ─────────────────────────────────────────
function confirmDeleteEvent(id, name) {
  const ev   = allEvents.find(e => e.id === id);
  const user = getCurrentUser();
  if (!ev || !canEditEvent(ev, user)) { showToast("Permission denied.", "error"); return; }
  document.getElementById("deleteEventName").textContent = name;
  document.getElementById("confirmDeleteEventBtn").onclick = async () => {
    try {
      await db.collection(ECOLL).doc(id).delete();
      await logAudit("delete","event",id,name,"Event deleted");
      closeModal("deleteEventModal");
      showToast("Event deleted.", "success");
      await fetchEvents();
    } catch(err) { showToast("Error: " + err.message, "error"); }
  };
  openModal("deleteEventModal");
}

// ── Helpers ───────────────────────────────────────────────
function fileTypeIcon(type) {
  const icons = {
    pdf:"fa-solid fa-file-pdf", document:"fa-solid fa-file-word",
    spreadsheet:"fa-solid fa-file-excel", presentation:"fa-solid fa-file-powerpoint",
    image:"fa-solid fa-file-image", video:"fa-solid fa-file-video",
    other:"fa-solid fa-file"
  };
  return icons[type] || icons.other;
}

// ── Notifications ─────────────────────────────────────────
let _notifDismissed = new Set(
  JSON.parse(localStorage.getItem("notifDismissed") || "[]")
);

function checkEventNotifications() {
  const user = getCurrentUser();
  if (!user) return;

  const now       = new Date();
  const in2days   = new Date(now.getTime() + 2  * 24 * 60 * 60 * 1000);
  const in1hour   = new Date(now.getTime() + 1  * 60 * 60 * 1000);

  const upcoming = allEvents.filter(ev => {
    if (!canViewEvent(ev, user)) return false;
    const start = ev.startDate?.toDate?.() || new Date(ev.startDate||0);
    return start >= now && start <= in2days;
  });

  const notifs = [];

  upcoming.forEach(ev => {
    const start     = ev.startDate?.toDate?.() || new Date(ev.startDate||0);
    const diffMs    = start - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMins  = diffMs / (1000 * 60);

    // 1-hour notification
    if (diffHours <= 1 && diffMins > 0) {
      const key = `${ev.id}-1h`;
      notifs.push({
        key,
        icon : "fa-clock",
        color: "#e74c5e",
        title: ev.title,
        msg  : `Starting in ${Math.round(diffMins)} minute${Math.round(diffMins)!==1?"s":""}`,
        event: ev
      });
    }
    // 2-day notification
    else if (diffHours <= 48) {
      const key = `${ev.id}-2d`;
      const hrs = Math.round(diffHours);
      const msg = hrs < 24
        ? `Starting in ${hrs} hour${hrs!==1?"s":""}`
        : `Starting in ${Math.round(diffHours/24)} day${Math.round(diffHours/24)!==1?"s":""}`;
      notifs.push({
        key,
        icon : "fa-calendar-check",
        color: "#3cb4f5",
        title: ev.title,
        msg,
        event: ev
      });
    }
  });

  // Filter out dismissed
  const active = notifs.filter(n => !_notifDismissed.has(n.key));

  renderNotifPanel(active);
  fireBrowserNotifications(active);
}

function renderNotifPanel(notifs) {
  const badge = document.getElementById("notifBadge");
  const list  = document.getElementById("notifList");
  if (!badge || !list) return;

  if (!notifs.length) {
    badge.style.display = "none";
    list.innerHTML = `<div class="notif-empty">No upcoming events</div>`;
    return;
  }

  badge.style.display = "";
  badge.textContent   = notifs.length;

  list.innerHTML = notifs.map(n => `
    <div class="notif-item" onclick="openEventDetail('${n.event.id}')">
      <div class="notif-icon" style="color:${n.color}">
        <i class="fa-solid ${n.icon}"></i>
      </div>
      <div class="notif-body">
        <div class="notif-title">${escapeHtml(n.title)}</div>
        <div class="notif-msg">${n.msg}</div>
      </div>
      <button class="notif-dismiss" title="Dismiss"
              onclick="event.stopPropagation();dismissNotif('${n.key}')">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`).join("");
}

async function fireBrowserNotifications(notifs) {
  if (!("Notification" in window)) return;

  // Request permission if not granted
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;

  notifs.forEach(n => {
    // Only fire once per session using sessionStorage
    const sessionKey = `notif-fired-${n.key}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    new Notification(`📅 ${n.title}`, {
      body : n.msg,
      icon : "./icons/icon-192.png",
      tag  : n.key  // prevents duplicate notifications
    });
  });
}

function dismissNotif(key) {
  _notifDismissed.add(key);
  localStorage.setItem("notifDismissed", JSON.stringify([..._notifDismissed]));
  checkEventNotifications();
}

function clearNotifications() {
  // Dismiss all current notifications
  const badge = document.getElementById("notifBadge");
  const list  = document.getElementById("notifList");
  if (badge) badge.style.display = "none";
  if (list)  list.innerHTML = `<div class="notif-empty">No upcoming events</div>`;

  // Mark all as dismissed
  allEvents.forEach(ev => {
    _notifDismissed.add(`${ev.id}-1h`);
    _notifDismissed.add(`${ev.id}-2d`);
  });
  localStorage.setItem("notifDismissed", JSON.stringify([..._notifDismissed]));
}

function toggleNotifPanel() {
  const panel = document.getElementById("notifPanel");
  if (!panel) return;
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

// Close panel when clicking outside
document.addEventListener("click", e => {
  const wrap = document.getElementById("notifBellWrap");
  if (wrap && !wrap.contains(e.target)) {
    const panel = document.getElementById("notifPanel");
    if (panel) panel.style.display = "none";
  }
});

// Re-check every 5 minutes while app is open
setInterval(checkEventNotifications, 5 * 60 * 1000);
