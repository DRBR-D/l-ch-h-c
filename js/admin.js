/**
 * admin.js - Quản lý thêm / sửa / xóa lịch học
 * Mã PIN mặc định: 132008
 */

// Biến trạng thái chỉnh sửa
let isEditing = false;
let currentEditDay = null;
let currentEditId = null;

// Biến bộ lọc danh sách trong admin
let adminFilterDay = "all";
let allScheduleData = {};

document.addEventListener("DOMContentLoaded", () => {
  const authBox = document.getElementById("auth-box");
  const adminPanel = document.getElementById("admin-panel");
  const pinField = document.getElementById("pin-field");
  const authError = document.getElementById("auth-error");
  const scheduleForm = document.getElementById("schedule-form");
  const itemsContainer = document.getElementById("items-list");
  const filterTabsContainer = document.getElementById("admin-filter-bar");

  // ==========================================
  // 1. Kiểm tra trạng thái đã đăng nhập chưa
  // ==========================================
  if (sessionStorage.getItem("admin_authenticated") === "true") {
    showAdminPanel();
  } else {
    showAuthBox();
  }

  // Bắt phím Enter trong ô nhập PIN
  if (pinField) {
    pinField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        unlock();
      }
    });
  }

  function showAuthBox() {
    if (authBox) authBox.style.display = "block";
    if (adminPanel) adminPanel.style.display = "none";
    if (pinField) {
      pinField.value = "";
      setTimeout(() => pinField.focus(), 150);
    }
    if (authError) authError.style.display = "none";
  }

  function showAdminPanel() {
    if (authBox) authBox.style.display = "none";
    if (adminPanel) adminPanel.style.display = "block";
  }

  // Hàm mở khóa
  window.unlock = function() {
    const val = pinField ? pinField.value.trim() : "";
    if (val === ADMIN_PIN) {
      sessionStorage.setItem("admin_authenticated", "true");
      showAdminPanel();
      showToast("Đăng nhập thành công!", "success");
    } else {
      if (authError) {
        authError.style.display = "block";
        authError.textContent = "Mã PIN không đúng! Vui lòng thử lại.";
      }
      if (pinField) {
        pinField.classList.add("shake");
        setTimeout(() => pinField.classList.remove("shake"), 500);
        pinField.select();
      }
    }
  };

  // Hàm đăng xuất
  window.logout = function() {
    sessionStorage.removeItem("admin_authenticated");
    showAuthBox();
    showToast("Đã đăng xuất khỏi quản trị.");
  };

  // ==========================================
  // 2. Thiết lập các nút chọn nhanh giờ học
  // ==========================================
  window.setQuickTime = function(timeStr) {
    const timeInput = document.getElementById("time-val");
    if (timeInput) {
      timeInput.value = timeStr;
      timeInput.focus();
    }
  };

  // ==========================================
  // 3. Khởi tạo thanh lọc ngày trong danh sách
  // ==========================================
  function setupAdminFilterTabs() {
    if (!filterTabsContainer) return;
    filterTabsContainer.innerHTML = "";

    const tabs = [
      { id: "all", label: "Tất cả" },
      ...DAYS_OF_WEEK.map(d => ({ id: d, label: d }))
    ];

    tabs.forEach(tab => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `admin-filter-chip ${adminFilterDay === tab.id ? "active" : ""}`;
      chip.textContent = tab.label;
      chip.onclick = () => {
        adminFilterDay = tab.id;
        document.querySelectorAll(".admin-filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        renderAdminItems();
      };
      filterTabsContainer.appendChild(chip);
    });
  }

  setupAdminFilterTabs();

  // ==========================================
  // 4. Xử lý Form Thêm mới / Cập nhật Lịch
  // ==========================================
  if (scheduleForm) {
    scheduleForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const day = document.getElementById("day-val").value;
      const time = document.getElementById("time-val").value.trim();
      const subject = document.getElementById("subject-val").value.trim();
      const room = document.getElementById("room-val").value.trim();
      const note = document.getElementById("note-val").value.trim();

      if (!subject) {
        showToast("Vui lòng nhập tên môn học / hoạt động!", "error");
        return;
      }

      const payload = { time, subject, room, note };

      if (isEditing) {
        // Đang sửa: Nếu người dùng đổi ngày khác với ngày ban đầu
        if (currentEditDay !== day) {
          // Xóa ở ngày cũ và tạo mới ở ngày mới
          const updates = {};
          updates[`${currentEditDay}/${currentEditId}`] = null;
          updates[`${day}/${currentEditId}`] = payload;
          db.update(updates).then(() => {
            showToast("Đã cập nhật lịch thành công!", "success");
            resetForm();
          }).catch(err => {
            showToast("Có lỗi xảy ra: " + err.message, "error");
          });
        } else {
          // Giữ nguyên ngày, cập nhật dữ liệu
          db.child(day).child(currentEditId).set(payload).then(() => {
            showToast("Đã cập nhật lịch thành công!", "success");
            resetForm();
          }).catch(err => {
            showToast("Có lỗi xảy ra: " + err.message, "error");
          });
        }
      } else {
        // Thêm mới
        db.child(day).push(payload).then(() => {
          showToast("Đã thêm môn học thành công!", "success");
          resetForm();
        }).catch(err => {
          showToast("Có lỗi xảy ra: " + err.message, "error");
        });
      }
    });
  }

  // Hàm reset form về trạng thái Thêm mới
  window.resetForm = function() {
    isEditing = false;
    currentEditDay = null;
    currentEditId = null;

    document.getElementById("form-title").innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      Thêm Môn / Hoạt Động Mới
    `;
    document.getElementById("btn-submit-form").innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Lưu Lên Hệ Thống
    `;
    document.getElementById("edit-cancel-wrap").style.display = "none";

    document.getElementById("subject-val").value = "";
    document.getElementById("time-val").value = "";
    document.getElementById("room-val").value = "";
    document.getElementById("note-val").value = "";
  };

  // ==========================================
  // 5. Chuẩn bị chỉnh sửa 1 mục
  // ==========================================
  window.editItem = function(day, id) {
    if (!allScheduleData[day] || !allScheduleData[day][id]) return;

    const item = allScheduleData[day][id];
    isEditing = true;
    currentEditDay = day;
    currentEditId = id;

    // Điền dữ liệu vào form
    document.getElementById("day-val").value = day;
    document.getElementById("time-val").value = item.time || "";
    document.getElementById("subject-val").value = item.subject || "";
    document.getElementById("room-val").value = item.room || "";
    document.getElementById("note-val").value = item.note || "";

    // Đổi giao diện nút và tiêu đề
    document.getElementById("form-title").innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Chỉnh Sửa Lịch Học (${day})
    `;
    document.getElementById("btn-submit-form").innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Lưu Cập Nhật
    `;
    document.getElementById("edit-cancel-wrap").style.display = "block";

    // Cuộn mượt lên form
    document.getElementById("schedule-form").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("subject-val").focus();
  };

  // ==========================================
  // 6. Xóa mục
  // ==========================================
  window.removeItem = function(day, id, subject) {
    const confirmMsg = subject 
      ? `Bạn có chắc chắn muốn xóa môn "${subject}" khỏi ${day}?`
      : `Bạn có chắc chắn muốn xóa mục này khỏi ${day}?`;

    if (confirm(confirmMsg)) {
      db.child(day).child(id).remove().then(() => {
        showToast("Đã xóa môn học thành công!", "success");
        if (isEditing && currentEditId === id) {
          resetForm();
        }
      }).catch(err => {
        showToast("Lỗi khi xóa: " + err.message, "error");
      });
    }
  };

  // ==========================================
  // 7. Render danh sách các mục đã lưu
  // ==========================================
  function renderAdminItems() {
    if (!itemsContainer) return;
    itemsContainer.innerHTML = "";

    let totalCount = 0;
    const daysToShow = (adminFilterDay === "all") ? DAYS_OF_WEEK : [adminFilterDay];

    daysToShow.forEach(day => {
      const dayData = allScheduleData[day] || {};
      const ids = Object.keys(dayData);

      // Sắp xếp các mục theo giờ
      ids.sort((a, b) => (dayData[a].time || "").localeCompare(dayData[b].time || ""));

      ids.forEach(id => {
        totalCount++;
        const item = dayData[id];
        const row = document.createElement("div");
        row.className = "admin-item-row";

        row.innerHTML = `
          <div class="item-details">
            <span class="item-day-tag">${day}</span>
            <div class="item-title-text">${escapeHtml(item.subject)}</div>
            <div class="item-meta-text">
              <span class="meta-tag time">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${escapeHtml(item.time || "Thời gian linh hoạt")}
              </span>
              ${item.room ? `
                <span class="meta-tag room">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <strong>Phòng:</strong> ${escapeHtml(item.room)}
                </span>
              ` : ""}
              ${item.note ? `
                <span class="meta-tag note">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <strong>Lưu ý:</strong> ${escapeHtml(item.note)}
                </span>
              ` : ""}
            </div>
          </div>
          <div class="item-action-btns">
            <button class="btn-edit-item" onclick="editItem('${day}', '${id}')" title="Sửa môn này">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Sửa
            </button>
            <button class="btn-delete-item" onclick="removeItem('${day}', '${id}', '${escapeAttr(item.subject)}')" title="Xóa môn này">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Xóa
            </button>
          </div>
        `;
        itemsContainer.appendChild(row);
      });
    });

    if (totalCount === 0) {
      itemsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 30px 10px; font-size: 0.95rem;">
          Chưa có lịch nào được lưu ${adminFilterDay !== "all" ? `cho ${adminFilterDay}` : ""}.
        </div>
      `;
    }
  }

  // Lắng nghe dữ liệu thời gian thực từ Firebase
  db.on("value", (snapshot) => {
    allScheduleData = snapshot.val() || {};
    renderAdminItems();
  });

  // ==========================================
  // 8. Tiện ích thông báo Toast nhẹ nhàng
  // ==========================================
  window.showToast = function(msg, type = "normal") {
    let toast = document.getElementById("admin-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "admin-toast";
      toast.className = "toast-notice";
      document.body.appendChild(toast);
    }

    toast.className = `toast-notice ${type} show`;
    toast.textContent = msg;

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  };

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }
});
