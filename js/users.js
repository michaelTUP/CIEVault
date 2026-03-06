/**
 * users.js — User CRUD, approval workflow, people directory
 */

let allUsers = [];

// ── Fetch users ───────────────────────────────────────────
async function fetchUsers() {
  try {
    const cached = await idbLoad("users");
    if (cached.length) { allUsers = cached; renderUsersTable(allUsers); }
    if (!db) return allUsers;
    const snap = await db.collection(C.USERS).orderBy("name","asc").get();
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await idbSave("users", allUsers);
    renderUsersTable(allUsers);
    updatePendingBadge();
    renderPendingPanel();
    return allUsers;
  } catch(e) { console.warn("fetchUsers:", e); return allUsers; }
}

// ── Pending count badge in sidebar ───────────────────────
function updatePendingBadge() {
  const count = allUsers.filter(u => u.status === "pending").length;
  const badge = document.getElementById("pendingBadge");
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

// ── Access control helpers ────────────────────────────────
function canManageUsers(actor) {
  return isSuperPlus(actor);
}
function canCreateSystemAdmin(actor) {
  return isSystemAdmin(actor);
}

// ── Render users table ────────────────────────────────────
function renderUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  const empty = document.getElementById("usersEmpty");
  const wrap  = document.getElementById("usersTableWrap");
  if (!tbody) return;

  const actor = getCurrentUser();
  const list  = users || allUsers;

  if (!list.length) {
    if (empty) empty.style.display = "flex";
    if (wrap)  wrap.style.display  = "none";
    return;
  }
  if (empty) empty.style.display = "none";
  if (wrap)  wrap.style.display  = "block";

  tbody.innerHTML = list.map((u,i) => {
    const color  = USER_TYPE_COLORS[u.userType] || "#94a3b8";
    const label  = USER_TYPE_LABELS[u.userType] || u.userType;
    const status = u.status === "pending" ? `<span class="status-badge status-pending">Pending</span>`
                 : u.status === "rejected"? `<span class="status-badge status-inactive">Rejected</span>`
                 : u.isActive             ? `<span class="status-badge status-active">Active</span>`
                 :                          `<span class="status-badge status-inactive">Inactive</span>`;
    const isPending = u.status === "pending";
    const isSA      = u.userType === "systemAdmin";
    const canEdit   = isSA ? isSystemAdmin(actor) : isSuperPlus(actor);

    return `
    <tr class="animate-row" style="animation-delay:${i*20}ms">
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="person-avatar" style="background:${avatarColor(u.name)}">
            ${initials(u.name)}
          </div>
          <div>
            <div class="fw-semibold">${escapeHtml(u.name||"")}</div>
            <div class="text-muted small">@${escapeHtml(u.username||"")}</div>
          </div>
        </div>
      </td>
      <td class="text-muted small">${escapeHtml(u.email||"")}</td>
      <td>${escapeHtml(u.office||"—")}</td>
      <td><span style="color:${color};font-weight:600;font-size:12px">${label}</span></td>
      <td>${status}</td>
      <td>${formatDate(u.dateRegistered)}</td>
      <td onclick="event.stopPropagation()">
        ${isPending ? `
          <button class="btn-icon-action btn-approve" onclick="approveUser('${u.id}')" title="Approve">
            <i class="fa-solid fa-check"></i>
          </button>
          <button class="btn-icon-action btn-delete" onclick="rejectUser('${u.id}','${escapeHtml(u.name)}')" title="Reject">
            <i class="fa-solid fa-xmark"></i>
          </button>` : ""}
        ${canEdit ? `
          <button class="btn-icon-action" onclick="openEditUserModal('${u.id}')" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon-action btn-delete" onclick="confirmDeleteUser('${u.id}','${escapeHtml(u.name)}')" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>` : ""}
      </td>
    </tr>`;
  }).join("");
}

// ── Pending approvals panel ───────────────────────────────
function renderPendingPanel() {
  const pending = allUsers.filter(u => u.status === "pending");
  const count   = pending.length;

  // Update all badge instances
  ["pendingBadge","pendingBadge2","pendingBadge3"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent    = count;
    el.style.display  = count > 0 ? "inline-flex" : "none";
  });

  // Render all panel instances
  ["pendingUsersPanel","pendingUsersPanel2"].forEach(id => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    if (!count) {
      wrap.innerHTML = `<div class="text-center text-muted py-3 small">No pending registrations.</div>`;
      return;
    }
    wrap.innerHTML = pending.map(u => `
      <div class="pending-card">
        <div class="d-flex align-items-center gap-3">
          <div class="person-avatar" style="background:${avatarColor(u.name)};width:36px;height:36px">
            ${initials(u.name)}
          </div>
          <div class="flex-grow-1">
            <div class="fw-semibold">${escapeHtml(u.name)}</div>
            <div class="text-muted small">${escapeHtml(u.email)} · ${escapeHtml(u.office||"No office")}</div>
            <div class="text-muted small">Registered: ${formatDate(u.dateRegistered)}</div>
          </div>
          <div class="d-flex flex-column gap-1">
            <button class="btn-dms-primary btn-sm" onclick="approveUser('${u.id}')">
              <i class="fa-solid fa-check me-1"></i>Approve
            </button>
            <button class="btn-dms-secondary btn-sm" onclick="rejectUser('${u.id}','${escapeHtml(u.name)}')">
              <i class="fa-solid fa-xmark me-1"></i>Reject
            </button>
          </div>
        </div>
      </div>`).join("");
  });
}

// ── Approve user ─────────────────────────────────────────
async function approveUser(userId) {
  const u = allUsers.find(x => x.id === userId);
  if (!u) return;
  // Open approval modal to assign type
  document.getElementById("approveUserName").textContent    = u.name;
  document.getElementById("approveUserOffice").textContent  = u.office || "Not set";

  // Populate user type select — system admin only sees systemAdmin option if actor is systemAdmin
  const actor   = getCurrentUser();
  const typeOpts = USER_TYPE_ORDER
    .filter(t => t !== "systemAdmin" || isSystemAdmin(actor))
    .map(t => `<option value="${t}" ${t==="regular"?"selected":""}>${USER_TYPE_LABELS[t]}</option>`)
    .join("");
  document.getElementById("approveUserTypeSelect").innerHTML = typeOpts;
  document.getElementById("approveUserId").value = userId;

  openModal("approveUserModal");
}

async function handleApproveSubmit() {
  const userId   = document.getElementById("approveUserId").value;
  const userType = document.getElementById("approveUserTypeSelect").value;
  const actor    = getCurrentUser();
  try {
    await db.collection(C.USERS).doc(userId).update({
      status     : "active",
      isActive   : true,
      userType,
      approvedBy : actor.id,
      approvedAt : nowTimestamp()
    });
    await logAudit("approve","user",userId,
      allUsers.find(u=>u.id===userId)?.name||userId,
      `Approved as ${USER_TYPE_LABELS[userType]}`);
    showToast("User approved successfully.","success");
    closeModal("approveUserModal");
    await fetchUsers();
    renderPendingPanel();
  } catch(e) { showToast("Error: "+e.message,"error"); }
}

// ── Reject user ───────────────────────────────────────────
async function rejectUser(userId, name) {
  if (!confirm(`Reject registration for ${name}?`)) return;
  try {
    await db.collection(C.USERS).doc(userId).update({ status:"rejected", isActive:false });
    await logAudit("reject","user",userId,name,"Registration rejected");
    showToast("User rejected.","warning");
    await fetchUsers();
    renderPendingPanel();
  } catch(e) { showToast("Error: "+e.message,"error"); }
}

// ── Edit user modal ───────────────────────────────────────
let _editUserId = null;

function openEditUserModal(id) {
  const u     = allUsers.find(x => x.id === id);
  if (!u) return;
  _editUserId = id;
  const actor = getCurrentUser();

  document.getElementById("editUserName").value   = u.name   || "";
  document.getElementById("editUserEmail").value  = u.email  || "";
  document.getElementById("editUserUsername").value = u.username || "";
  document.getElementById("editUserActive").checked = !!u.isActive;

  populateOfficeSelect("editUserOffice", u.office || "");

  // User type select
  const typeOpts = USER_TYPE_ORDER
    .filter(t => t !== "systemAdmin" || isSystemAdmin(actor))
    .map(t => `<option value="${t}" ${t===u.userType?"selected":""}>${USER_TYPE_LABELS[t]}</option>`)
    .join("");
  document.getElementById("editUserType").innerHTML = typeOpts;

  openModal("editUserModal");
}

async function handleEditUserSubmit(e) {
  e.preventDefault();
  const actor = getCurrentUser();
  const name     = document.getElementById("editUserName").value.trim();
  const office   = document.getElementById("editUserOffice").value;
  const userType = document.getElementById("editUserType").value;
  const isActive = document.getElementById("editUserActive").checked;

  if (userType === "systemAdmin" && !isSystemAdmin(actor)) {
    showToast("Only System Admin can assign System Admin role.","error");
    return;
  }

  try {
    await db.collection(C.USERS).doc(_editUserId).update({ name, office, userType, isActive });
    await logAudit("update","user",_editUserId,name,`Updated profile. Type: ${userType}`);
    showToast("User updated.","success");
    closeModal("editUserModal");
    await fetchUsers();
  } catch(e) { showToast("Error: "+e.message,"error"); }
}

// ── Delete user ───────────────────────────────────────────
function confirmDeleteUser(id, name) {
  document.getElementById("deleteUserName").textContent = name;
  document.getElementById("confirmDeleteUserBtn").onclick = async () => {
    try {
      await db.collection(C.USERS).doc(id).delete();
      await logAudit("delete","user",id,name,"User deleted");
      closeModal("deleteUserModal");
      showToast("User deleted.","success");
      await fetchUsers();
    } catch(e) { showToast("Error: "+e.message,"error"); }
  };
  openModal("deleteUserModal");
}

// ── Search users ──────────────────────────────────────────
function searchUsers(query) {
  const q = (query||"").toLowerCase();
  renderUsersTable(allUsers.filter(u =>
    (u.name||"").toLowerCase().includes(q) ||
    (u.email||"").toLowerCase().includes(q) ||
    (u.username||"").toLowerCase().includes(q) ||
    (u.office||"").toLowerCase().includes(q)
  ));
}

// ── Populate people checkboxes (doc registration) ────────
function populatePeopleCheckboxes(containerId, selectedIds = []) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const active = allUsers.filter(u => u.isActive && u.status === "active");
  if (!active.length) {
    wrap.innerHTML = `<div class="text-muted small">No active users found.</div>`;
    return;
  }
  wrap.innerHTML = active.map(u => {
    const checked = selectedIds.includes(u.id);
    return `
    <label class="checkbox-pill ${checked?"active":""}">
      <input type="checkbox" value="${u.id}" data-name="${escapeHtml(u.name)}"
        ${checked?"checked":""}
        onchange="this.closest('label').classList.toggle('active',this.checked)">
      <span class="person-avatar-xs" style="background:${avatarColor(u.name)}">${initials(u.name)}</span>
      ${escapeHtml(u.name)}
    </label>`;
  }).join("");
}

function getSelectedPeople(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return { ids:[], names:[] };
  const checked = [...wrap.querySelectorAll("input[type=checkbox]:checked")];
  return {
    ids   : checked.map(el => el.value),
    names : checked.map(el => el.dataset.name)
  };
}
