import {
  auth,
  db,
  firebaseConfig,
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc
} from "./firebase.js";
import { supabase } from "./supabase.js";

const VAPID_KEY = "BO96fJfYw-KK_jThdVRR_ouHAsGeLZB9qC0wFS__v8KQkHS8sY2NWfKh98LytMW0Y8IIeFYc8ucbA_ekuExVexs";
const ALERT_RADIUS_KM = 50;
const DEFAULT_LOCATION = {
  lat: 23.8103,
  lng: 90.4125,
  name: "Dhaka, Bangladesh",
  available: false
};

const state = {
  user: null,
  role: "user",
  incidents: [],
  users: [],
  sosLogs: [],
  activeTab: "map",
  filters: {
    search: "",
    severity: "all",
    type: "all"
  },
  map: null,
  markersLayer: null,
  userLocationMarker: null,
  locationAccuracyCircle: null,
  markerIndex: new Map(),
  sosMap: null,
  sosUserMarker: null,
  currentLocation: { ...DEFAULT_LOCATION },
  incidentLoadError: "",
  usersLoadError: "",
  sosLoadError: ""
};

const emergencyServices = [
  {
    category: "Nearby Police",
    items: [
      { name: "Dhanmondi Police", location: "Dhaka", phone: "999", lat: 23.7465, lng: 90.3760, type: "Police" },
      { name: "Gulshan Police", location: "Dhaka", phone: "999", lat: 23.7925, lng: 90.4078, type: "Police" },
      { name: "Motijheel Police", location: "Dhaka", phone: "999", lat: 23.7337, lng: 90.4172, type: "Police" }
    ]
  },
  {
    category: "Fire Service",
    items: [
      { name: "Fire Kakrail", location: "Dhaka", phone: "999", lat: 23.7367, lng: 90.4110, type: "Fire Service" },
      { name: "Fire Mirpur", location: "Dhaka", phone: "999", lat: 23.8068, lng: 90.3666, type: "Fire Service" },
      { name: "Fire Tejgaon", location: "Dhaka", phone: "999", lat: 23.7613, lng: 90.3927, type: "Fire Service" }
    ]
  },
  {
    category: "Govt Hospital",
    items: [
      { name: "BSMMU", location: "Dhaka", phone: "999", lat: 23.7382, lng: 90.3944, type: "Govt Hospital" },
      { name: "Dhaka Medical", location: "Dhaka", phone: "999", lat: 23.7268, lng: 90.3988, type: "Govt Hospital" },
      { name: "Shaheed Suhrawardy Medical", location: "Dhaka", phone: "999", lat: 23.7745, lng: 90.3666, type: "Govt Hospital" }
    ]
  },
  {
    category: "Private Hospital",
    items: [
      { name: "Square Hospital", location: "Dhaka", phone: "02-8149457", lat: 23.7528, lng: 90.3841, type: "Private Hospital" },
      { name: "Evercare", location: "Dhaka", phone: "10678", lat: 23.8700, lng: 90.3963, type: "Private Hospital" },
      { name: "United Hospital", location: "Dhaka", phone: "10666", lat: 23.8045, lng: 90.4153, type: "Private Hospital" }
    ]
  }
];

