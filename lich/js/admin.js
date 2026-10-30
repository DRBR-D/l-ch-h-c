/**
 * admin.js - Quản lý lịch học đơn giản, trực quan
 * Hỗ trợ: Tuần Này, Tuần Sau, Thêm Tuần Mới (+), Sao Chép Tuần
 * Mã PIN mặc định: 132008
 */

// Trạng thái hệ thống
let currentWeekMode = "current"; // 'current', 'next', hoặc id tuần thêm 'extra_...'
let isEditing = false;
let editDay = null;
let editId = null;
let currentFilter = "all";

// Lưu trữ dữ liệu Firebase
let allScheduleData = {
  current: {},
  next: {},
  extra: {}
};

const SHORT_DAYS = {
  "Thứ Hai": "Thứ 2",
  "Thứ Ba": "Thứ 3",
  "Thứ Tư": "Thứ 4",
  "Thứ Năm": "Thứ 5",
  "Thứ Sáu": "Thứ 6",
  "Thứ Bảy": "Thứ 7",
  "Chủ Nhật": "Chủ Nhật"
};

// ==========================================
// 1. CÁC HÀM XÁC ĐỊNH DATABASE & DỮ LIỆU ĐANG CHỌN
// ==========================================
function getActiveDb() {
  if (currentWeekMode === "current") return db;
  if (currentWeekMode === "next") return dbNext;
  return dbExtra.child(currentWeekMode).child("data");
}

function getActiveData() {
  if (currentWeekMode === "current") return allScheduleData.current || {};
  if (currentWeekMode === "next") return allScheduleData.next || {};
  return (allScheduleData.extra[currentWeekMode] && allScheduleData.extra[currentWeekMode].data) || {};
}

function getWeekLabel() {
  if (currentWeekMode === "current") return "Tuần Này";
  if (currentWeekMode === "next") return "Tuần Sau";
  return (allScheduleData.extra[currentWeekMode] && allScheduleData.extra[currentWeekMode].name) || "Tuần Khác";
}

// ==========================================
// 2. CHỌN GIỜ HỌC TIỆN LỢI & ĐỒNG BỘ
// ==========================================
window.setPresetTime = function(start, end) {
  const startEl = document.getElementById("time-start");
  const endEl = document.getElementById("time-end");
  const valEl = document.getElementById("time-val");
  if (startEl) startEl.value = start;
  if (endEl) endEl.value = end;
  if (valEl) valEl.value = `${start} - ${end}`;
};

window.syncTimeFromPickers = function() {
  const startEl = document.getElementById("time-start");
  const endEl = document.getElementById("time-end");
  const valEl = document.getElementById("time-val");
  const s = startEl && startEl.value ? startEl.value : "18:00";
  const e = endEl && endEl.value ? endEl.value : "20:00";
  if (valEl) valEl.value = `${s} - ${e}`;
};

window.syncPickersFromTimeInput = function() {
  const valEl = document.getElementById("time-val");
  if (!valEl) return;
  const parts = valEl.value.split("-").map(s => s.trim());
  if (parts.length >= 2) {
    const startEl = document.getElementById("time-start");
    const endEl = document.getElementById("time-end");
    if (startEl && /^\d{1,2}:\d{2}$/.test(parts[0])) {
      startEl.value = parts[0].padStart(5, "0");
    }
    if (endEl && /^\d{1,2}:\d{2}$/.test(parts[1])) {
      endEl.value = parts[1].padStart(5, "0");
    }
  }
};

// ==========================================
// 3. CHUYỂN TUẦN & RENDER CÁC TAB TUẦN (TUẦN NÀY, TUẦN SAU, TUẦN 3, TUẦN 4...)
// ==========================================
window.switchWeekMode = function(mode) {
  currentWeekMode = mode;
  renderWeekTabs();
  renderWeekTools();

  const listTitle = document.getElementById("list-title");
  if (listTitle) {
    listTitle.textContent = `Danh Sách Môn Học (${getWeekLabel()})`;
  }

  resetForm();
  renderList();
};

