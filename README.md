# Dâng hương TikTok LIVE

Frontend canvas nhận bình luận và quà qua SSE từ backend TikTok Live riêng. Dự án không chứa backend `/events`, không lưu dữ liệu phiên lên server và không có dependency npm bên ngoài.

## Chạy local

Dùng Node.js 24.x:

```sh
npm ci
npm test
BACKEND_URL=http://localhost:3100 npm start
```

Mở `http://localhost:3000/?username=ten_tiktok`. Bỏ username để dùng form thử quà.

`npm start` tự sinh `public/config.js` trước khi phục vụ trang. Nó không tự đọc `.env`/`.env.local`; truyền biến qua shell như trên. `PORT` mặc định là `3000`, server chỉ lắng nghe loopback và không áp dụng cổng mật khẩu Vercel.

## Deploy Vercel

- Framework Preset: **Other**, được ép bằng `"framework": null` trong `vercel.json` để không nhận nhầm script local `npm start` thành Node server. Root Directory là thư mục chứa `package.json` này.
- Build Command: `npm run build`; Output Directory: `public` (đã khai báo trong `vercel.json`).
- Chọn Node.js 24.x.
- Đặt các biến theo `.env.example` trong đúng môi trường Production/Preview:
  - `SITE_PASSWORD`: mật khẩu dài, khó đoán cho cổng vào trang.
  - `BACKEND_URL`: URL HTTPS công khai của backend, ví dụ `https://backend.example.com`.
- Redeploy sau khi thay `BACKEND_URL`: đây là cấu hình lúc build, không phải biến trình duyệt tự đọc lúc chạy.

`BACKEND_URL` có thể chứa tiền tố đường dẫn như `/live`, nhưng không được chứa `/events` ở cuối, query, fragment hoặc thông tin đăng nhập. Frontend tự nối `/events?username=...`. Để trống chỉ hoạt động nếu cùng origin đã có backend `/events`; bản deploy frontend này không có endpoint đó. URL được công khai trong JavaScript, không đặt secret vào biến này.

Backend phải cho phép CORS từ domain frontend và proxy phải hỗ trợ SSE không buffering. Cổng mật khẩu chỉ bảo vệ tài nguyên frontend trên Vercel, không xác thực backend riêng. Hosting tĩnh khác hoặc `npm start` không chạy middleware này.

`?server=https://...` vẫn có thể ghi đè backend cho một phiên; chỉ chấp nhận HTTPS hoặc HTTP localhost và cùng quy tắc URL nền. Đổi URL khi đang chạy cần tải lại trang.

## Hợp đồng sự kiện

Đối chiếu với `TiktokLive/src/events.js`, `docs/client-api.md` và `docs/client-guide.md` của backend:

- Sự kiện dùng tên `chat`, `gift`, `status`. Dữ liệu sai JSON/schema bị bỏ qua và có thông báo trạng thái; không làm hỏng sự kiện hợp lệ tiếp theo.
- `user.id`, `user.uniqueId`, `user.nickname` là chuỗi. Ưu tiên `user.id` làm khóa người dùng, sau đó `uniqueId`; không gộp người dùng chỉ vì trùng nickname hoặc thiếu ID.
- `gift.diamonds` là số nguyên dương an toàn và là **tổng combo đã hoàn tất**. `isStreakOver` phải là `true`; cộng điểm một lần, không nhân thêm `repeatCount`.
- Lọc trùng best-effort theo loại sự kiện, `roomId`, `eventId`, nhớ tối đa 2000 ID trong một phiên. Sự kiện thiếu ID không thể lọc trùng an toàn.
- Backend không replay hay bảo đảm giao đúng một lần. Mất kết nối có thể mất sự kiện; cache trùng có thể quên ID cũ. Không dùng bảng điểm này như sổ giao dịch thanh toán.

## Chính sách hàng đợi

- Tối đa **4 hàng hiển thị**, tính cả hàng đang thắp. VIP được ưu tiên FIFO nhưng không ngắt lượt đang diễn.
- Người **cùng cấp** xếp chung một hàng (tối đa 4 người), kể cả cấp cao: cả hàng lên diễn một màn. Hàng chưa đủ người chờ tối đa 6 giây rồi vẫn lên.
- Tối đa **200 người chờ**, tính cả các hàng đang xếp và danh sách chưa hiển thị, không tính lượt đang diễn.
- Bình luận đang chờ hết hạn sau **60 giây**. Khi đầy: loại bình luận cũ trước; nếu vẫn đầy thì bỏ màn diễn quà cũ nhất.
- **Mọi quà hợp lệ được cộng điểm trước khi xếp hàng**, dù màn diễn của nó bị bỏ vì quá tải. Lượt đang diễn không bị cắt.
- Bộ đếm trạng thái cho biết số lượt bị bỏ do quá tải/hết hạn. Đây là giới hạn animation, không phải giới hạn tổng điểm hay tổng người tặng trong bảng điểm.
- Bảng điểm, lượt chờ và dấu ấn đều ở RAM của tab; tải lại trang sẽ mất phiên hiện tại.