const el = {
  authButton: document.getElementById("authButton"),
  userBadge: document.getElementById("userBadge"),
  userEmailText: document.getElementById("userEmailText"),
  userRoleBadge: document.getElementById("userRoleBadge"),
  loginModal: document.getElementById("loginModal"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginRole: document.getElementById("loginRole"),
  authMode: document.getElementById("authMode"),
  authModalTitle: document.getElementById("authModalTitle"),

  navButtons: [...document.querySelectorAll(".nav-btn")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],

  searchInput: document.getElementById("searchInput"),
  severityFilter: document.getElementById("severityFilter"),
  typeFilter: document.getElementById("typeFilter"),

  incidentList: document.getElementById("incidentList"),
  alertsList: document.getElementById("alertsList"),
  alertsActiveBadge: document.getElementById("alertsActiveBadge"),

  reportForm: document.getElementById("reportForm"),
  reportFormTitle: document.getElementById("reportFormTitle"),
  reportLoginInfo: document.getElementById("reportLoginInfo"),
  reportLoginBtn: document.getElementById("reportLoginBtn"),
  reportSubmitBtn: document.getElementById("reportSubmitBtn"),
  editIncidentId: document.getElementById("editIncidentId"),
  incidentType: document.getElementById("incidentType"),
  incidentSeverity: document.getElementById("incidentSeverity"),
  incidentLat: document.getElementById("incidentLat"),
  incidentLng: document.getElementById("incidentLng"),
  incidentLocationText: document.getElementById("incidentLocationText"),
  incidentDescription: document.getElementById("incidentDescription"),
  incidentPhoto: document.getElementById("incidentPhoto"),
  incidentPhotoPreview: document.getElementById("incidentPhotoPreview"),
  gpsBtn: document.getElementById("gpsBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  centerUserBtn: document.getElementById("centerUserBtn"),
  refreshMapBtn: document.getElementById("refreshMapBtn"),

  chatMessages: document.getElementById("chatMessages"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  chatLanguage: document.getElementById("chatLanguage"),

  sosButton: document.getElementById("sosButton"),
  shareLocationBtn: document.getElementById("shareLocationBtn"),
  call999Btn: document.getElementById("call999Btn"),
  sosLog: document.getElementById("sosLog"),
  nearbyServices: document.getElementById("nearbyServices"),

  metricTotalIncidents: document.getElementById("metricTotalIncidents"),
  metricUsers: document.getElementById("metricUsers"),
  metricResolution: document.getElementById("metricResolution"),
  metricRiskAreas: document.getElementById("metricRiskAreas"),
  bars: document.getElementById("bars"),
  typeStats: document.getElementById("typeStats"),

  usersCountBadge: document.getElementById("usersCountBadge"),
  adminIncidentsCountBadge: document.getElementById("adminIncidentsCountBadge"),
  usersList: document.getElementById("usersList"),
  adminIncidentsList: document.getElementById("adminIncidentsList"),

  toastContainer: document.getElementById("toastContainer")
};

let incidentUnsub = null;
let userUnsub = null;
let sosUnsub = null;
let geoWatchId = null;

function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  el.toastContainer.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}

function setInlineMessage(node, message, variant = "info") {
  if (!node) return;
  node.innerHTML = `<div class="${variant === "error" ? "alert-card danger" : "alert-card info"}"><p class="card-desc">${escapeHtml(message)}</p></div>`;
}

function getLocationErrorMessage(error) {
  if (!error) return "Could not get your location.";
  if (error.code === 1) return "Location permission denied. Please allow location access in your browser.";
  if (error.code === 2) return "Location information is unavailable right now.";
  if (error.code === 3) return "Location request timed out. Please try again.";
  return "Could not get your location.";
}

function isSupportedImageFile(file) {
  if (!file) return true;
  return typeof file.type === "string" && file.type.startsWith("image/");
}

function validatePhotoFile(file) {
  if (!file) return { ok: true };
  const maxSize = 5 * 1024 * 1024;
  if (!isSupportedImageFile(file)) {
    return { ok: false, message: "Please select a valid image file." };
  }
  if (file.size > maxSize) {
    return { ok: false, message: "Image must be 5 MB or smaller." };
  }
  return { ok: true };
}

function getStorageErrorMessage(error) {
  const code = error?.code || "";
  if (code === "storage/unauthorized") return "Image upload blocked by Firebase Storage rules. Deploy the new storage.rules file.";
  if (code === "storage/canceled") return "Image upload was canceled.";
  if (code === "storage/invalid-format") return "Invalid image format. Please upload JPG, PNG, or WebP.";
  if (code === "storage/quota-exceeded") return "Firebase Storage free quota exceeded.";
  if (code === "storage/retry-limit-exceeded") return "Upload timed out. Please try again.";
  if (code === "storage/object-not-found") return "Previous image was not found in storage.";
  return error?.message || "Image upload failed. Please check Firebase Storage setup.";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function severityLabel(severity) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function isAdmin() {
  return !!state.user && state.role === "admin";
}

function isUserView() {
  return !state.user || state.role === "user";
}

function openModal() {
  el.loginModal.classList.remove("hidden");
}

function closeModal() {
  el.loginModal.classList.add("hidden");
}

function setActiveTab(tab) {
  state.activeTab = tab;
  renderTabs();

  if (tab === "map" && state.map) {
    setTimeout(() => state.map.invalidateSize(), 100);
  }

  if (tab === "sos" && state.sosMap) {
    setTimeout(() => state.sosMap.invalidateSize(), 100);
  }
}

function renderTabs() {
  el.navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === state.activeTab);
  });

  el.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${state.activeTab}`);
  });
}

function updateRoleUI() {
  if (state.user) {
    el.userBadge.classList.remove("hidden");
    el.userEmailText.textContent = state.user.email || "";
    el.userRoleBadge.textContent = state.role === "admin" ? "Admin" : "User";
    el.authButton.textContent = "Logout";
  } else {
    el.userBadge.classList.add("hidden");
    el.authButton.textContent = "Login";
  }

  document.querySelectorAll(".admin-only").forEach((node) => {
    node.classList.toggle("hidden", !isAdmin());
  });

  document.querySelectorAll(".user-only").forEach((node) => {
    node.classList.toggle("hidden", !isUserView());
  });

  if (!isAdmin() && ["stats", "admin"].includes(state.activeTab)) {
    state.activeTab = "map";
  }

  if (!isUserView() && ["report", "ai", "sos"].includes(state.activeTab)) {
    state.activeTab = "map";
  }

  renderTabs();
  updateReportAccessUI();
}

function updateReportAccessUI() {
  const disabled = !state.user;

  if (disabled) {
    el.reportLoginInfo.classList.remove("hidden");
    el.reportSubmitBtn.textContent = "Login required";
    el.reportSubmitBtn.disabled = true;
  } else {
    el.reportLoginInfo.classList.add("hidden");
    el.reportSubmitBtn.textContent = el.editIncidentId.value ? "Update Incident" : "Submit Report";
    el.reportSubmitBtn.disabled = false;
  }

  [
    el.incidentType,
    el.incidentSeverity,
    el.incidentLocationText,
    el.incidentDescription,
    el.incidentPhoto,
    el.gpsBtn
  ].forEach((input) => {
    input.disabled = disabled;
  });
}

function getMillis(item) {
  if (!item?.createdAt) return 0;
  if (typeof item.createdAt.toMillis === "function") return item.createdAt.toMillis();
  if (item.createdAt.seconds) return item.createdAt.seconds * 1000;
  return 0;
}

function sortNewest(list) {
  return [...list].sort((a, b) => getMillis(b) - getMillis(a));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return "";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(2)} km away`;
}

function withDistance(incident) {
  if (
    !state.currentLocation.available ||
    typeof incident.lat !== "number" ||
    typeof incident.lng !== "number"
  ) {
    return { ...incident, distanceKm: null };
  }

  const distanceKm = haversineKm(
    state.currentLocation.lat,
    state.currentLocation.lng,
    incident.lat,
    incident.lng
  );

  return { ...incident, distanceKm };
}


