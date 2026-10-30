/**
 * app.js - Logic hiển thị Lịch Học
 * Giao diện trực quan, chữ to rõ ràng, không rườm rà
 */

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("schedule-container");
  const liveDateEl = document.getElementById("live-date");
  const tabTodayBtn = document.getElementById("tab-today");
  const tabAllBtn = document.getElementById("tab-all");
  const daysBarEl = document.getElementById("days-bar");
  const zoomBtn = document.getElementById("btn-zoom");
  const zoomLabel = document.getElementById("zoom-label");

  // Bản đồ thứ trong tuần theo JS getDay()
  const DAY_MAP = {
    0: "Chủ Nhật",
    1: "Thứ Hai",
    2: "Thứ Ba",
    3: "Thứ Tư",
    4: "Thứ Năm",
    5: "Thứ Sáu",
    6: "Thứ Bảy"
  };

  const SHORT_DAY_MAP = {
    "Thứ Hai": "Thứ 2",
    "Thứ Ba": "Thứ 3",
    "Thứ Tư": "Thứ 4",
    "Thứ Năm": "Thứ 5",
    "Thứ Sáu": "Thứ 6",
    "Thứ Bảy": "Thứ 7",
    "Chủ Nhật": "Chủ Nhật"
  };

  const now = new Date();
  const currentDayName = DAY_MAP[now.getDay()];

  // Chế độ xem: 'today' (Mặc định hôm nay) hoặc 'all' (Cả tuần)
  let currentView = localStorage.getItem("schedule_view_mode") || "today";
  let filterDay = "all";
  let cachedData = {};

  // ==========================================
  // 1. CHẾ ĐỘ CHỮ TO (Aa)
  // ==========================================
  function initZoomMode() {
    const isZoom = localStorage.getItem("schedule_zoom_mode") === "on";
    if (isZoom) {
      document.body.classList.add("zoom-mode");
      if (zoomBtn) zoomBtn.classList.add("active");
      if (zoomLabel) zoomLabel.textContent = "Chữ chuẩn";
    }
  }

  window.toggleZoom = function() {
    const isZoom = document.body.classList.toggle("zoom-mode");
    localStorage.setItem("schedule_zoom_mode", isZoom ? "on" : "off");
    if (zoomBtn) {
      zoomBtn.classList.toggle("active", isZoom);
    }
    if (zoomLabel) {
      zoomLabel.textContent = isZoom ? "Chữ chuẩn" : "Chữ to";
    }
  };

  initZoomMode();

  // ==========================================
  // 2. HIỂN THỊ NGÀY THÁNG
  // ==========================================
  function updateLiveDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const dayName = DAY_MAP[d.getDay()];

    if (liveDateEl) {
      liveDateEl.textContent = `${dayName}, ${day}/${month}/${year}`;
    }
  }
  updateLiveDate();

  // ==========================================
  // 3. CHUYỂN ĐỔI CHẾ ĐỘ XEM (HÔM NAY / CẢ TUẦN)
  // ==========================================
  window.switchView = function(mode) {
    currentView = mode;
    filterDay = "all";
    localStorage.setItem("schedule_view_mode", mode);

    if (tabTodayBtn && tabAllBtn) {
      if (mode === "today") {
        tabTodayBtn.classList.add("active");
        tabAllBtn.classList.remove("active");
        if (daysBarEl) daysBarEl.style.display = "none";
      } else {
        tabTodayBtn.classList.remove("active");
        tabAllBtn.classList.add("active");
        if (daysBarEl) {
          daysBarEl.style.display = "flex";
          setupDaysBar();
        }
      }
    }

    renderSchedule(cachedData);
  };

  // ==========================================
  // 4. THANH LỌC THỨ TRONG TUẦN
  // ==========================================
  function setupDaysBar() {
    if (!daysBarEl) return;
    daysBarEl.innerHTML = "";

    const chips = [
      { id: "all", label: "Tất cả" },
      ...DAYS_OF_WEEK.map(d => ({
        id: d,
        label: SHORT_DAY_MAP[d] || d,
        isToday: (d === currentDayName)
      }))
    ];

    chips.forEach(chip => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `day-chip-btn ${filterDay === chip.id ? "active" : ""} ${chip.isToday ? "is-today-chip" : ""}`;
      btn.textContent = chip.label;

      btn.onclick = () => {
        filterDay = chip.id;
        document.querySelectorAll(".day-chip-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderSchedule(cachedData);
      };

      daysBarEl.appendChild(btn);
    });
  }

  // ==========================================
  // 5. ĐỊNH DẠNG THỜI GIAN & MÔN HỌC
  // ==========================================
  function formatTime(timeStr) {
    if (!timeStr) return "Chưa xếp giờ";
    let t = timeStr.trim();

    if (t === ":30 - 16:30" || t.startsWith(":30 - 16:30")) t = "12:30 - 16:30";
    else if (t === ":00 - 20:00" || t.startsWith(":00 - 20:00")) t = "18:00 - 20:00";
    else if (t === ":30 - 11:00" || t.startsWith(":30 - 11:00")) t = "07:30 - 11:00";
    else if (t.startsWith(":")) t = "0" + t;

    return t.replace(/-/g, "–");
  }

  function getSessionInfo(timeStr) {
    const formatted = formatTime(timeStr);
    const match = formatted.match(/^(\d{1,2})/);
    const h = match ? parseInt(match[1], 10) : 8;

    if (h < 12) {
      return { label: "Sáng", cssClass: "session-morning" };
    } else if (h < 17) {
      return { label: "Chiều", cssClass: "session-afternoon" };
    } else {
      return { label: "Tối", cssClass: "session-evening" };
    }
  }

  function formatSubject(subjStr) {
    if (!subjStr) return "Môn học";
    const match = subjStr.match(/^([^\s:]+)\s*:\s*(.+)$/);
    if (match) {
      return match[2].trim();
    }
    return subjStr.trim();
  }

  function formatRoom(roomStr) {
    if (!roomStr) return "";
    const r = roomStr.trim();
    if (r.toLowerCase().startsWith("phòng") || r.toLowerCase().startsWith("p.")) return r;
    return `Phòng ${r}`;
  }

  function parseTimeStartMinutes(timeStr) {
    if (!timeStr) return 9999;
    const formatted = formatTime(timeStr);
    const match = formatted.match(/^(\d{1,2})[:hH](\d{2})/);
    if (!match) return 9999;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  // ==========================================
  // 6. RENDER GIAO DIỆN
  // ==========================================
  function renderSchedule(data) {
    if (!container) return;
    container.innerHTML = "";

    // ------------------------------------------
    // A. CHẾ ĐỘ: XEM HÔM NAY
    // ------------------------------------------
    if (currentView === "today") {
      const todaySchedule = data[currentDayName] || {};
      const items = Object.values(todaySchedule);
      items.sort((a, b) => parseTimeStartMinutes(a.time) - parseTimeStartMinutes(b.time));

      if (items.length === 0) {
        container.innerHTML = `
          <div class="today-off-card">
            <h2 class="today-off-title">Hôm nay không có lịch học</h2>
            <p class="today-off-desc">${currentDayName} không có tiết học nào.</p>
            <button type="button" class="btn-see-week" onclick="switchView('all')">
              Xem lịch cả tuần
            </button>
          </div>
        `;
        return;
      }

      const block = createDayBlock(currentDayName, items, true);
      container.appendChild(block);
      return;
    }

    // ------------------------------------------
    // B. CHẾ ĐỘ: XEM CẢ TUẦN
    // ------------------------------------------
    let daysToRender = DAYS_OF_WEEK;
    if (filterDay !== "all") {
      daysToRender = [filterDay];
    }

    daysToRender.forEach(dayName => {
      const daySchedule = data[dayName] || {};
      const items = Object.values(daySchedule);
      items.sort((a, b) => parseTimeStartMinutes(a.time) - parseTimeStartMinutes(b.time));

      const isToday = (dayName === currentDayName);
      const block = createDayBlock(dayName, items, isToday);
      container.appendChild(block);
    });
  }

  function createDayBlock(dayName, items, isToday) {
    const block = document.createElement("div");
    block.className = `day-block ${isToday ? "is-today-block" : ""}`;

    let html = `
      <div class="day-block-header">
        <h2 class="day-block-title">${dayName}</h2>
        ${isToday ? '<span class="today-star-badge">Hôm nay</span>' : ""}
      </div>
    `;

    if (items.length > 0) {
      html += `<div class="day-classes-list">`;
      items.forEach(item => {
        const timeVal = formatTime(item.time);
        const sessionInfo = getSessionInfo(item.time);
        const subjTitle = escapeHtml(formatSubject(item.subject));
        const roomTitle = item.room ? escapeHtml(formatRoom(item.room)) : "";

        html += `
          <div class="class-card-item">
            <div class="class-time-row">
              <span class="class-session-badge ${sessionInfo.cssClass}">
                ${sessionInfo.label}
              </span>
              <span class="class-time-val">
                ${timeVal}
              </span>
            </div>

            <div class="class-info-row">
              <span class="class-subject-title">${subjTitle}</span>
              ${roomTitle ? `<span class="class-room-badge">${roomTitle}</span>` : ""}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    } else {
      html += `<div class="day-off-card">Nghỉ</div>`;
    }

    block.innerHTML = html;
    return block;
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
  // 7. TỰ ĐỘNG CHUYỂN GIAO TUẦN VÀO THỨ HAI
  // ==========================================
  function getISOWeekKey(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  function checkViewerAutoPromote() {
    const currentWeekKey = getISOWeekKey();
    if (typeof dbMeta === "undefined" || typeof dbNext === "undefined") return;

    dbMeta.once("value").then(metaSnap => {
      const meta = metaSnap.val() || {};
      if (!meta.lastPromotedWeek) {
        dbMeta.update({ lastPromotedWeek: currentWeekKey, initializedAt: new Date().toISOString() });
        return;
      }
      if (meta.lastPromotedWeek !== currentWeekKey) {
        dbNext.once("value").then(nextSnap => {
          const nextData = nextSnap.val();
          if (nextData && typeof nextData === "object" && Object.keys(nextData).length > 0) {
            const updates = {};
            updates["schedule"] = nextData;
            updates["schedule_next"] = null;
            updates["schedule_meta/lastPromotedWeek"] = currentWeekKey;
            updates["schedule_meta/lastPromotedAt"] = new Date().toISOString();
            firebase.database().ref().update(updates);
          } else {
            dbMeta.update({ lastPromotedWeek: currentWeekKey });
          }
        });
      }
    }).catch(err => {
      console.warn("Lỗi chuyển giao tuần:", err);
    });
  }

  checkViewerAutoPromote();

  // ==========================================
  // 8. LẮNG NGHE REALTIME TỪ FIREBASE
  // ==========================================
  db.on("value", (snapshot) => {
    cachedData = snapshot.val() || {};
    renderSchedule(cachedData);
  }, (error) => {
    console.error("Lỗi tải Firebase:", error);
    if (container) {
      container.innerHTML = `
        <div class="state-card" style="color: #b91c1c;">
          <p style="margin-bottom: 6px;">Không thể tải lịch học</p>
          <p style="font-size: 0.95rem; color: var(--text-muted);">Vui lòng kiểm tra lại kết nối mạng.</p>
        </div>
      `;
    }
  });

  // Khởi tạo ban đầu
  switchView(currentView);
});
