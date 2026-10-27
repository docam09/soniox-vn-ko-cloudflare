# Soniox Việt ↔ Hàn trên Cloudflare (Worker `cost`)

Ứng dụng phiên dịch giọng nói hai chiều Việt Nam–Hàn Quốc theo thời gian thực. Frontend React và Cloudflare Worker được triển khai chung bằng Workers Static Assets. Soniox nhận dạng giọng nói, nhận diện ngôn ngữ và dịch trực tiếp qua WebSocket.

Đây là source đầy đủ của Worker **`cost`** đang chạy tại `https://cost.dohuucam500.workers.dev`, gồm cả phần đăng nhập OTP (SMS/email) và từ điển dùng chung.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/` | Frontend React (Vite). `live.ts` ghép token Soniox thành từng lượt nói; `App.tsx` là giao diện. |
| `src/live.test.ts` | Test cho việc ghép lượt nói (`npm test`). |
| `worker/worker.mjs` | Entry của Worker: đăng nhập OTP SMS (Twilio Verify) / email (Cloudflare Access), duyệt quyền, chèn thanh truy cập vào HTML, rồi chuyển tiếp sang `original-worker.mjs`. |
| `worker/original-worker.mjs` | API ứng dụng: `/api/soniox/session` (temporary key + cấu hình dịch), `/api/dictionary` (từ điển dùng chung trong KV). |
| `worker/portal.mjs`, `email-access.mjs`, `access-bar.mjs` | Trang `/access`, đăng nhập email, thanh quản trị. |
| `worker/connection-guard.mjs` | Script chèn vào trang: giới hạn thời gian lấy phiên Soniox và xin quyền micro trên điện thoại. |
| `worker/soniox-auth.mjs` | Gọi Soniox tạo temporary key, có timeout. |
| `migrations/0001_access.sql` | Schema D1 `cost-access`. |

## Ghép lượt nói (vì sao từng mất bản dịch tiếng Hàn)

Soniox trả chữ gốc trước, bản dịch theo sau. Với tiếng Hàn (động từ cuối câu), bản dịch tiếng Việt có thể đến **sau** tín hiệu kết thúc câu (`<end>`) vài giây. Bản cũ chỉ chờ 500 ms rồi bỏ cả lượt nếu chưa có bản dịch. Từ v1.2.0:

- Chưa có bản dịch thì chờ tiếp, tối đa 4 giây (`MAX_TRANSLATION_WAIT_MS`); có bản dịch rồi thì vẫn chốt sau 500 ms như cũ.
- Hết thời gian chờ vẫn lưu câu gốc ("Chưa nhận được bản dịch"); bản dịch đến muộn được nối vào đúng lượt đó.
- Người kia nói tiếp trong lúc chờ thì thành lượt riêng.
- Server gửi `language_hints_strict: true` để tiếng Hàn không bị nhận nhầm sang ngôn ngữ khác (ngôn ngữ ngoài cặp vi/ko không được dịch).

## Cấu hình Cloudflare

Bindings khai báo trong `wrangler.jsonc`: D1 `ACCESS_DB` (`cost-access`), KV `DICTIONARY`, assets `ASSETS`.

Đặt trong dashboard (không commit vào repo):

| Tên | Loại | Ý nghĩa |
|---|---|---|
| `SONIOX_API_KEY` | secret | Khóa Soniox chính |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | secret | Gửi OTP SMS |
| `ADMIN_PHONE`, `ADMIN_EMAIL` | variable | Chủ ứng dụng (quản trị) |
| `EMAIL_ACCESS_AUD`, `EMAIL_ACCESS_DOMAIN` | variable | Ứng dụng Cloudflare Access cho đăng nhập email |

`keep_vars: true` giữ các variable này khi deploy; secret luôn được giữ.

## Chạy và deploy

```bash
npm install
npm test
cp .dev.vars.example .dev.vars   # điền khóa thật, không commit
npm run build
npx wrangler dev
```

Deploy (chạy test, build rồi `wrangler deploy`):

```bash
npx wrangler login
npm run deploy
```

Nếu máy có biến môi trường `CLOUDFLARE_API_TOKEN` không đủ quyền Workers, wrangler sẽ dùng token đó thay cho đăng nhập OAuth; bỏ biến đó trong lệnh deploy (`env -u CLOUDFLARE_API_TOKEN npm run deploy`).

Tạo database mới từ đầu: `npx wrangler d1 migrations apply cost-access --remote` (các câu lệnh dùng `IF NOT EXISTS`, chạy lại trên database đang có cũng an toàn).

## API

- `GET /api/healthz` — trạng thái Worker và secret.
- `POST /api/soniox/session` — temporary key + cấu hình phiên dịch hai chiều.
- `GET/PUT /api/dictionary` — từ điển chuyên ngành dùng chung.
- `/access`, `/api/access/*` — đăng nhập OTP và quản trị quyền truy cập.
