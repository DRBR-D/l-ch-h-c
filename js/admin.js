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

  function selectQuickSubject(subj, chipEl) {
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
  }

  function syncChipsWithSubject(subjectText) {
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
    document.getElementById("room-val").value = "";
    document.getElementById("note-val").value = "";
    selectedBuilding = "";
    document.querySelectorAll(".bld-btn").forEach(btn => btn.classList.remove("active"));
    startTime = "06:30";
    endTime = "11:00";
    syncTimeUI();

    // Reset chọn nhanh môn học
    currentSelectedCode = null;
    document.querySelectorAll(".subj-chip").forEach(c => c.classList.remove("selected"));
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
    const parsed = parseTimeStr(item.time || "");
    startTime = parsed.start;
    endTime = parsed.end;
    syncTimeUI();

    document.getElementById("subject-val").value = item.subject || "";
    document.getElementById("room-val").value = item.room || "";
    document.getElementById("note-val").value = item.note || "";

    // Đồng bộ thẻ môn học & phòng học khi sửa
    syncChipsWithSubject(item.subject || "");
    syncRoomBuilderFromInput();

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

  // Định dạng hiển thị mã môn học nổi bật
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