function renderNearbyServices() {
  const grouped = getSortedEmergencyServices();

  if (!state.currentLocation.available) {
    el.nearbyServices.innerHTML = `
      <div class="service-empty-state">
        <p class="card-desc">Current location not available. Please allow location access first.</p>
      </div>
    `;
    return;
  }

  if (!grouped.length) {
    el.nearbyServices.innerHTML = `
      <div class="service-empty-state">
        <p class="card-desc">No emergency services found within 50 km of your current location.</p>
      </div>
    `;
    return;
  }

  el.nearbyServices.innerHTML = `
    <div class="services-main-wrap">
      <div class="services-main-head">
        <h2>Nearest Emergency Services</h2>
        <p>Quick contact and route actions</p>
      </div>

      ${grouped
        .map((group) => {
          const cards = group.items
            .map((item, index) => {
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
              const distanceText = formatDistance(item.distanceKm);

              return `
                <div class="service-card">
                  <div class="service-card-top">
                    <h3 class="card-title">${escapeHtml(item.name)}</h3>
                    <span class="status-label ${index === 0 ? "high" : "low"}">
                      ${index === 0 ? "Nearest" : "Public"}
                    </span>
                  </div>

                  <p class="card-desc">${escapeHtml(item.location)}</p>

                  <div class="service-meta-line">
                    <span>📞 ${escapeHtml(item.phone)}</span>
                  </div>

                  <div class="service-meta-line">
                    <span>📏 ${escapeHtml(distanceText)}</span>
                  </div>

                  <div class="service-actions">
                    <a class="btn btn-primary" href="tel:${escapeHtml(item.phone)}">Call</a>
                    <a class="btn btn-outline" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Route</a>
                  </div>
                </div>
              `;
            })
            .join("");

          return `
            <section class="service-category-section">
              <h3 class="service-category-title">${escapeHtml(group.category)}</h3>
              <div class="service-category-grid">
                ${cards}
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}



