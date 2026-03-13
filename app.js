/**
 * E-Surat Frontend Logic
 * Full Version - Fixed & Complete
 */

// --- CONFIGURATION ---
const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxvCLxehz-NSiVE_0Njo5rCFr2Z48hTA0bpQhm_sXQ_4qH0AMUpq0FaQjJ2kXXNQKNVjQ/exec";

// --- STATE MANAGEMENT ---
const state = {
  user: null, // {id, username, role, name, nip_nim}
  letters: [],
  staff: { examiners: [], supervisors: [] },
  locations: [],
  currentView: "dashboard",
  loading: false,
  cache: {},
};

// Cache TTL (Time To Live) in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// --- CORE FUNCTIONS ---

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

async function api(action, data = {}, forceRefresh = false) {
  const mutations = [
    "login",
    "upsertUser",
    "deleteUser",
    "submitLetter",
    "updateLetterStatus",
    "deleteLetter", // <-- INI DITAMBAHKAN AGAR CACHE RESET SAAT SURAT DIHAPUS
    "bulkUpsertUsers",
    "bulkUpsert",
    "upsertStaff",
    "deleteStaff",
    "saveSettings",
    "upsertLocation",
    "deleteLocation",
  ];
  const isMutation = mutations.includes(action);
  const cacheKey = action + JSON.stringify(data);

  if (
    !isMutation &&
    !forceRefresh &&
    state.cache[cacheKey] &&
    Date.now() - state.cache[cacheKey].timestamp < CACHE_TTL
  ) {
    console.log("Using cached data for:", action);
    return state.cache[cacheKey].data;
  }

  showLoading(true);
  try {
    const url = GAS_WEB_APP_URL;
    const bodyData = JSON.stringify({ action, ...data });
    const formData = new URLSearchParams();
    formData.append("payload", bodyData);

    const response = await fetch(url, { method: "POST", body: formData });
    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON:", text);
      throw new Error(`Koneksi Gagal (Server Error).`);
    }

    if (result && result.success === false) throw new Error(result.error);

    if (!isMutation) {
      state.cache[cacheKey] = { data: result, timestamp: Date.now() };
    } else {
      state.cache = {}; // Clear cache on mutation
    }

    return result;
  } catch (err) {
    showToast(err.message, "error");
    throw err;
  } finally {
    showLoading(false);
  }
}

// --- UI ROUTING & RENDERING ---

function switchScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

function renderSidebar() {
  const nav = document.getElementById("nav-items");
  let items = [
    { id: "dashboard", label: "Dashboard", icon: "fas fa-th-large" },
  ];

  if (state.user.role === "super_admin") {
    items.push({
      id: "manage-users",
      label: "Kelola User",
      icon: "fas fa-users",
    });
  } else if (state.user.role === "admin") {
    items.push({
      id: "manage-staff",
      label: "Data Penguji & Pembimbing",
      icon: "fas fa-user-tie",
    });
    items.push({
      id: "manage-locations",
      label: "Tempat Ujian",
      icon: "fas fa-map-marker-alt",
    });
    items.push({
      id: "validate-letters",
      label: "Antrean Validasi",
      icon: "fas fa-clipboard-check",
    });
    items.push({
      id: "archive",
      label: "Arsip Surat Undangan",
      icon: "fas fa-archive",
    });
    items.push({
      id: "archive-research",
      label: "Arsip Ijin Penelitian",
      icon: "fas fa-folder-open",
    });
    items.push({
      id: "admin-report",
      label: "Laporan",
      icon: "fas fa-chart-pie",
    });
    items.push({
      id: "settings-signatory",
      label: "Pengaturan TTD",
      icon: "fas fa-signature",
    });
  } else if (state.user.role === "mahasiswa") {
    items.push({
      id: "my-letters",
      label: "Surat Saya",
      icon: "fas fa-file-alt",
    });
    items.push({
      id: "research-letters",
      label: "Ijin Penelitian",
      icon: "fas fa-microscope",
    });
  }

  nav.innerHTML = items
    .map(
      (item) => `
        <a href="#" class="nav-item ${state.currentView === item.id ? "active" : ""}" data-view="${item.id}">
            <i class="${item.icon}"></i>
            <span>${item.label}</span>
        </a>
    `,
    )
    .join("");

  nav.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const view = el.dataset.view;
      navigateTo(view);
    });
  });
}

function navigateTo(view) {
  state.currentView = view;
  localStorage.setItem("currentView", view); // Save view to persistence
  renderSidebar();
  const titleMap = {
    dashboard: "Dashboard Overview",
    "manage-users": "Manajemen Pengguna",
    "manage-staff": "Data Penguji & Pembimbing",
    "manage-locations": "Kelola Tempat Ujian",
    "validate-letters": "Antrean Validasi Surat",
    archive: "Arsip Surat Selesai (Undangan)",
    "archive-research": "Arsip Ijin Penelitian (Selesai)",
    "my-letters": "Permohonan Surat Saya",
    "research-letters": "Pengajuan Ijin Penelitian",
    "admin-report": "Laporan Statistik",
    "settings-signatory": "Pengaturan Penandatangan",
  };
  document.getElementById("current-view-title").innerText =
    titleMap[view] || "E-Surat";
  renderContent();
}

function renderContent() {
  const container = document.getElementById("content-area");
  switch (state.currentView) {
    case "dashboard":
      renderDashboard(container);
      break;
    case "manage-users":
      renderUserManagement(container);
      break;
    case "manage-staff":
      renderStaffManagement(container);
      break;
    case "manage-locations":
      renderLocationManagement(container);
      break; // FIXED
    case "validate-letters":
      renderValidationQueue(container);
      break;
    case "archive":
      renderArchive(container);
      break;
    case "archive-research":
      renderArchiveResearch(container);
      break;
    case "my-letters":
      renderStudentLetters(container);
      break;
    case "research-letters":
      renderResearchLetters(container);
      break;
    case "admin-report":
      renderAdminReport(container);
      break; // FIXED
    case "settings-signatory":
      renderSignatorySettings(container);
      break;
    default:
      container.innerHTML = "<p>Halaman tidak ditemukan.</p>";
  }
}

// --- VIEW COMPONENTS ---

async function renderDashboard(container) {
  let statsHtml = "";
  if (state.user.role === "super_admin" || state.user.role === "admin") {
    const stats = await api("getDashboardStats", {}, true); // Force Refresh
    statsHtml = `
      <div class="card-header" style="margin-bottom:20px; border-bottom:0; padding:0">
          <h3><i class="fas fa-th-large"></i> Dashboard Stats</h3>
          <button class="btn btn-icon" onclick="renderDashboard(document.getElementById('content-area'))" title="Refresh Data">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-clock"></i></div>
          <div class="stat-info"><span class="label">Pending</span><span class="value">${stats.surat_masuk}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
          <div class="stat-info"><span class="label">Disetujui</span><span class="value">${stats.sudah_validasi}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="fas fa-undo"></i></div>
          <div class="stat-info"><span class="label">Dikembalikan</span><span class="value">${stats.dikembalikan}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i class="fas fa-users"></i></div>
          <div class="stat-info"><span class="label">Total Mahasiswa</span><span class="value">${stats.total_mhs}</span></div>
        </div>
      </div>
      
      <div class="grid-form" style="grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
        <div class="card">
            <div class="card-header"><h3><i class="fas fa-chart-pie"></i> Status Surat</h3></div>
            <div style="padding: 16px; height: 260px; display: flex; justify-content: center;">
                <canvas id="statusChart"></canvas>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3><i class="fas fa-chart-bar"></i> Aktivitas Terbaru</h3></div>
            <div id="recent-activities" style="padding: 16px;">
                <p style="color:var(--text-muted); text-align:center">Memuat aktivitas...</p>
            </div>
        </div>
      </div>
    `;
    setTimeout(() => renderDashboardCharts(stats), 100);
  } else {
    // Mahasiswa Stats
    let letters = await api("getLetters", {
      role: "mahasiswa",
      userId: state.user.id,
    });
    if (!Array.isArray(letters)) letters = [];

    const pending = letters.filter((l) => l.status === "Pending").length;
    const draft = letters.filter((l) => l.status === "Draft").length;
    const returned = letters.filter((l) => l.status === "Returned").length;
    const approved = letters.filter((l) => l.status === "Approved").length;

    statsHtml = `
      <div class="card-header" style="margin-bottom:20px; border-bottom:0; padding:0">
          <h3><i class="fas fa-th-large"></i> Ringkasan Anda</h3>
          <button class="btn btn-icon" onclick="renderDashboard(document.getElementById('content-area'))" title="Refresh Data">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-clock"></i></div>
          <div class="stat-info"><span class="label">Sedang Diproses</span><span class="value">${pending}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
          <div class="stat-info"><span class="label">Disetujui</span><span class="value">${approved}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="fas fa-undo"></i></div>
          <div class="stat-info"><span class="label">Perlu Revisi</span><span class="value">${returned}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon gray"><i class="fas fa-edit"></i></div>
          <div class="stat-info"><span class="label">Draft Belum Kirim</span><span class="value">${draft}</span></div>
        </div>
      </div>
      
      <div class="card" style="margin-top: 20px;">
        <div class="card-header"><h3><i class="fas fa-info-circle"></i> Informasi Terbaru</h3></div>
        <div style="padding: 20px;">
            <p>Selamat datang di layanan <b>E-Surat</b>. Pastikan data yang Anda inputkan benar sesuai dengan draf pendaftaran ujian Anda.</p>
            <div style="margin-top: 12px; padding: 10px; background: #fff8eb; border-left: 4px solid #f59e0b; border-radius: 6px;">
                <small><b>Tips:</b> Jika surat Anda berstatus "Returned", silakan klik tombol edit di menu "Data Surat Saya" untuk melihat catatan revisi dari admin.</small>
            </div>
        </div>
      </div>
    `;
  }
  container.innerHTML = statsHtml;
}

