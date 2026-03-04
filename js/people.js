/**
 * people.js — People directory CRUD and rendering
 */

let allPeople = [];
let currentEditPersonId = null;

// ─────────────────────────────────────────────────────────
// Firestore operations
// ─────────────────────────────────────────────────────────
async function fetchPeople() {
  try {
    const snap = await db.collection(COLLECTIONS.PEOPLE)
                         .orderBy("name", "asc")
                         .get();
    allPeople = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPeopleTable(allPeople);
  } catch (err) {
    showToast("Failed to load people: " + err.message, "error");
  }
}

async function savePerson(data) {
  const ref = await db.collection(COLLECTIONS.PEOPLE).add({
    ...data,
    dateAdded: firebase.firestore.Timestamp.now()
  });
  return ref.id;
}

async function updatePerson(id, data) {
  await db.collection(COLLECTIONS.PEOPLE).doc(id).update(data);
}

async function deletePerson(id) {
  await db.collection(COLLECTIONS.PEOPLE).doc(id).delete();
}

// ─────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────
function renderPeopleTable(people) {
  const tbody  = document.getElementById("peopleTableBody");
  const empty  = document.getElementById("peopleEmptyState");
  const tWrap  = document.getElementById("peopleTableWrapper");

  if (!people || people.length === 0) {
    if (tbody)  tbody.innerHTML = "";
    if (empty)  empty.style.display  = "flex";
    if (tWrap)  tWrap.style.display  = "none";
    return;
  }

  if (empty) empty.style.display = "none";
  if (tWrap) tWrap.style.display = "block";

  const avatarColors = ["#e74c5e","#f59c3c","#3cb4f5","#5bc9a3","#a78bfa","#f97316"];
  const colorFor = name => avatarColors[name.charCodeAt(0) % avatarColors.length];

  tbody.innerHTML = people.map((p, i) => `
    <tr class="animate-row" style="animation-delay:${i*30}ms">
      <td>
        <div class="d-flex align-items-center gap-3">
          <div class="person-avatar" style="background:${colorFor(p.name||'?')}">
            ${(p.name||"?")[0].toUpperCase()}
          </div>
          <div>
            <div class="fw-semibold">${escapeHtml(p.name||"")}</div>
            <div class="text-muted small">${escapeHtml(p.email||"")}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(p.department||"—")}</td>
      <td>${escapeHtml(p.position||"—")}</td>
      <td>
        <span class="status-badge ${p.status==="Active"?"status-active":"status-inactive"}">
          ${escapeHtml(p.status||"Active")}
        </span>
      </td>
      <td>${formatDate(p.dateAdded)}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-icon-action" onclick="openEditPersonModal('${p.id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-icon-action btn-delete" onclick="confirmDeletePerson('${p.id}','${escapeHtml(p.name||'')}')" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

// ─────────────────────────────────────────────────────────
// Add / Edit
// ─────────────────────────────────────────────────────────
function openAddPersonModal() {
  currentEditPersonId = null;
  document.getElementById("personForm").reset();
  document.getElementById("personModalTitle").textContent = "Add Person";
  document.getElementById("savePersonBtn").textContent    = "Save Person";
  document.getElementById("personStatusField").value = "Active";
  const modal = new bootstrap.Modal(document.getElementById("personModal"));
  modal.show();
}

function openEditPersonModal(id) {
  const person = allPeople.find(p => p.id === id);
  if (!person) return;
  currentEditPersonId = id;
  document.getElementById("personForm").reset();
  document.getElementById("personModalTitle").textContent = "Edit Person";
  document.getElementById("savePersonBtn").textContent    = "Update Person";

  document.getElementById("personNameField").value   = person.name || "";
  document.getElementById("personDeptField").value   = person.department || "";
  document.getElementById("personPosField").value    = person.position || "";
  document.getElementById("personEmailField").value  = person.email || "";
  document.getElementById("personStatusField").value = person.status || "Active";

  const modal = new bootstrap.Modal(document.getElementById("personModal"));
  modal.show();
}

async function handlePersonFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("personForm");
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = document.getElementById("savePersonBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';

  try {
    const data = {
      name:       document.getElementById("personNameField").value.trim(),
      department: document.getElementById("personDeptField").value.trim(),
      position:   document.getElementById("personPosField").value.trim(),
      email:      document.getElementById("personEmailField").value.trim(),
      status:     document.getElementById("personStatusField").value
    };

    if (currentEditPersonId) {
      await updatePerson(currentEditPersonId, data);
      showToast("Person updated.", "success");
    } else {
      await savePerson(data);
      showToast("Person added.", "success");
    }

    bootstrap.Modal.getInstance(document.getElementById("personModal"))?.hide();
    await fetchPeople();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = currentEditPersonId ? "Update Person" : "Save Person";
  }
}

// ─────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────
function confirmDeletePerson(id, name) {
  document.getElementById("deletePersonName").textContent = name || "this person";
  document.getElementById("confirmDeletePersonBtn").onclick = async () => {
    try {
      await deletePerson(id);
      bootstrap.Modal.getInstance(document.getElementById("deletePersonModal"))?.hide();
      showToast("Person removed.", "success");
      await fetchPeople();
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
  };
  new bootstrap.Modal(document.getElementById("deletePersonModal")).show();
}

// ─────────────────────────────────────────────────────────
// Search people
// ─────────────────────────────────────────────────────────
function searchPeople(query) {
  const q = (query || "").toLowerCase();
  const result = allPeople.filter(p =>
    (p.name||"").toLowerCase().includes(q) ||
    (p.department||"").toLowerCase().includes(q) ||
    (p.position||"").toLowerCase().includes(q) ||
    (p.email||"").toLowerCase().includes(q)
  );
  renderPeopleTable(result);
}
