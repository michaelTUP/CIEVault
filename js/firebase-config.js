/**
 * firebase-config.js
 * ─────────────────────────────────────────────────────────
 * ★ REPLACE the values below with your real Firebase project credentials ★
 *
 * Where to find them:
 *   1. Go to https://console.firebase.google.com
 *   2. Click your project → ⚙ Project Settings
 *   3. Scroll to "Your apps" → click your web app
 *   4. Copy each value from the firebaseConfig object shown there
 * ─────────────────────────────────────────────────────────
 */

const firebaseConfig = {
  apiKey: "AIzaSyCfg6F2mkxoJxl7_UsPUoZDRkzM2Oo_3Jw",
  authDomain: "cievault.firebaseapp.com",
  projectId: "cievault",
  storageBucket: "cievault.firebasestorage.app",
  messagingSenderId: "428635719174",
  appId: "1:428635719174:web:1183f34075bfb94693e587"
};

// ── Detect if config has been filled in ──────────────────
const FIREBASE_CONFIGURED = !Object.values(firebaseConfig).some(
  v => typeof v === "string" && v.startsWith("PASTE_")
);

// ── Initialize ───────────────────────────────────────────
let db   = null;
let auth = null;   // ← auth MUST be declared here for auth.js to work

if (FIREBASE_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  db   = firebase.firestore();
  auth = firebase.auth();

  // Offline persistence — caches data locally for fast loading
  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code !== "failed-precondition" && err.code !== "unimplemented") {
      console.warn("Persistence error:", err.code);
    }
  });
} else {
  console.warn(
    "%c DocVault: Firebase not configured. Open js/firebase-config.js and replace the PASTE_... placeholders. ",
    "background:#f0a033;color:#0c1117;font-weight:bold;padding:2px 8px;border-radius:3px"
  );
}

// ── Collection names ──────────────────────────────────────
const C = {
  USERS     : "users",
  DOCUMENTS : "documents",
  TAGS      : "tags",
  OFFICES   : "offices",
  AUDIT     : "auditLog"
};

// ── User type definitions ─────────────────────────────────
const USER_TYPE_ORDER  = ["guest","regular","admin","superAdmin","systemAdmin"];
const USER_TYPE_LABELS = {
  guest       : "Guest",
  regular     : "Regular",
  admin       : "Admin",
  superAdmin  : "Super Admin",
  systemAdmin : "System Admin"
};
const USER_TYPE_COLORS = {
  guest       : "#94a3b8",
  regular     : "#3cb4f5",
  admin       : "#f59c3c",
  superAdmin  : "#a78bfa",
  systemAdmin : "#e74c5e"
};

// ── Current user cache ────────────────────────────────────
let _currentUser = null;
const getCurrentUser   = ()  => _currentUser;
const setCurrentUser   = (p) => { _currentUser = p; };
const clearCurrentUser = ()  => { _currentUser = null; };

// ── Role helpers ──────────────────────────────────────────
const isSystemAdmin = (u) => u?.userType === "systemAdmin";
const isSuperPlus   = (u) => ["systemAdmin","superAdmin"].includes(u?.userType);
const isAdminPlus   = (u) => ["systemAdmin","superAdmin","admin"].includes(u?.userType);
const isRegularPlus = (u) => u?.userType !== "guest" && !!u?.userType;
const isGuest       = (u) => u?.userType === "guest";