function renderDashboardCharts(stats) {
  const ctx = document.getElementById("statusChart")?.getContext("2d");
  if (!ctx) return;

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Pending", "Disetujui", "Dikembalikan", "Draft"],
      datasets: [
        {
          data: [
            stats.surat_masuk,
            stats.sudah_validasi,
            stats.dikembalikan,
            stats.draft,
          ],
          backgroundColor: ["#6366f1", "#22c55e", "#f59e0b", "#94a3b8"],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 20 },
        },
      },
      cutout: "70%",
    },
  });

  // Recent Activities placeholder logic
  const activityContainer = document.getElementById("recent-activities");
  if (activityContainer) {
    activityContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <div style="width:8px; height:8px; border-radius:50%; background:#22c55e"></div>
                    <div style="font-size:0.9rem">Total <b>${stats.sudah_validasi}</b> surat telah diselesaikan (Approved).</div>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <div style="width:8px; height:8px; border-radius:50%; background:#6366f1"></div>
                    <div style="font-size:0.9rem">Ada <b>${stats.surat_masuk}</b> surat baru yang menunggu validasi Anda.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <div style="width:8px; height:8px; border-radius:50%; background:#f59e0b"></div>
                    <div style="font-size:0.9rem"><b>${stats.dikembalikan}</b> mahasiswa perlu melakukan revisi surat.</div>
                </div>
            </div>
        `;
  }
}

// --- USER MANAGEMENT ---
function renderUserManagement(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div style="display:flex; align-items:center; gap:16px;">
                    <h3><i class="fas fa-users-cog"></i> Kelola Pengguna</h3>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <div class="search-container">
                        <i class="fas fa-search"></i>
                        <input type="text" id="u-search" placeholder="Cari nama atau username..." autocomplete="off">
                        <button class="btn-search" onclick="loadUsers()">Cari</button>
                    </div>
                    <button class="btn btn-primary" onclick="openUserForm()">
                        <i class="fas fa-plus"></i> Tambah User
                    </button>
                    <button class="btn btn-accent" onclick="exportUsers()">
                        <i class="fas fa-file-export"></i> Ekspor
                    </button>
                    <button class="btn btn-success" onclick="triggerImport()">
                        <i class="fas fa-file-import"></i> Impor
                    </button>
                    <input type="file" id="csv-import-input" style="display:none" accept=".csv" onchange="handleImport(this)">
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Nama</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>NIM/NIP</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="user-table-body"><tr><td colspan="5" style="text-align:center; padding:40px;">Memuat data...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;
  loadUsers();
}

async function loadUsers() {
  try {
    let users = await api("getUsers");
    if (!Array.isArray(users)) users = [];
    const tbody = document.getElementById("user-table-body");
    tbody.innerHTML =
      users
        .map(
          (u) => `
            <tr>
                <td style="font-weight:700; color:var(--text-main)">${u.name}</td>
                <td><code style="background:var(--primary-light); color:var(--primary); padding:2px 8px; border-radius:6px; font-weight:700; font-size:0.8rem">${u.username}</code></td>
                <td><span class="badge ${u.role === "admin" || u.role === "super_admin" ? "badge-approved" : "badge-pending"}">${u.role.replace("_", " ")}</span></td>
                <td style="color:var(--text-muted); font-weight:600">${u.nip_nim}</td>
                <td class="td-actions">
                    <div style="display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn btn-icon" title="Edit" onclick="editUser('${u.id}')"><i class="fas fa-edit" style="color:var(--primary)"></i></button>
                        <button class="btn btn-icon danger" title="Hapus" onclick="deleteUser('${u.id}')"><i class="fas fa-trash-alt" style="color:var(--danger)"></i></button>
                    </div>
                </td>
            </tr>
        `,
        )
        .join("") ||
      '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted)">Belum ada user terdaftar.</td></tr>';
  } catch (e) {
    document.getElementById("user-table-body").innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--danger)">Gagal memuat data user.</td></tr>';
  }
}

// Added Missing Function: openUserForm
function openUserForm(user = null) {
  const isEdit = !!user;
  showModal(
    isEdit ? "Edit User" : "Tambah User",
    `
      <form id="user-form">
          <div class="form-group"><label>Nama Lengkap</label><input id="u_name" class="form-input" value="${user?.name || ""}" required></div>
          <div class="form-group"><label>Username</label><input id="u_username" class="form-input" value="${user?.username || ""}" required></div>
          ${!isEdit ? '<div class="form-group"><label>Password</label><input type="password" id="u_password" class="form-input" required></div>' : ""}
          <div class="form-group"><label>Role</label>
              <select id="u_role" class="form-input" style="width:100%">
                  <option value="mahasiswa" ${user?.role === "mahasiswa" ? "selected" : ""}>Mahasiswa</option>
                  <option value="admin" ${user?.role === "admin" ? "selected" : ""}>Admin Prodi</option>
                  <option value="super_admin" ${user?.role === "super_admin" ? "selected" : ""}>Super Admin</option>
              </select>
          </div>
          <div class="form-group"><label>NIP / NIM</label><input id="u_nip" class="form-input" value="${user?.nip_nim || ""}" required></div>
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px">
              <button type="button" class="btn" onclick="closeModal()">Batal</button>
              <button type="submit" class="btn btn-primary">${isEdit ? "Perbarui" : "Tambah"} Pengguna</button>
          </div>
      </form>
  `,
  );

  document.getElementById("user-form").onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      id: user?.id,
      name: document.getElementById("u_name").value,
      username: document.getElementById("u_username").value,
      role: document.getElementById("u_role").value,
      nip_nim: document.getElementById("u_nip").value,
    };
    if (!isEdit) data.password = document.getElementById("u_password").value;

    await api("upsertUser", { data });
    showToast(isEdit ? "User diperbarui" : "User ditambahkan");
    closeModal();
    loadUsers();
  };
}

async function editUser(id) {
  let users = await api("getUsers");
  const user = users.find((u) => u.id == id);
  if (user) openUserForm(user);
}

async function deleteUser(id) {
  if (confirm("Hapus user ini?")) {
    await api("deleteUser", { id });
    showToast("User dihapus");
    loadUsers();
  }
}

async function exportUsers() {
  let users = await api("getUsers");
  if (!users.length) return showToast("Tidak ada data", "error");
  const headers = ["id", "username", "role", "name", "nip_nim"];
  const csvContent = [
    headers.join(","),
    ...users.map((u) => headers.map((h) => `"${u[h] || ""}"`).join(",")),
  ].join("\n");
  downloadFile(csvContent, "users.csv", "text/csv");
}

function triggerImport() {
  document.getElementById("csv-import-input").click();
}
async function handleImport(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const lines = e.target.result.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());
    const dataArray = lines
      .slice(1)
      .filter((l) => l.trim())
      .map((line) => {
        const values = line
          .split(",")
          .map((v) => v.trim().replace(/^"|"$/g, ""));
        let obj = {};
        headers.forEach((h, i) => (obj[h] = values[i]));
        return obj;
      });
    await api("bulkUpsertUsers", { dataArray });
    showToast(`${dataArray.length} user diimport`);
    loadUsers();
    input.value = "";
  };
  reader.readAsText(file);
}

// --- STAFF MANAGEMENT ---
function renderStaffManagement(container) {
  container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-user-tie"></i> Data Penguji</h3>
                    <button class="btn btn-primary" onclick="openStaffForm('Examiners')">
                        <i class="fas fa-plus"></i> Tambah
                    </button>
                </div>
                <div class="table-responsive">
                    <table id="table-examiners">
                        <thead>
                            <tr>
                                <th>Nama Lengkap & Gelar</th>
                                <th>NIP</th>
                                <th class="td-actions">Aksi</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-chalkboard-teacher"></i> Data Pembimbing</h3>
                    <button class="btn btn-primary" onclick="openStaffForm('Supervisors')">
                        <i class="fas fa-plus"></i> Tambah
                    </button>
                </div>
                <div class="table-responsive">
                    <table id="table-supervisors">
                        <thead>
                            <tr>
                                <th>Nama Lengkap & Gelar</th>
                                <th>NIP</th>
                                <th class="td-actions">Aksi</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
  loadStaff();
}

async function loadStaff() {
  const result = await api("getStaff");
  const render = (data, elementId, type) => {
    const table = document.querySelector(`#${elementId} tbody`);
    if (!table) return;
    table.innerHTML =
      data
        .map(
          (s) => `
            <tr>
                <td style="font-weight:700; color:var(--text-main)">${s.name}</td>
                <td style="color:var(--text-muted); font-family:monospace; font-weight:600">${s.nip || "-"}</td>
                <td class="td-actions">
                    <button class="btn btn-icon danger" title="Hapus" onclick="deleteStaff('${type}', '${s.id}')">
                        <i class="fas fa-trash-alt" style="color:var(--danger)"></i>
                    </button>
                </td>
            </tr>
        `,
        )
        .join("") ||
      '<tr><td colspan="3" style="text-align:center; padding: 30px; color:var(--text-muted)">Belum ada data.</td></tr>';
  };
  render(result.examiners || [], "table-examiners", "Examiners");
  render(result.supervisors || [], "table-supervisors", "Supervisors");
}