function renderWeekTabs() {
  const container = document.getElementById("week-tabs-list");
  if (!container) return;
  container.innerHTML = "";

  // 1. Tuần Này
  const curCount = countTotalItems(allScheduleData.current);
  const curBtn = createWeekTabElement("current", "Lịch Tuần Này", curCount > 0 ? `${curCount} môn (Trang chủ)` : "Đang dùng", false);
  container.appendChild(curBtn);

  // 2. Tuần Sau
  const nextCount = countTotalItems(allScheduleData.next);
  const nextBtn = createWeekTabElement("next", "Lịch Tuần Sau", nextCount > 0 ? `${nextCount} môn` : "Tuần tới", false);
  container.appendChild(nextBtn);

  // 3. Các tuần người dùng tự thêm (+)
  if (allScheduleData.extra) {
    Object.entries(allScheduleData.extra).forEach(([extraId, extraObj]) => {
      const eCount = countTotalItems(extraObj.data);
      const eName = extraObj.name || "Tuần Thêm";
      const eBtn = createWeekTabElement(extraId, eName, eCount > 0 ? `${eCount} môn` : "Trống", true);
      container.appendChild(eBtn);
    });
  }
}

function createWeekTabElement(modeId, title, subtext, canDelete) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `week-tab-btn ${currentWeekMode === modeId ? "active" : ""}`;
  btn.onclick = () => switchWeekMode(modeId);

  let html = `
    <span class="week-tab-title">${escapeHtml(title)}</span>
    <span class="week-tab-sub">${escapeHtml(subtext)}</span>
  `;

  if (canDelete) {
    html += `<span class="btn-delete-week-tab" title="Xóa tuần này" onclick="deleteExtraWeek('${modeId}', '${escapeHtml(title)}', event)">✕</span>`;
  }

  btn.innerHTML = html;
  return btn;
}

function countTotalItems(weekData) {
  if (!weekData) return 0;
  let count = 0;
  Object.values(weekData).forEach(dayObj => {
    count += Object.keys(dayObj || {}).length;
  });
  return count;
}

// Thêm tuần mới khi bấm nút [+]
window.promptAddNewWeek = function() {
  // Đếm số tuần hiện có để gợi ý tên (ví dụ: Tuần 3, Tuần 4...)
  const extraCount = Object.keys(allScheduleData.extra || {}).length;
  const suggestedNumber = extraCount + 3; // Tuần 1, Tuần 2, rồi đến Tuần 3
  const inputName = prompt(`Nhập tên tuần mới cần thêm (Ví dụ: Tuần ${suggestedNumber}, Tuần Sau Nữa, Tuần Thi...):`, `Tuần ${suggestedNumber}`);
  
  if (!inputName || !inputName.trim()) return;

  const newId = "extra_" + Date.now();
  const newName = inputName.trim();

  dbExtra.child(newId).set({
    id: newId,
    name: newName,
    data: {}
  }).then(() => {
    showToast(`Đã thêm ${newName} thành công!`);
    switchWeekMode(newId);
  }).catch(err => {
    showToast("Lỗi khi thêm tuần: " + err.message);
  });
};

// Xóa tuần tự thêm
window.deleteExtraWeek = function(weekId, weekName, event) {
  if (event) event.stopPropagation();

  const confirmed = confirm(`Bạn có chắc muốn xóa hẳn "${weekName}" không? Mọi môn học trong tuần này sẽ bị xóa.`);
  if (!confirmed) return;

  dbExtra.child(weekId).remove().then(() => {
    showToast(`Đã xóa ${weekName}`);
    if (currentWeekMode === weekId) {
      switchWeekMode("current");
    }
  }).catch(err => {
    showToast("Lỗi xóa tuần: " + err.message);
  });
};