function getSortedEmergencyServices() {
  return emergencyServices
    .map((group) => {
      const items = group.items
        .map((item) => {
          const distanceKm = state.currentLocation.available
            ? haversineKm(
                state.currentLocation.lat,
                state.currentLocation.lng,
                item.lat,
                item.lng
              )
            : null;

          return {
            ...item,
            distanceKm
          };
        })
        .filter((item) => {
          if (item.distanceKm === null) return false;
          return item.distanceKm >= 0 && item.distanceKm <= 50;
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);

      return {
        ...group,
        items
      };
    })
    .filter((group) => group.items.length > 0);
}


function getUserVisibleIncidents() {
  const search = state.filters.search.toLowerCase().trim();

  let incidents = state.incidents.map(withDistance);

  if (isUserView() && state.currentLocation.available) {
    incidents = incidents.filter((incident) => {
      return incident.distanceKm === null || incident.distanceKm <= ALERT_RADIUS_KM;
    });
  }

  incidents = incidents.filter((incident) => {
    const matchesSearch =
      !search ||
      incident.type.toLowerCase().includes(search) ||
      incident.description.toLowerCase().includes(search) ||
      (incident.locationName || "").toLowerCase().includes(search);

    const matchesSeverity =
      state.filters.severity === "all" || incident.severity === state.filters.severity;

    const matchesType =
      state.filters.type === "all" || incident.type === state.filters.type;

    return matchesSearch && matchesSeverity && matchesType;
  });

  return incidents;
}




function getSeverityBadge(severity) {
  return `<span class="status-label ${escapeHtml(severity)}">${escapeHtml(severityLabel(severity))}</span>`;
}

function alertCardClass(severity) {
  if (severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "info";
}

function incidentCardHTML(incident, showActions = false) {
  const distanceText = incident.distanceKm !== null ? formatDistance(incident.distanceKm) : "";
  const locationText = incident.locationName || `${incident.lat}, ${incident.lng}`;

  return `
    <div class="incident-card clickable-card" data-focus-incident="${incident.id}">
      <div class="card-top">
        <div>
          <h3 class="card-title">${escapeHtml(incident.type)}</h3>
          <p class="card-desc">${escapeHtml(incident.description)}</p>
        </div>
        ${getSeverityBadge(incident.severity)}
      </div>

      <div class="card-meta">
        <span>📍 ${escapeHtml(locationText)}</span>
        <span>👤 ${escapeHtml(incident.createdByEmail || "Unknown")}</span>
        ${distanceText ? `<span>📏 ${escapeHtml(distanceText)}</span>` : ""}
        <span>${formatRelativeTime(getMillis(incident))}</span>
      </div>

      ${incident.photoURL ? `<img class="incident-image" src="${escapeHtml(incident.photoURL)}" alt="Incident photo" />` : ""}

      ${
        showActions
          ? `
            <div class="card-actions">
              <button class="btn btn-outline" data-edit-incident="${incident.id}">Edit</button>
              <button class="btn btn-danger" data-delete-incident="${incident.id}" data-photo-path="${incident.photoPath || ""}">Delete</button>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function alertCardHTML(incident) {
  const className = alertCardClass(incident.severity);
  const tag =
    incident.severity === "high"
      ? "DANGER"
      : incident.severity === "medium"
        ? "WARNING"
        : "INFO";

  const distanceText = incident.distanceKm !== null ? formatDistance(incident.distanceKm) : "";
  const locationText = incident.locationName || `${incident.lat}, ${incident.lng}`;

  return `
    <div class="alert-card ${className}" data-focus-incident="${incident.id}">
      <div class="card-top">
        <div>
          <h3 class="card-title">${escapeHtml(incident.type)}</h3>
          <p class="card-desc">${escapeHtml(incident.description)}</p>
        </div>
        <span class="status-badge status-${className === "danger" ? "danger" : className === "warning" ? "warning" : "info"}">${tag}</span>
      </div>
      <div class="card-meta">
        <span>📍 ${escapeHtml(locationText)}</span>
        <span>👤 ${escapeHtml(incident.createdByEmail || "Unknown")}</span>
        ${distanceText ? `<span>📏 ${escapeHtml(distanceText)}</span>` : ""}
        <span>${formatRelativeTime(getMillis(incident))}</span>
      </div>
      ${incident.photoURL ? `<img class="incident-image" src="${escapeHtml(incident.photoURL)}" alt="Incident photo" />` : ""}
    </div>
  `;
}

function formatRelativeTime(ms) {
  if (!ms) return "Just now";
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}


function renderIncidentList() {
  if (state.incidentLoadError) {
    setInlineMessage(el.incidentList, state.incidentLoadError, "error");
    return;
  }

  let incidents = getUserVisibleIncidents();

  if (!incidents.length) {
    incidents = state.incidents.map(withDistance);
  }

  const sorted = sortNewest(incidents);

  el.incidentList.innerHTML = sorted.length
    ? sorted.map((i) => incidentCardHTML(i, false)).join("")
    : `<div class="incident-card"><p class="card-desc">No incidents found.</p></div>`;
}

function renderAlerts() {
  if (state.incidentLoadError) {
    setInlineMessage(el.alertsList, state.incidentLoadError, "error");
    el.alertsActiveBadge.textContent = "Error";
    return;
  }

  const search = state.filters.search.toLowerCase().trim();

  const alerts = sortNewest(
    state.incidents
      .filter((incident) => {
        const matchesSearch =
          !search ||
          incident.type.toLowerCase().includes(search) ||
          incident.description.toLowerCase().includes(search) ||
          (incident.locationName || "").toLowerCase().includes(search);

        const matchesSeverity =
          state.filters.severity === "all" || incident.severity === state.filters.severity;

        const matchesType =
          state.filters.type === "all" || incident.type === state.filters.type;

        return matchesSearch && matchesSeverity && matchesType;
      })
      .map(withDistance)
  );

  el.alertsList.innerHTML = alerts.length
    ? alerts.map(alertCardHTML).join("")
    : `<div class="alert-card info"><p class="card-desc">No active alerts found.</p></div>`;

  el.alertsActiveBadge.textContent = `${alerts.length} Active`;
}

function renderStats() {
  const visibleForStats = isAdmin() ? state.incidents : getUserVisibleIncidents();
  const total = visibleForStats.length;
  const users = state.users.length;
  const high = visibleForStats.filter((i) => i.severity === "high").length;
  const medium = visibleForStats.filter((i) => i.severity === "medium").length;
  const low = visibleForStats.filter((i) => i.severity === "low").length;
  const resolved = visibleForStats.filter((i) => i.status === "resolved").length;

  const riskAreas = new Set(
    visibleForStats
      .filter((i) => i.severity === "high")
      .map((i) => i.locationName || `${i.lat.toFixed(2)}, ${i.lng.toFixed(2)}`)
  ).size;

  el.metricTotalIncidents.textContent = String(total);
  el.metricUsers.textContent = String(users);
  el.metricResolution.textContent = total > 0 ? `${Math.round((resolved / total) * 100)}%` : "N/A";
  el.metricRiskAreas.textContent = String(riskAreas);

  const max = Math.max(low, medium, high, 1);

  el.bars.innerHTML = [
    ["Low", low, "low"],
    ["Medium", medium, "medium"],
    ["High", high, "high"]
  ]
    .map(
      ([label, value, klass]) => `
      <div class="bar-row">
        <strong>${label}</strong>
        <div class="bar-track">
          <div class="bar-fill ${klass}" style="width:${(value / max) * 100}%"></div>
        </div>
        <span>${value}</span>
      </div>
    `
    )
    .join("");

  const typeCounts = visibleForStats.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  const typeRows = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  el.typeStats.innerHTML = typeRows.length
    ? typeRows
        .map(
          ([type, count]) => `
          <div class="type-row">
            <strong>${escapeHtml(type)}</strong>
            <span>${count}</span>
          </div>
        `
        )
        .join("")
    : `<div class="type-row"><strong>No data</strong><span>0</span></div>`;
}

function renderAdmin() {
  el.usersCountBadge.textContent = `${state.users.length} Users`;
  el.adminIncidentsCountBadge.textContent = `${state.incidents.length} Incidents`;

  if (state.usersLoadError) {
    setInlineMessage(el.usersList, state.usersLoadError, "error");
  } else {
    el.usersList.innerHTML = state.users.length
    ? sortNewest(state.users)
        .map(
          (user) => `
        <div class="user-card">
          <div class="card-top">
            <div>
              <h3 class="card-title">${escapeHtml(user.email || "Unknown")}</h3>
              <p class="card-desc">UID: ${escapeHtml(user.uid || "")}</p>
            </div>
            <span class="status-label low">${escapeHtml(user.role || "user")}</span>
          </div>
        </div>
      `
        )
        .join("")
    : `<div class="user-card"><p class="card-desc">No users found.</p></div>`;
  }

  el.adminIncidentsList.innerHTML = state.incidents.length
    ? sortNewest(state.incidents.map(withDistance)).map((i) => incidentCardHTML(i, true)).join("")
    : `<div class="incident-card"><p class="card-desc">No incidents found.</p></div>`;
}

function renderSOS() {
  if (state.sosLoadError) {
    setInlineMessage(el.sosLog, state.sosLoadError, "error");
    return;
  }

  el.sosLog.innerHTML = state.sosLogs.length
    ? sortNewest(state.sosLogs)
        .map(
          (log) => `
        <div class="sos-card">
          <div class="card-top">
            <div>
              <h3 class="card-title">${escapeHtml(log.type)}</h3>
              <p class="card-desc">${escapeHtml(log.message)}</p>
            </div>
            <span class="status-label high">SOS</span>
          </div>
          <div class="card-meta">
            <span>👤 ${escapeHtml(log.createdByEmail || "Unknown")}</span>
            <span>${formatRelativeTime(getMillis(log))}</span>
          </div>
        </div>
      `
        )
        .join("")
    : `<div class="sos-card"><p class="card-desc">No SOS logs yet.</p></div>`;
}



function renderAll() {
  updateRoleUI();
  renderIncidentList();
  renderAlerts();
  renderStats();
  renderAdmin();
  renderSOS();
  renderNearbyServices();
  renderMapMarkers();

  if (!el.chatMessages.children.length) {
    addChatMessage(
      "Hello! I can help in English and বাংলা.\nআমি ইংরেজি ও বাংলায় সাহায্য করতে পারি।",
      "ai"
    );
  }
}

function initMap() {
  if (state.map) return;

  state.map = L.map("map", {
    zoomControl: true
  }).setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(state.map);

  state.markersLayer = L.layerGroup().addTo(state.map);
}

function initSOSMap() {
  if (state.sosMap) return;

  state.sosMap = L.map("sosMap", {
    zoomControl: true
  }).setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(state.sosMap);

  state.sosUserMarker = L.marker([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng]).addTo(state.sosMap);
  state.sosUserMarker.bindPopup("Your Location");
}

function updateMainUserLocationMarker(lat, lng, label = "Your Location", accuracyMeters = 0) {
  if (!state.map) return;

  if (!state.userLocationMarker) {
    state.userLocationMarker = L.marker([lat, lng]).addTo(state.map);
  } else {
    state.userLocationMarker.setLatLng([lat, lng]);
  }

  state.userLocationMarker.bindPopup(label);

  if (accuracyMeters > 0) {
    if (!state.locationAccuracyCircle) {
      state.locationAccuracyCircle = L.circle([lat, lng], {
        radius: accuracyMeters,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.08,
        weight: 1
      }).addTo(state.map);
    } else {
      state.locationAccuracyCircle.setLatLng([lat, lng]);
      state.locationAccuracyCircle.setRadius(accuracyMeters);
    }
  }
}

function updateSOSMap(lat, lng, label = "Your Location") {
  if (!state.sosMap) return;
  state.sosMap.setView([lat, lng], 14);
  if (state.sosUserMarker) {
    state.sosUserMarker.setLatLng([lat, lng]).bindPopup(label);
  }
}

function severityColor(severity) {
  if (severity === "high") return "#ef4444";
  if (severity === "medium") return "#f59e0b";
  return "#22c55e";
}

function focusIncidentOnMap(id) {
  const incident = state.incidents.find((item) => item.id === id);
  if (!incident || !state.map) return;

  setActiveTab("map");
  state.map.flyTo([incident.lat, incident.lng], 15, { duration: 0.8 });

  const marker = state.markerIndex.get(id);
  if (marker) {
    setTimeout(() => marker.openPopup(), 350);
  }
}

function fitMapToIncidents() {
  if (!state.map) return;
  const incidents = getUserVisibleIncidents();

  if (!incidents.length) {
    state.map.setView([state.currentLocation.lat, state.currentLocation.lng], state.currentLocation.available ? 13 : 11);
    return;
  }

  const bounds = L.latLngBounds(incidents.map((i) => [i.lat, i.lng]));
  if (state.currentLocation.available) {
    bounds.extend([state.currentLocation.lat, state.currentLocation.lng]);
  }
  state.map.fitBounds(bounds, { padding: [30, 30] });
}

function renderMapMarkers() {
  if (!state.map || !state.markersLayer) return;

  state.markersLayer.clearLayers();
  state.markerIndex.clear();

  let incidents = getUserVisibleIncidents();

  if (!incidents.length) {
    incidents = state.incidents.map(withDistance);
  }

  incidents.forEach((incident) => {
    const marker = L.circleMarker([incident.lat, incident.lng], {
      radius: 9,
      color: severityColor(incident.severity),
      fillColor: severityColor(incident.severity),
      fillOpacity: 0.9,
      weight: 2
    });

    const distanceText =
      incident.distanceKm !== null ? formatDistance(incident.distanceKm) : "";
    const locationText =
      incident.locationName || `${incident.lat}, ${incident.lng}`;

    marker.bindPopup(`
      <div style="min-width:220px">
        <strong>${escapeHtml(incident.type)}</strong><br/>
        <span>${escapeHtml(incident.description)}</span><br/><br/>
        <span><strong>Severity:</strong> ${escapeHtml(severityLabel(incident.severity))}</span><br/>
        <span><strong>Location:</strong> ${escapeHtml(locationText)}</span><br/>
        ${distanceText ? `<span><strong>Distance:</strong> ${escapeHtml(distanceText)}</span><br/>` : ""}
        <span><strong>By:</strong> ${escapeHtml(incident.createdByEmail || "Unknown")}</span>
      </div>
    `);

    marker.addTo(state.markersLayer);
    state.markerIndex.set(incident.id, marker);
  });
}




function clearPhotoPreview() {
  el.incidentPhotoPreview.src = "";
  el.incidentPhotoPreview.classList.add("hidden");
}

function showPhotoPreview(file) {
  if (!file) {
    clearPhotoPreview();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    el.incidentPhotoPreview.src = reader.result;
    el.incidentPhotoPreview.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function clearReportForm() {
  if (el.editIncidentId) el.editIncidentId.value = "";
  if (el.reportFormTitle) el.reportFormTitle.textContent = "Report an Incident";
  if (el.reportForm) el.reportForm.reset();
  clearPhotoPreview();

  if (state.currentLocation.available) {
    if (el.incidentLat) el.incidentLat.value = state.currentLocation.lat;
    if (el.incidentLng) el.incidentLng.value = state.currentLocation.lng;
    if (el.incidentLocationText && state.currentLocation.name) {
      el.incidentLocationText.value = state.currentLocation.name;
    }
  }

  updateReportAccessUI();
}


async function getUserRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return "user";
  return snap.data().role || "user";
}

async function saveUserProfile(user, role = "user") {
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email || "",
      role: "user",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
}

function sanitizeFilename(name) {
  const safe = String(name || "image")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe || "image";
}

async function uploadPhoto(file, uid) {
  if (!file) return { photoURL: "", photoPath: "" };

  const validation = validatePhotoFile(file);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const safeName = `${Date.now()}-${sanitizeFilename(file.name)}`;
  const photoPath = `${uid}/${safeName}`;

  const { error } = await supabase
    .storage
    .from("incident-photos")
    .upload(photoPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg"
    });

  if (error) {
    throw new Error(error.message || "Image upload failed.");
  }

  const { data } = supabase.storage.from("incident-photos").getPublicUrl(photoPath);

  return {
    photoURL: data?.publicUrl || "",
    photoPath
  };
}

async function deletePhoto(photoPath) {
  if (!photoPath) return;
  const { error } = await supabase.storage.from("incident-photos").remove([photoPath]);
  if (error) {
    console.warn("Photo delete failed:", error.message || error);
  }
}


async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return "";
    const data = await response.json();
    return data.display_name || "";
  } catch {
    return "";
  }
}

function isBanglaText(text) {
  return /[\u0980-\u09FF]/.test(text);
}

function getChatLanguage(text) {
  if (el.chatLanguage.value === "en") return "en";
  if (el.chatLanguage.value === "bn") return "bn";
  return isBanglaText(text) ? "bn" : "en";
}

function getAiReply(text, lang) {
  const value = text.toLowerCase();
  const visibleHigh = getUserVisibleIncidents().filter((i) => i.severity === "high").length;

  if (lang === "bn") {
    if (value.includes("দুর্ঘটনা")) {
      return "প্রথমে নিরাপদ স্থানে যান। কেউ আহত হলে জরুরি সহায়তা ডাকুন। তারপর সঠিক লোকেশন ও ঘটনার বিবরণ দিয়ে রিপোর্ট করুন।";
    }
    if (value.includes("সন্দেহ") || value.includes("suspicious")) {
      return "সরাসরি মুখোমুখি হবেন না। স্থান, সময় এবং আচরণ লক্ষ্য করুন, তারপর রিপোর্ট করুন।";
    }
    if (value.includes("ঝুঁকি") || value.includes("risk")) {
      return `আপনার ৫০ কিমি এলাকার মধ্যে এখন ${visibleHigh} টি উচ্চ-ঝুঁকির ঘটনা আছে। বিস্তারিত দেখতে Alerts ট্যাব দেখুন।`;
    }
    if (value.includes("জরুরি") || value.includes("sos")) {
      return "জরুরি হলে SOS ট্যাবে যান, 999 এ কল করুন, এবং সম্ভব হলে নিজের লোকেশন শেয়ার করুন।";
    }
    return "আমি নিরাপত্তা, রিপোর্টিং, জরুরি সহায়তা এবং ঝুঁকিপূর্ণ এলাকা সম্পর্কে বাংলায় সাহায্য করতে পারি।";
  }

  if (value.includes("accident")) {
    return "Move to a safe place, call emergency services if needed, and report the exact location with clear details.";
  }
  if (value.includes("suspicious")) {
    return "Avoid confrontation, observe safely, and submit a suspicious activity report with the location and details.";
  }
  if (value.includes("risk")) {
    return `There are currently ${visibleHigh} high-severity incidents within your 50 km area. Check the Alerts tab for the latest warnings.`;
  }
  if (value.includes("sos") || value.includes("emergency")) {
    return "Go to the SOS tab, call 999 immediately if needed, and share your location for faster help.";
  }
  return "I can help with safety advice, incident reporting, emergency response, and risk awareness in English or Bangla.";
}

function addChatMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.textContent = text;
  el.chatMessages.appendChild(div);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = el.loginEmail.value.trim();
  const password = el.loginPassword.value.trim();
  const mode = el.authMode.value;

  try {
    if (mode === "register") {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await saveUserProfile(cred.user, "user");
      toast("Account created successfully", "success");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      toast("Login successful", "success");
    }

    closeModal();
    el.loginForm.reset();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function handleAuthButtonClick() {
  if (state.user) {
    await signOut(auth);
    toast("Logged out", "info");
  } else {
    openModal();
  }
}


async function geocodeLocation(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || !data.length) return null;

    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
      name: data[0].display_name || query
    };
  } catch {
    return null;
  }
}



