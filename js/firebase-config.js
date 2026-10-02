/**
 * firebase-config.js
 * Cấu hình kết nối Firebase Realtime Database dùng chung cho hệ thống Lịch Học
 */

const firebaseConfig = {
  apiKey: "AIzaSyA5o5FjDgTiYtHw8uaK6_eXxAZ6Go2Ppew",
  authDomain: "menu-bcf7e.firebaseapp.com",
  databaseURL: "https://menu-bcf7e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "menu-bcf7e",
  storageBucket: "menu-bcf7e.firebasestorage.app",
  messagingSenderId: "998669598735",
  appId: "1:998669598735:web:e8a9a6f249c72b82ad637a",
  measurementId: "G-98SJPTGWPH"
};

// Khởi tạo Firebase nếu chưa có
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Tham chiếu đến bảng 'schedule' trong Realtime Database
const db = firebase.database().ref("schedule");

// Danh sách các ngày trong tuần
const DAYS_OF_WEEK = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật"
];

// Mã PIN quản trị mặc định
const ADMIN_PIN = "132008";
