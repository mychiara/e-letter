/**
 * E-Surat Backend (Google Apps Script)
 * Versi: 1.2 - Fixed Location & Reports
 * Deploy as Web App: "Anyone"
 */
const SPREADSHEET_ID = "1ogUFkMtjEssEC7MQOfqGkznmwWL3PWUJaZKIu62yIbw";
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("⚙️ E-Surat Admin")
    .addItem("🚀 Setup Database Otomatis", "setup")
    .addSeparator()
    .addItem("👤 Kelola User", "openUserManagement")
    .addToUi();
}

/**
 * Handle POST Requests
 */
function doPost(e) {
  let params;
  try {
    // Menangani payload baik dari parameter maupun postData
    const contents =
      e.parameter && e.parameter.payload
        ? e.parameter.payload
        : e.postData
          ? e.postData.contents
          : null;
    if (!contents) throw new Error("Tidak ada data payload.");
    params = JSON.parse(contents);
  } catch (err) {
    return JSON_RESPONSE({
      success: false,
      error: "Gagal memproses JSON: " + err.message,
    });
  }

  const action = params.action;
  try {
    switch (action) {
      case "login":
        return JSON_RESPONSE(login(params.username, params.password));
      case "getUsers":
        return JSON_RESPONSE(getData("Users"));
      case "upsertUser":
        return JSON_RESPONSE(upsertData("Users", params.data));
      case "deleteUser":
        return JSON_RESPONSE(deleteData("Users", params.id));
      case "getLetters":
        return JSON_RESPONSE(getLetters(params.role, params.userId));
      case "submitLetter":
        return JSON_RESPONSE(submitLetter(params.data));
      case "updateLetterStatus":
        return JSON_RESPONSE(
          updateLetterStatus(params.id, params.status, params.updateData),
        );
      case "getDashboardStats":
        return JSON_RESPONSE(getDashboardStats());
      case "getStaff":
        return JSON_RESPONSE(getData("Staff"));
      case "upsertStaff":
        return JSON_RESPONSE(upsertData("Staff", params.data));
      case "bulkUpsertStaff":
        return JSON_RESPONSE(bulkUpsertData("Staff", params.dataArray));
      case "deleteStaff":
        return JSON_RESPONSE(deleteData("Staff", params.id));
      case "getLocations":
        return JSON_RESPONSE(getData("Locations"));
      case "upsertLocation":
        return JSON_RESPONSE(upsertData("Locations", params.data));
      case "deleteLocation":
        return JSON_RESPONSE(deleteData("Locations", params.id));
      case "getSettings":
        return JSON_RESPONSE(getSettings());
      case "saveSettings":
        return JSON_RESPONSE(saveSettings(params.data));
      case "deleteLetter":
        return JSON_RESPONSE(deleteData("Letters", params.id));
      case "bulkUpsertUsers":
        return JSON_RESPONSE(bulkUpsertData("Users", params.dataArray));
      case "bulkUpsert":
        return JSON_RESPONSE(
          bulkUpsertData(params.sheetName, params.dataArray),
        );
      default:
        throw new Error("Action '" + action + "' tidak terdaftar di server.");
    }
  } catch (err) {
    return JSON_RESPONSE({ success: false, error: err.message });
  }
}

function doGet(e) {
  return HtmlService.createHtmlOutput(
    "<h1>E-Surat API is Running</h1><p>Gunakan POST request untuk mengakses data.</p>",
  ).setTitle("E-Surat API Status");
}

function JSON_RESPONSE(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// --- CORE LOGIC ---

/**
 * Login function
 */
function login(username, password) {
  const users = getData("Users");
  const user = users.find(
    (u) => u.username === username && u.password === password,
  );
  if (user) {
    const { password: pw, ...safeUser } = user;
    return { success: true, user: safeUser };
  }
  return { success: false, error: "Username atau Password salah." };
}

/**
 * Get Data from Sheet
 */
function getData(sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data.shift();
  return data.map((row) => {
    let obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

/**
 * Helpers
 */
function getTrueLastRow(sheet) {
  const data = sheet.getRange("A:A").getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0] && data[i][0].toString().trim() !== "") return i + 1;
  }
  return 1;
}

/**
 * Insert or Update Data
 */
function upsertData(sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' tidak ditemukan.");
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  let rowIndex = -1;
  if (data.id) {
    // Pastikan perbandingan string agar tidak ada masalah tipe data
    rowIndex = rows.findIndex((r) => r[0].toString() === data.id.toString());
  } else {
    data.id = new Date().getTime().toString();
  }

  const values = headers.map((h) => data[h] || "");

  if (rowIndex > -1) {
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([values]);
  } else {
    const lastRow = getTrueLastRow(sheet);
    sheet.getRange(lastRow + 1, 1, 1, headers.length).setValues([values]);
  }
  return { success: true, id: data.id };
}

/**
 * Delete Data
 */
function deleteData(sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: "Sheet tidak ada." };
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((r) => r[0].toString() === id.toString());
  if (rowIndex > -1) {
    sheet.deleteRow(rowIndex + 1);
    return { success: true };
  }
  return { success: false, error: "Data tidak ditemukan." };
}

