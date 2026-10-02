/**
 * app.js - Logic hiển thị Lịch Học & Hoạt Động Của Con (Trang chính dành cho mẹ)
 * Thiết kế ấm cúng, trực quan, hỗ trợ chữ lớn, ca học rõ ràng, KHÔNG NEON
 */

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("schedule-container");
  const liveClockEl = document.getElementById("live-clock");
  const liveDateEl = document.getElementById("live-date");
  const filterTabsContainer = document.getElementById("filter-tabs");
  const todayFocusTitle = document.getElementById("today-focus-title");
  const todayFocusDesc = document.getElementById("today-focus-desc");

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
  // 1. CHẾ ĐỘ PHÓNG TO CHỮ CHO MẸ (LƯU VÀO MÁY)
  // ==========================================
  function initTextSizeMode() {
    const isLarge = localStorage.getItem("mom_text_size") === "large";
    if (isLarge) {
      document.body.classList.add("large-text-mode");
      updateTextSizeButtonUI(true);
    }
  }

  window.toggleTextSize = function() {
    const isLarge = document.body.classList.toggle("large-text-mode");
    localStorage.setItem("mom_text_size", isLarge ? "large" : "normal");
    updateTextSizeButtonUI(isLarge);
  };

  function updateTextSizeButtonUI(isLarge) {
    const btn = document.getElementById("btn-text-size");
    const label = document.getElementById("text-size-label");
    if (!btn || !label) return;

    if (isLarge) {
      btn.classList.add("active");
      label.textContent = "Chữ vừa";
      btn.title = "Nhấn để về lại cỡ chữ bình thường";
    } else {
      btn.classList.remove("active");
      label.textContent = "Chữ Lớn";
      btn.title = "Nhấn để phóng to chữ dễ đọc hơn";
    }
  }

  initTextSizeMode();

  // ==========================================
  // 2. ĐỒNG HỒ & NGÀY THÁNG TIẾNG VIỆT TO RÕ
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

    // Cập nhật ngày tháng năm tiếng Việt đầy đủ, rõ ràng
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const dayName = DAY_MAP[d.getDay()];

    if (liveDateEl) {
      liveDateEl.textContent = `${dayName}, ngày ${day}/${month}/${year}`;
    }
  }

  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // ==========================================
  // 3. KHỞI TẠO CÁC NÚT CHỌN NGÀY SIÊU TO RÕ
  // ==========================================
  function setupFilterTabs() {
    if (!filterTabsContainer) return;
    filterTabsContainer.innerHTML = "";

    const tabs = [
      { id: "all", label: "📖 Cả tuần (Tất cả)" },
      { id: "today", label: `⭐ Hôm nay (${currentDayName})`, isToday: true },
      { id: "tomorrow", label: `📅 Ngày mai (${tomorrowDayName})` },
      ...DAYS_OF_WEEK.map(d => ({ id: d, label: d }))
    ];

    tabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tab-btn ${currentFilter === tab.id ? "active" : ""} ${tab.isToday ? "tab-today" : ""}`;
      btn.innerHTML = escapeHtml(tab.label);

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
        text: "🟢 Đang trong giờ học",
        className: "status-current"
      };
    } else if (currentM < startM) {
      const diff = startM - currentM;
      if (diff <= 60) {
        return {
          text: `⏳ Sắp học (còn ${diff} phút)`,
          className: "status-upcoming"
        };
      } else {
        return {
          text: "⏳ Sắp học",
          className: "status-upcoming"
        };
      }
    } else {
      return {
        text: "✔️ Đã học xong",
        className: "status-finished"
      };
    }
  }

  // ==========================================
  // 5. CẬP NHẬT BANNER TÓM TẮT HÔM NAY DÀNH CHO MẸ
  // ==========================================
  function updateTodayFocusBanner(data) {
    if (!todayFocusTitle || !todayFocusDesc) return;

    const todayItemsObj = data[currentDayName] || {};
    const items = Object.values(todayItemsObj);
    items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    if (items.length === 0) {
      todayFocusTitle.innerHTML = `Hôm nay con được nghỉ học ở nhà ❤️`;
      todayFocusDesc.innerHTML = `Mẹ yên tâm nhé, hôm nay con không có lịch học ở trường!`;
    } else {
      todayFocusTitle.innerHTML = `Hôm nay (${currentDayName}) con có ${items.length} buổi học:`;
      const summaries = items.map(it => {
        const shift = getTimeShiftInfo(it.time);
        const subjName = cleanSubjectName(it.subject);
        const roomTxt = it.room ? ` (Phòng ${escapeHtml(it.room)})` : "";
        return `<strong>${shift.name}</strong>: ${subjName}${roomTxt}`;
      });
      todayFocusDesc.innerHTML = summaries.join(" &bull; ");
    }
  }

  function cleanSubjectName(subjStr) {
    if (!subjStr) return "Môn học";
    const match = subjStr.match(/^([^\s:]+)\s*:\s*(.+)$/);
    if (match) return escapeHtml(match[2]);
    return escapeHtml(subjStr);
  }

  // ==========================================
  // 6. RENDER GIAO DIỆN LỊCH HỌC DÀNH CHO MẸ
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

      // Sắp xếp theo giờ tăng dần (e.g. 06:30 trước 12:30)
      items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

      const itemCount = items.length;

      // Header của từng ngày
      let cardHtml = `
        <div class="day-header">
          <div class="day-title-wrap">
            <span class="day-title">${dayName}</span>
            ${isToday ? `
              <span class="today-star-tag">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                HÔM NAY CỦA CON
              </span>
            ` : ""}
            ${isTomorrow && !isToday ? `
              <span class="today-star-tag" style="background: #0284c7;">
                NGÀY MAI
              </span>
            ` : ""}
          </div>
          <span class="item-count-badge">${itemCount > 0 ? `${itemCount} buổi học` : "Nghỉ học"}</span>
        </div>
      `;

      // Danh sách các buổi học
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
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  ${escapeHtml(item.time || "Giờ linh hoạt")}
                </span>
                ${statusInfo ? `
                  <span class="live-status-tag ${statusInfo.className}">
                    ${statusInfo.text}
                  </span>
                ` : ""}
              </div>

              <!-- TÊN MÔN HỌC RÕ RÀNG -->
              <div class="subject-name-container">
                ${formatSubjectDisplay(item.subject || "")}
              </div>

              <!-- THÔNG TIN PHÒNG HỌC & LƯU Ý -->
              <div class="meta-container">
                ${item.room ? `
                  <div class="meta-item room">
                    <svg class="meta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <div>
                      <span class="meta-label">Phòng học:</span>
                      <span class="meta-value">${formatRoomDisplay(item.room)}</span>
                    </div>
                  </div>
                ` : ""}

                ${item.note ? `
                  <div class="meta-item note">
                    <svg class="meta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <div>
                      <span class="meta-label">Dặn dò của con:</span>
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
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>${isToday ? "Hôm nay con được nghỉ học ở nhà với mẹ ❤️" : "Ngày này con không có lịch học ở trường"}</span>
          </div>
        `;
      }

      card.innerHTML = cardHtml;
      container.appendChild(card);
    });
  }

  // ==========================================
  // 7. LẮNG NGHE DỮ LIỆU TỪ FIREBASE REALTIME
  // ==========================================
  db.on("value", (snapshot) => {
    cachedData = snapshot.val() || {};
    updateTodayFocusBanner(cachedData);
    renderSchedule(cachedData);
  }, (error) => {
    console.error("Lỗi khi kết nối Firebase:", error);
    if (container) {
      container.innerHTML = `
        <div class="loading-box" style="color: #b91c1c;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p style="font-weight: 700; font-size: 1.1rem; margin-bottom: 4px;">Chưa tải được lịch học của con</p>
          <p style="font-size: 0.95rem; color: #64748b;">Mẹ kiểm tra lại kết nối mạng wifi/4G trên máy giúp con nhé!</p>
        </div>
      `;
    }
  });

  // Cập nhật trạng thái thời gian thực mỗi 30 giây
  setInterval(() => {
    if (cachedData && Object.keys(cachedData).length > 0) {
      renderSchedule(cachedData);
      updateTodayFocusBanner(cachedData);
    }
  }, 30000);

  // ==========================================
  // 8. TIỆN ÍCH HIỂN THỊ ĐỊNH DẠNG DỄ HIỂU
  // ==========================================
  function formatSubjectDisplay(subjectStr) {
    if (!subjectStr) return "";
    const match = subjectStr.match(/^([^\s:]+)\s*:\s*(.+)$/);
    if (match) {
      const code = escapeHtml(match[1]);
      const name = escapeHtml(match[2]);
      return `
        <span class="subject-main-name">${name}</span>
        <span class="subj-code-pill">Mã: ${code}</span>
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
      return `Phòng ${escapeHtml(trimmed)} (Tòa ${bld})`;
    }
    return escapeHtml(trimmed);
  }

  function getShiftIconSvg(type) {
    if (type === "sun") {
      return `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    } else if (type === "cloud-sun") {
      return `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v2"></path>
          <path d="M4.93 4.93l1.41 1.41"></path>
          <path d="M20 12h2"></path>
          <path d="M19.07 4.93l-1.41 1.41"></path>
          <path d="M15.95 9.05a5 5 0 0 0-7.9 4.95A6 6 0 1 0 18 19h1a4 4 0 0 0 0-8c-.35 0-.68.05-1 .13"></path>
        </svg>
      `;
    } else {
      return `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
