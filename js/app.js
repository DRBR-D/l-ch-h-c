/**
 * app.js - Logic hiển thị Thời Khóa Biểu
 * Thiết kế hiện đại, sang trọng, tinh tế, rõ ràng
 */

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("schedule-container");
  const liveClockEl = document.getElementById("live-clock");
  const liveDateEl = document.getElementById("live-date");
  const filterTabsContainer = document.getElementById("filter-tabs");

  // Bản đồ thứ trong tuần theo JS getDay() (0: CN, 1: T2, 2: T3, ...)
  const DAY_MAP = {
    0: "Chủ Nhật",
    1: "Thứ Hai",
    2: "Thứ Ba",
    3: "Thứ Tư",
    4: "Thứ Năm",
    5: "Thứ Sáu",
    6: "Thứ Bảy"
  };

  const now = new Date();
  const currentDayName = DAY_MAP[now.getDay()];
  const tomorrowDayName = DAY_MAP[(now.getDay() + 1) % 7];

  // Biến lưu trữ dữ liệu Firebase tải về
  let cachedData = {};
  let currentFilter = "all"; // 'all', 'today', 'tomorrow', hoặc tên ngày cụ thể

  // ==========================================
  // 1. CHẾ ĐỘ CHỮ LỚN ACCESSIBILITY
  // ==========================================
  function initTextSizeMode() {
    const isLarge = localStorage.getItem("schedule_text_size") === "large";
    if (isLarge) {
      document.body.classList.add("large-text-mode");
      updateTextSizeButtonUI(true);
    }
  }

  window.toggleTextSize = function() {
    const isLarge = document.body.classList.toggle("large-text-mode");
    localStorage.setItem("schedule_text_size", isLarge ? "large" : "normal");
    updateTextSizeButtonUI(isLarge);
  };

  function updateTextSizeButtonUI(isLarge) {
    const btn = document.getElementById("btn-text-size");
    const label = document.getElementById("text-size-label");
    if (!btn || !label) return;

    if (isLarge) {
      btn.classList.add("active");
      label.textContent = "Chữ vừa";
      btn.title = "Về lại cỡ chữ chuẩn";
    } else {
      btn.classList.remove("active");
      label.textContent = "Chữ lớn";
      btn.title = "Phóng to chữ dễ đọc";
    }
  }

  initTextSizeMode();

  // ==========================================
  // 2. ĐỒNG HỒ & NGÀY THÁNG THỰC
  // ==========================================
  function updateLiveClock() {
    const d = new Date();
    
    // Cập nhật giờ phút giây
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    if (liveClockEl) {
      liveClockEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    // Cập nhật ngày tháng năm
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const dayName = DAY_MAP[d.getDay()];

    if (liveDateEl) {
      liveDateEl.textContent = `${dayName}, ${day}/${month}/${year}`;
    }
  }

  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // ==========================================
  // 3. KHỞI TẠO CÁC TAB LỌC NGÀY HIỆN ĐẠI
  // ==========================================
  function setupFilterTabs() {
    if (!filterTabsContainer) return;
    filterTabsContainer.innerHTML = "";

    const tabs = [
      { id: "all", label: "Tất cả" },
      { id: "today", label: `Hôm nay (${currentDayName})`, isToday: true },
      { id: "tomorrow", label: `Ngày mai (${tomorrowDayName})` },
      ...DAYS_OF_WEEK.map(d => ({ id: d, label: d }))
    ];

    tabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tab-btn ${currentFilter === tab.id ? "active" : ""} ${tab.isToday ? "tab-today" : ""}`;
      btn.textContent = tab.label;

      btn.onclick = () => {
        currentFilter = tab.id;
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderSchedule(cachedData);

        // Cuộn mượt đến ngày đã chọn
        if (tab.id !== "all") {
          let targetDayName = tab.id;
          if (tab.id === "today") targetDayName = currentDayName;
          if (tab.id === "tomorrow") targetDayName = tomorrowDayName;

          const el = document.getElementById(`day-${targetDayName}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      };

      filterTabsContainer.appendChild(btn);
    });
  }

  setupFilterTabs();

  // ==========================================
  // 4. PHÂN TÍCH CA HỌC & TRẠNG THÁI THỜI GIAN THỰC
  // ==========================================
  function getTimeShiftInfo(timeStr) {
    if (!timeStr) return { name: "Giờ học", icon: "clock", colorClass: "shift-morning" };

    const firstHourMatch = timeStr.match(/^(\d{1,2})/);
    const startHour = firstHourMatch ? parseInt(firstHourMatch[1], 10) : 7;

    if (startHour < 12) {
      return { name: "Ca Sáng", icon: "sun", colorClass: "shift-morning" };
    } else if (startHour >= 12 && startHour < 17) {
      return { name: "Ca Chiều", icon: "cloud-sun", colorClass: "shift-afternoon" };
    } else {
      return { name: "Ca Tối", icon: "moon", colorClass: "shift-evening" };
    }
  }

  function getRealtimeClassStatus(timeStr, isToday) {
    if (!isToday || !timeStr) return null;

    const parts = timeStr.split("-").map(s => s.trim());
    if (parts.length < 2) return null;

    const parseMinutes = (str) => {
      const match = str.match(/^(\d{1,2})[:hH](\d{1,2})$/);
      if (!match) return null;
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    };

    const startM = parseMinutes(parts[0]);
    const endM = parseMinutes(parts[1]);
    if (startM === null || endM === null) return null;

    const d = new Date();
    const currentM = d.getHours() * 60 + d.getMinutes();

    if (currentM >= startM && currentM <= endM) {
      return {
        text: "Đang diễn ra",
        className: "status-current"
      };
    } else if (currentM < startM) {
      const diff = startM - currentM;
      if (diff <= 60) {
        return {
          text: `Sắp tới (${diff}p)`,
          className: "status-upcoming"
        };
      } else {
        return {
          text: "Sắp tới",
          className: "status-upcoming"
        };
      }
    } else {
      return {
        text: "Đã hoàn thành",
        className: "status-finished"
      };
    }
  }

  // ==========================================
  // 5. RENDER GIAO DIỆN LỊCH HỌC
  // ==========================================
  function renderSchedule(data) {
    if (!container) return;
    container.innerHTML = "";

    // Lọc danh sách ngày cần hiển thị
    let daysToRender = DAYS_OF_WEEK;
    if (currentFilter === "today") {
      daysToRender = [currentDayName];
    } else if (currentFilter === "tomorrow") {
      daysToRender = [tomorrowDayName];
    } else if (currentFilter !== "all") {
      daysToRender = [currentFilter];
    }

    daysToRender.forEach(dayName => {
      const isToday = (dayName === currentDayName);
      const isTomorrow = (dayName === tomorrowDayName);
      const card = document.createElement("div");
      card.className = `day-card ${isToday ? "today" : ""}`;
      card.id = `day-${dayName}`;

      const daySchedule = data[dayName] || {};
      const items = Object.values(daySchedule);

      // Sắp xếp theo giờ tăng dần
      items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

      const itemCount = items.length;

      // Header của từng ngày
      let cardHtml = `
        <div class="day-header">
          <div class="day-title-wrap">
            <span class="day-title">${dayName}</span>
            ${isToday ? `
              <span class="today-star-tag">
                Hôm nay
              </span>
            ` : ""}
            ${isTomorrow && !isToday ? `
              <span class="today-star-tag" style="background: #0284c7;">
                Ngày mai
              </span>
            ` : ""}
          </div>
          <span class="item-count-badge">${itemCount > 0 ? `${itemCount} hoạt động` : "Trống"}</span>
        </div>
      `;

      // Danh sách các hoạt động / buổi học
      if (itemCount > 0) {
        cardHtml += `<div class="schedule-items-list">`;
        items.forEach(item => {
          const shiftInfo = getTimeShiftInfo(item.time || "");
          const statusInfo = getRealtimeClassStatus(item.time || "", isToday);

          cardHtml += `
            <div class="schedule-item">
              <div class="time-row">
                <span class="shift-badge ${shiftInfo.colorClass}">
                  ${getShiftIconSvg(shiftInfo.icon)}
                  ${escapeHtml(shiftInfo.name)}
                </span>
                <span class="time-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  ${escapeHtml(item.time || "Thời gian linh hoạt")}
                </span>
                ${statusInfo ? `
                  <span class="live-status-tag ${statusInfo.className}">
                    ${statusInfo.text}
                  </span>
                ` : ""}
              </div>

              <!-- TÊN MÔN HỌC -->
              <div class="subject-name-container">
                ${formatSubjectDisplay(item.subject || "")}
              </div>

              <!-- THÔNG TIN PHÒNG HỌC & GHI CHÚ -->
              <div class="meta-container">
                ${item.room ? `
                  <div class="meta-item room">
                    <svg class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <div>
                      <span class="meta-label">Phòng:</span>
                      <span class="meta-value">${formatRoomDisplay(item.room)}</span>
                    </div>
                  </div>
                ` : ""}

                ${item.note ? `
                  <div class="meta-item note">
                    <svg class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <div>
                      <span class="meta-label">Ghi chú:</span>
                      <span class="meta-value">${escapeHtml(item.note)}</span>
                    </div>
                  </div>
                ` : ""}
              </div>
            </div>
          `;
        });
        cardHtml += `</div>`;
      } else {
        cardHtml += `
          <div class="empty-day">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span>${isToday ? "Hôm nay không có lịch học" : "Không có lịch học trong ngày này"}</span>
          </div>
        `;
      }

      card.innerHTML = cardHtml;
      container.appendChild(card);
    });
  }

  // ==========================================
  // 6. KIỂM TRA TỰ ĐỘNG CHUYỂN GIAO THỜI KHÓA BIỂU ĐẦU TUẦN THỨ HAI
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
      console.warn("Không thể kiểm tra tự động chuyển giao tuần:", err);
    });
  }

  checkViewerAutoPromote();

  // ==========================================
  // 7. LẮNG NGHE DỮ LIỆU TỪ FIREBASE REALTIME
  // ==========================================
  db.on("value", (snapshot) => {
    cachedData = snapshot.val() || {};
    renderSchedule(cachedData);
  }, (error) => {
    console.error("Lỗi khi kết nối Firebase:", error);
    if (container) {
      container.innerHTML = `
        <div class="loading-box" style="color: #b91c1c;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p style="font-weight: 700; font-size: 1rem; margin-bottom: 4px;">Không thể tải dữ liệu thời khóa biểu</p>
          <p style="font-size: 0.88rem; color: #64748b;">Vui lòng kiểm tra lại kết nối mạng!</p>
        </div>
      `;
    }
  });

  // Cập nhật trạng thái thời gian thực mỗi 30 giây
  setInterval(() => {
    if (cachedData && Object.keys(cachedData).length > 0) {
      renderSchedule(cachedData);
    }
  }, 30000);

  // ==========================================
  // 7. TIỆN ÍCH ĐỊNH DẠNG
  // ==========================================
  function formatSubjectDisplay(subjectStr) {
    if (!subjectStr) return "";
    const match = subjectStr.match(/^([^\s:]+)\s*:\s*(.+)$/);
    if (match) {
      const code = escapeHtml(match[1]);
      const name = escapeHtml(match[2]);
      return `
        <span class="subject-main-name">${name}</span>
        <span class="subj-code-pill">${code}</span>
      `;
    }
    return `<span class="subject-main-name">${escapeHtml(subjectStr)}</span>`;
  }

  function formatRoomDisplay(roomStr) {
    if (!roomStr) return "";
    const trimmed = roomStr.trim();
    // Bóc tách nếu là định dạng F4.5
    const match = trimmed.match(/^([ABCEF])(\d{1,2})\.(\d{1,2})$/i);
    if (match) {
      const bld = match[1].toUpperCase();
      return `${escapeHtml(trimmed)} (Tòa ${bld})`;
    }
    return escapeHtml(trimmed);
  }

  function getShiftIconSvg(type) {
    if (type === "sun") {
      return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
        </svg>
      `;
    } else if (type === "cloud-sun") {
      return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v2"></path>
          <path d="M4.93 4.93l1.41 1.41"></path>
          <path d="M20 12h2"></path>
          <path d="M15.95 9.05a5 5 0 0 0-7.9 4.95A6 6 0 1 0 18 19h1a4 4 0 0 0 0-8c-.35 0-.68.05-1 .13"></path>
        </svg>
      `;
    } else {
      return `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
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
});