function openStaffForm(type) {
  showModal(
    type === "Examiners" ? "Tambah Penguji" : "Tambah Pembimbing",
    `
        <form id="staff-form">
            <div class="form-group"><label>Nama</label><input id="s_name" class="form-input" required></div>
            <div class="form-group"><label>NIP</label><input id="s_nip" class="form-input" required></div>
             <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px">
                <button type="button" class="btn" onclick="closeModal()">Batal</button>
                <button type="submit" class="btn btn-primary">Simpan Data</button>
            </div>
        </form>
  `,
  );
  document.getElementById("staff-form").onsubmit = async (e) => {
    e.preventDefault();
    await api("upsertStaff", {
      type,
      data: {
        name: document.getElementById("s_name").value,
        nip: document.getElementById("s_nip").value,
      },
    });
    showToast("Berhasil");
    closeModal();
    loadStaff();
  };
}

async function deleteStaff(type, id) {
  if (confirm("Hapus staff ini?")) {
    await api("deleteStaff", { type, id });
    loadStaff();
  }
}

// --- LOCATION MANAGEMENT (FIXED & ADDED) ---
function renderLocationManagement(container) {
  container.innerHTML = `
          <div class="card">
              <div class="card-header">
                  <h3><i class="fas fa-map-marker-alt"></i> Kelola Tempat Ujian</h3>
                  <button class="btn btn-primary" onclick="openLocationForm()">
                      <i class="fas fa-plus"></i> Tambah Lokasi
                  </button>
              </div>
              <div class="table-responsive">
                  <table>
                      <thead>
                        <tr>
                            <th>Nama Ruangan / Lokasi</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                      </thead>
                      <tbody id="location-table-body"><tr><td colspan="2" style="text-align:center; padding:30px;">Memuat...</td></tr></tbody>
                  </table>
              </div>
          </div>
      `;
  loadLocations();
}

