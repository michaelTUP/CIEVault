/**
 * offices.js — Offices CRUD (System Admin only) + shared dropdown loader
 */

let allOffices = [];

// ── Fetch offices ────────────────────────────────────────
async function fetchOffices() {
  try {
    // Try cache first
    const cached = await idbLoad("offices");
    if (cached.length) allOffices = cached;

    if (!db) return allOffices;
    const snap = await db.collection(C.OFFICES).orderBy("name","asc").get();
    allOffices  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await idbSave("offices", allOffices);
    return allOffices;
  } catch(e) {
    console.warn("fetchOffices:", e);
    return allOffices;
  }
}

// ── Populate any <select> with office options ────────────
function populateOfficeSelect(selectId, selectedValue = "") {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = selectedValue || sel.value;
  sel.innerHTML = `<option value="">— Select Office —</option>` +
    allOffices.map(o =>
      `<option value="${escapeHtml(o.name)}" ${o.name===current?"selected":""}>${escapeHtml(o.name)}</option>`
    ).join("");
  if (current) sel.value = current;
}

// ── Populate multi-select checkboxes for doc offices ────
function populateOfficeCheckboxes(containerId, selectedValues = []) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = allOffices.map(o => `
    <label class="checkbox-pill ${selectedValues.includes(o.name)?"active":""}">
      <input type="checkbox" value="${escapeHtml(o.name)}"
        ${selectedValues.includes(o.name)?"checked":""}
        onchange="this.closest('label').classList.toggle('active',this.checked)">
      ${escapeHtml(o.name)}
    </label>`).join("");
}

function getSelectedOffices(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return [];
  return [...wrap.querySelectorAll("input[type=checkbox]:checked")].map(el => el.value);
}

// ── Render offices management table ─────────────────────
function renderOfficesTable() {
  const tbody = document.getElementById("officesTableBody");
  if (!tbody) return;
  if (!allOffices.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">No offices yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = allOffices.map((o,i) => `
    <tr class="animate-row" style="animation-delay:${i*20}ms">
      <td class="fw-medium">${escapeHtml(o.name)}</td>
      <td class="text-muted small">${formatDate(o.dateCreated)}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-icon-action" onclick="openEditOfficeModal('${o.id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-icon-action btn-delete" onclick="confirmDeleteOffice('${o.id}','${escapeHtml(o.name)}')" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>`).join("");
}

// ── Add / Edit office ────────────────────────────────────
let _editOfficeId = null;

function openAddOfficeModal() {
  _editOfficeId = null;
  document.getElementById("officeNameInput").value = "";
  document.getElementById("officeModalTitle").textContent = "Add Office";
  openModal("officeModal");
}

function openEditOfficeModal(id) {
  const o = allOffices.find(x => x.id === id);
  if (!o) return;
  _editOfficeId = id;
  document.getElementById("officeNameInput").value = o.name;
  document.getElementById("officeModalTitle").textContent = "Edit Office";
  openModal("officeModal");
}

async function handleOfficeFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("officeNameInput").value.trim();
  if (!name) return;
  const u = getCurrentUser();
  try {
    if (_editOfficeId) {
      // Check duplicate on edit (exclude self)
      const exists = allOffices.find(o =>
        o.name.toLowerCase() === name.toLowerCase() && o.id !== _editOfficeId);
      if (exists) { showToast("An office with that name already exists.","warning"); return; }
      await db.collection(C.OFFICES).doc(_editOfficeId).update({ name });
      await logAudit("update","office",_editOfficeId,name,"Office name updated");
      showToast("Office updated.","success");
    } else {
      // Check duplicate on add
      const exists = allOffices.find(o => o.name.toLowerCase() === name.toLowerCase());
      if (exists) { showToast("Office already exists.","warning"); return; }
      const ref = await db.collection(C.OFFICES).add({ name, createdBy: u.id, dateCreated: nowTimestamp() });
      await logAudit("create","office",ref.id,name,"Office added");
      showToast("Office added.","success");
    }
    closeModal("officeModal");
    await fetchOffices();
    renderOfficesTable();
  } catch(e) { showToast("Error: "+e.message,"error"); }
}

function confirmDeleteOffice(id, name) {
  document.getElementById("deleteOfficeName").textContent = name;
  document.getElementById("confirmDeleteOfficeBtn").onclick = async () => {
    try {
      await db.collection(C.OFFICES).doc(id).delete();
      await logAudit("delete","office",id,name,"Office deleted");
      closeModal("deleteOfficeModal");
      showToast("Office deleted.","success");
      await fetchOffices();
      renderOfficesTable();
    } catch(e) { showToast("Error: "+e.message,"error"); }
  };
  openModal("deleteOfficeModal");
}
