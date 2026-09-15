# Soniox Việt ↔ Hàn trên Cloudflare

Ứng dụng phiên dịch giọng nói hai chiều Việt Nam–Hàn Quốc theo thời gian thực. Frontend React và Cloudflare Worker được triển khai chung bằng Workers Static Assets. Soniox thực hiện nhận dạng giọng nói, nhận diện ngôn ngữ và dịch trực tiếp qua WebSocket.

## Kiến trúc

1. Trình duyệt gọi `POST /api/soniox/session`.
2. Cloudflare Worker dùng secret `SONIOX_API_KEY` để tạo temporary key có thời hạn 120 giây.
3. Trình duyệt dùng temporary key để kết nối trực tiếp tới Soniox WebSocket.
4. API key chính không bao giờ xuất hiện trong frontend hoặc GitHub.

## Chạy local

```bash
npm install
cp .dev.vars.example .dev.vars
# Điền SONIOX_API_KEY vào .dev.vars, không commit file này.
npm run build
npx wrangler dev
```

Mở URL do Wrangler hiển thị. Trình duyệt cần quyền sử dụng micro.

## Deploy Cloudflare

### Cách 1: Cloudflare Dashboard + GitHub

1. Trong Cloudflare Dashboard, mở Workers & Pages.
2. Chọn Create application, Import a repository và chọn repo này.
3. Build command: `npm run build`.
4. Deploy command: `npx wrangler deploy`.
5. Sau lần deploy đầu tiên, mở Worker Settings → Variables and Secrets.
6. Thêm secret `SONIOX_API_KEY`, sau đó deploy lại.

### Cách 2: Wrangler CLI

```bash
npm install
npx wrangler login
npx wrangler secret put SONIOX_API_KEY
npm run deploy
```

Không đặt khóa thật trong `.env`, `.dev.vars.example`, `wrangler.jsonc` hoặc mã nguồn.

## API

- `GET /api/healthz` — trạng thái Worker và secret.
- `POST /api/soniox/session` — tạo temporary key + cấu hình phiên dịch hai chiều.

## Chi phí

Cloudflare chỉ phục vụ frontend và endpoint tạo temporary key. Audio truyền thẳng từ trình duyệt tới Soniox; thời lượng dịch được tính bởi tài khoản Soniox.