// ==========================================
// 4. THANH CÔNG CỤ TÁC VỤ TUẦN ĐỘNG
// ==========================================
function renderWeekTools() {
  const toolsBar = document.getElementById("week-tools-bar");
  if (!toolsBar) return;
  toolsBar.innerHTML = "";

  if (currentWeekMode === "current") {
    // ------------------------------------
    // KHI Ở TUẦN NÀY:
    // ------------------------------------
    toolsBar.innerHTML = `
      <button type="button" class="tool-btn copy-btn" onclick="copyCurrentToNextWeek()">
        📋 Sao Chép Sang Tuần Sau
      </button>
      <button type="button" class="tool-btn text-copy" onclick="copyScheduleAsText()">
        📄 Sao Chép Văn Bản (Zalo)
      </button>
      <button type="button" class="tool-btn danger" onclick="clearCurrentWeekData()">
        🗑️ Xóa Tuần Này
      </button>
    `;
  } else {
    // ------------------------------------
    // KHI Ở TUẦN SAU HOẶC CÁC TUẦN THÊM (+):
    // ------------------------------------
    toolsBar.innerHTML = `
      <button type="button" class="tool-btn apply-btn" onclick="applyActiveWeekToLive()">
        ⚡ Áp Dụng Cho Trang Chủ Ngay
      </button>
      <button type="button" class="tool-btn copy-btn" onclick="copyCurrentToActiveWeek()">
        📋 Sao Chép Lịch Từ Tuần Này Sang
      </button>
      <button type="button" class="tool-btn text-copy" onclick="copyScheduleAsText()">
        📄 Sao Chép Văn Bản (Zalo)
      </button>
      <button type="button" class="tool-btn danger" onclick="clearCurrentWeekData()">
        🗑️ Xóa Lịch Tuần Này
      </button>
    `;
  }
}

// Sao chép toàn bộ Tuần Này sang Tuần Sau
window.copyCurrentToNextWeek = function() {
  const curData = allScheduleData.current || {};
  const count = countTotalItems(curData);

  if (count === 0) {
    showToast("Tuần Này chưa có môn nào để sao chép!");
    return;
  }

  const nextCount = countTotalItems(allScheduleData.next);
  if (nextCount > 0) {
    if (!confirm(`Tuần Sau đang có ${nextCount} môn. Bạn có muốn ghi đè toàn bộ ${count} môn từ Tuần Này sang Tuần Sau không?`)) {
      return;
    }
  }

  const clone = JSON.parse(JSON.stringify(curData));
  dbNext.set(clone).then(() => {
    showToast(`Đã sao chép ${count} môn sang Tuần Sau!`);
    switchWeekMode("next");
  }).catch(err => {
    showToast("Lỗi sao chép: " + err.message);
  });
};

// Sao chép toàn bộ Tuần Này sang tuần đang chọn (ví dụ: Tuần 3, Tuần 4...)
window.copyCurrentToActiveWeek = function() {
  const curData = allScheduleData.current || {};
  const count = countTotalItems(curData);
  const targetLabel = getWeekLabel();

  if (count === 0) {
    showToast("Tuần Này chưa có môn nào để sao chép!");
    return;
  }

  const activeCount = countTotalItems(getActiveData());
  if (activeCount > 0) {
    if (!confirm(`${targetLabel} đang có sẵn ${activeCount} môn. Bạn có muốn ghi đè toàn bộ môn từ Tuần Này sang không?`)) {
      return;
    }
  }

  const clone = JSON.parse(JSON.stringify(curData));
  getActiveDb().set(clone).then(() => {
    showToast(`Đã sao chép ${count} môn từ Tuần Này sang ${targetLabel}!`);
    renderList();
  }).catch(err => {
    showToast("Lỗi sao chép: " + err.message);
  });
};

// Áp dụng tuần đang chọn làm lịch chính ngoài trang chủ
window.applyActiveWeekToLive = function() {
  const dataToApply = getActiveData();
  const count = countTotalItems(dataToApply);
  const weekLabel = getWeekLabel();

  if (count === 0) {
    showToast(`${weekLabel} đang trống, không có môn nào để áp dụng!`);
    return;
  }

  if (!confirm(`Bạn có chắc muốn đưa toàn bộ ${count} môn của "${weekLabel}" ra ngoài trang chủ cho mẹ xem ngay lập tức không?`)) {
    return;
  }

  const updates = {};
  updates["schedule"] = dataToApply;

  // Nếu áp dụng từ Tuần Sau, dọn dẹp Tuần Sau để chuẩn bị tiếp
  if (currentWeekMode === "next") {
    updates["schedule_next"] = null;
  }

  firebase.database().ref().update(updates).then(() => {
    showToast(`Đã áp dụng lịch của ${weekLabel} ra trang chủ thành công!`);
    switchWeekMode("current");
  }).catch(err => {
    showToast("Lỗi áp dụng: " + err.message);
  });
};

