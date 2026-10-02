/**
 * app.js - Logic hiển thị Lịch Học & Hoạt Động (Trang chính)
 * Thiết kế thân thiện cho ba mẹ: 100% SVG, hiển thị chữ "Phòng:" rõ ràng, không neon
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

  // Biến lưu trữ dữ liệu Firebase tải về
  let cachedData = {};
  let currentFilter = "all"; // 'all' hoặc tên ngày cụ thể hoặc 'today'

  // ==========================================
  // 1. Đồng hồ thời gian thực & ngày tháng tiếng Việt
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
      liveDateEl.textContent = `${dayName}, ngày ${day}/${month}/${year}`;
    }
  }

  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // ==========================================
  // 2. Khởi tạo các nút lọc (Tất cả / Hôm nay / Từng thứ)
  // ==========================================
  function setupFilterTabs() {
    if (!filterTabsContainer) return;

    filterTabsContainer.innerHTML = "";

    const tabs = [
      { id: "all", label: "Tất cả các ngày" },
      { id: "today", label: `Hôm nay (${currentDayName})` },
      ...DAYS_OF_WEEK.map(d => ({ id: d, label: d }))
    ];

    tabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tab-btn ${currentFilter === tab.id ? "active" : ""}`;
      btn.textContent = tab.label;
      btn.onclick = () => {
        currentFilter = tab.id;
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderSchedule(cachedData);

        // Nếu lọc theo ngày cụ thể, cuộn mượt đến ngày đó
        if (tab.id !== "all") {
          const targetId = tab.id === "today" ? `day-${currentDayName}` : `day-${tab.id}`;
          const el = document.getElementById(targetId);
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
  // 3. Render giao diện danh sách lịch học (100% SVG)
  // ==========================================
  function renderSchedule(data) {
    if (!container) return;
    container.innerHTML = "";

    // Lọc danh sách ngày cần hiển thị
    let daysToRender = DAYS_OF_WEEK;
    if (currentFilter === "today") {
      daysToRender = [currentDayName];
    } else if (currentFilter !== "all") {
      daysToRender = [currentFilter];
    }

    daysToRender.forEach(dayName => {
      const isToday = (dayName === currentDayName);
      const card = document.createElement("div");
      card.className = `day-card ${isToday ? "today" : ""}`;
      card.id = `day-${dayName}`;

      const daySchedule = data[dayName] || {};
      const items = Object.values(daySchedule);

      // Sắp xếp theo giờ tăng dần (e.g. 07:00 trước 13:00)
      items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

      const itemCount = items.length;

      // Header của từng ngày
      let cardHtml = `
        <div class="day-header">
          <div class="day-title-wrap">
            <span class="day-title">${dayName}</span>
            ${isToday ? `
              <span class="today-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Hôm nay
              </span>
            ` : ""}
          </div>
          <span class="item-count-badge">${itemCount > 0 ? `${itemCount} hoạt động` : "Nghỉ"}</span>
        </div>
      `;

      // Nội dung các tiết học
      if (itemCount > 0) {
        cardHtml += `<div class="schedule-items-list">`;
        items.forEach(item => {
          cardHtml += `
            <div class="schedule-item">
              <div class="time-row">
                <span class="time-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  ${escapeHtml(item.time || "Thời gian linh hoạt")}
                </span>
              </div>
              <div class="subject-name">${escapeHtml(item.subject || "")}</div>
              <div class="meta-container">
                ${item.room ? `
                  <div class="meta-item room">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span class="meta-label">Phòng:</span>
                    <span class="meta-value">${escapeHtml(item.room)}</span>
                  </div>
                ` : ""}
                ${item.note ? `
                  <div class="meta-item note">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <span class="meta-label">Lưu ý:</span>
                    <span class="meta-value">${escapeHtml(item.note)}</span>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            <span>${isToday ? "Hôm nay con được nghỉ • Không có lịch học" : "Ngày này không có lịch học"}</span>
          </div>
        `;
      }

      card.innerHTML = cardHtml;
      container.appendChild(card);
    });
  }

  // ==========================================
  // 4. Lắng nghe dữ liệu thời gian thực từ Firebase
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
          <p>Không thể tải dữ liệu lịch học. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau!</p>
        </div>
      `;
    }
  });

  // Tiện ích escape chuỗi để tránh XSS
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
