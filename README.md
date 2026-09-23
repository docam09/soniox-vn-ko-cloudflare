# Soniox Việt ↔ Hàn trên Cloudflare

Ứng dụng phiên dịch giọng nói hai chiều Việt Nam–Hàn Quốc theo thời gian thực. Frontend React và Cloudflare Worker được triển khai chung bằng Workers Static Assets. Soniox thực hiện nhận dạng giọng nói, nhận diện ngôn ngữ và dịch trực tiếp qua WebSocket. Từ điển chuyên ngành được đồng bộ qua Cloudflare KV để dùng chung trên nhiều thiết bị và địa chỉ IP.

## Kiến trúc

1. Trình duyệt gọi `POST /api/soniox/session`.
2. Cloudflare Worker dùng secret `SONIOX_API_KEY` để tạo temporary key có thời hạn 120 giây.
3. Trình duyệt dùng temporary key để kết nối trực tiếp tới Soniox WebSocket.
4. API key chính không bao giờ xuất hiện trong frontend hoặc GitHub.
5. Cloudflare KV lưu một từ điển dùng chung; lịch sử hội thoại vẫn chỉ lưu trên từng trình duyệt.

Ứng dụng buộc bản dịch dùng đại từ lịch sự, trung tính; bản dịch tiếng Việt không dùng `mày` hoặc `tao` mà ưu tiên `bạn`, `anh/chị` và `tôi` theo ngữ cảnh. Bản dịch không tự phát âm; người dùng vẫn có thể bấm nút phát ở từng lượt đã lưu.

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
npx wrangler kv namespace create DICTIONARY
# Chép id namespace vào binding DICTIONARY trong wrangler.jsonc.
npx wrangler secret put SONIOX_API_KEY
npm run deploy
```

Không đặt khóa thật trong `.env`, `.dev.vars.example`, `wrangler.jsonc` hoặc mã nguồn.

## API

- `GET /api/healthz` – trạng thái Worker và secret.
- `GET /api/dictionary` – tải từ điển dùng chung.
- `PUT /api/dictionary` – lưu từ điển dùng chung.
- `POST /api/soniox/session` – tạo temporary key + cấu hình phiên dịch hai chiều.

## Chi phí

Cloudflare chỉ phục vụ frontend và endpoint tạo temporary key. Audio truyền thẳng từ trình duyệt tới Soniox; thời lượng dịch được tính bởi tài khoản Soniox.
