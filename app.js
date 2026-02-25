/**
 * E-Surat Frontend Logic
 * Full Version - Fixed & Complete
 */

// --- CONFIGURATION ---
const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwlng64hc59P_31NZ68HUvwHoQkgimlUzeCHGZu1WOxJfoeETXr01G2QPiZtbNFmxRM8w/exec";

// --- STATE MANAGEMENT ---
const state = {
  user: null, // {id, username, role, name, nip_nim}
  letters: [],
  staff: { examiners: [], supervisors: [] },
  locations: [],
  currentView: "dashboard",
  loading: false,
  cache: {},
  chartInstance: null,
};

// Cache TTL (Time To Live) in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// --- PAGINATION SYSTEM ---
const ITEMS_PER_PAGE = 15;
const paginationState = {};

function paginateData(data, viewId) {
  if (!paginationState[viewId]) paginationState[viewId] = { page: 1 };
  const p = paginationState[viewId];
  const total = data.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  if (p.page > totalPages) p.page = totalPages;
  const start = (p.page - 1) * ITEMS_PER_PAGE;
  return {
    items: data.slice(start, start + ITEMS_PER_PAGE),
    page: p.page, totalPages, total,
    start: start + 1, end: Math.min(start + ITEMS_PER_PAGE, total)
  };
}