// Sao chép văn bản gửi Zalo
window.copyScheduleAsText = function() {
  const activeData = getActiveData();
  const weekLabel = getWeekLabel().toUpperCase();
  let text = `📅 THỜI KHÓA BIỂU (${weekLabel}):\n`;
  let hasData = false;

  DAYS_OF_WEEK.forEach(day => {
    const dayData = activeData[day] || {};
    const items = Object.values(dayData);
    if (items.length > 0) {
      hasData = true;
      text += `\n📌 ${day}:\n`;
      items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      items.forEach(it => {
        text += `• ${it.time || "Chưa giờ"}: ${it.subject}${it.room ? ` (Phòng ${it.room})` : ""}\n`;
      });
    }
  });

  if (!hasData) {
    showToast("Lịch đang trống, chưa có môn nào để sao chép!");
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast("Đã sao chép lịch vào bộ nhớ tạm để gửi tin nhắn!");
  }).catch(() => {
    showToast("Không thể tự động sao chép.");
  });
};

// Xóa dữ liệu của tuần đang chọn
window.clearCurrentWeekData = function() {
  const weekLabel = getWeekLabel();
  if (!confirm(`Bạn có chắc muốn xóa TẤT CẢ các môn học của ${weekLabel} không?`)) {
    return;
  }

  getActiveDb().remove().then(() => {
    showToast(`Đã xóa sạch lịch ${weekLabel}!`);
    resetForm();
  }).catch(err => {
    showToast("Lỗi xóa: " + err.message);
  });
};

// ==========================================
// 5. XỬ LÝ LƯU (THÊM / SỬA) TIẾT HỌC
// ==========================================
function setupScheduleForm() {
  const scheduleForm = document.getElementById("schedule-form");
  if (!scheduleForm) return;

  scheduleForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const day = document.getElementById("day-val").value;
    const time = document.getElementById("time-val").value.trim();
    const subject = document.getElementById("subject-val").value.trim();
    const room = document.getElementById("room-val").value.trim();

    if (!subject) {
      showToast("Vui lòng nhập tên môn học!");
      return;
    }

    const payload = {
      time: time,
      subject: subject,
      room: room,
      note: ""
    };

    const targetDb = getActiveDb();
    const weekLabel = getWeekLabel();

    if (isEditing) {
      if (editDay !== day) {
        const updates = {};
        updates[`${editDay}/${editId}`] = null;
        updates[`${day}/${editId}`] = payload;
        targetDb.update(updates).then(() => {
          showToast(`Đã cập nhật môn học (${weekLabel})!`);
          resetForm();
        }).catch(err => {
          showToast("Lỗi: " + err.message);
        });
      } else {
        targetDb.child(day).child(editId).set(payload).then(() => {
          showToast(`Đã cập nhật môn học (${weekLabel})!`);
          resetForm();
        }).catch(err => {
          showToast("Lỗi: " + err.message);
        });
      }
    } else {
      targetDb.child(day).push(payload).then(() => {
        showToast(`Đã thêm vào ${day} (${weekLabel})!`);
        resetForm();
      }).catch(err => {
        showToast("Lỗi: " + err.message);
      });
    }
  });
}