async function loadLocations() {
  const tbody = document.getElementById("location-table-body");
  try {
    let locations = await api("getLocations");
    if (!Array.isArray(locations)) locations = [];

    // Safety check for names and IDs
    locations.sort((a, b) => {
      const nameA = (a.name || "").toString().toLowerCase();
      const nameB = (b.name || "").toString().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    state.locations = locations;
    if (tbody) {
      tbody.innerHTML =
        locations
          .map(
            (l) => `
                <tr>
                    <td style="font-weight:600">${l.name}</td>
                    <td class="td-actions">
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button class="btn btn-icon" title="Edit" onclick="openLocationForm('${l.id}')">
                                <i class="fas fa-edit" style="color:var(--primary)"></i>
                            </button>
                            <button class="btn btn-icon danger" title="Hapus" onclick="deleteLocation('${l.id}')">
                                <i class="fas fa-trash-alt" style="color:var(--danger)"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `,
          )
          .join("") ||
        '<tr><td colspan="2" style="text-align:center; padding: 40px; color: var(--text-muted)">Belum ada lokasi yang ditambahkan.</td></tr>';
    }
  } catch (e) {
    console.error("Error in loadLocations:", e);
    if (tbody)
      tbody.innerHTML =
        '<tr><td colspan="2" style="text-align:center; color:var(--danger)">Gagal memuat data</td></tr>';
  }
}

function openLocationForm(id = null) {
  const loc = id ? state.locations.find((l) => l.id == id) : null;
  showModal(
    id ? "Edit Tempat Ujian" : "Tambah Lokasi Baru",
    `
      <form id="location-form">
          <div class="form-group">
              <label>Nama Ruangan / Lokasi</label>
              <input type="text" id="loc_name" class="form-input" value="${loc ? loc.name : ""}" placeholder="Contoh: Ruang Sidang 1" required>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px">
              <button type="button" class="btn" onclick="closeModal()">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan Lokasi</button>
          </div>
      </form>
    `,
  );
  document.getElementById("location-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("loc_name").value;
    await api("upsertLocation", { data: { id: id, name: name } });
    showToast(id ? "Lokasi diperbarui" : "Lokasi berhasil ditambahkan");
    closeModal();
    loadLocations();
  };
}

async function deleteLocation(id) {
  if (confirm("Yakin ingin menghapus lokasi ini?")) {
    await api("deleteLocation", { id });
    showToast("Lokasi dihapus");
    loadLocations();
  }
}

// --- STUDENT LETTERS VIEW ---
function renderStudentLetters(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-file-alt"></i> Permohonan Surat Saya</h3>
                <button class="btn btn-primary" onclick="openLetterForm()"><i class="fas fa-plus"></i> Buat Surat Baru</button>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Jenis Surat</th>
                            <th>Judul & Penguji</th>
                            <th>Tgl Pengajuan</th>
                            <th>Status</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="student-letters-body"><tr><td colspan="5" style="text-align:center; padding: 40px;">Memuat data surat...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;
  loadStudentData();
}

async function loadStudentData() {
  let letters = await api("getLetters", {
    role: "mahasiswa",
    userId: state.user.id,
  });
  if (!Array.isArray(letters)) letters = [];

  // Filter out research letters from this view
  const examLetters = letters.filter(
    (l) => l.letter_type !== "Surat Ijin Penelitian",
  );

  const tbody = document.getElementById("student-letters-body");

  const getBadge = (s) => {
    const map = {
      Draft: "badge-pending",
      Pending: "badge-pending",
      Approved: "badge-approved",
      Returned: "badge-rejected",
    };
    return `<span class="badge ${map[s] || "badge-pending"}">${s}</span>`;
  };

  tbody.innerHTML =
    examLetters
      .map(
        (l) => `
        <tr style="font-size: 0.9rem;">
            <td><span class="badge ${l.status === "Approved" ? "badge-approved" : l.status === "Returned" ? "badge-rejected" : "badge-pending"}" style="font-size:0.75rem">${l.letter_type}</span></td>
            <td style="max-width:250px;">
                <div style="font-weight:600">${l.proposal_title || "-"}</div>
                <div style="font-size:0.75rem; color:var(--text-muted)">Penguji: ${l.examiner_name}</div>
            </td>
            <td style="white-space:nowrap">${new Date(l.submission_date).toLocaleDateString("id-ID")}</td>
            <td>
                ${getBadge(l.status)}
                ${
                  l.status === "Returned"
                    ? `
                    <div style="margin-top:8px; padding: 8px; background: #fff1f2; border-radius: 4px; border-left: 3px solid #ef4444; font-size: 0.8rem; color: #b91c1c;">
                        <i class="fas fa-exclamation-circle"></i> <b>Catatan Revisi:</b><br>${l.rejection_notes}
                    </div>
                `
                    : ""
                }
            </td>
            <td class="td-actions">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-icon" onclick="previewLetter('${l.id}')" title="Pratinjau"><i class="fas fa-eye" style="color:var(--primary)"></i></button>
                    ${
                      l.status === "Draft" || l.status === "Returned"
                        ? `
                        <button class="btn btn-icon" onclick="openLetterForm('${l.id}')" title="Edit"><i class="fas fa-edit" style="color:var(--accent)"></i></button>
                        <button class="btn btn-icon" onclick="ajukanSurat('${l.id}')" title="Kirim ke Admin"><i class="fas fa-paper-plane" style="color:var(--primary)"></i></button>
                    `
                        : ""
                    }
                    ${l.status === "Draft" ? `<button class="btn btn-icon danger" onclick="batalkanSurat('${l.id}')" title="Hapus"><i class="fas fa-trash-alt" style="color:var(--danger)"></i></button>` : ""}
                    ${l.status === "Approved" ? `<button class="btn btn-icon" onclick="printLetter('${l.id}')" title="Cetak Surat"><i class="fas fa-print" style="color:var(--secondary)"></i></button>` : ""}
                </div>
            </td>
        </tr>
    `,
      )
      .join("") ||
    '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted)">Belum ada surat yang diajukan.</td></tr>';
}

async function openLetterForm(id = null) {
  const staff = await api("getStaff");
  const locs = await api("getLocations");

  // Find existing letter data from state cache if editing
  let existing = null;
  if (id) {
    // Search within cached letter lists (which usually contain the data we need)
    Object.keys(state.cache).forEach((key) => {
      if (key.startsWith("getLetters") && state.cache[key].data) {
        const found = state.cache[key].data.find((l) => l.id == id);
        if (found) existing = found;
      }
    });
  }

  const examiners = (staff.examiners || [])
    .map(
      (s) =>
        `<option value="${s.name}" ${existing && existing.examiner_name === s.name ? "selected" : ""}>${s.name}</option>`,
    )
    .join("");
  const supervisors = (staff.supervisors || [])
    .map(
      (s) =>
        `<option value="${s.name}" ${existing && existing.supervisor_name === s.name ? "selected" : ""}>${s.name}</option>`,
    )
    .join("");
  const locations = (locs || [])
    .map(
      (l) =>
        `<option value="${l.name}" ${existing && existing.exam_location === l.name ? "selected" : ""}>${l.name}</option>`,
    )
    .join("");

  showModal(
    id ? "Edit Surat Pengajuan" : "Buat Surat Baru",
    `
        <form id="letter-form" class="grid-form" style="grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group span-2">
                <label><i class="fas fa-file-signature"></i> Jenis Surat</label>
                <select id="letter_type" class="form-input" style="width:100%">
                    <option ${existing && existing.letter_type === "Surat Ujian Tugas Akhir" ? "selected" : ""}>Surat Ujian Tugas Akhir</option>
                    <option ${existing && existing.letter_type === "Surat Ujian Proposal" ? "selected" : ""}>Surat Ujian Proposal</option>
                </select>
            </div>
            <div class="form-group span-2">
                <label><i class="fas fa-heading"></i> Judul Penelitian / Tugas Akhir</label>
                <input id="proposal_title" class="form-input" value="${existing ? existing.proposal_title : ""}" placeholder="Masukkan judul lengkap" required>
            </div>
            <div class="form-group span-2">
                <label><i class="fas fa-calendar-day"></i> Tanggal Pelaksanaan</label>
                <input type="date" id="exam_date" class="form-input" value="${existing ? existing.exam_date : ""}" required>
            </div>
            <div class="form-group">
                <label><i class="fas fa-hourglass-start"></i> Jam Mulai</label>
                <input type="time" id="exam_time" class="form-input" value="${existing ? existing.exam_time : ""}" required>
            </div>
            <div class="form-group">
                <label><i class="fas fa-hourglass-end"></i> Jam Selesai</label>
                <input type="time" id="exam_time_end" class="form-input" value="${existing ? existing.exam_time_end : ""}" required>
            </div>
            <div class="form-group span-2">
                <label><i class="fas fa-map-marked-alt"></i> Lokasi / Ruangan</label>
                 <input list="loc-list" id="exam_location" class="form-input" required placeholder="Pilih lokasi atau ketik manual" value="${existing ? existing.exam_location : ""}">
                 <datalist id="loc-list">${locations}</datalist>
            </div>
            <div class="form-group">
                <label><i class="fas fa-user-tie"></i> Penguji 1</label>
                <select id="examiner_1" class="form-input" style="width:100%">${examiners}</select>
            </div>
            <div class="form-group">
                <label><i class="fas fa-user-graduate"></i> Penguji 2 (Pembimbing)</label>
                <select id="examiner_2" class="form-input" style="width:100%">${supervisors}</select>
            </div>
            <div class="span-2" style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px">
                <button type="button" class="btn" onclick="closeModal()">Batal</button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-check-circle"></i> ${id ? "Simpan Perubahan" : "Simpan sebagai Draft"}
                </button>
            </div>
        </form>
    `,
  );

  document.getElementById("letter-form").onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      id: id || null,
      letter_type: document.getElementById("letter_type").value,
      proposal_title: document.getElementById("proposal_title").value,
      exam_date: document.getElementById("exam_date").value,
      exam_time: document.getElementById("exam_time").value,
      exam_time_end: document.getElementById("exam_time_end").value,
      exam_location: document.getElementById("exam_location").value,
      examiner_name: document.getElementById("examiner_1").value,
      supervisor_name: document.getElementById("examiner_2").value,
      student_id: state.user.id,
      student_name: state.user.name,
      student_nim: state.user.nip_nim,
    };
    await api("submitLetter", { data });
    showToast(id ? "Surat diperbarui" : "Draft tersimpan");
    closeModal();
    loadStudentData();
  };
}

async function ajukanSurat(id) {
  if (confirm("Ajukan surat ini ke admin?")) {
    await api("updateLetterStatus", { id, status: "Pending", updateData: {} });
    showToast("Surat diajukan");
    loadStudentData();
  }
}
async function batalkanSurat(id) {
  if (confirm("Hapus draft ini?")) {
    await api("deleteLetter", { id });
    showToast("Dihapus");
    loadStudentData();
    if (state.currentView === "research-letters") loadResearchLettersData();
  }
}

// --- RESEARCH LETTERS VIEW ---
function renderResearchLetters(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-microscope"></i> Pengajuan Ijin Penelitian</h3>
                <button class="btn btn-primary" onclick="openResearchLetterForm()"><i class="fas fa-plus"></i> Ajukan Ijin Penelitian</button>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Judul Penelitian</th>
                            <th>Tempat Tujuan</th>
                            <th>Tgl Pengajuan</th>
                            <th>Status</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="research-letters-body"><tr><td colspan="5" style="text-align:center; padding: 40px;">Memuat data...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;
  loadResearchLettersData();
}

async function loadResearchLettersData() {
  let letters = await api("getLetters", {
    role: "mahasiswa",
    userId: state.user.id,
  });
  if (!Array.isArray(letters)) letters = [];

  // Filter only for "Surat Ijin Penelitian"
  const researchLetters = letters.filter(
    (l) => l.letter_type === "Surat Ijin Penelitian",
  );

  const tbody = document.getElementById("research-letters-body");
  if (!tbody) return;

  const getStatusDisplay = (l) => {
    if (l.status === "Approved") {
      return `<span class="badge badge-approved"><i class="fas fa-check-circle"></i> Silakan ambil surat</span>`;
    }
    const map = {
      Draft: "badge-pending",
      Pending: "badge-pending",
      Returned: "badge-rejected",
    };
    return `<span class="badge ${map[l.status] || "badge-pending"}">${l.status}</span>`;
  };

  tbody.innerHTML =
    researchLetters
      .map(
        (l) => `
        <tr style="font-size: 0.9rem;">
            <td style="max-width:300px; font-weight:600;">${l.proposal_title}</td>
            <td>${l.exam_location || "-"}</td>
            <td style="white-space:nowrap">${new Date(l.submission_date).toLocaleDateString("id-ID")}</td>
            <td>
                ${getStatusDisplay(l)}
                ${
                  l.status === "Returned"
                    ? `
                    <div style="margin-top:8px; padding: 8px; background: #fff1f2; border-radius: 4px; border-left: 3px solid #ef4444; font-size: 0.8rem; color: #b91c1c;">
                        <i class="fas fa-exclamation-circle"></i> <b>Catatan Revisi:</b><br>${l.rejection_notes}
                    </div>
                `
                    : ""
                }
            </td>
            <td class="td-actions">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    ${
                      l.status === "Draft" || l.status === "Returned"
                        ? `
                        <button class="btn btn-icon" onclick="openResearchLetterForm('${l.id}')" title="Edit"><i class="fas fa-edit" style="color:var(--accent)"></i></button>
                        <button class="btn btn-icon" onclick="ajukanRisetSurat('${l.id}')" title="Kirim ke Admin"><i class="fas fa-paper-plane" style="color:var(--primary)"></i></button>
                    `
                        : ""
                    }
                    ${l.status === "Draft" ? `<button class="btn btn-icon danger" onclick="batalkanSurat('${l.id}')" title="Hapus"><i class="fas fa-trash-alt" style="color:var(--danger)"></i></button>` : ""}
                    ${l.status === "Approved" ? `<button class="btn btn-icon" onclick="previewLetter('${l.id}')" title="Lihat"><i class="fas fa-eye" style="color:var(--primary)"></i></button>` : ""}
                </div>
            </td>
        </tr>
    `,
      )
      .join("") ||
    '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted)">Belum ada pengajuan ijin penelitian.</td></tr>';
}

