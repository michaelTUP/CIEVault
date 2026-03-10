
/**
 * app.js — Main app bootstrap, navigation, dashboard
 */

// ── Views ─────────────────────────────────────────────────
const VIEWS = ["documents","users","tags","offices","audit","dashboard"];
let _viewLoaded = {};

function showView(view) {
  VIEWS.forEach(v => {
    const el = document.getElementById("view-"+v);
    if (el) el.classList.toggle("active", v===view);
  });
  document.querySelectorAll(".nav-link[data-view]").forEach(a =>
    a.classList.toggle("active", a.dataset.view===view)
  );
  // Close mobile sidebar
  document.getElementById("sidebar")?.classList.remove("sidebar-open");
  document.getElementById("sidebarOverlay")?.classList.remove("active");

  // Lazy load view data
  if (!_viewLoaded[view]) {
    _viewLoaded[view] = true;
    if (view==="tags")      { fetchTags().then(renderTagsTable); }
    if (view==="offices")   { fetchOffices().then(renderOfficesTable); }
    if (view==="audit")     { renderAuditLog(); }
    if (view==="dashboard") { renderDashboard(); }
  }
  // Always refresh users + pending panel when switching to users view
  if (view==="users") { fetchUsers(); }
}

// ── Sidebar — show/hide items per role ───────────────────
function setupSidebarForRole(user) {
  // Show user name + role
  const nameEl  = document.getElementById("sidebarUserName");
  const roleEl  = document.getElementById("sidebarUserRole");
  const officeEl= document.getElementById("sidebarUserOffice");
  const avatarEl= document.getElementById("sidebarAvatar");
  if (nameEl)   nameEl.textContent   = user.name || "User";
  if (roleEl)   roleEl.textContent   = USER_TYPE_LABELS[user.userType] || user.userType;
  if (officeEl) officeEl.textContent = user.office || "";
  if (avatarEl) {
    avatarEl.textContent   = initials(user.name);
    avatarEl.style.background = avatarColor(user.name);
  }
  if (roleEl) {
    roleEl.style.color = USER_TYPE_COLORS[user.userType]||"#94a3b8";
  }

  // Hide admin-only nav items
  const adminOnly = document.querySelectorAll("[data-role='admin']");
  adminOnly.forEach(el => el.style.display = isAdminPlus(user) ? "" : "none");

  const superOnly = document.querySelectorAll("[data-role='super']");
  superOnly.forEach(el => el.style.display = isSuperPlus(user) ? "" : "none");

  const sysOnly = document.querySelectorAll("[data-role='system']");
  sysOnly.forEach(el => el.style.display = isSystemAdmin(user) ? "" : "none");

  // Hide "Register Document" for guests
  const regDocBtn = document.getElementById("regDocBtn");
  if (regDocBtn) regDocBtn.style.display = isRegularPlus(user) ? "" : "none";
}

// ── Dashboard ─────────────────────────────────────────────
function renderDashboard() {
  const user = getCurrentUser();

  // Visible docs for this user
  const visibleDocs = allDocuments.filter(d => canViewDoc(d, user));

  document.getElementById("dashTotal")?.setAttribute &&
  (document.getElementById("dashTotal").textContent = visibleDocs.length);
  document.getElementById("dashUsers") &&
  (document.getElementById("dashUsers").textContent = allUsers.filter(u=>u.isActive).length||"—");
  document.getElementById("dashPending") &&
  (document.getElementById("dashPending").textContent =
    allUsers.filter(u=>u.status==="pending").length||"0");

  const typeCounts = {};
  const deptCounts = {};
  visibleDocs.forEach(doc => {
    const t = doc.fileType||"other";
    typeCounts[t] = (typeCounts[t]||0)+1;
    (doc.offices||["Unknown"]).forEach(o => { deptCounts[o]=(deptCounts[o]||0)+1; });
  });

  // Type bar
  const typeBar = document.getElementById("typeBreakdownBar");
  const typeColors={pdf:"#e74c5e",document:"#3cb4f5",spreadsheet:"#5bc9a3",
                    presentation:"#f59c3c",image:"#a78bfa",video:"#f97316",other:"#94a3b8"};
  const total = visibleDocs.length||1;
  if (typeBar) typeBar.innerHTML = Object.entries(typeCounts).map(([t,c])=>
    `<div class="dash-bar-segment tooltip-wrap" style="width:${(c/total*100).toFixed(1)}%;background:${typeColors[t]||'#94a3b8'}">
       <span class="tooltip-text">${t}: ${c}</span></div>`).join("");

  // Dept list
  const deptList = document.getElementById("deptBreakdownList");
  if (deptList) deptList.innerHTML = Object.entries(deptCounts)
    .sort((a,b)=>b[1]-a[1])
    .map(([d,c])=>`
      <div class="dash-dept-row">
        <span>${escapeHtml(d)}</span>
        <div class="d-flex align-items-center gap-2">
          <div class="dash-mini-bar" style="width:${Math.round(c/total*120)}px"></div>
          <span class="fw-bold">${c}</span>
        </div>
      </div>`).join("") || "<p class='text-muted small'>No data.</p>";

  // Recent docs
  const recentList = document.getElementById("recentDocsList");
  if (recentList) {
    const recent = [...visibleDocs]
      .sort((a,b)=>(b.dateAdded?.toDate?.()?.getTime()||0)-(a.dateAdded?.toDate?.()?.getTime()||0))
      .slice(0,6);
    recentList.innerHTML = recent.map(doc=>`
      <div class="recent-doc-item" onclick="showView('documents');setTimeout(()=>openPreviewModal('${doc.id}'),200)">
        <div class="file-icon-wrap file-type-${doc.fileType||'other'} small-icon">
          <i class="fa-solid ${fileTypeIcon(doc.fileType)}"></i>
        </div>
        <div class="flex-grow-1 overflow-hidden">
          <div class="text-truncate fw-medium">${escapeHtml(doc.fileName||"Untitled")}</div>
          <div class="text-muted small">${escapeHtml((doc.offices||[]).join(", ")||"")} · ${formatDate(doc.dateAdded)}</div>
        </div>
        <span class="type-badge ${fileTypeBadgeClass(doc.fileType)}">${escapeHtml(doc.fileType||"other")}</span>
      </div>`).join("") || "<p class='text-muted small'>No documents.</p>";
  }
}