// Bắt đầu sửa môn
window.startEdit = function(day, id) {
  const activeData = getActiveData();
  const item = (activeData[day] && activeData[day][id]) || null;
  if (!item) return;

  isEditing = true;
  editDay = day;
  editId = id;

  document.getElementById("day-val").value = day;
  const timeStr = item.time || "";
  document.getElementById("time-val").value = timeStr;
  window.syncPickersFromTimeInput();

  document.getElementById("subject-val").value = item.subject || "";
  document.getElementById("room-val").value = item.room || "";

  const formTitle = document.getElementById("form-title");
  const btnSubmit = document.getElementById("btn-submit");
  const btnCancel = document.getElementById("btn-cancel");

  if (formTitle) formTitle.textContent = `Chỉnh Sửa Tiết Học (${getWeekLabel()})`;
  if (btnSubmit) btnSubmit.textContent = "Cập Nhật";
  if (btnCancel) btnCancel.style.display = "inline-flex";

  const formSection = document.getElementById("schedule-form");
  if (formSection) {
    formSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

// Hủy sửa
window.resetForm = function() {
  isEditing = false;
  editDay = null;
  editId = null;

  document.getElementById("time-val").value = "18:00 - 20:00";
  window.syncPickersFromTimeInput();

  document.getElementById("subject-val").value = "";
  document.getElementById("room-val").value = "";

  const formTitle = document.getElementById("form-title");
  const btnSubmit = document.getElementById("btn-submit");
  const btnCancel = document.getElementById("btn-cancel");

  if (formTitle) formTitle.textContent = "Thêm Tiết Học Mới";
  if (btnSubmit) btnSubmit.textContent = "Lưu Tiết Học";
  if (btnCancel) btnCancel.style.display = "none";
};

// Xóa 1 môn
window.deleteItem = function(day, id, subjName) {
  const weekLabel = getWeekLabel();
  const confirmed = confirm(`Bạn có chắc muốn xóa môn "${subjName || 'này'}" khỏi ${day} (${weekLabel})?`);
  if (!confirmed) return;

  getActiveDb().child(day).child(id).remove().then(() => {
    showToast("Đã xóa tiết học thành công!");
    if (isEditing && editId === id) {
      resetForm();
    }
  }).catch(err => {
    showToast("Lỗi khi xóa: " + err.message);
  });
};

// ==========================================
// 6. THANH LỌC DANH SÁCH THEO THỨ
// ==========================================
function setupFilterBar() {
  const filterBar = document.getElementById("filter-bar");
  if (!filterBar) return;
  filterBar.innerHTML = "";

  const filters = [
    { id: "all", label: "Tất cả" },
    ...DAYS_OF_WEEK.map(d => ({
      id: d,
      label: SHORT_DAYS[d] || d
    }))
  ];

  filters.forEach(f => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `filter-btn ${currentFilter === f.id ? "active" : ""}`;
    btn.textContent = f.label;

    btn.onclick = () => {
      currentFilter = f.id;
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderList();
    };

    filterBar.appendChild(btn);
  });
}

// ==========================================
// 7. HIỂN THỊ DANH SÁCH MÔN HỌC
// ==========================================
function renderList() {
  const itemsContainer = document.getElementById("items-list");
  if (!itemsContainer) return;
  itemsContainer.innerHTML = "";

  const data = getActiveData();

  let daysToRender = DAYS_OF_WEEK;
  if (currentFilter !== "all") {
    daysToRender = [currentFilter];
  }

  let totalItems = 0;

  daysToRender.forEach(day => {
    const dayData = data[day] || {};
    const items = Object.entries(dayData);

    // Sắp xếp theo giờ tăng dần
    items.sort((a, b) => (a[1].time || "").localeCompare(b[1].time || ""));

    if (items.length > 0) {
      totalItems += items.length;

      const group = document.createElement("div");
      group.className = "day-group";

      let html = `
        <div class="day-group-header">
          <span>${day}</span>
          <span class="day-count">${items.length} môn</span>
        </div>
        <div class="day-group-items">
      `;

      items.forEach(([id, item]) => {
        const time = escapeHtml(item.time || "Chưa xếp giờ");
        const subject = escapeHtml(item.subject || "Môn học");
        const room = item.room ? `Phòng ${escapeHtml(item.room)}` : "";

        html += `
          <div class="item-row">
            <div class="item-info">
              <div class="item-time">${time}</div>
              <div class="item-subject">${subject}</div>
              ${room ? `<div class="item-room">${room}</div>` : ""}
            </div>
            <div class="item-actions">
              <button type="button" class="btn-action edit" onclick="startEdit('${day}', '${id}')">Sửa</button>
              <button type="button" class="btn-action delete" onclick="deleteItem('${day}', '${id}', '${escapeHtml(subject)}')">Xóa</button>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      group.innerHTML = html;
      itemsContainer.appendChild(group);
    }
  });

  if (totalItems === 0) {
    const weekLabel = getWeekLabel();
    itemsContainer.innerHTML = `
      <div class="empty-state">
        ${currentFilter === "all" ? `Chưa có môn học nào trong ${weekLabel}.` : `Không có môn học nào vào ${currentFilter} (${weekLabel}).`}
      </div>
    `;
  }
}

// ==========================================
// 8. TOAST THÔNG BÁO
// ==========================================
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = msg;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// 9. XÁC THỰC MÃ PIN & KHỞI TẠO
// ==========================================
window.unlock = function() {
  const pinField = document.getElementById("pin-field");
  const authError = document.getElementById("auth-error");
  const val = pinField ? pinField.value.trim() : "";

  if (val === ADMIN_PIN) {
    sessionStorage.setItem("admin_authenticated", "true");
    showAdminPanel();
    showToast("Đăng nhập thành công!");
  } else {
    if (authError) authError.style.display = "block";
    if (pinField) {
      pinField.select();
    }
  }
};

window.logout = function() {
  sessionStorage.removeItem("admin_authenticated");
  showAuthBox();
  showToast("Đã đăng xuất");
};

function showAuthBox() {
  const authBox = document.getElementById("auth-box");
  const adminPanel = document.getElementById("admin-panel");
  const pinField = document.getElementById("pin-field");
  const authError = document.getElementById("auth-error");

  if (authBox) authBox.style.display = "block";
  if (adminPanel) adminPanel.style.display = "none";
  if (pinField) {
    pinField.value = "";
    setTimeout(() => pinField.focus(), 150);
  }
  if (authError) authError.style.display = "none";
}

function showAdminPanel() {
  const authBox = document.getElementById("auth-box");
  const adminPanel = document.getElementById("admin-panel");

  if (authBox) authBox.style.display = "none";
  if (adminPanel) adminPanel.style.display = "block";

  setupFilterBar();
  setupScheduleForm();
  switchWeekMode("current");
}

document.addEventListener("DOMContentLoaded", () => {
  const pinField = document.getElementById("pin-field");
  if (pinField) {
    pinField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        unlock();
      }
    });
  }

  // Khởi động Firebase listeners
  initFirebaseListeners();

  // Kiểm tra đăng nhập
  if (sessionStorage.getItem("admin_authenticated") === "true") {
    showAdminPanel();
  } else {
    showAuthBox();
  }
});

// ==========================================
// 10. LẮNG NGHE DỮ LIỆU TỪ FIREBASE REALTIME
// ==========================================
function initFirebaseListeners() {
  // 1. Tuần Này (schedule)
  db.on("value", (snapshot) => {
    allScheduleData.current = snapshot.val() || {};
    renderWeekTabs();
    if (currentWeekMode === "current") {
      renderList();
    }
  }, (err) => {
    console.error("Lỗi tải Tuần Này:", err);
  });

  // 2. Tuần Sau (schedule_next)
  dbNext.on("value", (snapshot) => {
    allScheduleData.next = snapshot.val() || {};
    renderWeekTabs();
    if (currentWeekMode === "next") {
      renderList();
    }
  }, (err) => {
    console.error("Lỗi tải Tuần Sau:", err);
  });

  // 3. Các Tuần Thêm (schedule_extra)
  dbExtra.on("value", (snapshot) => {
    allScheduleData.extra = snapshot.val() || {};
    renderWeekTabs();
    if (currentWeekMode.startsWith("extra_")) {
      renderList();
    }
  }, (err) => {
    console.error("Lỗi tải các Tuần Thêm:", err);
  });
}