async function openResearchLetterForm(id = null) {
  let existing = null;
  if (id) {
    Object.keys(state.cache).forEach((key) => {
      if (key.startsWith("getLetters") && state.cache[key].data) {
        const found = state.cache[key].data.find((l) => l.id == id);
        if (found) existing = found;
      }
    });
  }

  showModal(
    id ? "Edit Ijin Penelitian" : "Ajukan Ijin Penelitian Baru",
    `
        <form id="research-letter-form">
            <div class="form-group">
                <label><i class="fas fa-heading"></i> Judul Penelitian</label>
                <textarea id="r_title" class="form-input" rows="3" placeholder="Masukkan judul penelitian lengkap" required>${existing ? existing.proposal_title : ""}</textarea>
            </div>
            <div class="form-group">
                <label><i class="fas fa-map-marker-alt"></i> Tempat Tujuan Penelitian</label>
                <input id="r_location" class="form-input" value="${existing ? existing.exam_location : ""}" placeholder="Contoh: Rumah Sakit Umum Daerah..., Desa..." required>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px">
                <button type="button" class="btn" onclick="closeModal()">Batal</button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-check-circle"></i> ${id ? "Simpan Perubahan" : "Simpan sebagai Draft"}
                </button>
            </div>
        </form>
    `,
  );

  document.getElementById("research-letter-form").onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      id: id || null,
      letter_type: "Surat Ijin Penelitian",
      proposal_title: document.getElementById("r_title").value,
      exam_location: document.getElementById("r_location").value,
      student_id: state.user.id,
      student_name: state.user.name,
      student_nim: state.user.nip_nim,
      // Default empty values for other fields to avoid backend issues
      exam_date: "",
      exam_time: "",
      exam_time_end: "",
      examiner_name: "-",
      supervisor_name: "-",
    };
    await api("submitLetter", { data });
    showToast(id ? "Berhasil diperbarui" : "Draft tersimpan");
    closeModal();
    loadResearchLettersData();
  };
}

async function ajukanRisetSurat(id) {
  if (confirm("Ajukan surat ijin penelitian ini ke admin?")) {
    await api("updateLetterStatus", { id, status: "Pending", updateData: {} });
    showToast("Surat diajukan");
    loadResearchLettersData();
  }
}

// --- VALIDATION & ADMIN REPORTS ---

// --- VALIDATION QUEUE (PENDING ONLY) ---
function renderValidationQueue(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div style="display:flex; align-items:center; gap:12px;">
                    <h3><i class="fas fa-clipboard-check"></i> Antrean Validasi</h3>
                    <button class="btn btn-icon" onclick="loadValidationQueue(true)" title="Refresh Antrean">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div class="search-container">
                    <i class="fas fa-search"></i>
                    <input type="text" id="v-search" placeholder="Cari nama, NIM, atau judul..." autocomplete="off">
                    <button class="btn-search" onclick="loadValidationQueue()">Cari</button>
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Nama Mahasiswa</th>
                            <th>Perihal</th>
                            <th>Judul</th>
                            <th>Tujuan (Penguji)</th>
                            <th>Tgl Pengajuan</th>
                            <th>Status</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="validation-table-body"><tr><td colspan="7" style="text-align:center; padding:40px;">Memuat antrean...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;

  // Enter key trigger search
  document.getElementById("v-search")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadValidationQueue();
  });

  loadValidationQueue();
}

async function loadValidationQueue(force = false) {
  const searchQuery =
    document.getElementById("v-search")?.value.toLowerCase() || "";
  let letters = await api("getLetters", { role: "admin" }, force);

  // Filter only PENDING and match search
  const filtered = (letters || []).filter((l) => {
    const isPending = l.status === "Pending";
    const matchesSearch =
      l.student_name.toLowerCase().includes(searchQuery) ||
      l.student_nim.toLowerCase().includes(searchQuery) ||
      (l.proposal_title || "").toLowerCase().includes(searchQuery);
    return isPending && matchesSearch;
  });

  const tbody = document.getElementById("validation-table-body");
  if (!tbody) return;

  tbody.innerHTML =
    filtered
      .map(
        (l) => `
        <tr>
            <td>
                <div style="font-weight:700; color:var(--text-main)">${l.student_name}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px">${l.student_nim}</div>
            </td>
            <td><span class="badge badge-pending" style="font-size:0.7rem">${l.letter_type}</span></td>
            <td style="max-width: 250px;">
                <div style="font-size:0.85rem; font-weight:600; line-height:1.4">${l.proposal_title}</div>
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${
                      l.letter_type === "Surat Ijin Penelitian"
                        ? `<span style="display:flex; align-items:center; gap:8px; font-size:0.85rem;"><i class="fas fa-map-marker-alt" style="color:var(--primary); width:14px"></i> Tujuan: ${l.exam_location}</span>`
                        : `
                        <span style="display:flex; align-items:center; gap:8px; font-size:0.85rem;"><i class="fas fa-user-tie" style="color:var(--primary); width:14px"></i> 1. ${l.examiner_name}</span>
                        <span style="display:flex; align-items:center; gap:8px; font-size:0.85rem;"><i class="fas fa-user-graduate" style="color:var(--secondary); width:14px"></i> 2. ${l.supervisor_name}</span>
                        `
                    }
                </div>
            </td>
            <td style="font-size:0.85rem; font-weight:600; white-space:nowrap; color:var(--text-muted)">
                <i class="far fa-calendar-alt"></i> ${new Date(l.submission_date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
            </td>
            <td class="td-actions">
                <div style="display:flex; justify-content:flex-end; gap:10px; align-items:center;">
                    <button class="btn btn-icon" title="Preview" onclick="previewLetter('${l.id}')">
                        <i class="fas fa-eye" style="color:var(--primary)"></i>
                    </button>
                    <button class="btn btn-sm btn-success" title="Setujui dan Beri Nomor" onclick="approveLetter('${l.id}')">
                        <i class="fas fa-check"></i> Terima
                    </button>
                    <button class="btn btn-sm btn-danger" title="Kembalikan untuk Revisi" onclick="returnLetter('${l.id}')">
                        <i class="fas fa-times"></i> Tolak
                    </button>
                </div>
            </td>
        </tr>
    `,
      )
      .join("") ||
    '<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted)">Tidak ada antrean validasi.</td></tr>';
}

// --- ARCHIVE (APPROVED ONLY) ---
function renderArchive(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div style="display:flex; align-items:center; gap:12px;">
                    <h3><i class="fas fa-archive"></i> Arsip Surat Undangan</h3>
                    <button class="btn btn-icon" onclick="loadArchive(true)" title="Refresh Arsip">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div class="search-container">
                    <i class="fas fa-search"></i>
                    <input type="text" id="a-search" placeholder="Cari nomor, nama, atau NIM..." autocomplete="off">
                    <button class="btn-search" onclick="loadArchive()">Cari</button>
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>No Surat</th>
                            <th>Mahasiswa</th>
                            <th>Judul</th>
                            <th>Waktu Ujian</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="archive-table-body"><tr><td colspan="5" style="text-align:center; padding:40px;">Memuat arsip...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;

  document.getElementById("a-search")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadArchive();
  });

  loadArchive();
}