function renderPagination(containerId, viewId, total, pg, reloadFn) {
  const el = document.getElementById(containerId);
  if (!el || total <= ITEMS_PER_PAGE) { if (el) el.innerHTML = ''; return; }
  const pages = [];
  for (let i = 1; i <= pg.totalPages; i++) {
    if (i === 1 || i === pg.totalPages || (i >= pg.page - 1 && i <= pg.page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }
  el.innerHTML = `
    <div class="pagination">
      <span class="pagination-info">Menampilkan ${pg.start}-${pg.end} dari ${total} data</span>
      <div class="pagination-controls">
        <button class="page-btn" ${pg.page <= 1 ? 'disabled' : ''} onclick="paginationState['${viewId}'].page--;${reloadFn}"><i class="fas fa-chevron-left"></i></button>
        ${pages.map(p => p === '...' ? '<span style="color:var(--text-muted);padding:0 4px">...</span>' : `<button class="page-btn ${p === pg.page ? 'active' : ''}" onclick="paginationState['${viewId}'].page=${p};${reloadFn}">${p}</button>`).join('')}
        <button class="page-btn" ${pg.page >= pg.totalPages ? 'disabled' : ''} onclick="paginationState['${viewId}'].page++;${reloadFn}"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
  `;
}

// --- CORE FUNCTIONS ---

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    console.log("Service Worker registered:", reg.scope);
  }).catch((err) => {
    console.warn("SW registration failed:", err);
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

    const response = await fetch(url, { method: "POST", body: formData, redirect: "follow" });
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
      label: "Arsip Surat",
      icon: "fas fa-archive",
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
  } else if (state.user.role === "staff") {
    items.push({
      id: "staff-archive",
      label: "Arsip Surat Saya",
      icon: "fas fa-archive",
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
  // Persist current view to localStorage
  try { localStorage.setItem('esurat_view', view); } catch(e) {}
  renderSidebar();
  const titleMap = {
    dashboard: "Dashboard Overview",
    "manage-users": "Manajemen Pengguna",
    "manage-staff": "Data Penguji & Pembimbing",
    "manage-locations": "Kelola Tempat Ujian",
    "validate-letters": "Antrean Validasi Surat",
    archive: "Arsip Surat (Selesai)",
    "my-letters": "Permohonan Surat Saya",
    "staff-archive": "Arsip Surat Saya",
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
    case "my-letters":
      renderStudentLetters(container);
      break;
    case "admin-report":
      renderAdminReport(container);
      break; // FIXED
    case "staff-archive":
      renderStaffArchive(container);
      break;
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
    const stats = await api("getDashboardStats");
    statsHtml = `
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
  } else if (state.user.role === "mahasiswa") {
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
    const recent = letters.slice(0, 5);

    const statusDotClass = (s) => s === 'Approved' ? 'approved' : s === 'Returned' ? 'returned' : s === 'Pending' ? 'pending' : 'draft';

    const timelineHtml = recent.length ? recent.map(l => `
      <div class="timeline-item">
        <div class="timeline-dot ${statusDotClass(l.status)}"></div>
        <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:var(--text-main)">${l.letter_type}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;max-width:350px;line-height:1.4">${l.proposal_title || '-'}</div>
          </div>
          <div style="text-align:right">
            ${getStatusBadge(l.status)}
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px"><i class="far fa-calendar-alt"></i> ${new Date(l.submission_date).toLocaleDateString('id-ID')}</div>
          </div>
        </div>
        ${l.status === 'Returned' && l.rejection_notes ? `<div style="margin-top:10px;padding:8px 12px;background:#fff1f2;border-left:3px solid #ef4444;border-radius:6px;font-size:0.8rem;color:#b91c1c"><i class="fas fa-exclamation-circle"></i> <b>Revisi:</b> ${l.rejection_notes}</div>` : ''}
      </div>
    `).join('') : '<p style="color:var(--text-muted);text-align:center;padding:20px">Belum ada surat yang diajukan.</p>';

    statsHtml = `
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
          <div class="stat-info"><span class="label">Draft</span><span class="value">${draft}</span></div>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
        <div class="card">
          <div class="card-header"><h3><i class="fas fa-stream"></i> Riwayat Surat Terbaru</h3></div>
          <div style="padding:20px">
            <div class="timeline">${timelineHtml}</div>
          </div>
        </div>
        <div>
          <div class="card">
            <div class="card-header"><h3><i class="fas fa-info-circle"></i> Informasi</h3></div>
            <div style="padding:20px">
              <p>Selamat datang di layanan <b>E-Surat</b>. Pastikan data yang Anda inputkan benar sesuai dengan draf pendaftaran ujian Anda.</p>
              <div style="margin-top:12px;padding:10px;background:#fff8eb;border-left:4px solid #f59e0b;border-radius:6px">
                <small><b>Tips:</b> Jika surat Anda berstatus "Returned", silakan klik tombol edit di menu "Surat Saya" untuk melihat catatan revisi dari admin.</small>
              </div>
            </div>
          </div>
          <div class="quick-actions">
            <div class="quick-action-btn" onclick="navigateTo('my-letters');setTimeout(()=>openLetterForm(),300)">
              <i class="fas fa-plus-circle"></i> Buat Surat Baru
            </div>
            <div class="quick-action-btn" onclick="navigateTo('my-letters')">
              <i class="fas fa-list-alt"></i> Lihat Semua Surat
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (state.user.role === "staff") {
    // Staff (Penguji/Pembimbing) Dashboard
    let letters = await api("getLetters", { role: "staff", userId: state.user.id });
    if (!Array.isArray(letters)) letters = [];
    const total = letters.length;
    const asExaminer = letters.filter((l) => l.examiner_name === state.user.name).length;
    const asSupervisor = letters.filter((l) => l.supervisor_name === state.user.name).length;

    statsHtml = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-file-alt"></i></div>
          <div class="stat-info"><span class="label">Total Surat</span><span class="value">${total}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-user-tie"></i></div>
          <div class="stat-info"><span class="label">Sebagai Penguji</span><span class="value">${asExaminer}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="fas fa-chalkboard-teacher"></i></div>
          <div class="stat-info"><span class="label">Sebagai Pembimbing</span><span class="value">${asSupervisor}</span></div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="card-header"><h3><i class="fas fa-info-circle"></i> Informasi</h3></div>
        <div style="padding:20px">
          <p>Selamat datang, <b>${state.user.name}</b>. Anda dapat melihat dan mengunduh surat-surat undangan ujian yang ditujukan kepada Anda.</p>
        </div>
      </div>

      <div class="quick-actions" style="margin-top:16px">
        <div class="quick-action-btn" onclick="navigateTo('staff-archive')">
          <i class="fas fa-archive"></i> Lihat Arsip Surat Saya
        </div>
      </div>
    `;
  }
  container.innerHTML = statsHtml;
}

function renderDashboardCharts(stats) {
  if (typeof Chart === 'undefined') {
    const el = document.getElementById("statusChart");
    if (el) el.parentElement.innerHTML = '<p style="color:var(--danger)">Gagal memuat Chart.js (koneksi terputus)</p>';
    return;
  }
  const ctx = document.getElementById("statusChart")?.getContext("2d");
  if (!ctx) return;

  // Destroy previous chart instance to prevent memory leak
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }

  state.chartInstance = new Chart(ctx, {
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
                    <button class="btn btn-info" onclick="downloadUserTemplate()">
                        <i class="fas fa-file-csv"></i> Unduh Template
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
            <div id="user-pagination"></div>
        </div>
    `;
  // Enter key trigger search
  document.getElementById("u-search")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadUsers();
  });
  loadUsers();
}

async function loadUsers() {
  try {
    let users = await api("getUsers");
    if (!Array.isArray(users)) users = [];

    // Apply search filter
    const searchQuery =
      document.getElementById("u-search")?.value.toLowerCase() || "";
    if (searchQuery) {
      users = users.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(searchQuery) ||
          (u.username || "").toLowerCase().includes(searchQuery) ||
          (u.nip_nim || "").toLowerCase().includes(searchQuery),
      );
    }

    const pg = paginateData(users, 'users');
    const tbody = document.getElementById("user-table-body");
    tbody.innerHTML =
      pg.items
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
    renderPagination('user-pagination', 'users', users.length, pg, 'loadUsers()');
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

function downloadUserTemplate() {
  const headers = "name,username,password,role,nip_nim";
  const exampleRow = "Budi Santoso,budi123,password123,mahasiswa,123456789";
  const csvContent = headers + "\n" + exampleRow;
  downloadFile(csvContent, "template_import_user.csv", "text/csv");
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

// --- STAFF MANAGEMENT (MERGED) ---
function renderStaffManagement(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-user-tie"></i> Data Penguji & Pembimbing</h3>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="btn btn-primary" onclick="openStaffForm()"><i class="fas fa-plus"></i> Tambah</button>
                    <button class="btn btn-info" onclick="downloadStaffTemplate()"><i class="fas fa-file-csv"></i> Unduh Template</button>
                    <button class="btn btn-success" onclick="triggerStaffImport()"><i class="fas fa-file-import"></i> Impor</button>
                    <input type="file" id="csv-staff-import" style="display:none" accept=".csv" onchange="handleStaffImport(this)">
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Nama Lengkap & Gelar</th>
                            <th>NIP</th>
                            <th>Jabatan</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="staff-table-body"><tr><td colspan="4" style="text-align:center; padding:40px;">Memuat data...</td></tr></tbody>
                </table>
            </div>
            <div id="staff-pagination"></div>
        </div>
    `;
  loadStaff();
}

async function loadStaff() {
  try {
    let staffList = await api("getStaff");
    if (!Array.isArray(staffList)) staffList = [];
    const tbody = document.getElementById("staff-table-body");
    if (!tbody) return;
    const pg = paginateData(staffList, 'staff');
    tbody.innerHTML =
      pg.items
        .map(
          (s) => `
            <tr>
                <td style="font-weight:700; color:var(--text-main)">${s.name}</td>
                <td style="color:var(--text-muted); font-family:monospace; font-weight:600">${s.nip || "-"}</td>
                <td><span class="badge ${s.jabatan === 'Penguji' ? 'badge-approved' : 'badge-pending'}">${s.jabatan || "-"}</span></td>
                <td class="td-actions">
                    <div style="display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn btn-icon" title="Edit" onclick="editStaff('${s.id}')"><i class="fas fa-edit" style="color:var(--primary)"></i></button>
                        <button class="btn btn-icon danger" title="Hapus" onclick="deleteStaff('${s.id}')"><i class="fas fa-trash-alt" style="color:var(--danger)"></i></button>
                    </div>
                </td>
            </tr>
        `,
        )
        .join("") ||
      '<tr><td colspan="4" style="text-align:center; padding: 30px; color:var(--text-muted)">Belum ada data.</td></tr>';
    renderPagination('staff-pagination', 'staff', staffList.length, pg, 'loadStaff()');
  } catch (e) {
    showToast("Gagal memuat data staff", "error");
  }
}

function openStaffForm(editId = null) {
  let existing = null;
  if (editId) {
    // Find from cache
    Object.keys(state.cache).forEach((key) => {
      if (key.startsWith("getStaff") && state.cache[key].data) {
        const found = (Array.isArray(state.cache[key].data) ? state.cache[key].data : []).find((s) => s.id == editId);
        if (found) existing = found;
      }
    });
  }
  showModal(
    existing ? "Edit Staff" : "Tambah Penguji / Pembimbing",
    `
        <form id="staff-form">
            <div class="form-group"><label>Nama Lengkap & Gelar</label><input id="s_name" class="form-input" value="${existing?.name || ''}" required></div>
            <div class="form-group"><label>NIP</label><input id="s_nip" class="form-input" value="${existing?.nip || ''}" required></div>
            <div class="form-group"><label>Jabatan</label>
              <select id="s_jabatan" class="form-input" required>
                <option value="">-- Pilih Jabatan --</option>
                <option value="Penguji" ${existing?.jabatan === 'Penguji' ? 'selected' : ''}>Penguji</option>
                <option value="Pembimbing" ${existing?.jabatan === 'Pembimbing' ? 'selected' : ''}>Pembimbing</option>
              </select>
            </div>
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
      data: {
        id: editId || undefined,
        name: document.getElementById("s_name").value,
        nip: document.getElementById("s_nip").value,
        jabatan: document.getElementById("s_jabatan").value,
      },
    });
    showToast("Berhasil");
    closeModal();
    loadStaff();
  };
}

function editStaff(id) {
  openStaffForm(id);
}

async function deleteStaff(id) {
  if (confirm("Hapus staff ini?")) {
    await api("deleteStaff", { id });
    showToast("Staff dihapus");
    loadStaff();
  }
}

function triggerStaffImport() {
  document.getElementById("csv-staff-import").click();
}

function downloadStaffTemplate() {
  const headers = "name,nip,jabatan";
  const exampleRow = "Dr. Andi Santoso M.T,198001012005011001,Penguji\nProf. Budi Darmawan,197502022000031002,Pembimbing";
  const csvContent = headers + "\n" + exampleRow;
  downloadFile(csvContent, "template_import_staff.csv", "text/csv");
}

async function handleStaffImport(input) {
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
          .split(/[;,]/)
          .map((v) => v.trim().replace(/^"|"$/g, ""));
        let obj = {
          name: values[0] || "",
          nip: values[1] || "",
          jabatan: values[2] || ""
        };
        // Validasi jabatan
        if (obj.jabatan !== "Penguji" && obj.jabatan !== "Pembimbing") {
           obj.jabatan = "Penguji"; // fallback default
        }
        return obj;
      });
    await api("bulkUpsertStaff", { dataArray });
    // Force a small delay to ensure Google Sheets API finishes writing before reloading
    setTimeout(() => {
        showToast(`${dataArray.length} data staff diimport`);
        loadStaff();
    }, 1000);
    input.value = "";
  };
  reader.readAsText(file);
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
            <div id="student-pagination"></div>
        </div>
    `;
  loadStudentData();
}

async function loadStudentData() {
  try {
    let letters = await api("getLetters", {
      role: "mahasiswa",
      userId: state.user.id,
    });
    if (!Array.isArray(letters)) letters = [];
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

    const pg = paginateData(letters, 'student-letters');

    tbody.innerHTML =
      pg.items
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
    renderPagination('student-pagination', 'student-letters', letters.length, pg, 'loadStudentData()');
  } catch (e) {
    showToast("Gagal memuat data surat", "error");
  }
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

  const staffList = Array.isArray(staff) ? staff : [];
  
  const staffOptions1 = staffList.map(
    (s) => `<option value="${s.name}" ${existing && existing.examiner_name === s.name ? "selected" : ""}>${s.name} (${s.jabatan})</option>`
  ).join("");

  const staffOptions2 = staffList.map(
    (s) => `<option value="${s.name}" ${existing && existing.supervisor_name === s.name ? "selected" : ""}>${s.name} (${s.jabatan})</option>`
  ).join("");
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
                <select id="examiner_1" class="form-input" style="width:100%">
                    <option value="">-- Pilih Penguji 1 --</option>
                    ${staffOptions1}
                </select>
            </div>
            <div class="form-group">
                <label><i class="fas fa-user-tie"></i> Penguji 2</label>
                <select id="examiner_2" class="form-input" style="width:100%">
                    <option value="">-- Pilih Penguji 2 --</option>
                    ${staffOptions2}
                </select>
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
    const examiner1 = document.getElementById("examiner_1").value;
    const examiner2 = document.getElementById("examiner_2").value;
    
    if (!examiner1 || !examiner2) {
        showToast("Pilih Penguji 1 dan Penguji 2!", "error");
        return;
    }
    
    if (examiner1 === examiner2) {
        showToast("Penguji 1 dan Penguji 2 tidak boleh sama!", "error");
        return;
    }

    const data = {
      id: id || null,
      letter_type: document.getElementById("letter_type").value,
      proposal_title: document.getElementById("proposal_title").value,
      exam_date: document.getElementById("exam_date").value,
      exam_time: document.getElementById("exam_time").value,
      exam_time_end: document.getElementById("exam_time_end").value,
      exam_location: document.getElementById("exam_location").value,
      examiner_name: examiner1,
      supervisor_name: examiner2,
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
    try {
      await api("updateLetterStatus", {
        id,
        status: "Pending",
        updateData: {},
      });
      showToast("Surat diajukan");
      loadStudentData();
    } catch (e) {
      showToast("Gagal mengajukan surat", "error");
    }
  }
}
async function batalkanSurat(id) {
  if (confirm("Hapus draft ini?")) {
    try {
      await api("deleteLetter", { id });
      showToast("Dihapus");
      loadStudentData();
    } catch (e) {
      showToast("Gagal menghapus draft", "error");
    }
  }
}

// --- VALIDATION & ADMIN REPORTS ---

// --- VALIDATION QUEUE (PENDING ONLY) ---
function renderValidationQueue(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-clipboard-check"></i> Antrean Validasi</h3>
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
            <div id="validation-pagination"></div>
        </div>
    `;

  // Enter key trigger search
  document.getElementById("v-search")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadValidationQueue();
  });

  loadValidationQueue();
}