async function handleReportSubmit(event) {
  event.preventDefault();

  if (!state.user) {
    toast("Please login first", "warn");
    openModal();
    return;
  }

  const editId = el.editIncidentId?.value || "";
  const type = el.incidentType?.value?.trim() || "";
  const severity = el.incidentSeverity?.value?.trim() || "";
  let lat = Number.parseFloat(el.incidentLat?.value || "");
  let lng = Number.parseFloat(el.incidentLng?.value || "");
  let locationName = el.incidentLocationText?.value?.trim() || "";
  const description = el.incidentDescription?.value?.trim() || "";
  const photoFile = el.incidentPhoto?.files?.[0] || null;

  const photoValidation = validatePhotoFile(photoFile);
  if (!photoValidation.ok) {
    toast(photoValidation.message, "warn");
    return;
  }

  if (!type || !severity || !description) {
    toast("Please fill all required fields", "warn");
    return;
  }

  const hasValidCoords =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng);

  if (!hasValidCoords) {
    if (locationName) {
      const geocoded = await geocodeLocation(locationName);

      if (!geocoded) {
        toast("Could not find this location. Please use My Location or enter a clearer address.", "warn");
        return;
      }

      lat = geocoded.lat;
      lng = geocoded.lng;
      locationName = geocoded.name;

      if (el.incidentLat) el.incidentLat.value = lat;
      if (el.incidentLng) el.incidentLng.value = lng;
      if (el.incidentLocationText) el.incidentLocationText.value = locationName;
    } else {
      toast("Please use My Location or enter a location name.", "warn");
      return;
    }
  }

  try {
    if (editId) {
      const incidentRef = doc(db, "incidents", editId);
      const existing = state.incidents.find((item) => item.id === editId);

      const patch = {
        type,
        severity,
        description,
        locationName,
        lat,
        lng,
        updatedAt: serverTimestamp()
      };

      if (photoFile) {
        if (existing?.photoPath) {
          try {
            await deletePhoto(existing.photoPath);
          } catch {}
        }

        try {
          const uploaded = await uploadPhoto(photoFile, state.user.uid);
          patch.photoURL = uploaded.photoURL;
          patch.photoPath = uploaded.photoPath;
        } catch (error) {
          toast(getStorageErrorMessage(error), "warn");
        }
      }

      await updateDoc(incidentRef, patch);
      toast("Incident updated successfully", "success");
    } else {
      let uploaded = { photoURL: "", photoPath: "" };

      if (photoFile) {
        try {
          uploaded = await uploadPhoto(photoFile, state.user.uid);
        } catch (error) {
          toast(getStorageErrorMessage(error), "warn");
        }
      }

      await addDoc(collection(db, "incidents"), {
        type,
        severity,
        lat,
        lng,
        description,
        locationName,
        photoURL: uploaded.photoURL,
        photoPath: uploaded.photoPath,
        createdBy: state.user.uid,
        createdByEmail: state.user.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "active"
      });

      toast("Incident reported successfully", "success");
    }

    clearReportForm();
    setActiveTab("map");

    setTimeout(() => {
      renderIncidentList();
      renderAlerts();
      renderMapMarkers();
      fitMapToIncidents();
    }, 150);
  } catch (error) {
    toast(error.message, "error");
  }
}