async function loadArchive(force = false) {
  const searchQuery =
    document.getElementById("a-search")?.value.toLowerCase() || "";
  let letters = await api("getLetters", { role: "admin" }, force);

  // Filter only APPROVED, NOT research letter, and match search
  const filtered = (letters || []).filter((l) => {
    const isApproved = l.status === "Approved";
    const isNotResearch = l.letter_type !== "Surat Ijin Penelitian";
    const matchesSearch =
      (l.letter_number || "").toLowerCase().includes(searchQuery) ||
      l.student_name.toLowerCase().includes(searchQuery) ||
      l.student_nim.toLowerCase().includes(searchQuery) ||
      (l.proposal_title || "").toLowerCase().includes(searchQuery);
    return isApproved && isNotResearch && matchesSearch;
  });

  const tbody = document.getElementById("archive-table-body");
  if (!tbody) return;

  tbody.innerHTML =
    filtered
      .map(
        (l) => `
        <tr>
            <td style="font-weight:700; color:var(--primary)">${l.letter_number || "-"}</td>
            <td>
                <div style="font-weight:700">${l.student_name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted)">${l.student_nim}</div>
            </td>
            <td style="max-width:250px">
                <div style="font-weight:600; font-size:0.85rem">${l.letter_type}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px">${l.proposal_title}</div>
            </td>
            <td>
                <div style="font-size:0.85rem; font-weight:600"><i class="far fa-calendar-alt" style="color:var(--primary)"></i> ${formatDateID(l.exam_date)}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)"><i class="far fa-clock"></i> ${formatTimeID(l.exam_time)}</div>
            </td>
            <td class="td-actions">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-icon" title="Preview" onclick="previewLetter('${l.id}')"><i class="fas fa-eye" style="color:var(--primary)"></i></button>
                    <button class="btn btn-icon" title="Cetak" onclick="printLetter('${l.id}')"><i class="fas fa-print" style="color:var(--secondary)"></i></button>
                </div>
            </td>
        </tr>
    `,
      )
      .join("") ||
    '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted)">Arsip kosong atau tidak ditemukan.</td></tr>';
}

// --- ARCHIVE RESEARCH ---
function renderArchiveResearch(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div style="display:flex; align-items:center; gap:12px;">
                    <h3><i class="fas fa-folder-open"></i> Arsip Ijin Penelitian Selesai</h3>
                    <button class="btn btn-icon" onclick="loadArchiveResearch(true)" title="Refresh Arsip">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div class="search-container">
                    <i class="fas fa-search"></i>
                    <input type="text" id="ar-search" placeholder="Cari nomor, nama, atau NIM..." autocomplete="off">
                    <button class="btn-search" onclick="loadArchiveResearch()">Cari</button>
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>No Surat</th>
                            <th>Mahasiswa</th>
                            <th>Judul Penelitian</th>
                            <th>Tempat Tujuan</th>
                            <th>Tgl Pengajuan / Terima</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="archive-research-table-body"><tr><td colspan="6" style="text-align:center; padding:40px;">Memuat arsip...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;

  document.getElementById("ar-search")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadArchiveResearch();
  });

  loadArchiveResearch();
}

async function loadArchiveResearch(force = false) {
  const searchQuery =
    document.getElementById("ar-search")?.value.toLowerCase() || "";
  let letters = await api("getLetters", { role: "admin" }, force);

  const filtered = (letters || []).filter((l) => {
    const isApproved = l.status === "Approved";
    const isResearch = l.letter_type === "Surat Ijin Penelitian";
    const matchesSearch =
      (l.letter_number || "").toLowerCase().includes(searchQuery) ||
      l.student_name.toLowerCase().includes(searchQuery) ||
      l.student_nim.toLowerCase().includes(searchQuery) ||
      (l.proposal_title || "").toLowerCase().includes(searchQuery);
    return isApproved && isResearch && matchesSearch;
  });

  const tbody = document.getElementById("archive-research-table-body");
  if (!tbody) return;

  tbody.innerHTML =
    filtered
      .map(
        (l) => `
        <tr>
            <td style="font-weight:700; color:var(--primary)">${l.letter_number || "-"}</td>
            <td>
                <div style="font-weight:700">${l.student_name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted)">${l.student_nim}</div>
            </td>
            <td style="max-width:250px">
                <div style="font-size:0.8rem; color:var(--text-main); font-weight:600;">${l.proposal_title}</div>
            </td>
            <td>
                <div style="font-size:0.85rem; font-weight:600"><i class="fas fa-map-marker-alt" style="color:var(--primary)"></i> ${l.exam_location}</div>
            </td>
            <td>
                <div style="font-size:0.8rem; color:var(--text-main); font-weight:600;"><i class="far fa-paper-plane"></i> ${formatDateID(l.submission_date)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);"><i class="fas fa-check-circle"></i> ${l.approval_date ? formatDateID(l.approval_date) : "-"}</div>
            </td>
            <td class="td-actions">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-icon" title="Preview" onclick="previewLetter('${l.id}')"><i class="fas fa-eye" style="color:var(--primary)"></i></button>
                    <button class="btn btn-icon" title="Cetak" onclick="printLetter('${l.id}')"><i class="fas fa-print" style="color:var(--secondary)"></i></button>
                </div>
            </td>
        </tr>
    `,
      )
      .join("") ||
    '<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted)">Arsip ijin penelitian kosong.</td></tr>';
}