async function loadValidationQueue() {
  const searchQuery =
    document.getElementById("v-search")?.value.toLowerCase() || "";
  let letters = await api("getLetters", { role: "admin" });

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

  const pg = paginateData(filtered, 'validation');

  tbody.innerHTML =
    pg.items
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
                    <span style="display:flex; align-items:center; gap:8px; font-size:0.85rem;"><i class="fas fa-user-tie" style="color:var(--primary); width:14px"></i> 1. ${l.examiner_name}</span>
                    <span style="display:flex; align-items:center; gap:8px; font-size:0.85rem;"><i class="fas fa-user-graduate" style="color:var(--secondary); width:14px"></i> 2. ${l.supervisor_name}</span>
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
                        <i class="fas fa-check"></i> Setujui
                    </button>
                    <button class="btn btn-sm btn-danger" title="Kembalikan untuk Revisi" onclick="returnLetter('${l.id}')">
                        <i class="fas fa-undo"></i> Return
                    </button>
                </div>
            </td>
        </tr>
    `,
      )
      .join("") ||
    '<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted)">Tidak ada antrean validasi.</td></tr>';
  renderPagination('validation-pagination', 'validation', filtered.length, pg, 'loadValidationQueue()');
}

// --- ARCHIVE (APPROVED ONLY) ---
function renderArchive(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-archive"></i> Arsip Surat Selesai</h3>
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
            <div id="archive-pagination"></div>
        </div>
    `;

  document.getElementById("a-search")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadArchive();
  });

  loadArchive();
}

