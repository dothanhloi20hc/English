// WordWise Service Worker
// Đổi số version này (v5, v6...) mỗi khi muốn ép trình duyệt xoá cache cũ và tải lại toàn bộ.
const CACHE = 'wordwise-v5';
const SELF_URL = self.location.href.replace('sw.js', 'index.html');

// Các file tĩnh cần cache sẵn để dùng offline (font, thư viện Excel, icon, manifest, dữ liệu từ vựng)
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  'https://raw.githubusercontent.com/dothanhloi20hc/English/main/Vocab.xlsx',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Inter:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(PRECACHE.map(u => fetch(u).then(r => r.ok && c.put(u, r)).catch(() => {})))
    )
  );
  self.skipWaiting(); // kích hoạt bản Service Worker mới ngay, không chờ user đóng hết các tab cũ
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim(); // áp dụng ngay cho các tab/PWA đang mở, không cần load lại thủ công
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // TRANG HTML CHÍNH (navigation) — dùng NETWORK-FIRST: luôn cố lấy bản MỚI NHẤT từ mạng trước.
  // Đây là điểm mấu chốt khắc phục lỗi "up code mới lên GitHub nhưng máy vẫn không thấy thay đổi" —
  // trước đây dùng cache-first cho MỌI request kể cả trang HTML, khiến máy cứ mãi dùng bản cache cũ
  // dù đã deploy code mới, chỉ cập nhật được khi người dùng tự xoá cache/gỡ cài app thủ công.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match(SELF_URL)))
    );
    return;
  }

  // CÁC FILE TĨNH KHÁC (font, thư viện, icon, Vocab.xlsx...) — CACHE-FIRST để vào nhanh + dùng được offline,
  // đồng thời âm thầm cập nhật lại cache ở nền cho lần sau (stale-while-revalidate).
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
