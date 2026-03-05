/**
 * auth.js — Login, registration, logout, password reset
 */

// ── Login ────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn      = document.getElementById("loginBtn");
  const errEl    = document.getElementById("loginError");

  errEl.textContent = "";
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in…';

  try {
    // Sign in with Firebase Auth
    const cred = await auth.signInWithEmailAndPassword(email, password);

    // Load user profile from Firestore
    const snap = await db.collection(C.USERS).doc(cred.user.uid).get();
    if (!snap.exists) {
      await auth.signOut();
      throw new Error("User profile not found. Contact your administrator.");
    }

    const profile = { id: snap.id, ...snap.data() };

    if (profile.status === "pending") {
      await auth.signOut();
      throw new Error("Your account is pending approval. Please wait for an administrator.");
    }
    if (profile.status === "rejected") {
      await auth.signOut();
      throw new Error("Your account registration was not approved.");
    }
    if (!profile.isActive) {
      await auth.signOut();
      throw new Error("Your account has been deactivated. Contact your administrator.");
    }

    // Cache profile and redirect to app
    setCurrentUser(profile);
    await logAudit("login", "user", profile.id, profile.name, "User logged in");
    window.location.href = "app.html";

  } catch (err) {
    errEl.textContent = friendlyAuthError(err.message);
    btn.disabled  = false;
    btn.innerHTML = "Sign In";
  }
}

// ── Register ─────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById("regName").value.trim();
  const email    = document.getElementById("regEmail").value.trim();
  const office   = document.getElementById("regOffice").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm  = document.getElementById("regConfirm").value;
  const btn      = document.getElementById("registerBtn");
  const errEl    = document.getElementById("registerError");

  errEl.textContent = "";

  if (!name || !email)  { errEl.textContent = "Please fill in all required fields."; return; }
  if (!office)          { errEl.textContent = "Please select your office / department."; return; }
  if (password !== confirm) { errEl.textContent = "Passwords do not match."; return; }
  if (password.length < 6)  { errEl.textContent = "Password must be at least 6 characters."; return; }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registering…';

  try {
    // Create Firebase Auth account
    const cred = await auth.createUserWithEmailAndPassword(email, password);

    // Save profile to Firestore (status = pending)
    await db.collection(C.USERS).doc(cred.user.uid).set({
      name,
      email,
      username   : email,   // use email as username internally
      office,
      userType   : "regular",   // default — overridden at approval
      isActive   : false,
      status     : "pending",
      dateRegistered : nowTimestamp(),
      approvedBy : null,
      approvedAt : null
    });

    await auth.signOut();
    await logAuditPublic("register", "user", cred.user.uid, name, "Self-registration submitted");

    // Show success, switch to login tab
    showToast("Registration submitted! Wait for administrator approval.", "success");
    document.getElementById("registerError").textContent = "";
    switchAuthTab("login");

  } catch (err) {
    errEl.textContent = friendlyAuthError(err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "Register";
  }
}

// ── Forgot password ───────────────────────────────────────
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById("resetEmail").value.trim();
  const errEl = document.getElementById("resetError");
  const btn   = document.getElementById("resetBtn");

  errEl.textContent = "";
  if (!email) { errEl.textContent = "Please enter your email address."; return; }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending…';

  try {
    await auth.sendPasswordResetEmail(email);
    document.getElementById("resetSuccess").style.display = "block";
    errEl.textContent = "";
  } catch (err) {
    errEl.textContent = friendlyAuthError(err.message);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = "Send Reset Email";
  }
}

// ── Logout ────────────────────────────────────────────────
async function handleLogout() {
  const u = getCurrentUser();
  if (u) await logAudit("logout","user",u.id,u.name,"User logged out");
  clearCurrentUser();
  await auth.signOut();
  window.location.href = "index.html";
}

// ── Auth state guard (call on app.html load) ─────────────
function initAuthGuard(onAuthed) {
  showLoading(true);
  const timeout = setTimeout(() => {
    showLoading(false);
    window.location.href = "index.html";
  }, 8000);

  auth.onAuthStateChanged(async firebaseUser => {
    clearTimeout(timeout);
    if (!firebaseUser) {
      showLoading(false);
      window.location.href = "index.html";
      return;
    }
    try {
      const snap = await db.collection(C.USERS).doc(firebaseUser.uid).get();
      if (!snap.exists || snap.data().status !== "active" || !snap.data().isActive) {
        await auth.signOut();
        window.location.href = "index.html";
        return;
      }
      const profile = { id: snap.id, ...snap.data() };
      setCurrentUser(profile);
      showLoading(false);
      onAuthed(profile);
    } catch (err) {
      console.error("Auth guard error:", err);
      showLoading(false);
      window.location.href = "index.html";
    }
  });
}

// ── Switch between login/register/reset tabs ─────────────
function switchAuthTab(tab) {
  ["login","register","reset"].forEach(t => {
    document.getElementById(${t}Form).style.display  = t===tab ? "block" : "none";
  });
  document.getElementById("authSubtitle").textContent = {
    login    : "Sign in to your account",
    register : "Create a new account",
    reset    : "Reset your password"
  }[tab];
}

// ── Friendly Firebase error messages ────────────────────
function friendlyAuthError(msg) {
  if (msg.includes("user-not-found"))    return "No account found with this email.";
  if (msg.includes("wrong-password"))    return "Incorrect password.";
  if (msg.includes("invalid-email"))     return "Invalid email address.";
  if (msg.includes("email-already"))     return "An account with this email already exists.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please try again later.";
  if (msg.includes("network-request"))  return "Network error. Check your connection.";
  return msg;
}

// ── Log audit without current user (for registration) ────
async function logAuditPublic(action, targetType, targetId, targetName, details) {
  if (!db) return;
  try {
    await db.collection(C.AUDIT).add({
      action, targetType, targetId, targetName, details,
      performedBy     : targetId,
      performedByName : targetName,
      timestamp       : nowTimestamp()
    });
  } catch(e) { /* non-critical */ }
}