function revealTitle(id) {
  // Find letter in all getLetters cache
  let letters = [];
  Object.keys(state.cache).forEach((key) => {
    if (key.startsWith("getLetters") && state.cache[key].data) {
      letters = letters.concat(state.cache[key].data);
    }
  });

  const letter = letters.find((l) => l.id == id);
  if (!letter) return;

  const div = document.getElementById(`archive-title-${id}`);
  if (div) {
    div.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4; text-align: justify; max-width: 250px;">
        ${letter.proposal_title}
      </div>
    `;
  }
}

function getStatusBadge(status) {
  const map = {
    Draft: "badge-pending",
    Pending: "badge-pending",
    Approved: "badge-approved",
    Returned: "badge-rejected",
  };
  return `<span class="badge ${map[status] || "badge-pending"}">${status}</span>`;
}

async function approveLetter(id) {
  const settings = await api("getSettings");
  if (!settings.signatory_name)
    return showToast("Atur Penandatangan di Menu Pengaturan dulu!", "error");

  showModal(
    "Setujui Surat",
    `
        <form id="approve-form">
            <div class="form-group"><label>Nomor Surat</label>
            <div style="display:flex"><span style="padding:10px;background:#eee">PP.06.02/F.XXIX.19/4/</span><input id="a_num" class="form-input" required></div>
            </div>
            <div style="margin-top:20px; text-align:right">
                <button type="button" class="btn" onclick="closeModal()">Batal</button>
                <button type="submit" class="btn btn-primary">Setuju & TTD</button>
            </div>
        </form>
    `,
  );
  document.getElementById("approve-form").onsubmit = async (e) => {
    e.preventDefault();
    const updateData = {
      letter_number:
        "PP.06.02/F.XXIX.19/4/" + document.getElementById("a_num").value,
      signatory_position: settings.signatory_position,
      signatory_name: settings.signatory_name,
      signatory_nip: settings.signatory_nip,
    };
    await api("updateLetterStatus", { id, status: "Approved", updateData });
    showToast("Surat Disetujui");
    closeModal();
    loadValidationQueue();
  };
}

// --- HELPERS ---
const formatDateID = (dStr) => {
  if (!dStr) return "-";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch (e) {
    return dStr;
  }
};

const formatTimeID = (tStr) => {
  if (!tStr) return "-";
  if (tStr.includes("T")) {
    try {
      const dt = new Date(tStr);
      return dt
        .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        .replace(".", ":");
    } catch (e) {
      return tStr;
    }
  }
  return tStr;
};

async function returnLetter(id) {
  showModal(
    "Kembalikan Surat",
    `
        <form id="return-form">
            <div class="form-group"><label>Alasan Pengembalian</label><textarea id="r_note" class="form-input" rows="3" required></textarea></div>
            <button type="submit" class="btn btn-primary" style="margin-top:10px">Kirim</button>
        </form>
    `,
  );
  document.getElementById("return-form").onsubmit = async (e) => {
    e.preventDefault();
    await api("updateLetterStatus", {
      id,
      status: "Returned",
      updateData: { rejection_notes: document.getElementById("r_note").value },
    });
    showToast("Surat dikembalikan");
    closeModal();
    loadValidationQueue();
  };
}

// --- ADMIN REPORT (FIXED & ADDED) ---
// --- ADMIN REPORT (FIXED & ENHANCED) ---
function renderAdminReport(container) {
  const today = new Date().toISOString().split("T")[0];
  const lastMonth = new Date();
  lastMonth.setDate(lastMonth.getDate() - 30);
  const dateStr = lastMonth.toISOString().split("T")[0];

  container.innerHTML = `
      <div class="card" style="margin-bottom: 24px;">
          <div class="card-header"><h3><i class="fas fa-chart-pie"></i> Filter Laporan Statistik</h3></div>
          <div style="padding: 24px;">
              <div class="grid-form" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); align-items:end; gap:20px;">
                  <div class="form-group"><label><i class="fas fa-calendar-alt"></i> Dari Tanggal</label><input type="date" id="report-start" class="form-input" value="${dateStr}"></div>
                  <div class="form-group"><label><i class="fas fa-calendar-check"></i> Sampai Tanggal</label><input type="date" id="report-end" class="form-input" value="${today}"></div>
                  <div class="form-group"><label><i class="fas fa-tasks"></i> Status</label>
                    <select id="report-status" class="form-input">
                        <option value="All">Semua Status</option>
                        <option value="Draft">Draft</option>
                        <option value="Pending">Pending (Menunggu)</option>
                        <option value="Approved">Approved (Disetujui)</option>
                        <option value="Returned">Returned (Dikembalikan)</option>
                    </select>
                  </div>
                  <div class="form-group" style="display:flex; gap:12px;">
                      <button class="btn btn-primary" style="flex:1; height:45px;" onclick="previewReport()">
                        <i class="fas fa-search"></i> Lihat Laporan
                      </button>
                      <button class="btn btn-accent" style="flex:1; height:45px;" onclick="generateReport()">
                        <i class="fas fa-file-csv"></i> Ekspor CSV
                      </button>
                  </div>
              </div>
          </div>
      </div>
      <div id="report-preview-area"></div>
    `;
}

async function previewReport() {
  const startStr = document.getElementById("report-start").value;
  const endStr = document.getElementById("report-end").value;
  const statusFilter = document.getElementById("report-status").value;

  const container = document.getElementById("report-preview-area");
  container.innerHTML = `<div class="card" style="padding:40px; text-align:center"><div class="loader" style="width:30px; height:30px; border-width:3px"></div><p style="margin-top:10px">Mengambil data...</p></div>`;

  try {
    let letters = await api("getLetters", { role: "admin" });
    if (!Array.isArray(letters)) letters = [];

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    endDate.setHours(23, 59, 59);

    const filtered = letters.filter((l) => {
      const subDate = new Date(l.submission_date);
      const matchDate = subDate >= startDate && subDate <= endDate;
      const matchStatus = statusFilter === "All" || l.status === statusFilter;
      return matchDate && matchStatus;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="card" style="padding:40px; text-align:center; color:var(--text-muted)">Tidak ada data ditemukan untuk periode ini.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
           <h3>Pratinjau Data (${filtered.length} surat)</h3>
           <span class="badge badge-pending">Total: ${filtered.length} Data</span>
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Tgl Pengajuan</th>
                <th>Status</th>
                <th>NIM / Nama</th>
                <th>Jenis / Judul</th>
                <th>Tgl / Jam Ujian</th>
                <th>Tempat</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(
                  (l) => `
                <tr>
                  <td>${formatDateID(l.submission_date)}</td>
                  <td>${getStatusBadge(l.status)}</td>
                  <td>
                    <div style="font-weight:600">${l.student_nim}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted)">${l.student_name}</div>
                  </td>
                  <td style="max-width:300px">
                    <div style="font-weight:600">${l.letter_type}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); text-align:justify;">${l.proposal_title}</div>
                  </td>
                  <td>
                    <div style="font-weight:600">${formatDateID(l.exam_date)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted)">${formatTimeID(l.exam_time)} - ${formatTimeID(l.exam_time_end)}</div>
                  </td>
                  <td>${l.exam_location || "-"}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="card" style="padding:40px; text-align:center; color:var(--danger)">Gagal memuat pratinjau.</div>`;
  }
}

async function generateReport() {
  const startStr = document.getElementById("report-start").value;
  const endStr = document.getElementById("report-end").value;
  if (!startStr || !endStr) return showToast("Pilih rentang tanggal", "error");

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  endDate.setHours(23, 59, 59);

  try {
    let letters = await api("getLetters", { role: "admin" });
    if (!Array.isArray(letters)) letters = [];
    const statusFilter = document.getElementById("report-status").value;
    const filtered = letters.filter((l) => {
      const subDate = new Date(l.submission_date);
      const matchDate = subDate >= startDate && subDate <= endDate;
      const matchStatus = statusFilter === "All" || l.status === statusFilter;
      return matchDate && matchStatus;
    });
    if (filtered.length === 0) return showToast("Tidak ada data", "error");

    const headers = [
      "No Surat",
      "Tgl Pengajuan",
      "Status",
      "NIM",
      "Nama",
      "Jenis Surat",
      "Judul",
      "Penguji 1",
      "Penguji 2",
      "Tgl Ujian",
      "Jam",
      "Tempat",
    ];
    const csvRows = filtered.map((l) => [
      `"${l.letter_number || "-"}"`,
      `"${new Date(l.submission_date).toLocaleDateString()}"`,
      `"${l.status}"`,
      `"${l.student_nim}"`,
      `"${l.student_name}"`,
      `"${l.letter_type}"`,
      `"${(l.proposal_title || "").replace(/"/g, '""')}"`,
      `"${l.examiner_name || "-"}"`,
      `"${l.supervisor_name || "-"}"`,
      `"${l.exam_date || "-"}"`,
      `"${l.exam_time} - ${l.exam_time_end}"`,
      `"${l.exam_location || "-"}"`,
    ]);
    const csvContent = [
      headers.join(","),
      ...csvRows.map((row) => row.join(",")),
    ].join("\n");
    downloadFile(csvContent, `Laporan_${startStr}_${endStr}.csv`, "text/csv");
  } catch (e) {
    showToast("Gagal membuat laporan", "error");
  }
}

// --- SETTINGS ---
async function renderSignatorySettings(container) {
  const settings = await api("getSettings");
  container.innerHTML = `
      <div class="card" style="max-width:600px;">
          <div class="card-header">
            <h3><i class="fas fa-signature"></i> Pengaturan Penandatangan</h3>
          </div>
          <div style="padding:32px;">
              <form id="signatory-form">
                  <div class="form-group"><label>Jabatan Penandatangan</label><input id="set_pos" class="form-input" value="${settings.signatory_position || ""}" placeholder="Contoh: Dekan / Ketua Prodi" required></div>
                  <div class="form-group"><label>Nama Lengkap & Gelar</label><input id="set_name" class="form-input" value="${settings.signatory_name || ""}" placeholder="Nama lengkap penandatangan" required></div>
                  <div class="form-group"><label>NIP Penandatangan</label><input id="set_nip" class="form-input" value="${settings.signatory_nip || ""}" placeholder="Masukkan NIP" required></div>
                  <div style="margin-top:24px">
                    <button type="submit" class="btn btn-primary" style="width:100%">
                        <i class="fas fa-save"></i> Simpan Pengaturan
                    </button>
                  </div>
              </form>
          </div>
      </div>
    `;
  document.getElementById("signatory-form").onsubmit = async (e) => {
    e.preventDefault();
    await api("saveSettings", {
      data: {
        signatory_position: document.getElementById("set_pos").value,
        signatory_name: document.getElementById("set_name").value,
        signatory_nip: document.getElementById("set_nip").value,
      },
    });
    showToast("Tersimpan");
  };
}

