/**
 * audit.js — Audit trail: log actions + render viewer
 */

// ── Log an action ────────────────────────────────────────
async function logAudit(action, targetType, targetId, targetName, details) {
  if (!db) return;
  const u = getCurrentUser();
  try {
    await db.collection(C.AUDIT).add({
      action,
      targetType,
      targetId      : targetId  || "",
      targetName    : targetName || "",
      details       : details   || "",
      performedBy     : u?.id   || "system",
      performedByName : u?.name || "System",
      timestamp       : nowTimestamp()
    });
  } catch(e) { console.warn("Audit log failed:", e); }
}

// ── Fetch audit logs ─────────────────────────────────────
async function fetchAuditLogs(limitN = 200) {
  if (!db) return [];
  try {
    const snap = await db.collection(C.AUDIT)
      .orderBy("timestamp","desc")
      .limit(limitN)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    console.warn("Fetch audit failed:", e);
    return [];
  }
}

// ── Render audit log table ───────────────────────────────
async function renderAuditLog() {
  const tbody  = document.getElementById("auditTableBody");
  const loader = document.getElementById("auditLoader");
  if (!tbody) return;
  if (loader) loader.style.display = "flex";

  const logs = await fetchAuditLogs(300);

  if (loader) loader.style.display = "none";

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No audit logs yet.</td></tr>`;
    return;
  }

  const actionIcons = {
    login    : "fa-right-to-bracket",
    logout   : "fa-right-from-bracket",
    register : "fa-user-plus",
    create   : "fa-plus",
    update   : "fa-pen",
    delete   : "fa-trash",
    approve  : "fa-circle-check",
    reject   : "fa-circle-xmark",
    view     : "fa-eye",
  };
  const actionColors = {
    login:"#5bc9a3",logout:"#94a3b8",register:"#3cb4f5",
    create:"#f0a033",update:"#f59c3c",delete:"#e74c5e",
    approve:"#5bc9a3",reject:"#e74c5e",view:"#a78bfa"
  };

  tbody.innerHTML = logs.map((log,i) => {
    const icon  = actionIcons[log.action]  || "fa-circle-dot";
    const color = actionColors[log.action] || "#94a3b8";
    return `
    <tr class="animate-row" style="animation-delay:${i*15}ms">
      <td class="text-muted small">${formatDateTime(log.timestamp)}</td>
      <td>
        <span style="color:${color}">
          <i class="fa-solid ${icon} me-1"></i>${escapeHtml(log.action)}
        </span>
      </td>
      <td>
        <div class="fw-medium">${escapeHtml(log.performedByName||"")}</div>
      </td>
      <td>
        <span class="text-muted small">${escapeHtml(log.targetType||"")}</span>
        <div>${escapeHtml(log.targetName||"")}</div>
      </td>
      <td class="text-muted small">${escapeHtml(log.details||"")}</td>
    </tr>`;
  }).join("");
}