function loadIncidentIntoForm(id) {
  const incident = state.incidents.find((item) => item.id === id);
  if (!incident) return;

  el.editIncidentId.value = incident.id;
  el.incidentType.value = incident.type;
  el.incidentSeverity.value = incident.severity;
  el.incidentLat.value = incident.lat;
  el.incidentLng.value = incident.lng;
  el.incidentLocationText.value = incident.locationName || "";
  el.incidentDescription.value = incident.description;
  el.reportFormTitle.textContent = "Edit Incident";

  if (incident.photoURL) {
    el.incidentPhotoPreview.src = incident.photoURL;
    el.incidentPhotoPreview.classList.remove("hidden");
  } else {
    clearPhotoPreview();
  }

  updateReportAccessUI();
  setActiveTab("report");
}

async function deleteIncident(id, photoPath = "") {
  try {
    await deleteDoc(doc(db, "incidents", id));

    if (photoPath) {
      try {
        await deletePhoto(photoPath);
      } catch {}
    }

    toast("Incident deleted", "error");
  } catch (error) {
    toast(error.message, "error");
  }
}
async function captureLocation() {
  if (!navigator.geolocation) {
    toast("Geolocation is not supported", "warn");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = Number(position.coords.latitude.toFixed(6));
      const lng = Number(position.coords.longitude.toFixed(6));

      if (el.incidentLat) el.incidentLat.value = lat;
      if (el.incidentLng) el.incidentLng.value = lng;

      const locationName = await reverseGeocode(lat, lng);
      if (locationName && el.incidentLocationText) {
        el.incidentLocationText.value = locationName;
      }

      state.currentLocation = {
        lat,
        lng,
        name: locationName || "Current Location",
        available: true
      };

      updateMainUserLocationMarker(
        lat,
        lng,
        locationName || "Your Location",
        position.coords.accuracy || 0
      );

      updateSOSMap(lat, lng, locationName || "Your Location");
      renderIncidentList();
      renderAlerts();
      renderStats();
      renderMapMarkers();
      renderNearbyServices();
      fitMapToIncidents();

      toast("Location captured", "success");
    },
    (error) => toast(getLocationErrorMessage(error), "error"),
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function startLiveLocationTracking() {
  if (!navigator.geolocation) return;
  if (geoWatchId !== null) return;

  geoWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      const lat = Number(position.coords.latitude.toFixed(6));
      const lng = Number(position.coords.longitude.toFixed(6));

      state.currentLocation.lat = lat;
      state.currentLocation.lng = lng;
      state.currentLocation.available = true;

      try {
        const name = await reverseGeocode(lat, lng);
        state.currentLocation.name = name || "Current Location";
      } catch {
        state.currentLocation.name = "Current Location";
      }

      updateMainUserLocationMarker(
        lat,
        lng,
        state.currentLocation.name,
        position.coords.accuracy || 0
      );

      updateSOSMap(lat, lng, state.currentLocation.name);

      if (el.incidentLat) el.incidentLat.value = lat;
      if (el.incidentLng) el.incidentLng.value = lng;
      if (el.incidentLocationText && state.currentLocation.name) {
        el.incidentLocationText.value = state.currentLocation.name;
      }

      renderIncidentList();
      renderAlerts();
      renderStats();
      renderMapMarkers();
      renderNearbyServices();
      fitMapToIncidents();
    },
    (error) => {
      console.error("Live location tracking failed:", error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000
    }
  );
}