async function loadArchive() {
  const searchQuery =
    document.getElementById("a-search")?.value.toLowerCase() || "";
  let letters = await api("getLetters", { role: "admin" });

  // Filter only APPROVED and match search
  const filtered = (letters || []).filter((l) => {
    const isApproved = l.status === "Approved";
    const matchesSearch =
      (l.letter_number || "").toLowerCase().includes(searchQuery) ||
      l.student_name.toLowerCase().includes(searchQuery) ||
      l.student_nim.toLowerCase().includes(searchQuery) ||
      (l.proposal_title || "").toLowerCase().includes(searchQuery);
    return isApproved && matchesSearch;
  });

  const tbody = document.getElementById("archive-table-body");
  if (!tbody) return;

  const pg = paginateData(filtered, 'archive');

  tbody.innerHTML =
    pg.items
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
  renderPagination('archive-pagination', 'archive', filtered.length, pg, 'loadArchive()');
}

// --- STAFF ARCHIVE (PENGUJI/PEMBIMBING VIEW) ---
function renderStaffArchive(container) {
  container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-archive"></i> Surat yang Ditujukan ke Saya</h3>
                <div class="search-container">
                    <i class="fas fa-search"></i>
                    <input type="text" id="sa-search" placeholder="Cari nama mahasiswa atau judul..." autocomplete="off">
                    <button class="btn-search" onclick="loadStaffArchive()">Cari</button>
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>No Surat</th>
                            <th>Mahasiswa</th>
                            <th>Judul</th>
                            <th>Peran Saya</th>
                            <th>Waktu Ujian</th>
                            <th class="td-actions">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="staff-archive-body"><tr><td colspan="6" style="text-align:center; padding:40px;">Memuat arsip surat...</td></tr></tbody>
                </table>
            </div>
            <div id="staff-archive-pagination"></div>
        </div>
    `;
  document.getElementById("sa-search")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadStaffArchive();
  });
  loadStaffArchive();
}

async function loadStaffArchive() {
  try {
    const searchQuery = document.getElementById("sa-search")?.value.toLowerCase() || "";
    let letters = await api("getLetters", { role: "staff", userId: state.user.id });
    if (!Array.isArray(letters)) letters = [];

    const filtered = letters.filter((l) => {
      if (!searchQuery) return true;
      return (
        (l.student_name || "").toLowerCase().includes(searchQuery) ||
        (l.student_nim || "").toLowerCase().includes(searchQuery) ||
        (l.proposal_title || "").toLowerCase().includes(searchQuery) ||
        (l.letter_number || "").toLowerCase().includes(searchQuery)
      );
    });

    const tbody = document.getElementById("staff-archive-body");
    if (!tbody) return;

    const pg = paginateData(filtered, 'staff-archive');
    const myName = state.user.name;

    tbody.innerHTML =
      pg.items
        .map(
          (l) => {
            const role = l.examiner_name === myName ? "Penguji" : "Pembimbing";
            return `
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
            <td><span class="badge ${role === 'Penguji' ? 'badge-approved' : 'badge-pending'}">${role}</span></td>
            <td>
                <div style="font-size:0.85rem; font-weight:600"><i class="far fa-calendar-alt" style="color:var(--primary)"></i> ${formatDateID(l.exam_date)}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)"><i class="far fa-clock"></i> ${formatTimeID(l.exam_time)}</div>
            </td>
            <td class="td-actions">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-icon" title="Preview" onclick="previewLetter('${l.id}')"><i class="fas fa-eye" style="color:var(--primary)"></i></button>
                    <button class="btn btn-icon" title="Cetak" onclick="printLetter('${l.id}')"><i class="fas fa-print" style="color:var(--secondary)"></i></button>
                    <button class="btn btn-icon" title="PDF" onclick="downloadPDF('${l.id}')"><i class="fas fa-file-pdf" style="color:var(--danger)"></i></button>
                </div>
            </td>
        </tr>`;
          },
        )
        .join("") ||
      '<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted)">Belum ada surat yang ditujukan ke Anda.</td></tr>';
    renderPagination('staff-archive-pagination', 'staff-archive', filtered.length, pg, 'loadStaffArchive()');
  } catch (e) {
    showToast("Gagal memuat arsip surat", "error");
  }
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
            <div style="display:flex"><span style="padding:10px;background:#eee">KP.03.04/F.XXIX.19.4/</span><input id="a_num" class="form-input" required></div>
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
        "KP.03.04/F.XXIX.19.4/" + document.getElementById("a_num").value,
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
  const d = new Date(l.exam_date || Date.now());
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
  const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  const dayName = days[d.getDay()];

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

  return `
    <style>
      .letter-pdf-table td { border: none !important; padding: 2px 0 !important; background: transparent !important; }
    </style>
    <div style="font-family:'Times New Roman', serif; line-height: 1.6; color: black; padding: 0 20px;">
        <div style="text-align:center;margin-bottom:15px">
            <img src="${kopUrl}" onerror="this.style.display='none'" style="width:100%;max-width:700px">
        </div>
        
        <table class="letter-pdf-table" style="width:100%; margin-bottom: 15px;">
            <tr>
                <td style="width:80px">Nomor</td>
                <td style="width:10px">:</td>
                <td>${l.letter_number || "......."}</td>
                <td style="text-align:right">${dateStr}</td>
            </tr>
            <tr>
                <td>Perihal</td>
                <td>:</td>
                <td colspan="2">${l.letter_type}</td>
            </tr>
        </table>

        <div style="margin-bottom: 16px;">
            Yth.<br>
            1. ${l.examiner_name} (Penguji 1)<br>
            2. ${l.supervisor_name} (Penguji 2)
        </div>
        
        <p>Dengan hormat,<br>Sesuai perihal diatas, bersama ini kami mengundang Bapak/Ibu untuk menguji dalam <i>${l.letter_type.replace(/^Surat\s+/i, '')}</i> mahasiswa a.n :</p>
        
        <table class="letter-pdf-table" style="margin-left:30px; margin-bottom: 10px; width: calc(100% - 30px); border-collapse: collapse;">
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
        <table class="letter-pdf-table" style="margin-left:30px; margin-bottom: 15px; border-collapse: collapse;">
            <tr>
                <td style="width:100px;">Hari/Tgl</td>
                <td style="width:15px;">:</td>
                <td>${dayName}, ${dateStr}</td>
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

        <p>Atas perhatian dan kerja sama yang baik disampaikan terima kasih.</p>

        <div style="margin-top:20px; margin-left:auto; width:300px; text-align:center; page-break-inside: avoid;">
            <p>${l.signatory_position || ""}</p>
            ${l.status === "Approved" ? `<img src="${ttdUrl}" style="height:80px; margin: 5px 0;">` : "<br><br><br><br><br><br><br><br><br><br>"}
            <p style="text-decoration:underline; font-weight:bold; margin-bottom: 0;">${l.signatory_name || "................"}</p>
            <p style="margin-top: 0;">NIP. ${l.signatory_nip || "................"}</p>
        </div>
    </div>`;
}

async function previewLetter(id) {
  let letters = await api("getLetters", {
    role: state.user.role === "mahasiswa" ? "mahasiswa" : "admin",
    userId: state.user.id,
  });
  const l = letters.find((lt) => lt.id == id);
  if (!l) return showToast("Surat tidak ditemukan", "error");

  const win = window.open("", "_blank");
  if (!win) {
    // Fallback to modal if popup blocked
    showModal("Preview", `<div style="border:1px solid #ccc;padding:10px;height:60vh;overflow:auto;background:white">${buildLetterHTML(l)}</div>`);
    return;
  }

  const watermark = l.status !== 'Approved' ? `
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
      font-size:120px;font-weight:900;color:rgba(0,0,0,0.04);pointer-events:none;z-index:0;
      text-transform:uppercase;letter-spacing:20px">${l.status}</div>` : '';

  win.document.write(`<!DOCTYPE html>
  <html><head>
    <title>Preview Surat - ${l.student_name}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { background:#e2e8f0; font-family:'Segoe UI',sans-serif; }
      .toolbar {
        position:sticky;top:0;z-index:100;background:#1e293b;color:#fff;
        display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 24px;
        box-shadow:0 2px 10px rgba(0,0,0,0.2);
      }
      .toolbar button {
        display:inline-flex;align-items:center;gap:8px;padding:8px 20px;
        border:none;border-radius:8px;font-weight:700;font-size:0.85rem;
        cursor:pointer;transition:all 0.2s;
      }
      .btn-print { background:#6366f1;color:#fff; }
      .btn-print:hover { background:#4f46e5; }
      .btn-pdf { background:#ef4444;color:#fff; }
      .btn-pdf:hover { background:#dc2626; }
      .btn-close { background:#475569;color:#fff; }
      .btn-close:hover { background:#334155; }
      .page-container {
        width:210mm;min-height:297mm;margin:24px auto;background:#fff;
        box-shadow:0 4px 20px rgba(0,0,0,0.15);position:relative;overflow:hidden;
        padding:15mm 20mm;
      }
      @media print {
        .toolbar { display:none !important; }
        body { background:#fff; }
        .page-container { box-shadow:none;margin:0;width:100%;padding:10mm 15mm; }
      }
    </style>
  </head><body>
    <div class="toolbar">
      <button class="btn-print" onclick="window.print()"><i class="fas fa-print"></i> Cetak</button>
      <button class="btn-pdf" onclick="savePDF()"><i class="fas fa-file-pdf"></i> Download PDF</button>
      <button class="btn-close" onclick="window.close()"><i class="fas fa-times"></i> Tutup</button>
    </div>
    ${watermark}
    <div class="page-container" id="letter-content">
      ${buildLetterHTML(l, true)}
    </div>
    <script>
      function savePDF() {
        const el = document.getElementById('letter-content');
        html2pdf().set({
          margin: [10,10,10,10],
          filename: 'Surat_${l.student_nim}_${l.letter_type.replace(/\\s+/g,'_')}.pdf',
          image: { type:'jpeg', quality:0.98 },
          html2canvas: { scale:2, useCORS:true },
          jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
        }).from(el).save();
      }
    <\/script>
  </body></html>`);
  win.document.close();
}

