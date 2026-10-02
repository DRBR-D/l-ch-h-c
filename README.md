# 📅 Hệ Thống Quản Lý & Xem Lịch Học Trực Tuyến

Giao diện thời khóa biểu và quản lý lịch học được thiết kế **tối giản, ấm cúng, trang nhã, không neon**, cực kỳ dễ nhìn và tiện lợi cho ba mẹ cũng như gia đình theo dõi.

---

## 📁 Cấu Trúc Dự Án Chuẩn

```text
├── index.html              # Trang xem lịch học chính (cho ba mẹ / gia đình xem)
├── admin.html              # Trang quản trị thêm, sửa, xóa lịch học
├── css/
│   ├── style.css           # Định dạng giao diện chính (ấm áp, không chói mắt)
│   └── admin.css           # Định dạng bảng điều khiển quản trị
├── js/
│   ├── firebase-config.js  # Cấu hình kết nối Firebase Realtime Database
│   ├── app.js              # Logic hiển thị lịch học, đồng hồ thực, lọc ngày
│   └── admin.js            # Logic xác thực PIN 132008, thêm/sửa/xóa môn học
└── README.md               # Hướng dẫn chi tiết sử dụng & đưa lên GitHub
```

---

## 🔑 Thông Tin Quản Trị
- **Mã PIN / Mật khẩu vào Admin:** `132008`
- Bạn có thể nhấn vào nút **"Quản Lý Lịch"** trên thanh tiêu đề hoặc **nút tròn nổi ở góc phải bên dưới màn hình** để vào trang Admin.
- Sau khi nhập đúng mã PIN `132008`, hệ thống sẽ lưu phiên đăng nhập để bạn không cần nhập lại nhiều lần khi thao tác.

---

## 🚀 Hướng Dẫn Đưa Lên GitHub & Bật Web Miễn Phí (GitHub Pages)

Để đưa trang web này lên mạng để ba mẹ có thể mở bằng điện thoại mọi lúc mọi nơi:

### Bước 1: Tạo kho lưu trữ (Repository) trên GitHub
1. Đăng nhập vào [GitHub](https://github.com/).
2. Nhấn nút **New** (hoặc dấu `+` ở góc trên cùng bên phải) để tạo Repository mới.
3. Đặt tên kho lưu trữ (Ví dụ: `lich-hoc`).
4. Chọn **Public**.
5. Nhấn **Create repository**.

### Bước 2: Tải các file lên GitHub
**Cách 1 (Dùng giao diện Web trực tiếp):**
1. Trên trang kho lưu trữ vừa tạo, chọn **"uploading an existing file"**.
2. Kéo toàn bộ các file và thư mục (`index.html`, `admin.html`, thư mục `css/`, thư mục `js/`, `README.md`) vào khung tải lên.
3. Nhấn **Commit changes**.

**Cách 2 (Dùng dòng lệnh Git):**
```bash
git init
git add .
git commit -m "Khoi tao he thong lich hoc"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git
git push -u origin main
```

### Bước 3: Kích hoạt GitHub Pages (Xem web online)
1. Tại trang repo trên GitHub, vào mục **Settings** (Cài đặt).
2. Ở thanh menu bên trái, chọn **Pages**.
3. Tại phần **Build and deployment** -> **Branch**:
   - Chọn nhánh: `main`
   - Chọn thư mục: `/ (root)`
   - Nhấn **Save**.
4. Chờ khoảng 1 - 2 phút, GitHub sẽ cung cấp cho bạn một đường link dạng:
   `https://<ten-tai-khoan>.github.io/<ten-repo>/`
5. Gửi đường link này cho ba mẹ là ba mẹ có thể mở xem lịch học mọi lúc trên điện thoại hoặc máy tính!

---

## ✨ Tính Năng Nổi Bật
- **Thiết kế thân thiện cho người lớn:** Phông chữ to, nét, màu nền sáng dịu mắt, thẻ nội dung tách biệt rõ ràng, không hiệu ứng đèn neon chói lóa.
- **Đồng hồ & Ngày tiếng Việt:** Tự động nhận diện thứ hôm nay và đánh dấu nổi bật lịch của ngày hiện tại.
- **Lọc nhanh theo thứ:** Cho phép xem lịch của cả tuần hoặc chọn xem riêng từng thứ.
- **Đồng bộ thời gian thực (Realtime):** Bất cứ khi nào bạn thêm hoặc sửa trên trang Admin, trang của ba mẹ sẽ tự động cập nhật ngay lập tức mà không cần bấm tải lại trang!
- **Hỗ trợ Sửa & Xóa:** Trang Admin cho phép bấm "Sửa" để sửa trực tiếp hoặc "Xóa" một tiết học nhanh chóng kèm cảnh báo xác nhận.