function stopLiveLocationTracking() {
  if (geoWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
}

async function triggerSOS(withLocation) {
  if (!state.user) {
    toast("Please login first", "warn");
    openModal();
    return;
  }

  let lat = null;
  let lng = null;
  let locationName = "";

  if (withLocation) {
    try {
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      lat = Number(coords.latitude.toFixed(6));
      lng = Number(coords.longitude.toFixed(6));
      locationName = await reverseGeocode(lat, lng);

      state.currentLocation = {
        lat,
        lng,
        name: locationName || "Current Location",
        available: true
      };

      if (el.incidentLat) el.incidentLat.value = lat;
      if (el.incidentLng) el.incidentLng.value = lng;
      if (el.incidentLocationText && locationName) {
        el.incidentLocationText.value = locationName;
      }

      updateMainUserLocationMarker(
        lat,
        lng,
        locationName || "Your Location"
      );

      updateSOSMap(
        lat,
        lng,
        locationName || "Your Location"
      );

      renderIncidentList();
      renderAlerts();
      renderStats();
      renderMapMarkers();
      renderNearbyServices();
      fitMapToIncidents();
    } catch (error) {
      toast(getLocationErrorMessage(error), "warn");
    }
  }

  await addDoc(collection(db, "sosLogs"), {
    type: withLocation ? "Location Shared" : "SOS Triggered",
    message: withLocation
      ? "Emergency request sent with live location."
      : "Emergency assistance requested.",
    lat,
    lng,
    locationName,
    createdBy: state.user.uid,
    createdByEmail: state.user.email || "",
    createdAt: serverTimestamp()
  });

  toast(
    withLocation
      ? "SOS alert sent with your location"
      : "SOS alert sent",
    "error"
  );
}

function handleChatSubmit(event) {
  event.preventDefault();
  const text = el.chatInput.value.trim();
  if (!text) return;

  const lang = getChatLanguage(text);

  addChatMessage(text, "user");
  el.chatInput.value = "";

  setTimeout(() => {
    addChatMessage(getAiReply(text, lang), "ai");
  }, 250);
}

async function setupNotifications() {
  if (!VAPID_KEY || VAPID_KEY === "YOUR_WEB_PUSH_VAPID_KEY") return;

  const supported = await isSupported();
  if (!supported || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (state.user && token) {
      await setDoc(
        doc(db, "fcmTokens", state.user.uid),
        {
          uid: state.user.uid,
          email: state.user.email || "",
          token,
          firebaseProjectId: firebaseConfig.projectId,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    onMessage(messaging, (payload) => {
      toast(payload?.notification?.title || "New safety notification", "info");
    });
  } catch (error) {
    console.error("Notification setup failed:", error);
  }
}

function watchIncidents() {
  if (incidentUnsub) incidentUnsub();

  incidentUnsub = onSnapshot(
    query(collection(db, "incidents"), orderBy("createdAt", "desc")),
    (snapshot) => {
      state.incidentLoadError = "";
      state.incidents = snapshot.docs.map((docItem) => {
        const data = docItem.data();
        return {
          id: docItem.id,
          ...data,
          lat: Number(data.lat),
          lng: Number(data.lng)
        };
      });

      renderIncidentList();
      renderAlerts();
      renderStats();
      renderAdmin();
      renderMapMarkers();

      if (state.activeTab === "map") {
        setTimeout(() => state.map?.invalidateSize(), 50);
      }
    },
    (error) => {
      console.error("Realtime incident listener error:", error);
      state.incidentLoadError = "Failed to load realtime incidents. Please check your Firebase connection or permissions.";
      renderIncidentList();
      renderAlerts();
      toast("Failed to load realtime incidents", "error");
    }
  );
}

function watchUsers() {
  if (userUnsub) userUnsub();

  userUnsub = onSnapshot(
    query(collection(db, "users"), orderBy("updatedAt", "desc")),
    (snapshot) => {
      state.usersLoadError = "";
      state.users = snapshot.docs.map((docItem) => docItem.data());
      renderAll();
    },
    (error) => {
      console.error("Users listener error:", error);
      state.usersLoadError = "Failed to load users list.";
      renderAdmin();
    }
  );
}

function watchSOS() {
  if (sosUnsub) sosUnsub();

  sosUnsub = onSnapshot(
    query(collection(db, "sosLogs"), orderBy("createdAt", "desc")),
    (snapshot) => {
      state.sosLoadError = "";
      state.sosLogs = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));
      renderSOS();
    },
    (error) => {
      console.error("SOS listener error:", error);
      state.sosLoadError = "Failed to load SOS activity.";
      renderSOS();
    }
  );
}

function bindEvents() {
  el.authButton.addEventListener("click", handleAuthButtonClick);
  el.loginForm.addEventListener("submit", handleAuthSubmit);
  el.reportForm.addEventListener("submit", handleReportSubmit);
  el.reportLoginBtn.addEventListener("click", openModal);
  el.gpsBtn.addEventListener("click", captureLocation);
  el.chatForm.addEventListener("submit", handleChatSubmit);
  el.sosButton.addEventListener("click", () => triggerSOS(false));
  el.shareLocationBtn.addEventListener("click", () => triggerSOS(true));
  el.call999Btn.addEventListener("click", () => {
    window.location.href = "tel:999";
  });

  el.centerUserBtn.addEventListener("click", async () => {
    if (!state.currentLocation.available) {
      await captureLocation();
      return;
    }
    state.map?.flyTo([state.currentLocation.lat, state.currentLocation.lng], 14);
    state.userLocationMarker?.openPopup();
  });

  el.refreshMapBtn.addEventListener("click", () => {
    renderMapMarkers();
    fitMapToIncidents();
    toast("Map pins refreshed", "success");
  });

  el.authMode.addEventListener("change", () => {
    el.authModalTitle.textContent =
      el.authMode.value === "register" ? "Register for SSAN" : "Login to SSAN";
  });

  el.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  el.searchInput.addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderIncidentList();
    renderAlerts();
    renderMapMarkers();
  });

  el.severityFilter.addEventListener("change", (e) => {
    state.filters.severity = e.target.value;
    renderIncidentList();
    renderAlerts();
    renderMapMarkers();
  });

  el.typeFilter.addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    renderIncidentList();
    renderAlerts();
    renderMapMarkers();
  });

  el.incidentPhoto.addEventListener("change", () => {
    const file = el.incidentPhoto.files?.[0] || null;
    const validation = validatePhotoFile(file);

    if (!validation.ok) {
      el.incidentPhoto.value = "";
      clearPhotoPreview();
      toast(validation.message, "warn");
      return;
    }

    showPhotoPreview(file);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.closeModal === "true") {
      closeModal();
      return;
    }

    if (target.classList.contains("question-chip")) {
      el.chatInput.value = target.textContent.trim();
      setActiveTab("ai");
      el.chatInput.focus();
      return;
    }

    if (target.dataset.editIncident) {
      loadIncidentIntoForm(target.dataset.editIncident);
      return;
    }

    if (target.dataset.deleteIncident) {
      deleteIncident(target.dataset.deleteIncident, target.dataset.photoPath || "");
      return;
    }

    const focusHolder = target.closest("[data-focus-incident]");
    if (focusHolder instanceof HTMLElement) {
      const id = focusHolder.dataset.focusIncident;
      if (id) focusIncidentOnMap(id);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

onAuthStateChanged(auth, async (user) => {
  state.user = user;

  if (user) {
    state.role = await getUserRole(user.uid);
    startLiveLocationTracking();
    await setupNotifications();
  } else {
    state.role = "user";
    stopLiveLocationTracking();
  }

  updateRoleUI();
  renderAll();
  clearReportForm();
});

initMap();
initSOSMap();
bindEvents();
watchIncidents();
watchUsers();
watchSOS();
renderAll();
setTimeout(() => {
  state.map?.invalidateSize();
  state.sosMap?.invalidateSize();
}, 200);