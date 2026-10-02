/**
 * admin.js - Quản lý thêm / sửa / xóa lịch học
 * Mã PIN mặc định: 132008
 */

// Biến trạng thái chỉnh sửa
let isEditing = false;
let currentEditDay = null;
let currentEditId = null;

// Chế độ quản trị: 'current' (Tuần Này - Đang Dùng) hoặc 'next' (Tuần Sau - Nhập Trước)
let currentScheduleMode = "current";

// Biến bộ lọc danh sách theo thứ trong admin
let adminFilterDay = "all";

// Lưu trữ dữ liệu từ Firebase
let allScheduleData = {
  current: {},
  next: {}
};
let scheduleMeta = {};

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
  // 2. BỘ CHỌN THỜI GIAN KIỂU IPHONE (IOS WHEEL PICKER) - SIÊU MƯỢT
  // ==========================================
  let startTime = "06:30";
  let endTime = "11:00";
  let tempStartTime = "06:30";
  let tempEndTime = "11:00";
  let pickerTarget = "start"; // 'start' (Từ) hoặc 'end' (Đến)
  let wheelsInitialized = false;

  const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  // Bước nhảy 5 phút, không số lẻ: 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
  const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
  const ITEM_HEIGHT = 44;

  // Hiệu ứng pulse sáng lên cho 2 khung thời gian
  function triggerTimeBoxPulse() {
    const boxStart = document.getElementById("time-box-start");
    const boxEnd = document.getElementById("time-box-end");
    [boxStart, boxEnd].forEach(box => {
      if (box) {
        box.classList.remove("time-box-pulse");
        void box.offsetWidth;
        box.classList.add("time-box-pulse");
      }
    });
  }

  // Đồng bộ trạng thái active của các nút chọn nhanh ca học
  function syncTimePresetChips() {
    const currentStr = `${startTime} - ${endTime}`;
    const chips = document.querySelectorAll(".time-presets .preset-chip");
    chips.forEach(chip => {
      const timeData = chip.getAttribute("data-time") || "";
      if (timeData === currentStr) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });
  }

  // Đồng bộ giao diện 2 khung Từ - Đến và input ẩn
  function syncTimeUI() {
    const displayStart = document.getElementById("display-time-start");
    const displayEnd = document.getElementById("display-time-end");
    const timeVal = document.getElementById("time-val");

    if (displayStart) displayStart.textContent = startTime;
    if (displayEnd) displayEnd.textContent = endTime;
    if (timeVal) timeVal.value = `${startTime} - ${endTime}`;

    syncTimePresetChips();
  }

  // Chuẩn hóa và bóc tách chuỗi thời gian
  function parseTimeStr(timeStr) {
    if (!timeStr) return { start: "06:30", end: "11:00" };
    const parts = timeStr.split("-").map(s => s.trim());
    let s = parts[0] || "06:30";
    let e = parts[1] || "";

    s = normalizeTimeSegment(s, "06:30");
    if (!e) {
      e = "11:00";
    } else {
      e = normalizeTimeSegment(e, "11:00");
    }
    return { start: s, end: e };
  }

  function normalizeTimeSegment(str, fallback) {
    const match = str.match(/^(\d{1,2})[:hH](\d{1,2})$/);
    if (!match) return fallback;
    let h = parseInt(match[1], 10);
    let m = parseInt(match[2], 10);
    if (isNaN(h) || h < 0 || h > 23) h = 6;
    // Làm tròn phút về bội số gần nhất của 5 (0, 5, 10, 15... không lẻ)
    m = Math.round(m / 5) * 5;
    if (m >= 60) m = 55;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // Haptic feedback nhẹ nhàng khi xoay nấc (rung 8ms)
  function triggerHaptic() {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch (e) {}
    }
  }

  // Khởi tạo các cột bánh xe (chỉ tạo 1 lần)
  function initWheels() {
    if (wheelsInitialized) return;
    const hourCol = document.getElementById("wheel-col-hour");
    const minCol = document.getElementById("wheel-col-minute");
    if (!hourCol || !minCol) return;

    hourCol.innerHTML = "";
    minCol.innerHTML = "";

    HOURS.forEach((h, idx) => {
      const el = document.createElement("div");
      el.className = "ios-wheel-item";
      el.textContent = h;
      el.dataset.index = idx;
      hourCol.appendChild(el);
    });

    MINUTES.forEach((m, idx) => {
      const el = document.createElement("div");
      el.className = "ios-wheel-item";
      el.textContent = m;
      el.dataset.index = idx;
      minCol.appendChild(el);
    });

    enableWheelTouchPhysics(hourCol, "hour");
    enableWheelTouchPhysics(minCol, "minute");

    wheelsInitialized = true;
  }

  // Cập nhật class selected thông minh - CHỈ cập nhật khi index thực sự thay đổi!
  function updateSelectedClasses(col, activeIndex) {
    if (col._lastSelectedIdx === activeIndex) return;
    col._lastSelectedIdx = activeIndex;

    const items = col.children;
    for (let i = 0; i < items.length; i++) {
      if (i === activeIndex) {
        items[i].classList.add("selected");
      } else {
        items[i].classList.remove("selected");
      }
    }
  }

  // Animation cuộn mượt mà với gia tốc EaseOutCubic chuẩn xác
  function animateScrollTo(col, targetTop, duration = 200, onComplete) {
    cancelAnimationFrame(col._raf);
    const startTop = col.scrollTop;
    const distance = targetTop - startTop;

    if (Math.abs(distance) < 0.5) {
      col.scrollTop = targetTop;
      if (onComplete) onComplete();
      return;
    }

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // EaseOutCubic: Hãm phanh êm ái, không giật khựng
      const ease = 1 - Math.pow(1 - progress, 3);
      col.scrollTop = startTop + distance * ease;

      const itemsCount = (col.id === "wheel-col-hour") ? HOURS.length : MINUTES.length;
      const curIdx = Math.max(0, Math.min(itemsCount - 1, Math.round(col.scrollTop / ITEM_HEIGHT)));
      updateSelectedClasses(col, curIdx);

      if (progress < 1) {
        col._raf = requestAnimationFrame(step);
      } else {
        col.scrollTop = targetTop;
        updateSelectedClasses(col, Math.round(targetTop / ITEM_HEIGHT));
        if (onComplete) onComplete();
      }
    }

    col._raf = requestAnimationFrame(step);
  }

  function scrollToIndex(col, idx, type, duration = 200) {
    const itemsCount = (type === "hour") ? HOURS.length : MINUTES.length;
    idx = Math.max(0, Math.min(itemsCount - 1, idx));
    const targetScroll = idx * ITEM_HEIGHT;

    updateSelectedClasses(col, idx);
    const val = (type === "hour") ? HOURS[idx] : MINUTES[idx];
    onWheelValueChanged(type, val);

    animateScrollTo(col, targetScroll, duration, () => {
      col.style.scrollSnapType = "y mandatory";
    });
  }

  function onWheelValueChanged(type, val) {
    const curVal = (pickerTarget === "start") ? tempStartTime : tempEndTime;
    const parts = curVal.split(":");
    let h = parts[0] || "06";
    let m = parts[1] || "30";

    if (type === "hour") {
      h = val;
    } else {
      m = val;
    }

    const newTime = `${h}:${m}`;
    if (pickerTarget === "start") {
      tempStartTime = newTime;
      const segStart = document.getElementById("segment-val-start");
      if (segStart) segStart.textContent = tempStartTime;
    } else {
      tempEndTime = newTime;
      const segEnd = document.getElementById("segment-val-end");
      if (segEnd) segEnd.textContent = tempEndTime;
    }
  }

  // ==========================================
  // HỆ THỐNG VẬT LÝ KÉO VUỐT CHO CẢ MOBILE & DESKTOP (SIÊU MƯỢT, KHÔNG BAY BAY, KHÔNG KHỰNG)
  // ==========================================
  function enableWheelTouchPhysics(col, type) {
    const itemsCount = (type === "hour") ? HOURS.length : MINUTES.length;
    let isDown = false;
    let startY = 0;
    let startScroll = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let hasMoved = false;

    function onPointerDown(e) {
      cancelAnimationFrame(col._raf);

      isDown = true;
      hasMoved = false;
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      startY = clientY;
      lastY = clientY;
      startScroll = col.scrollTop;
      lastTime = performance.now();
      velocity = 0;

      col.style.cursor = "grabbing";
      col.style.scrollSnapType = "none"; // Tạm ngắt snap để không bị khựng giật

      if (e.pointerId && col.setPointerCapture) {
        try { col.setPointerCapture(e.pointerId); } catch(err) {}
      }
    }

    function onPointerMove(e) {
      if (!isDown) return;
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const dy = clientY - startY;

      if (Math.abs(dy) > 3) {
        hasMoved = true;
      }

      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 8) {
        velocity = (lastY - clientY) / dt;
        lastY = clientY;
        lastTime = now;
      }

      let newScroll = startScroll - dy;
      const maxScroll = (itemsCount - 1) * ITEM_HEIGHT;

      // Cản lực đàn hồi nếu kéo vượt biên
      if (newScroll < 0) {
        newScroll = newScroll * 0.35;
      } else if (newScroll > maxScroll) {
        newScroll = maxScroll + (newScroll - maxScroll) * 0.35;
      }

      col.scrollTop = newScroll;

      // Cập nhật vị trí và rung haptic khi trúng nấc
      const liveIdx = Math.max(0, Math.min(itemsCount - 1, Math.round(newScroll / ITEM_HEIGHT)));
      if (liveIdx !== col._currentLiveIdx) {
        col._currentLiveIdx = liveIdx;
        updateSelectedClasses(col, liveIdx);
        triggerHaptic();
        const val = (type === "hour") ? HOURS[liveIdx] : MINUTES[liveIdx];
        onWheelValueChanged(type, val);
      }
    }

    function onPointerUp(e) {
      if (!isDown) return;
      isDown = false;
      col.style.cursor = "grab";

      if (e.pointerId && col.releasePointerCapture) {
        try { col.releasePointerCapture(e.pointerId); } catch(err) {}
      }

      // 1. Nếu chỉ chạm (tap)
      if (!hasMoved) {
        const rect = col.getBoundingClientRect();
        const clientY = e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : lastY);
        const tapY = clientY - rect.top;
        const distFromCenter = tapY - 110; // Kính lúp ở giữa tại 110px
        const step = Math.round(distFromCenter / ITEM_HEIGHT);
        const curIdx = Math.max(0, Math.min(itemsCount - 1, Math.round(col.scrollTop / ITEM_HEIGHT)));
        const targetIdx = Math.max(0, Math.min(itemsCount - 1, curIdx + step));
        scrollToIndex(col, targetIdx, type);
        triggerHaptic();
        return;
      }

      // 2. Nếu có vuốt: Khống chế quán tính tối đa 4 nấc để không bay mất kiểm soát
      const maxAdvance = 4;
      let stepAdvance = Math.round(velocity * 7.5);
      stepAdvance = Math.max(-maxAdvance, Math.min(maxAdvance, stepAdvance));

      const curIdx = Math.max(0, Math.min(itemsCount - 1, Math.round(col.scrollTop / ITEM_HEIGHT)));
      const targetIdx = Math.max(0, Math.min(itemsCount - 1, curIdx + stepAdvance));

      scrollToIndex(col, targetIdx, type);
      triggerHaptic();
    }

    if (window.PointerEvent) {
      col.addEventListener("pointerdown", onPointerDown, { passive: true });
      col.addEventListener("pointermove", onPointerMove, { passive: true });
      col.addEventListener("pointerup", onPointerUp, { passive: true });
      col.addEventListener("pointercancel", onPointerUp, { passive: true });
    } else {
      col.addEventListener("touchstart", onPointerDown, { passive: true });
      col.addEventListener("touchmove", onPointerMove, { passive: true });
      col.addEventListener("touchend", onPointerUp, { passive: true });
      col.addEventListener("touchcancel", onPointerUp, { passive: true });
      col.addEventListener("mousedown", onPointerDown);
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);
    }
  }

  // Tăng giảm 1 nấc bằng nút bấm (+ / -)
  window.stepPickerTime = function(type, step) {
    const col = (type === "hour") ? document.getElementById("wheel-col-hour") : document.getElementById("wheel-col-minute");
    if (!col) return;
    const itemsCount = (type === "hour") ? HOURS.length : MINUTES.length;
    const curIdx = Math.max(0, Math.min(itemsCount - 1, Math.round(col.scrollTop / ITEM_HEIGHT)));
    const targetIdx = Math.max(0, Math.min(itemsCount - 1, curIdx + step));
    scrollToIndex(col, targetIdx, type);
    triggerHaptic();
  };

  // Chọn nhanh giờ
  window.setQuickHour = function(hourStr) {
    initWheels();
    const hourCol = document.getElementById("wheel-col-hour");
    const idx = HOURS.indexOf(hourStr);
    if (idx !== -1 && hourCol) {
      scrollToIndex(hourCol, idx, "hour");
      triggerHaptic();
    }
  };

  // Đặt vị trí 2 bánh xe theo giờ & phút
  function setWheelsToTime(timeStr, smooth = false) {
    initWheels();
    const [h, m] = (timeStr || "06:30").split(":");
    let hourIndex = HOURS.indexOf(h);
    if (hourIndex === -1) hourIndex = 6;

    let minIndex = MINUTES.indexOf(m);
    if (minIndex === -1) {
      const mNum = parseInt(m, 10) || 0;
      const roundedM = String(Math.round(mNum / 5) * 5).padStart(2, "0");
      minIndex = MINUTES.indexOf(roundedM);
      if (minIndex === -1) minIndex = 6;
    }

    const hourCol = document.getElementById("wheel-col-hour");
    const minCol = document.getElementById("wheel-col-minute");

    if (hourCol) {
      scrollToIndex(hourCol, hourIndex, "hour", smooth ? 250 : 0);
    }
    if (minCol) {
      scrollToIndex(minCol, minIndex, "minute", smooth ? 250 : 0);
    }
  }

  // Mở modal xoay chọn thời gian
  window.openTimePickerModal = function(target = "start") {
    initWheels();
    pickerTarget = target;
    tempStartTime = startTime;
    tempEndTime = endTime;

    const modal = document.getElementById("ios-time-modal-backdrop");
    if (!modal) return;

    modal.classList.add("show");
    document.body.style.overflow = "hidden";

    updatePickerModalUI();
  };

  // Chuyển đổi tab TỪ / ĐẾN trong modal
  window.switchPickerTarget = function(target) {
    pickerTarget = target;
    updatePickerModalUI(true);
  };

  function updatePickerModalUI(smooth = false) {
    const title = document.getElementById("ios-picker-title");
    const tabStart = document.getElementById("tab-start");
    const tabEnd = document.getElementById("tab-end");
    const segStart = document.getElementById("segment-val-start");
    const segEnd = document.getElementById("segment-val-end");

    if (segStart) segStart.textContent = tempStartTime;
    if (segEnd) segEnd.textContent = tempEndTime;

    if (pickerTarget === "start") {
      if (title) title.textContent = "Chỉnh Giờ Bắt Đầu (Từ)";
      if (tabStart) tabStart.classList.add("active");
      if (tabEnd) tabEnd.classList.remove("active");
      setWheelsToTime(tempStartTime, smooth);
    } else {
      if (title) title.textContent = "Chỉnh Giờ Kết Thúc (Đến)";
      if (tabStart) tabStart.classList.remove("active");
      if (tabEnd) tabEnd.classList.add("active");
      setWheelsToTime(tempEndTime, smooth);
    }
  }

  // Phím chọn nhanh phút (:00, :15, :30, :45)
  window.setQuickMinute = function(minStr) {
    initWheels();
    const minCol = document.getElementById("wheel-col-minute");
    const idx = MINUTES.indexOf(minStr);
    if (idx !== -1 && minCol) {
      scrollToIndex(minCol, idx, "minute", 250);
      triggerHaptic();
    }
  };

  // Chọn nhanh ca học ngay bên trong Modal
  window.applyModalPreset = function(start, end) {
    tempStartTime = start;
    tempEndTime = end;
    updatePickerModalUI(true);
    showToast(`Đã chọn: ${start} - ${end}`, "normal");
  };

  // Đóng modal (Lưu hoặc Hủy)
  window.closeTimePickerModal = function(apply = true) {
    const modal = document.getElementById("ios-time-modal-backdrop");
    if (modal) modal.classList.remove("show");
    document.body.style.overflow = "";

    if (apply) {
      startTime = tempStartTime;
      endTime = tempEndTime;
      syncTimeUI();
      triggerTimeBoxPulse();
      showToast(`Đã cập nhật giờ: ${startTime} - ${endTime}`, "success");
    }
  };

  // Nhấn vào vùng tối bên ngoài modal để đóng và lưu
  window.handleBackdropClick = function(e) {
    if (e.target.id === "ios-time-modal-backdrop") {
      closeTimePickerModal(true);
    }
  };

  // Bắt phím Escape để đóng modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("ios-time-modal-backdrop");
      if (modal && modal.classList.contains("show")) {
        closeTimePickerModal(false);
      }
    }
  });

  // Thiết lập các nút chọn nhanh giờ học ngoài form
  window.setQuickTime = function(timeStr) {
    const parsed = parseTimeStr(timeStr);
    startTime = parsed.start;
    endTime = parsed.end;
    syncTimeUI();
    triggerTimeBoxPulse();
    showToast(`Đã chọn ca: ${startTime} - ${endTime}`, "normal");
  };

  // Đồng bộ UI ban đầu
  syncTimeUI();

  // ==========================================
  // 2B. GỢI Ý CHỌN NHANH MÔN HỌC (HIỆU ỨNG HIỆN ĐẠI)
  // ==========================================
  const QUICK_SUBJECTS = [
    { code: "ATĐ", name: "An toàn điện", theme: "amber", desc: "An toàn lao động & điện" },
    { code: "ĐTCB", name: "Điện tử cơ bản", theme: "blue", desc: "Linh kiện & mạch điện tử" },
    { code: "ĐCB", name: "Điện cơ bản", theme: "cyan", desc: "Nguyên lý điện cơ sở" },
    { code: "QS", name: "Giáo dục quốc phòng và an ninh", theme: "emerald", desc: "Quốc phòng an ninh" },
    { code: "DT", name: "Tuần dự trữ", theme: "slate", desc: "Tuần dự phòng / thi bù" },
    { code: "@1", name: "Thi học kỳ 1", theme: "rose", desc: "Kỳ thi chính thức HK1" },
    { code: "ĐLĐ", name: "Đo lường điện", theme: "purple", desc: "Thiết bị đo & đo lường" },
    { code: "KTXS", name: "Kỹ thuật xung - số", theme: "indigo", desc: "Kỹ thuật xung - số" },
    { code: "IPC", name: "Hàn tay điện tử IPC", theme: "orange", desc: "Kỹ năng hàn chuẩn IPC" },
    { code: "@2", name: "Thi học kỳ 2", theme: "rose", desc: "Kỳ thi chính thức HK2" }
  ];

  let currentSubjectFormat = "code_name";
  try {
    currentSubjectFormat = localStorage.getItem("admin_subject_format") || "code_name";
  } catch (e) {}

  let currentSelectedCode = null;

  function getFormattedSubject(item, format = currentSubjectFormat) {
    if (format === "name_only") return item.name;
    if (format === "code_only") return item.code;
    return `${item.code}: ${item.name}`;
  }

  window.setSubjectFormat = function(format) {
    currentSubjectFormat = format;
    try {
      localStorage.setItem("admin_subject_format", format);
    } catch (e) {}

    // Cập nhật giao diện nút format
    document.querySelectorAll(".subject-format-toggle .format-btn").forEach(btn => {
      if (btn.dataset.format === format) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Nếu đang có môn được chọn, cập nhật lại text trong ô input
    if (currentSelectedCode) {
      const found = QUICK_SUBJECTS.find(s => s.code === currentSelectedCode);
      if (found) {
        const inp = document.getElementById("subject-val");
        if (inp) {
          inp.value = getFormattedSubject(found, format);
          triggerInputGlow(inp);
        }
      }
    }
  };

  function renderQuickSubjectChips() {
    const grid = document.getElementById("subject-chips-grid");
    if (!grid) return;
    grid.innerHTML = "";

    QUICK_SUBJECTS.forEach(subj => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `subj-chip theme-${subj.theme}`;
      chip.dataset.code = subj.code;
      chip.dataset.name = subj.name;
      chip.title = `${subj.code}: ${subj.name} (${subj.desc})`;

      chip.innerHTML = `
        <span class="subj-badge">${escapeHtml(subj.code)}</span>
        <span class="subj-info">
          <span class="subj-name">${escapeHtml(subj.name)}</span>
          <span class="subj-subtext">${escapeHtml(subj.desc)}</span>
        </span>
        <span class="subj-check">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
      `;

      chip.addEventListener("click", (e) => {
        createRipple(e, chip);
        selectQuickSubject(subj, chip);
      });

      grid.appendChild(chip);
    });

    // Đồng bộ nút định dạng ban đầu
    document.querySelectorAll(".subject-format-toggle .format-btn").forEach(btn => {
      if (btn.dataset.format === currentSubjectFormat) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function createRipple(e, el) {
    const rect = el.getBoundingClientRect();
    const circle = document.createElement("span");
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add("subj-ripple");

    const existing = el.querySelector(".subj-ripple");
    if (existing) existing.remove();

    el.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  }

  function triggerInputGlow(inputEl) {
    inputEl.classList.remove("input-pulse-glow");
    void inputEl.offsetWidth; // Force reflow
    inputEl.classList.add("input-pulse-glow");
  }

  // Chế độ chọn môn học: 'single' (chọn 1 môn) hoặc 'multi' (chọn nhiều môn trong ngày)
  let subjectSelectMode = "single";
  let multiSelectedSubjects = [];

  window.setSubjectSelectMode = function(mode) {
    subjectSelectMode = mode;
    const btnSingle = document.getElementById("btn-mode-single");
    const btnMulti = document.getElementById("btn-mode-multi");
    const panel = document.getElementById("multi-subject-panel");

    if (mode === "single") {
      if (btnSingle) btnSingle.classList.add("active");
      if (btnMulti) btnMulti.classList.remove("active");
      multiSelectedSubjects = [];
      if (panel) panel.style.display = "none";
      // Bỏ chọn tất cả chip
      document.querySelectorAll(".subj-chip").forEach(c => c.classList.remove("selected"));
      showToast("Chế độ: Chọn 1 môn", "normal");
    } else {
      if (btnSingle) btnSingle.classList.remove("active");
      if (btnMulti) btnMulti.classList.add("active");
      // Bỏ chọn tất cả chip để bắt đầu chọn nhóm mới
      multiSelectedSubjects = [];
      document.querySelectorAll(".subj-chip").forEach(c => c.classList.remove("selected"));
      if (panel) panel.style.display = "none";
      showToast("Chế độ nhiều môn: Bấm chọn các môn học trong ngày (Ca Sáng + Ca Chiều...)", "normal");
    }
  };

  function selectQuickSubject(subj, chipEl) {
    if (subjectSelectMode === "single") {
      currentSelectedCode = subj.code;
      const inp = document.getElementById("subject-val");
      const formatted = getFormattedSubject(subj, currentSubjectFormat);

      if (inp) {
        inp.value = formatted;
        triggerInputGlow(inp);
        inp.focus();
      }

      document.querySelectorAll(".subj-chip").forEach(c => c.classList.remove("selected"));
      if (chipEl) {
        chipEl.classList.add("selected");
      }

      showToast(`Đã chọn: ${formatted}`, "normal");
    } else {
      // Chế độ chọn nhiều môn (Multi-select)
      const existingIdx = multiSelectedSubjects.findIndex(s => s.code === subj.code);
      if (existingIdx !== -1) {
        // Đã có -> Bỏ chọn
        multiSelectedSubjects.splice(existingIdx, 1);
        if (chipEl) chipEl.classList.remove("selected");
      } else {
        // Chưa có -> Thêm vào
        multiSelectedSubjects.push(subj);
        if (chipEl) chipEl.classList.add("selected");
      }

      renderMultiSubjectPanel();
    }
  }

  // Khung giờ mặc định cho các ca
  const DEFAULT_SHIFT_TIMES = [
    { name: "Ca Sáng", time: "06:30 - 11:00", tagClass: "shift-tag-morning", icon: "☀️" },
    { name: "Ca Chiều", time: "12:30 - 16:30", tagClass: "shift-tag-afternoon", icon: "🌤️" },
    { name: "Ca Tối", time: "18:00 - 20:00", tagClass: "shift-tag-evening", icon: "🌙" }
  ];

  function renderMultiSubjectPanel() {
    const panel = document.getElementById("multi-subject-panel");
    if (!panel) return;

    if (multiSelectedSubjects.length === 0) {
      panel.style.display = "none";
      panel.innerHTML = "";
      return;
    }

    panel.style.display = "block";
    const currentDay = document.getElementById("day-val") ? document.getElementById("day-val").value : "Thứ Hai";
    const currentRoom = document.getElementById("room-val") ? document.getElementById("room-val").value : "";

    let html = `
      <div class="multi-panel-header">
        <span class="multi-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Đã chọn ${multiSelectedSubjects.length} môn cho <strong>${escapeHtml(currentDay)}</strong>:
        </span>
        <span class="multi-panel-hint">Tự động xếp Ca Sáng, Ca Chiều...</span>
      </div>

      <div class="multi-shift-list">
    `;

    multiSelectedSubjects.forEach((subj, idx) => {
      const shiftInfo = DEFAULT_SHIFT_TIMES[idx] || {
        name: `Ca ${idx + 1}`,
        time: idx === 0 ? "06:30 - 11:00" : (idx === 1 ? "12:30 - 16:30" : "18:00 - 20:00"),
        tagClass: "shift-tag-morning",
        icon: "⏰"
      };

      const formattedSubj = getFormattedSubject(subj, currentSubjectFormat);
      const roomVal = currentRoom || "F4.5";

      html += `
        <div class="multi-shift-row" id="multi-row-${idx}">
          <span class="shift-tag-badge ${shiftInfo.tagClass}">${shiftInfo.icon} ${shiftInfo.name}</span>
          <input type="text" class="shift-row-time-input" id="multi-time-${idx}" value="${shiftInfo.time}" title="Khung giờ học">
          <div class="multi-shift-name" title="${escapeHtml(formattedSubj)}">
            <span class="subj-badge" style="display: inline-block; padding: 1px 6px; font-size: 0.72rem; margin-right: 4px;">${escapeHtml(subj.code)}</span>
            <strong>${escapeHtml(subj.name)}</strong>
          </div>
          <input type="text" class="shift-row-room-input" id="multi-room-${idx}" value="${escapeAttr(roomVal)}" placeholder="Phòng..." title="Phòng học">
          <button type="button" class="btn-remove-shift-row" onclick="removeMultiSubjectItem('${subj.code}')" title="Bỏ chọn môn này">✕</button>
        </div>
      `;
    });

    html += `
      </div>

      <div class="multi-panel-actions">
        <button type="button" class="btn-multi-save" onclick="saveMultiShifts()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
          </svg>
          Lưu Cả ${multiSelectedSubjects.length} Ca Này Vào ${escapeHtml(currentDay)}
        </button>

        <button type="button" class="btn-multi-combine" onclick="combineMultiSubjectsToInput()" title="Ghép tất cả các môn đã chọn vào 1 ca học duy nhất">
          Ghép Vào 1 Buổi (${multiSelectedSubjects.map(s => s.code).join(" + ")})
        </button>
      </div>
    `;

    panel.innerHTML = html;
  }

  // Bỏ 1 môn khỏi danh sách đã chọn nhiều
  window.removeMultiSubjectItem = function(code) {
    const idx = multiSelectedSubjects.findIndex(s => s.code === code);
    if (idx !== -1) {
      multiSelectedSubjects.splice(idx, 1);
      document.querySelectorAll(".subj-chip").forEach(c => {
        if (c.dataset.code === code) c.classList.remove("selected");
      });
      renderMultiSubjectPanel();
    }
  };

  // Lưu cùng lúc tất cả các ca học đã chọn vào ngày hiện tại
  window.saveMultiShifts = function() {
    const day = document.getElementById("day-val") ? document.getElementById("day-val").value : "Thứ Hai";
    const targetDb = getTargetDb();
    const modeLabel = currentScheduleMode === "current" ? "Tuần Này" : "Tuần Sau";

    if (multiSelectedSubjects.length === 0) {
      showToast("Chưa chọn môn nào để lưu!", "error");
      return;
    }

    const updates = {};
    multiSelectedSubjects.forEach((subj, idx) => {
      const timeInp = document.getElementById(`multi-time-${idx}`);
      const roomInp = document.getElementById(`multi-room-${idx}`);
      const time = timeInp ? timeInp.value.trim() : (DEFAULT_SHIFT_TIMES[idx] ? DEFAULT_SHIFT_TIMES[idx].time : "06:30 - 11:00");
      const room = roomInp ? roomInp.value.trim() : "";
      const subject = getFormattedSubject(subj, currentSubjectFormat);
      const note = document.getElementById("note-val") ? document.getElementById("note-val").value.trim() : "";

      const newId = "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      updates[`${day}/${newId}`] = { time, subject, room, note };
    });

    targetDb.update(updates).then(() => {
      showToast(`Đã lưu thành công ${multiSelectedSubjects.length} ca học vào ${day} (${modeLabel})!`, "success");
      // Reset panel
      multiSelectedSubjects = [];
      const panel = document.getElementById("multi-subject-panel");
      if (panel) panel.style.display = "none";
      setSubjectSelectMode("single");
      resetForm();
    }).catch(err => {
      showToast("Lỗi khi lưu các ca học: " + err.message, "error");
    });
  };

  // Ghép các môn đã chọn vào ô input Tên môn học
  window.combineMultiSubjectsToInput = function() {
    if (multiSelectedSubjects.length === 0) return;

    const formattedList = multiSelectedSubjects.map(s => getFormattedSubject(s, currentSubjectFormat));
    const combinedStr = formattedList.join(" + ");

    const inp = document.getElementById("subject-val");
    if (inp) {
      inp.value = combinedStr;
      triggerInputGlow(inp);
      inp.focus();
    }

    // Chuyển lại về chế độ 1 môn
    setSubjectSelectMode("single");
    showToast(`Đã ghép ${multiSelectedSubjects.length} môn vào ô Tên môn học!`, "normal");
  };

  // Nút Lưu và Chuyển nhanh sang Ca Tiếp Theo cho cùng ngày
  window.saveAndNextShift = function() {
    const day = document.getElementById("day-val").value;
    const time = document.getElementById("time-val").value.trim();
    const subject = document.getElementById("subject-val").value.trim();
    const room = document.getElementById("room-val").value.trim();
    const note = document.getElementById("note-val").value.trim();

    if (!subject) {
      showToast("Vui lòng chọn hoặc nhập tên môn học trước khi lưu!", "error");
      const inp = document.getElementById("subject-val");
      if (inp) inp.focus();
      return;
    }

    const payload = { time, subject, room, note };
    const targetDb = getTargetDb();
    const modeLabel = currentScheduleMode === "current" ? "Tuần Này" : "Tuần Sau";

    targetDb.child(day).push(payload).then(() => {
      showToast(`Đã lưu môn vào ${day} (${modeLabel})!`, "success");

      // Tự động chuyển giờ sang ca tiếp theo
      const parsed = parseTimeStr(time);
      const btnNextText = document.getElementById("btn-save-next-text");

      if (parsed.start === "06:30" || parsed.start === "07:00") {
        // Vừa lưu Ca Sáng -> Chuyển sang Ca Chiều
        startTime = "12:30";
        endTime = "16:30";
        if (btnNextText) btnNextText.textContent = "+ Lưu & Thêm Tiếp Ca Tối";
        showToast(`Đã lưu Ca Sáng! Mời bạn chọn tiếp môn cho Ca Chiều (${day}).`, "normal");
      } else if (parsed.start === "12:30" || parsed.start === "13:00") {
        // Vừa lưu Ca Chiều -> Chuyển sang Ca Tối
        startTime = "18:00";
        endTime = "20:00";
        if (btnNextText) btnNextText.textContent = "+ Lưu & Thêm Tiếp Môn Khác";
        showToast(`Đã lưu Ca Chiều! Mời bạn chọn tiếp môn cho Ca Tối (${day}).`, "normal");
      } else {
        // Về lại Ca Sáng
        startTime = "06:30";
        endTime = "11:00";
        if (btnNextText) btnNextText.textContent = "+ Lưu & Thêm Tiếp Ca Chiều";
      }

      syncTimeUI();

      // Xóa ô môn học để người dùng chọn môn tiếp theo
      const s = document.getElementById("subject-val");
      if (s) {
        s.value = "";
        s.focus();
      }

      currentSelectedCode = null;
      document.querySelectorAll(".subj-chip").forEach(c => c.classList.remove("selected"));
    }).catch(err => {
      showToast("Lỗi khi lưu: " + err.message, "error");
    });
  };

  function syncChipsWithSubject(subjectText) {
    if (subjectSelectMode === "multi") return;
    currentSelectedCode = null;
    const s = (subjectText || "").trim().toLowerCase();
    document.querySelectorAll(".subj-chip").forEach(c => {
      const code = (c.dataset.code || "").toLowerCase();
      const name = (c.dataset.name || "").toLowerCase();
      if (
        s === name ||
        s === `${code}: ${name}` ||
        s === `${code} - ${name}` ||
        s === code
      ) {
        c.classList.add("selected");
        currentSelectedCode = c.dataset.code;
      } else {
        c.classList.remove("selected");
      }
    });
  }

  // Khởi tạo hiển thị các môn
  renderQuickSubjectChips();

  const subjectInputEl = document.getElementById("subject-val");
  if (subjectInputEl) {
    subjectInputEl.addEventListener("input", () => {
      syncChipsWithSubject(subjectInputEl.value);
    });
  }

  // Lắng nghe khi người dùng đổi Thứ trong ô chọn ngày để cập nhật bảng nhiều môn
  const daySelectEl = document.getElementById("day-val");
  if (daySelectEl) {
    daySelectEl.addEventListener("change", () => {
      if (subjectSelectMode === "multi" && multiSelectedSubjects.length > 0) {
        renderMultiSubjectPanel();
      }
    });
  }

  // ==========================================
  // 2C. BỘ CHỌN PHÒNG HỌC (TÒA A, B, C, E, F • SỐ 1: 0-10 • SỐ 2: 0-20)
  // ==========================================
  let selectedBuilding = "";
  let selectedNum1 = "4";
  let selectedNum2 = "5";

  function initRoomSelector() {
    const sel1 = document.getElementById("room-num1-select");
    const sel2 = document.getElementById("room-num2-select");
    if (!sel1 || !sel2) return;

    sel1.innerHTML = "";
    for (let i = 0; i <= 10; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      if (i === 4) opt.selected = true;
      sel1.appendChild(opt);
    }

    sel2.innerHTML = "";
    for (let i = 0; i <= 20; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      if (i === 5) opt.selected = true;
      sel2.appendChild(opt);
    }

    const roomInput = document.getElementById("room-val");
    if (roomInput) {
      roomInput.addEventListener("input", syncRoomBuilderFromInput);
    }
  }

  window.setRoomBuilding = function(bld) {
    selectedBuilding = bld;
    document.querySelectorAll(".bld-btn").forEach(btn => {
      if (btn.dataset.bld === bld) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    applyRoomFromBuilder();
  };

  window.stepRoomNumber = function(component, step) {
    const sel = document.getElementById(component === 1 ? "room-num1-select" : "room-num2-select");
    if (!sel) return;
    const maxVal = component === 1 ? 10 : 20;
    let cur = parseInt(sel.value, 10) || 0;
    cur = Math.max(0, Math.min(maxVal, cur + step));
    sel.value = String(cur);
    onRoomNumberChange();
  };

  window.onRoomNumberChange = function() {
    const sel1 = document.getElementById("room-num1-select");
    const sel2 = document.getElementById("room-num2-select");
    if (sel1) selectedNum1 = sel1.value;
    if (sel2) selectedNum2 = sel2.value;
    if (!selectedBuilding) {
      selectedBuilding = "F";
      document.querySelectorAll(".bld-btn").forEach(btn => {
        if (btn.dataset.bld === "F") btn.classList.add("active");
        else btn.classList.remove("active");
      });
    }
    applyRoomFromBuilder();
  };

  function applyRoomFromBuilder() {
    if (!selectedBuilding) return;
    const roomInput = document.getElementById("room-val");
    const roomCode = `${selectedBuilding}${selectedNum1}.${selectedNum2}`;
    if (roomInput) {
      roomInput.value = roomCode;
      triggerInputGlow(roomInput);
    }
  }

  window.clearRoomValue = function() {
    const roomInput = document.getElementById("room-val");
    if (roomInput) {
      roomInput.value = "";
      triggerInputGlow(roomInput);
    }
    selectedBuilding = "";
    document.querySelectorAll(".bld-btn").forEach(btn => btn.classList.remove("active"));
    showToast("Đã xóa phòng học", "normal");
  };

  function syncRoomBuilderFromInput() {
    const roomInput = document.getElementById("room-val");
    if (!roomInput) return;
    const val = roomInput.value.trim().toUpperCase();

    if (!val) {
      selectedBuilding = "";
      document.querySelectorAll(".bld-btn").forEach(btn => btn.classList.remove("active"));
      return;
    }

    const match = val.match(/^([ABCEF])(\d{1,2})\.(\d{1,2})$/);
    if (match) {
      const bld = match[1];
      const n1 = parseInt(match[2], 10);
      const n2 = parseInt(match[3], 10);

      if (n1 >= 0 && n1 <= 10 && n2 >= 0 && n2 <= 20) {
        selectedBuilding = bld;
        selectedNum1 = String(n1);
        selectedNum2 = String(n2);

        document.querySelectorAll(".bld-btn").forEach(btn => {
          if (btn.dataset.bld === bld) {
            btn.classList.add("active");
          } else {
            btn.classList.remove("active");
          }
        });

        const sel1 = document.getElementById("room-num1-select");
        const sel2 = document.getElementById("room-num2-select");
        if (sel1) sel1.value = selectedNum1;
        if (sel2) sel2.value = selectedNum2;
      }
    } else {
      selectedBuilding = "";
      document.querySelectorAll(".bld-btn").forEach(btn => btn.classList.remove("active"));
    }
  }

  initRoomSelector();

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
  // 4. CHUYỂN ĐỔI CHẾ ĐỘ & BẬT/TẮT BẢNG NHẬP
  // ==========================================
  function getTargetDb() {
    return currentScheduleMode === "current" ? db : dbNext;
  }

  // Bật / tắt bảng form nhập tiết học
  window.toggleFormCard = function(forceState) {
    const formCard = document.getElementById("form-card");
    const btnText = document.getElementById("btn-toggle-form-text");
    if (!formCard) return;

    const willOpen = (typeof forceState === "boolean")
      ? forceState
      : (formCard.style.display === "none" || !formCard.style.display);

    if (willOpen) {
      formCard.style.display = "block";
      if (btnText) btnText.textContent = "Đóng Bảng Nhập";
      formCard.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        const inp = document.getElementById("subject-val");
        if (inp) inp.focus();
      }, 150);
    } else {
      formCard.style.display = "none";
      if (btnText) btnText.textContent = "Thêm Tiết Học Mới";
      if (isEditing) {
        resetForm();
      }
    }
  };

  // Chuyển đổi giữa 'current' (Tuần Này) và 'next' (Tuần Sau)
  window.switchScheduleMode = function(mode) {
    currentScheduleMode = mode;

    const tabCurrent = document.getElementById("tab-mode-current");
    const tabNext = document.getElementById("tab-mode-next");
    const banner = document.getElementById("mode-context-banner");
    const bannerText = document.getElementById("context-banner-text");
    const btnApplyNextNow = document.getElementById("btn-apply-next-now");
    const btnCopyToNext = document.getElementById("btn-copy-to-next");
    const listTitle = document.getElementById("list-card-title");

    if (mode === "current") {
      if (tabCurrent) tabCurrent.classList.add("active");
      if (tabNext) tabNext.classList.remove("active");

      if (banner) banner.classList.remove("mode-next-active");
      if (bannerText) {
        bannerText.innerHTML = `Bạn đang xem và chỉnh sửa <strong>Lịch Học Tuần Này</strong> (Đang áp dụng trực tiếp).`;
      }

      if (btnApplyNextNow) btnApplyNextNow.style.display = "none";
      if (btnCopyToNext) btnCopyToNext.style.display = "inline-flex";
      if (listTitle) listTitle.textContent = "Danh Sách Môn Học (Tuần Này)";
    } else {
      if (tabCurrent) tabCurrent.classList.remove("active");
      if (tabNext) tabNext.classList.add("active");

      if (banner) banner.classList.add("mode-next-active");
      if (bannerText) {
        bannerText.innerHTML = `Bạn đang soạn <strong>Lịch Tuần Sau</strong> (Sẽ tự động chuyển dùng vào lúc <strong>00:00 Thứ Hai tới</strong> hoặc bấm nút áp dụng ngay bên dưới).`;
      }

      if (btnApplyNextNow) btnApplyNextNow.style.display = "inline-flex";
      if (btnCopyToNext) btnCopyToNext.style.display = "none";
      if (listTitle) listTitle.textContent = "Danh Sách Môn Học (Tuần Sau - Nhập Trước)";
    }

    if (isEditing) {
      resetForm();
    }

    renderAdminItems();
  };

  // ==========================================
  // 5. CƠ CHẾ TỰ ĐỘNG KÍCH HOẠT VÀO ĐẦU TUẦN THỨ HAI
  // ==========================================
  function getISOWeekKey(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  function checkAndAutoPromoteMonday() {
    const currentWeekKey = getISOWeekKey();
    if (!scheduleMeta || typeof scheduleMeta !== "object") return;

    // Nếu chưa từng có lastPromotedWeek, lưu tuần hiện tại làm mốc ban đầu
    if (!scheduleMeta.lastPromotedWeek) {
      dbMeta.update({
        lastPromotedWeek: currentWeekKey,
        initializedAt: new Date().toISOString()
      });
      return;
    }

    // Đã sang tuần mới (khác lastPromotedWeek)
    if (scheduleMeta.lastPromotedWeek !== currentWeekKey) {
      let nextItemsCount = 0;
      if (allScheduleData.next && typeof allScheduleData.next === "object") {
        Object.values(allScheduleData.next).forEach(dayObj => {
          if (dayObj && typeof dayObj === "object") {
            nextItemsCount += Object.keys(dayObj).length;
          }
        });
      }

      if (nextItemsCount > 0) {
        // Có dữ liệu tuần sau: Tự động chuyển thành tuần này và làm mới tuần sau
        const nextData = JSON.parse(JSON.stringify(allScheduleData.next));
        const updates = {};
        updates["schedule"] = nextData;
        updates["schedule_next"] = null;
        updates["schedule_meta/lastPromotedWeek"] = currentWeekKey;
        updates["schedule_meta/lastPromotedAt"] = new Date().toISOString();

        firebase.database().ref().update(updates).then(() => {
          showToast("Đầu tuần Thứ Hai: Đã tự động kích hoạt Thời Khóa Biểu Tuần Mới!", "success");
        }).catch(err => {
          console.error("Lỗi tự động kích hoạt tuần mới:", err);
        });
      } else {
        // Tuần sau trống: Chỉ cập nhật mốc tuần hiện tại để không check lặp
        dbMeta.update({ lastPromotedWeek: currentWeekKey });
      }
    }
  }

  // ==========================================
  // 6. TÁC VỤ SAO CHÉP & DÁN THỜI KHÓA BIỂU
  // ==========================================

  // Sao chép lịch Tuần Này sang Tuần Sau
  window.copyCurrentToNextWeek = function() {
    let currentCount = 0;
    if (allScheduleData.current) {
      Object.values(allScheduleData.current).forEach(dayObj => {
        if (dayObj && typeof dayObj === "object") currentCount += Object.keys(dayObj).length;
      });
    }

    if (currentCount === 0) {
      showToast("Lịch tuần này đang trống, không có gì để sao chép!", "error");
      return;
    }

    let nextCount = 0;
    if (allScheduleData.next) {
      Object.values(allScheduleData.next).forEach(dayObj => {
        if (dayObj && typeof dayObj === "object") nextCount += Object.keys(dayObj).length;
      });
    }

    if (nextCount > 0) {
      if (!confirm(`Lịch tuần sau đang có sẵn ${nextCount} môn. Bạn có chắc muốn ghi đè toàn bộ bằng lịch của tuần này?`)) {
        return;
      }
    }

    const clone = JSON.parse(JSON.stringify(allScheduleData.current));
    dbNext.set(clone).then(() => {
      showToast(`Đã sao chép ${currentCount} môn từ Tuần Này sang Tuần Sau thành công!`, "success");
      switchScheduleMode("next");
    }).catch(err => {
      showToast("Lỗi khi sao chép: " + err.message, "error");
    });
  };

  // Kích hoạt ngay lập tức Lịch Tuần Sau cho Tuần Này
  window.applyNextWeekNow = function() {
    let nextCount = 0;
    if (allScheduleData.next) {
      Object.values(allScheduleData.next).forEach(dayObj => {
        if (dayObj && typeof dayObj === "object") nextCount += Object.keys(dayObj).length;
      });
    }

    if (nextCount === 0) {
      showToast("Lịch tuần sau đang trống, không có môn nào để áp dụng!", "error");
      return;
    }

    if (!confirm(`Bạn có chắc muốn đưa ${nextCount} môn từ Tuần Sau sang áp dụng ngay cho Tuần Này không?`)) {
      return;
    }

    const nextData = JSON.parse(JSON.stringify(allScheduleData.next));
    const currentWeekKey = getISOWeekKey();
    const updates = {};
    updates["schedule"] = nextData;
    updates["schedule_next"] = null;
    updates["schedule_meta/lastPromotedWeek"] = currentWeekKey;
    updates["schedule_meta/lastPromotedAt"] = new Date().toISOString();

    firebase.database().ref().update(updates).then(() => {
      showToast("Đã áp dụng lịch tuần sau cho tuần này thành công!", "success");
      switchScheduleMode("current");
    }).catch(err => {
      showToast("Lỗi khi áp dụng: " + err.message, "error");
    });
  };

  // Sao chép toàn bộ TKB của tuần đang xem vào Clipboard
  window.copyScheduleText = function() {
    const activeData = (currentScheduleMode === "current") ? allScheduleData.current : allScheduleData.next;
    const modeLabel = (currentScheduleMode === "current") ? "TUẦN NÀY (ĐANG DÙNG)" : "TUẦN SAU (NHẬP TRƯỚC)";

    let lines = [];
    lines.push(`THỜI KHÓA BIỂU [${modeLabel}]`);
    lines.push("==================================");

    let total = 0;
    DAYS_OF_WEEK.forEach(day => {
      const dayData = activeData[day] || {};
      const ids = Object.keys(dayData);
      if (ids.length > 0) {
        ids.sort((a, b) => (dayData[a].time || "").localeCompare(dayData[b].time || ""));
        lines.push(`\n${day}:`);
        ids.forEach(id => {
          total++;
          const item = dayData[id];
          let line = `• ${item.time || "Thời gian linh hoạt"} | ${item.subject}`;
          if (item.room) line += ` | Phòng: ${item.room}`;
          if (item.note) line += ` | Ghi chú: ${item.note}`;
          lines.push(line);
        });
      }
    });

    if (total === 0) {
      showToast("Chưa có môn học nào để sao chép!", "error");
      return;
    }

    const textToCopy = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`Đã sao chép ${total} môn học vào bộ nhớ tạm!`, "success");
      }).catch(() => {
        fallbackCopyText(textToCopy, total);
      });
    } else {
      fallbackCopyText(textToCopy, total);
    }
  };

  function fallbackCopyText(text, count) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast(`Đã sao chép ${count} môn học vào bộ nhớ tạm!`, "success");
    } catch (e) {
      showToast("Không thể tự động sao chép văn bản", "error");
    }
    document.body.removeChild(ta);
  }

  // Mở modal Dán TKB
  window.openPasteModal = function() {
    const modal = document.getElementById("paste-modal-backdrop");
    const targetSelect = document.getElementById("paste-target-week");
    const textarea = document.getElementById("paste-textarea");
    const msg = document.getElementById("paste-preview-msg");

    if (targetSelect) targetSelect.value = currentScheduleMode;
    if (textarea) textarea.value = "";
    if (msg) {
      msg.textContent = "";
      msg.style.color = "";
    }

    if (modal) modal.classList.add("show");
    setTimeout(() => { if (textarea) textarea.focus(); }, 150);
  };

  // Đóng modal Dán TKB
  window.closePasteModal = function() {
    const modal = document.getElementById("paste-modal-backdrop");
    if (modal) modal.classList.remove("show");
  };

  // Bộ bóc tách thông minh cho văn bản hoặc JSON
  function parsePastedSchedule(rawText) {
    const trimmed = (rawText || "").trim();
    if (!trimmed) return null;

    // 1. Nếu là chuỗi JSON
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const obj = JSON.parse(trimmed);
        const hasDay = Object.keys(obj).some(k => DAYS_OF_WEEK.includes(k) || k.toLowerCase().includes("thứ") || k.toLowerCase().includes("chủ nhật"));
        if (hasDay) {
          const result = {};
          DAYS_OF_WEEK.forEach(d => {
            if (obj[d] && typeof obj[d] === "object") {
              result[d] = obj[d];
            }
          });
          if (Object.keys(result).length > 0) return result;
        }
      } catch (e) {}
    }

    // 2. Parse dạng văn bản có cấu trúc
    const lines = trimmed.split(/\r?\n/);
    let currentDay = "Thứ Hai";
    const result = {};

    const DAY_ALIASES = {
      "thứ hai": "Thứ Hai", "thứ 2": "Thứ Hai", "thu hai": "Thứ Hai", "t2": "Thứ Hai",
      "thứ ba": "Thứ Ba", "thứ 3": "Thứ Ba", "thu ba": "Thứ Ba", "t3": "Thứ Ba",
      "thứ tư": "Thứ Tư", "thứ 4": "Thứ Tư", "thu tu": "Thứ Tư", "t4": "Thứ Tư",
      "thứ năm": "Thứ Năm", "thứ 5": "Thứ Năm", "thu nam": "Thứ Năm", "t5": "Thứ Năm",
      "thứ sáu": "Thứ Sáu", "thứ 6": "Thứ Sáu", "thu sau": "Thứ Sáu", "t6": "Thứ Sáu",
      "thứ bảy": "Thứ Bảy", "thứ 7": "Thứ Bảy", "thu bay": "Thứ Bảy", "t7": "Thứ Bảy",
      "chủ nhật": "Chủ Nhật", "chu nhat": "Chủ Nhật", "cn": "Chủ Nhật"
    };

    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (!line || line.startsWith("----") || line.startsWith("====") || line.toLowerCase().includes("thời khóa biểu")) {
        return;
      }

      // Kiểm tra tiêu đề Ngày
      const normalizedHeader = line.toLowerCase().replace(/[:\-–]/g, "").trim();
      let matchedDay = null;
      for (const [alias, dayName] of Object.entries(DAY_ALIASES)) {
        if (normalizedHeader === alias || normalizedHeader.startsWith(alias + " ")) {
          matchedDay = dayName;
          break;
        }
      }

      if (matchedDay) {
        currentDay = matchedDay;
        return;
      }

      // Xử lý dòng tiết học
      const cleanLine = line.replace(/^[\s•\-\*\d\.\)\>]+/, "").trim();
      if (!cleanLine) return;

      if (cleanLine.includes("|")) {
        const parts = cleanLine.split("|").map(s => s.trim());
        let time = parts[0] || "";
        let subject = parts[1] || "";
        let room = "";
        let note = "";

        for (let i = 2; i < parts.length; i++) {
          const p = parts[i];
          const plower = p.toLowerCase();
          if (plower.startsWith("phòng:") || plower.startsWith("phong:")) {
            room = p.substring(p.indexOf(":") + 1).trim();
          } else if (plower.startsWith("ghi chú:") || plower.startsWith("lưu ý:") || plower.startsWith("ghi chu:")) {
            note = p.substring(p.indexOf(":") + 1).trim();
          } else if (!room) {
            room = p;
          } else if (!note) {
            note = p;
          }
        }

        if (subject) {
          if (!result[currentDay]) result[currentDay] = {};
          const newId = "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
          result[currentDay][newId] = { time, subject, room, note };
        }
      } else {
        // Cú pháp đơn giản không pipe
        const timeMatch = cleanLine.match(/(\d{1,2}[:hH]\d{2}\s*[-–]\s*\d{1,2}[:hH]\d{2})/);
        let time = "";
        let remain = cleanLine;
        if (timeMatch) {
          time = timeMatch[1].replace(/h/gi, ":");
          remain = cleanLine.replace(timeMatch[0], "").trim();
        }

        const roomMatch = remain.match(/([ABCEF]\d{1,2}\.\d{1,2})/i);
        let room = "";
        if (roomMatch) {
          room = roomMatch[1].toUpperCase();
          remain = remain.replace(roomMatch[0], "").trim();
        }

        const subject = remain.trim();
        if (subject) {
          if (!result[currentDay]) result[currentDay] = {};
          const newId = "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
          result[currentDay][newId] = { time, subject, room, note: "" };
        }
      }
    });

    return Object.keys(result).length > 0 ? result : null;
  }

  // Thực hiện lưu dữ liệu đã dán
  window.executePasteSchedule = function() {
    const ta = document.getElementById("paste-textarea");
    const targetSelect = document.getElementById("paste-target-week");
    const targetMode = targetSelect ? targetSelect.value : currentScheduleMode;
    const targetDb = targetMode === "current" ? db : dbNext;

    const parsed = parsePastedSchedule(ta ? ta.value : "");
    if (!parsed) {
      showToast("Không tìm thấy dữ liệu môn học hợp lệ để nạp!", "error");
      return;
    }

    let totalNew = 0;
    Object.values(parsed).forEach(dayObj => {
      totalNew += Object.keys(dayObj).length;
    });

    const targetLabel = targetMode === "current" ? "Tuần Này (Đang Dùng)" : "Tuần Sau (Nhập Trước)";
    if (!confirm(`Phát hiện ${totalNew} môn học. Bạn có muốn nạp vào "${targetLabel}" không?`)) {
      return;
    }

    // Ghi dữ liệu vào Firebase
    targetDb.update(parsed).then(() => {
      showToast(`Đã nhập thành công ${totalNew} môn vào ${targetLabel}!`, "success");
      closePasteModal();
      switchScheduleMode(targetMode);
    }).catch(err => {
      showToast("Lỗi khi lưu lịch: " + err.message, "error");
    });
  };

  // Mở modal sao chép từ ngày này sang ngày khác
  window.openCopyDayModal = function(fromDay) {
    const modal = document.getElementById("copy-day-modal-backdrop");
    const fromText = document.getElementById("copy-from-day-text");
    const fromVal = document.getElementById("copy-from-day-val");
    const toSelect = document.getElementById("copy-to-day-select");

    if (fromText) fromText.textContent = fromDay;
    if (fromVal) fromVal.value = fromDay;

    if (toSelect) {
      toSelect.innerHTML = "";
      DAYS_OF_WEEK.filter(d => d !== fromDay).forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        toSelect.appendChild(opt);
      });
    }

    if (modal) modal.classList.add("show");
  };

  window.closeCopyDayModal = function() {
    const modal = document.getElementById("copy-day-modal-backdrop");
    if (modal) modal.classList.remove("show");
  };

  window.executeCopyDay = function() {
    const fromDay = document.getElementById("copy-from-day-val").value;
    const toDay = document.getElementById("copy-to-day-select").value;
    const targetDb = getTargetDb();
    const activeData = (currentScheduleMode === "current") ? allScheduleData.current : allScheduleData.next;

    const sourceItems = activeData[fromDay] || {};
    const keys = Object.keys(sourceItems);
    if (keys.length === 0) {
      showToast(`${fromDay} không có môn nào để sao chép!`, "error");
      return;
    }

    if (!confirm(`Sao chép ${keys.length} môn từ ${fromDay} sang ${toDay}?`)) {
      return;
    }

    const updates = {};
    keys.forEach(k => {
      const newKey = "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      updates[`${toDay}/${newKey}`] = JSON.parse(JSON.stringify(sourceItems[k]));
    });

    targetDb.update(updates).then(() => {
      showToast(`Đã sao chép ${keys.length} môn từ ${fromDay} sang ${toDay}!`, "success");
      closeCopyDayModal();
    }).catch(err => {
      showToast("Lỗi khi sao chép: " + err.message, "error");
    });
  };

  // Xóa toàn bộ lịch của tuần đang chọn
  window.clearCurrentScheduleData = function() {
    const modeLabel = currentScheduleMode === "current" ? "Tuần Này (Đang Dùng)" : "Tuần Sau (Nhập Trước)";
    const targetDb = getTargetDb();

    if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA TOÀN BỘ lịch học của "${modeLabel}" không?\nHành động này sẽ xóa hết các môn trong tuần và không thể hoàn tác!`)) {
      targetDb.remove().then(() => {
        showToast(`Đã xóa sạch lịch học của ${modeLabel}!`, "normal");
        if (isEditing) resetForm();
      }).catch(err => {
        showToast("Lỗi khi xóa: " + err.message, "error");
      });
    }
  };

  // ==========================================
  // 7. XỬ LÝ FORM THÊM MỚI / SỬA MÔN HỌC
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
      const targetDb = getTargetDb();
      const modeLabel = currentScheduleMode === "current" ? "Tuần Này" : "Tuần Sau";

      if (isEditing) {
        if (currentEditDay !== day) {
          const updates = {};
          updates[`${currentEditDay}/${currentEditId}`] = null;
          updates[`${day}/${currentEditId}`] = payload;
          targetDb.update(updates).then(() => {
            showToast(`Đã cập nhật lịch (${modeLabel}) thành công!`, "success");
            resetForm();
          }).catch(err => {
            showToast("Có lỗi xảy ra: " + err.message, "error");
          });
        } else {
          targetDb.child(day).child(currentEditId).set(payload).then(() => {
            showToast(`Đã cập nhật lịch (${modeLabel}) thành công!`, "success");
            resetForm();
          }).catch(err => {
            showToast("Có lỗi xảy ra: " + err.message, "error");
          });
        }
      } else {
        targetDb.child(day).push(payload).then(() => {
          showToast(`Đã thêm môn học vào ${modeLabel} thành công!`, "success");
          resetForm();
        }).catch(err => {
          showToast("Có lỗi xảy ra: " + err.message, "error");
        });
      }
    });
  }

  // Hàm reset form
  window.resetForm = function() {
    isEditing = false;
    currentEditDay = null;
    currentEditId = null;

    const titleEl = document.getElementById("form-title");
    if (titleEl) {
      titleEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <span>Thêm Tiết Học Mới</span>
      `;
    }

    const btnSubmit = document.getElementById("btn-submit-form");
    if (btnSubmit) {
      btnSubmit.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        <span>Lưu Lên Hệ Thống</span>
      `;
    }

    const cancelWrap = document.getElementById("edit-cancel-wrap");
    if (cancelWrap) cancelWrap.style.display = "none";

    const s = document.getElementById("subject-val");
    const r = document.getElementById("room-val");
    const n = document.getElementById("note-val");
    if (s) s.value = "";
    if (r) r.value = "";
    if (n) n.value = "";

    selectedBuilding = "";
    document.querySelectorAll(".bld-btn").forEach(btn => btn.classList.remove("active"));
    startTime = "06:30";
    endTime = "11:00";
    syncTimeUI();

    currentSelectedCode = null;
    document.querySelectorAll(".subj-chip").forEach(c => c.classList.remove("selected"));

    // Reset chế độ nhiều môn
    multiSelectedSubjects = [];
    const panel = document.getElementById("multi-subject-panel");
    if (panel) panel.style.display = "none";
    setSubjectSelectMode("single");

    const btnNextShift = document.getElementById("btn-save-next-shift");
    if (btnNextShift) btnNextShift.style.display = "inline-flex";
    const btnNextText = document.getElementById("btn-save-next-text");
    if (btnNextText) btnNextText.textContent = "+ Lưu & Thêm Tiếp Ca Chiều";
  };

  // ==========================================
  // 8. CHUẨN BỊ SỬA MỤC
  // ==========================================
  window.editItem = function(day, id) {
    const activeData = (currentScheduleMode === "current") ? allScheduleData.current : allScheduleData.next;
    if (!activeData[day] || !activeData[day][id]) return;

    const item = activeData[day][id];
    isEditing = true;
    currentEditDay = day;
    currentEditId = id;

    // Reset chế độ chọn môn về single khi đang sửa
    setSubjectSelectMode("single");
    const btnNextShift = document.getElementById("btn-save-next-shift");
    if (btnNextShift) btnNextShift.style.display = "none";

    // Mở form drawer nếu đang đóng
    toggleFormCard(true);

    const dayVal = document.getElementById("day-val");
    if (dayVal) dayVal.value = day;

    const parsed = parseTimeStr(item.time || "");
    startTime = parsed.start;
    endTime = parsed.end;
    syncTimeUI();

    const s = document.getElementById("subject-val");
    const r = document.getElementById("room-val");
    const n = document.getElementById("note-val");
    if (s) s.value = item.subject || "";
    if (r) r.value = item.room || "";
    if (n) n.value = item.note || "";

    syncChipsWithSubject(item.subject || "");
    syncRoomBuilderFromInput();

    const modeLabel = currentScheduleMode === "current" ? "Tuần Này" : "Tuần Sau";
    const titleEl = document.getElementById("form-title");
    if (titleEl) {
      titleEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>Chỉnh Sửa Tiết Học (${day} - ${modeLabel})</span>
      `;
    }

    const btnSubmit = document.getElementById("btn-submit-form");
    if (btnSubmit) {
      btnSubmit.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        <span>Lưu Cập Nhật</span>
      `;
    }

    const formEl = document.getElementById("schedule-form");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "start" });
    if (s) s.focus();
  };

  // ==========================================
  // 9. XÓA MỤC
  // ==========================================
  window.removeItem = function(day, id, subject) {
    const modeLabel = currentScheduleMode === "current" ? "Tuần Này" : "Tuần Sau";
    const confirmMsg = subject 
      ? `Bạn có chắc chắn muốn xóa môn "${subject}" khỏi ${day} (${modeLabel})?`
      : `Bạn có chắc chắn muốn xóa mục này khỏi ${day} (${modeLabel})?`;

    if (confirm(confirmMsg)) {
      const targetDb = getTargetDb();
      targetDb.child(day).child(id).remove().then(() => {
        showToast("Đã xóa môn học thành công!", "success");
        if (isEditing && currentEditId === id) {
          resetForm();
        }
      }).catch(err => {
        showToast("Lỗi khi xóa: " + err.message, "error");
      });
    }
  };

  function formatSubjectDisplay(subjectStr) {
    if (!subjectStr) return "";
    const match = subjectStr.match(/^([^\s:]+)\s*:\s*(.+)$/);
    if (match) {
      const code = escapeHtml(match[1]);
      const name = escapeHtml(match[2]);
      return `<span class="subject-code-tag">${code}</span><span>${name}</span>`;
    }
    return escapeHtml(subjectStr);
  }

  // ==========================================
  // 10. RENDER DANH SÁCH MÔN HỌC THEO THẺ TỪNG NGÀY
  // ==========================================
  function renderAdminItems() {
    if (!itemsContainer) return;
    itemsContainer.innerHTML = "";

    const activeData = (currentScheduleMode === "current") ? allScheduleData.current : allScheduleData.next;
    let totalCount = 0;
    const daysToShow = (adminFilterDay === "all") ? DAYS_OF_WEEK : [adminFilterDay];

    daysToShow.forEach(day => {
      const dayData = activeData[day] || {};
      const ids = Object.keys(dayData);

      // Nếu đang lọc 1 ngày hoặc ngày đó có môn học
      if (adminFilterDay !== "all" || ids.length > 0) {
        ids.sort((a, b) => (dayData[a].time || "").localeCompare(dayData[b].time || ""));

        const dayCard = document.createElement("div");
        dayCard.className = "admin-day-card";

        let dayCardHtml = `
          <div class="admin-day-card-header">
            <div class="admin-day-title-wrap">
              <span class="admin-day-title">${day}</span>
              <span class="mode-badge live" style="font-size: 0.72rem; padding: 2px 7px;">${ids.length} tiết</span>
            </div>
            <div class="admin-day-actions">
              ${ids.length > 0 ? `
                <button type="button" class="btn-copy-day" onclick="openCopyDayModal('${day}')" title="Sao chép toàn bộ môn của ${day} sang thứ khác">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Sao chép ngày
                </button>
              ` : ""}
            </div>
          </div>
          <div class="admin-day-items">
        `;

        if (ids.length > 0) {
          ids.forEach(id => {
            totalCount++;
            const item = dayData[id];
            dayCardHtml += `
              <div class="admin-item-row">
                <div class="item-details">
                  <div class="item-title-text">${formatSubjectDisplay(item.subject)}</div>
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
              </div>
            `;
          });
        } else {
          dayCardHtml += `
            <div style="text-align: center; color: var(--text-muted); padding: 18px; font-size: 0.88rem;">
              Chưa có tiết học nào cho ${day}. Bấm "+ Thêm Tiết Học Mới" ở trên để thêm.
            </div>
          `;
        }

        dayCardHtml += `</div>`;
        dayCard.innerHTML = dayCardHtml;
        itemsContainer.appendChild(dayCard);
      }
    });

    // Cập nhật tổng số tiết
    const totalPill = document.getElementById("total-count-pill");
    if (totalPill) {
      totalPill.textContent = `${totalCount} tiết học`;
    }

    if (totalCount === 0) {
      const isCurrent = currentScheduleMode === "current";
      itemsContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 36px 16px; font-size: 0.95rem; background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 14px;">
          <p style="font-weight: 700; color: var(--text-main); margin-bottom: 6px; font-size: 1.05rem;">
            ${isCurrent ? "Lịch Tuần Này Đang Trống" : "Lịch Tuần Sau Đang Trống"}
          </p>
          <p style="margin-bottom: 14px; font-size: 0.88rem; color: var(--text-muted);">
            ${isCurrent 
              ? "Bạn có thể bấm \"+ Thêm Tiết Học Mới\" hoặc bấm \"Dán TKB\" để nhập lịch nhanh." 
              : "Bạn có thể bấm \"Sao chép ➔ Tuần Sau\" để lấy toàn bộ lịch từ tuần này sang rồi sửa nhanh, hoặc bấm \"+ Thêm Tiết Học Mới\"."}
          </p>
        </div>
      `;
    }
  }

  // Cập nhật số lượng môn tuần sau lên Badge và render lại
  function updateBadgeAndRender() {
    let nextCount = 0;
    if (allScheduleData.next) {
      Object.values(allScheduleData.next).forEach(dayObj => {
        if (dayObj && typeof dayObj === "object") nextCount += Object.keys(dayObj).length;
      });
    }

    const badge = document.getElementById("next-count-badge");
    if (badge) {
      badge.textContent = nextCount > 0 ? `${nextCount} môn` : "0 môn";
      if (nextCount > 0) {
        badge.classList.add("has-items");
      } else {
        badge.classList.remove("has-items");
      }
    }

    renderAdminItems();
  }

  // ==========================================
  // 11. LẮNG NGHE DỮ LIỆU TỪ FIREBASE REALTIME
  // ==========================================
  db.on("value", (snapshot) => {
    allScheduleData.current = snapshot.val() || {};
    updateBadgeAndRender();
    checkAndAutoPromoteMonday();
  });

  dbNext.on("value", (snapshot) => {
    allScheduleData.next = snapshot.val() || {};
    updateBadgeAndRender();
    checkAndAutoPromoteMonday();
  });

  dbMeta.on("value", (snapshot) => {
    scheduleMeta = snapshot.val() || {};
    checkAndAutoPromoteMonday();
  });

  // Tự động kiểm tra chuyển giao tuần mỗi 60 giây khi đang mở web
  setInterval(checkAndAutoPromoteMonday, 60000);

  // ==========================================
  // 12. TIỆN ÍCH THÔNG BÁO TOAST & ESCAPE
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