/**
 * Custom logic for Letters
 */
function getLetters(role, userId) {
  let letters = getData("Letters");
  if (role === "mahasiswa") {
    letters = letters.filter((l) => l.student_id == userId);
  } else if (role === "staff") {
    // Staff only sees approved letters where they are examiner or supervisor
    const users = getData("Users");
    const staffUser = users.find((u) => u.id.toString() === userId.toString());
    if (staffUser) {
      letters = letters.filter(
        (l) =>
          l.status === "Approved" &&
          ((l.examiner_name || "").includes(staffUser.name) ||
            (l.supervisor_name || "").includes(staffUser.name)),
      );
    } else {
      letters = [];
    }
  }
  return letters.reverse(); // Terbaru di atas
}

function submitLetter(data) {
  if (!data.id) {
    data.id = new Date().getTime().toString();
    data.status = "Draft";
    data.submission_date = new Date().toISOString();
  }
  return upsertData("Letters", data);
}

function updateLetterStatus(id, status, updateData) {
  const letters = getData("Letters");
  const letter = letters.find((l) => l.id.toString() === id.toString());
  if (!letter) throw new Error("Surat tidak ditemukan.");

  const updatedLetter = { ...letter, ...updateData, status };
  return upsertData("Letters", updatedLetter);
}

function getDashboardStats() {
  const letters = getData("Letters");
  const users = getData("Users");

  return {
    surat_masuk: letters.filter((l) => l.status === "Pending").length,
    draft: letters.filter((l) => l.status === "Draft").length,
    dikembalikan: letters.filter((l) => l.status === "Returned").length,
    sudah_validasi: letters.filter((l) => l.status === "Approved").length,
    total_surat: letters.length,
    total_mhs: users.filter((u) => u.role === "mahasiswa").length,
    total_admin: users.filter(
      (u) => u.role === "admin" || u.role === "super_admin",
    ).length,
  };
}

/**
 * Settings Management
 */
function getSettings() {
  const sheet = ss.getSheetByName("Settings");
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  let settings = {};
  rows.forEach((r) => {
    if (r[0]) settings[r[0]] = r[1];
  });
  return settings;
}

function saveSettings(data) {
  let sheet = ss.getSheetByName("Settings");
  if (!sheet) sheet = ss.insertSheet("Settings");
  sheet.clear();
  sheet.appendRow(["key", "value"]); // Header
  for (let key in data) {
    sheet.appendRow([key, data[key]]);
  }
  return { success: true };
}

/**
 * Setup Initial Sheets
 */
function setup() {
  const sheets = {
    Users: ["id", "username", "password", "role", "name", "nip_nim"],
    Letters: [
      "id",
      "student_id",
      "student_name",
      "student_nim",
      "letter_type",
      "proposal_title",
      "status",
      "submission_date",
      "examiner_name",
      "supervisor_name",
      "exam_date",
      "exam_time",
      "exam_time_end",
      "exam_location",
      "letter_number",
      "signatory_name",
      "signatory_position",
      "signatory_nip",
      "rejection_notes",
    ],
    Staff: ["id", "name", "nip", "jabatan"],
    Locations: ["id", "name"],
    Settings: ["key", "value"],
  };

  for (let name in sheets) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = sheets[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // Admin Awal
  const userSheet = ss.getSheetByName("Users");
  if (userSheet.getLastRow() === 1) {
    upsertData("Users", {
      username: "admin",
      password: "password123",
      role: "super_admin",
      name: "Super Admin",
      nip_nim: "000",
    });
  }

  SpreadsheetApp.getUi().alert("Database Berhasil Disiapkan!");
}

function bulkUpsertData(sheetName, dataArray) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + sheetName);
  if (!Array.isArray(dataArray) || dataArray.length === 0)
    return { success: true };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = [];

  dataArray.forEach((item) => {
    if (!item.id)
      item.id =
        new Date().getTime().toString() +
        Math.random().toString(36).substr(2, 5);
    const row = headers.map((h) => (item[h] !== undefined ? item[h] : ""));
    rows.push(row);
  });

  const lastRow = getTrueLastRow(sheet);
  sheet.getRange(lastRow + 1, 1, rows.length, headers.length).setValues(rows);
  return { success: true, count: rows.length };
}

function bulkUpsertStaff(dataArray) {
  return bulkUpsertData("Staff", dataArray);
}