## Giọng đọc trên điện thoại

Giọng đọc **mặc định bật và không có nút tắt**. Trình duyệt chỉ cho đọc sau một thao tác của người dùng, nên lần chạm đầu tiên vào trang sẽ mở khoá giọng đọc (đọc một câu thử ngắn). Trước lần chạm đó, các lời chúc chỉ được chờ theo thời gian và không có tiếng. Chế độ live không có nút; dòng trạng thái nhỏ phía dưới màn hình hiện lỗi nếu có. Trang thử có nút **Thử giọng đọc** để kiểm tra lại.

- Danh sách giọng có thể tải chậm. Khi chưa thấy giọng Việt, frontend vẫn yêu cầu `vi-VN` để hệ thống chọn giọng; không bỏ đọc chỉ vì `getVoices()` đang rỗng.
- Nếu máy báo thiếu giọng Việt hoặc từ chối quyền đọc, dòng trạng thái ghi rõ lỗi; chạm lại vào trang để thử lại. Frontend không tự cài giọng và không dùng dịch vụ TTS bên ngoài; không bảo đảm mọi thiết bị đều có giọng Việt.
- Khi đổi ứng dụng, đưa trang vào nền hoặc quay lại từ lịch sử, trình duyệt ngắt giọng đọc; chạm một lần vào trang là bật lại. Không tự phát sau khi trang bị gián đoạn.
- Nếu giọng đọc lỗi hoặc mất callback kết thúc, watchdog giải phóng lượt để hàng đợi không bị kẹt. Game vẫn hoạt động khi không có TTS.

## Âm thanh

Âm thanh nằm trong `public/sounds/` (mẫu MP3 và `manifest.json`), phát bằng Web Audio. `sound.js` là engine; `sound-cues.js` ghi âm nào phát vào giây nào của từng cảnh. Bước chân lấy theo quãng người đi; vị trí trái/phải và xa/gần theo chỗ đứng trên màn hình.

- Mở khoá bằng cú chạm đầu tiên, giống giọng đọc. Không có nút tắt.
- Không có Web Audio hoặc không tải được file thì game vẫn chạy, chỉ im lặng.
- Chỉnh âm: đổi `gain`, `loop` hoặc danh sách file trong `manifest.json`; đổi giây phát trong `sound-cues.js`.
- `tools/make_audio.py` tạo lại toàn bộ `public/sounds/`. Cần `AUDIO_SRC` trỏ tới thư mục chứa các mẫu gốc từ Commons (xem CREDITS.md) và cài `pip install numpy scipy soundfile av`.

## Kiểm thử và nghiệm thu

`npm test` chạy test URL/build, hàng đợi, bảng điểm, schema SSE, middleware, giọng đọc (gesture, giọng tải chậm, lỗi, timeout) và tích hợp script game với DOM/canvas/đồng hồ giả. Test dùng dữ liệu giả, không cần kết nối TikTok hay backend thật. Test middleware chỉ kiểm tra logic handler, không thay thế việc Vercel nhận diện và bundle file.

Trước khi chạy production, kiểm tra trên Vercel Preview:

1. Chưa đăng nhập không đọc được trang, script hoặc ảnh; đăng nhập đúng/sai và đổi mật khẩu hoạt động như mong đợi.
2. `config.js` có đúng URL backend, `/events` kết nối được qua HTTPS/CORS.
3. Bình luận, quà combo, ngắt/kết nối lại và một phiên kéo dài hoạt động đúng.
4. Hình ảnh, giọng Việt, thao tác bật âm thanh/toàn màn hình trên các trình duyệt và thiết bị sẽ sử dụng. Test canvas giả không xác minh các mục này.

Nguồn và lưu ý quyền sử dụng ảnh nằm trong `CREDITS.md`. Cần chốt quyền ảnh và cách công bố attribution trước khi phát hành công khai; README này không xác nhận quyền sử dụng thay cho chủ dự án.