// ── Offline indicator ─────────────────────────────────────
function updateOnlineStatus() {
  const el = document.getElementById("onlineStatus");
  if (!el) return;
  if (navigator.onLine) {
    el.innerHTML = '<i class="fa-solid fa-wifi text-success me-1"></i><span>Online</span>';
    el.className = "online-indicator online";
  } else {
    el.innerHTML = '<i class="fa-solid fa-wifi-slash text-warning me-1"></i><span>Offline</span>';
    el.className = "online-indicator offline";
  }
}

// ── Mobile sidebar ────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("sidebar-open");
  document.getElementById("sidebarOverlay")?.classList.toggle("active");
}

// ── PWA: register service worker ─────────────────────────
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
      .then(r => console.log("SW registered:", r.scope))
      .catch(e => console.warn("SW registration failed:", e));
  }
}

// ── Bootstrap ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (!FIREBASE_CONFIGURED) {
    showLoading(false);
    document.getElementById("configBanner")?.style && (document.getElementById("configBanner").style.display="flex");
    return;
  }

  registerSW();

  // Online/offline events
  window.addEventListener("online",  updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  // Auth guard — only proceeds if user is logged in and active
  initAuthGuard(async (user) => {
    setupSidebarForRole(user);

    // Load shared data in parallel
    await Promise.all([
      fetchOffices(),
      fetchTags(),
      fetchDocuments()
    ]);

    // Load users for admin+
    if (isAdminPlus(user)) {
      await fetchUsers();
    }

    // Default view
    showView("documents");
    applyFilters();

    // Wire up nav links
    document.querySelectorAll(".nav-link[data-view]").forEach(link =>
      link.addEventListener("click", e => { e.preventDefault(); showView(link.dataset.view); })
    );

    // Wire up form submissions
    document.getElementById("documentForm")?.addEventListener("submit", handleDocFormSubmit);
    document.getElementById("officeForm")?.addEventListener("submit",   handleOfficeFormSubmit);
    document.getElementById("tagForm")?.addEventListener("submit",      handleTagFormSubmit);
    document.getElementById("editUserForm")?.addEventListener("submit", handleEditUserSubmit);

    // Drive URL auto-detect
    document.getElementById("driveUrlField")?.addEventListener("input", onDriveUrlInput);

    // Search + filter
    initSearchListeners();

    // Tag autocomplete
    initTagAutocomplete("tagsInput","tagPillsWrap","tagSuggestions");

    // People search in modal
    document.getElementById("peopleSearch")?.addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll("#docPeopleWrap .checkbox-pill").forEach(pill => {
        const name = pill.textContent.trim().toLowerCase();
        pill.style.display = name.includes(q) ? "" : "none";
      });
    });

    // Sidebar overlay
    document.getElementById("sidebarOverlay")?.addEventListener("click", toggleSidebar);

    // Preview modal cleanup — also reset meta panel to closed
    document.getElementById("previewModal")?.addEventListener("hidden.bs.modal", () => {
      document.getElementById("previewFrame").src = "";
      // Reset metadata panel to hidden state
      const pane = document.getElementById("previewMetaPane");
      if (pane) pane.classList.remove("open");
      const icon  = document.getElementById("metaToggleIcon");
      const label = document.getElementById("metaToggleLabel");
      if (icon)  icon.className  = "fa-solid fa-circle-info";
      if (label) label.textContent = "Details";
    });

    // Logout
    document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

    // Pending approvals quick panel refresh
    if (isSuperPlus(user)) renderPendingPanel();
  });
});

// ── Toggle metadata panel in preview modal ───────────────
function toggleMetaPanel() {
  const pane  = document.getElementById("previewMetaPane");
  const icon  = document.getElementById("metaToggleIcon");
  const label = document.getElementById("metaToggleLabel");
  const isOpen = pane.classList.toggle("open");
  icon.className   = isOpen ? "fa-solid fa-angles-right" : "fa-solid fa-circle-info";
  label.textContent = isOpen ? "Hide" : "Details";
}