async function downloadPDF(id) {
  let letters = await api("getLetters", {
    role: state.user.role === "mahasiswa" ? "mahasiswa" : "admin",
    userId: state.user.id,
  });
  const l = letters.find((lt) => lt.id == id);
  if (!l) return showToast("Surat tidak ditemukan", "error");

  if (typeof html2pdf === 'undefined') {
    showToast("Memuat library PDF...", "error");
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => downloadPDF(id);
    document.head.appendChild(script);
    return;
  }

  showToast("Membuat PDF...");
  const htmlContent = `
    <div style="width:210mm; background:#fff; padding:15mm 20mm;">
        ${buildLetterHTML(l, true)}
    </div>
  `;

  try {
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: `Surat_${l.student_nim}_${l.letter_type.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(htmlContent).save();
    showToast("PDF berhasil diunduh");
  } catch (e) {
    showToast("Gagal membuat PDF", "error");
  }
}

async function printLetter(id) {
  let letters = await api("getLetters", {
    role: state.user.role === "mahasiswa" ? "mahasiswa" : "admin",
    userId: state.user.id,
  });
  const l = letters.find((lt) => lt.id == id);
  if (!l) return showToast("Surat tidak ditemukan", "error");
  const win = window.open("", "_blank");
  if (!win) return showToast("Popup diblokir browser", "error");
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    // Persist session to localStorage
    try { localStorage.setItem('esurat_session', JSON.stringify(state.user)); } catch(e) {}
    document.getElementById("user-display-name").innerText = state.user.name;
    document.getElementById("user-display-role").innerText = state.user.role;
    // Removed avatar initial setting
    switchScreen("dashboard-screen");
    navigateTo("dashboard");
  } catch (err) {
    document.getElementById("login-error").innerText = err.message;
  }
};

document.getElementById("close-modal").onclick = closeModal;

document.getElementById("btn-logout").onclick = () => {
  state.user = null;
  state.cache = {};
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }
  // Clear persisted session
  try { localStorage.removeItem('esurat_session'); localStorage.removeItem('esurat_view'); } catch(e) {}
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

// --- SESSION RESTORE ---
// Try to restore session from localStorage
(function restoreSession() {
  try {
    const saved = localStorage.getItem('esurat_session');
    if (saved) {
      const user = JSON.parse(saved);
      if (user && user.id && user.role) {
        state.user = user;
        document.getElementById("user-display-name").innerText = state.user.name;
        document.getElementById("user-display-role").innerText = state.user.role;
        switchScreen("dashboard-screen");
        const savedView = localStorage.getItem('esurat_view') || 'dashboard';
        navigateTo(savedView);
        return;
      }
    }
  } catch(e) {
    console.warn('Session restore failed:', e);
  }
  switchScreen("login-screen");
})();