// --- PREVIEW & PRINT ---
function buildLetterHTML(l, forPrint = false) {
  const dExam = new Date(l.exam_date || Date.now());
  const dLetter = new Date(l.approval_date || l.submission_date || Date.now());
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const letterDateStr = `${dLetter.getDate()} ${months[dLetter.getMonth()]} ${dLetter.getFullYear()}`;
  const examDateStr = `${dExam.getDate()} ${months[dExam.getMonth()]} ${dExam.getFullYear()}`;
  const examDayName = days[dExam.getDay()];

  const kopUrl = new URL("assets/kop.png", window.location.href).href;
  const ttdUrl = new URL("assets/ttd.png", window.location.href).href;

  const fixTime = (t) => {
    if (!t) return "";
    if (t.includes("T")) {
      const dt = new Date(t);
      return dt
        .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        .replace(".", ":");
    }
    return t;
  };

  if (l.letter_type === "Surat Ijin Penelitian") {
    return `
      <div style="font-family:'Times New Roman', serif; line-height: 1.6; color: black; padding: 20px;">
          <div style="text-align:center;margin-bottom:20px">
              <img src="${kopUrl}" onerror="this.style.display='none'" style="width:100%;max-width:700px">
          </div>
          
          <table style="width:100%; margin-bottom: 20px;">
              <tr>
                  <td style="width:80px">Nomor</td>
                  <td style="width:10px">:</td>
                  <td>${l.letter_number || "......."}</td>
                  <td style="text-align:right">${letterDateStr}</td>
              </tr>
              <tr>
                  <td>Perihal</td>
                  <td>:</td>
                  <td colspan="2"><b>Ijin Penelitian</b></td>
              </tr>
          </table>

          <p>Yth. <br>Pimpinan / Kepala <br><b>${l.exam_location}</b></p>
          
          <p>Dengan hormat,<br>Dalam rangka penyelesaian tugas akhir/skripsi mahasiswa kami, dengan ini kami mengajukan permohonan ijin penelitian bagi mahasiswa berikut:</p>
          
          <table style="margin-left:30px; margin-bottom: 20px; width: calc(100% - 30px);">
              <tr>
                  <td style="width:120px;">Nama</td>
                  <td style="width:15px;">:</td>
                  <td><b>${l.student_name}</b></td>
              </tr>
              <tr>
                  <td>NIM</td>
                  <td>:</td>
                  <td>${l.student_nim}</td>
              </tr>
              <tr>
                  <td style="vertical-align: top;">Judul Penelitian</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="text-align: justify; padding-right: 20px;">"${l.proposal_title}"</td>
              </tr>
              <tr>
                  <td style="vertical-align: top;">Tempat Tujuan</td>
                  <td style="vertical-align: top;">:</td>
                  <td>${l.exam_location}</td>
              </tr>
          </table>
          
          <p>Demikian permohonan ini kami sampaikan. Atas bantuan dan kerjasama Bapak/Ibu, kami ucapkan terima kasih.</p>
          
          <div style="margin-top:40px; float:right; width:300px; text-align:center">
              <p>${l.signatory_position || "Ketua Program Studi"},</p>
              <div style="height:80px; display:flex; align-items:center; justify-content:center;">
                  ${forPrint ? `<img src="${ttdUrl}" style="height:80px">` : '<div style="color:#ccc; font-style:italic">[Tanda Tangan Digital]</div>'}
              </div>
              <p><b>${l.signatory_name || "................"}</b><br>NIP. ${l.signatory_nip || "................"}</p>
          </div>
          <div style="clear:both"></div>
      </div>
    `;
  }

  return `
    <div style="font-family:'Times New Roman', serif; line-height: 1.6; color: black; padding: 20px;">
        <div style="text-align:center;margin-bottom:20px">
            <img src="${kopUrl}" onerror="this.style.display='none'" style="width:100%;max-width:700px">
        </div>
        
        <table style="width:100%; margin-bottom: 20px;">
            <tr>
                <td style="width:80px">Nomor</td>
                <td style="width:10px">:</td>
                <td>${l.letter_number || "......."}</td>
                <td style="text-align:right">${letterDateStr}</td>
            </tr>
            <tr>
                <td>Perihal</td>
                <td>:</td>
                <td colspan="2">${l.letter_type}</td>
            </tr>
        </table>

        <p>Yth. <br>1. ${l.examiner_name} (Penguji I)<br>2. ${l.supervisor_name} (Penguji II)</p>
        
        <p>Dengan hormat,<br>Bersama ini kami mengundang Bapak/Ibu untuk menguji mahasiswa:</p>
        
        <table style="margin-left:30px; margin-bottom: 15px; width: calc(100% - 30px); border-collapse: collapse;">
            <tr>
                <td style="width:100px; vertical-align: top;">Nama</td>
                <td style="width:15px; vertical-align: top;">:</td>
                <td style="vertical-align: top;">${l.student_name}</td>
            </tr>
            <tr>
                <td style="vertical-align: top;">NIM</td>
                <td style="vertical-align: top;">:</td>
                <td style="vertical-align: top;">${l.student_nim}</td>
            </tr>
            <tr>
                <td style="vertical-align: top;">Judul</td>
                <td style="vertical-align: top;">:</td>
                <td style="vertical-align: top; text-align: justify; padding-right: 20px;">${l.proposal_title}</td>
            </tr>
        </table>
        
        <p>Pada:</p>
        <table style="margin-left:30px; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
                <td style="width:100px;">Hari/Tgl</td>
                <td style="width:15px;">:</td>
                <td>${examDayName}, ${examDateStr}</td>
            </tr>
            <tr>
                <td>Jam</td>
                <td>:</td>
                <td>${fixTime(l.exam_time)} s/d ${fixTime(l.exam_time_end) || "Selesai"} WITA</td>
            </tr>
            <tr>
                <td>Tempat</td>
                <td>:</td>
                <td>${l.exam_location}</td>
            </tr>
        </table>
        
        <p>Demikian penyampaian kami. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.</p>
        
        <div style="margin-top:20px; float:right; width:300px; text-align:center">
            <p>${l.signatory_position || "Ketua Program Studi"},</p>
            <div style="height:80px; display:flex; align-items:center; justify-content:center;">
                ${forPrint ? `<img src="${ttdUrl}" style="height:80px">` : '<div style="color:#ccc; font-style:italic">[Tanda Tangan Digital]</div>'}
            </div>
            <p><b>${l.signatory_name || "................"}</b><br>NIP. ${l.signatory_nip || "................"}</p>
        </div>
        <div style="clear:both"></div>
    </div>
  `;
}

async function previewLetter(id) {
  let letters = await api("getLetters", {
    role: state.user.role === "mahasiswa" ? "mahasiswa" : "admin",
    userId: state.user.id,
  });
  const l = letters.find((lt) => lt.id == id);
  if (!l) return;
  showModal(
    "Preview",
    `<div style="border:1px solid #ccc;padding:10px;height:60vh;overflow:auto;background:white">${buildLetterHTML(l)}</div>`,
  );
}

async function printLetter(id) {
  let letters = await api("getLetters", {
    role: state.user.role === "mahasiswa" ? "mahasiswa" : "admin",
    userId: state.user.id,
  });
  const l = letters.find((lt) => lt.id == id);
  const win = window.open("", "_blank");
  win.document.write(
    `<html><body onload="window.print()">${buildLetterHTML(l, true)}</body></html>`,
  );
  win.document.close();
}

// --- HELPERS ---
function showLoading(show) {
  document.getElementById("loading-overlay").style.display = show
    ? "flex"
    : "none";
}
function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerText = msg;
  document.getElementById("toast-container").appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
function showModal(title, content) {
  document.getElementById("modal-title").innerText = title;
  document.getElementById("modal-content").innerHTML = content;
  document.getElementById("modal-container").classList.add("active");
}
function closeModal() {
  document.getElementById("modal-container").classList.remove("active");
}
function downloadFile(content, fileName, mimeType) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  a.href = url;
  a.download = fileName;
  a.click();
}

// --- INITIALIZATION ---
document.getElementById("login-form").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const res = await api("login", {
      username: document.getElementById("username").value,
      password: document.getElementById("password").value,
    });
    state.user = res.user;
    localStorage.setItem("user", JSON.stringify(state.user)); // Persist user
    state.cache = {}; // Clear cache to force fresh data

    document.getElementById("user-display-name").innerText = state.user.name;
    document.getElementById("user-display-role").innerText = state.user.role;
    switchScreen("dashboard-screen");
    navigateTo("dashboard");
  } catch (err) {
    document.getElementById("login-error").innerText = err.message;
  }
};

document.getElementById("close-modal").onclick = closeModal;

document.getElementById("btn-logout").onclick = () => {
  state.user = null;
  localStorage.removeItem("user");
  localStorage.removeItem("currentView");
  state.cache = {};
  switchScreen("login-screen");
  document.getElementById("login-form").reset();
};

// Mobile Menu Toggle
const toggleMenu = () => {
  document.getElementById("sidebar").classList.toggle("active");
  document.getElementById("sidebar-overlay").classList.toggle("active");
};

document.getElementById("menu-toggle").onclick = toggleMenu;
document.getElementById("sidebar-overlay").onclick = toggleMenu;

// Close sidebar on nav click (mobile)
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 992) {
    if (e.target.closest(".nav-item")) {
      document.getElementById("sidebar").classList.remove("active");
      document.getElementById("sidebar-overlay").classList.remove("active");
    }
  }
});

// --- INITIALIZATION ---
window.onload = async () => {
  const savedUser = localStorage.getItem("user");
  const savedView = localStorage.getItem("currentView");

  if (savedUser) {
    try {
      state.user = JSON.parse(savedUser);
      state.cache = {}; // Force fresh data on load

      document.getElementById("user-display-name").innerText = state.user.name;
      document.getElementById("user-display-role").innerText = state.user.role;

      switchScreen("dashboard-screen");
      navigateTo(savedView || "dashboard");
    } catch (e) {
      console.error("Failed to restore session", e);
      localStorage.removeItem("user");
      switchScreen("login-screen");
    }
  } else {
    switchScreen("login-screen");
  }
};
