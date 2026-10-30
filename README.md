# TikTok Live WebSocket & Donor Chat Overlay 🔴💬

Aplikasi WebSocket khusus TikTok Live yang membaca komentar live streaming secara real-time. Penonton dan streamer dapat melihat komentar di layar overlay, dan **komentar dari donatur/gifter akan otomatis ditampilkan dalam kotak khusus (VIP Donor Box)** dengan efek animasi bercahaya (neon gradient glow).

---

## Fitur Utama

- ⚡ **Realtime WebSocket Feed**: Menyiarkan komentar, like, join, dan donasi/gift TikTok Live tanpa delay.
- 👑 **Kotak Khusus Donatur (VIP Box)**:
  - Setiap penonton yang pernah memberikan gift (Mawar, Paus, Singa, dsb.) otomatis dicatat sebagai Donatur.
  - Saat donatur mengetik komentar, komentar mereka tampil di **kotak khusus dengan border gradasi animasi neon emas/ungu, badge mahkota "DONATUR", dan jumlah diamond**.
- 🎁 **Pop-up Gift Alert**: Animasi banner notifikasi gift saat penonton mengirim donasi.
- 📺 **OBS & Stream Ready**: Halaman overlay `/overlay` berlatar belakang transparan, siap dimasukkan ke OBS Studio atau TikTok LIVE Studio sebagai Browser Source.
- 🧪 **Built-in Simulator**: Dashboard streamer dilengkapi simulator offline untuk mengetes chat biasa, chat donatur (kotak khusus), dan gift tanpa harus sedang live di TikTok.

---

## Cara Menjalankan

### 1. Install Dependensi (jika belum)
```bash
npm install
```

### 2. Jalankan Server
```bash
npm start
# atau
node server.js
```

Server akan berjalan pada port `3000`:
- **Dashboard Streamer**: [http://localhost:3000](http://localhost:3000)
- **Overlay Chat (OBS/Penonton)**: [http://localhost:3000/overlay](http://localhost:3000/overlay)

---

## Panduan Penggunaan

### 1. Menghubungkan ke TikTok Live
1. Buka Dashboard di browser: `http://localhost:3000`
2. Pada form **Hubungkan TikTok Live**, masukkan username akun TikTok yang sedang live (contoh: `@username` atau `username`).
3. Klik tombol **Hubungkan**. Status akan berubah menjadi **Terhubung** warna hijau.

### 2. Memasang Chat di OBS Studio / TikTok LIVE Studio
1. Di OBS Studio, tambahkan Source baru: **Browser**.
2. Beri nama (misal: *TikTok Live Chat*).
3. Masukkan URL: `http://localhost:3000/overlay`
4. Atur ukuran:
   - **Width**: `420`
   - **Height**: `700`
5. Centang opsi *Shutdown source when not visible* atau biarkan default.
6. Klik **OK**. Chat overlay transparan akan langsung muncul di stream Anda!
Tersedia 2 pilihan URL overlay untuk Browser Source OBS:

1. **Khusus Chat Kustom (Rekomendasi untuk Chat Saja)**:
   - URL: `http://localhost:3000/chat`
   - Bebas Anda custom tampilannya di:
     - `public/obs-chat.css`: variabel CSS warna, font, background, glow kotak donatur.
     - `public/obs-chat.js`: pengaturan jumlah chat, auto-hide timer, animasi, suara, dan format HTML.
     - `public/obs-socket.js`: client WebSocket mandiri.
   - Parameter URL tambahan (opsional):
     - `http://localhost:3000/chat?timeout=15` (pesan otomatis hilang setelah 15 detik)
     - `http://localhost:3000/chat?onlyDonors=1` (hanya tampilkan chat dari donatur)
     - `http://localhost:3000/chat?sound=0` (nonaktifkan audio chime)
     - `http://localhost:3000/chat?max=10` (batasi maksimal 10 chat tampil di layar)
     - `http://localhost:3000/chat?anim=pop` (ganti animasi masuk: `slide-left`, `pop`, `fade-in`)

2. **Overlay Lengkap (Chat + Gift Alert + Top Donatur)**:
   - URL: `http://localhost:3000/overlay`

**Pengaturan Ukuran di OBS:**
- **Width**: `420`
- **Height**: `700`

### 3. Menguji Tampilan dengan Simulator (Tanpa Perlu Live)
Pada Dashboard streamer di bagian **Simulator Pengujian (Offline Test)**:
1. Klik **Kirim** pada *Simulasi Komentar Biasa* untuk melihat komentar penonton umum.
2. Klik **Kirim VIP** pada *Simulasi Komentar Donatur* untuk melihat langsung tampilan **Kotak Khusus Donatur** dengan border animasi emas bercahaya dan badge donatur.
3. Klik tombol **🌹 Mawar**, **🐳 Paus**, atau **🌌 Universe** untuk melihat pop-up alert gift dan penambahan donatur ke daftar peringkat.

---

## Struktur File Proyek

```
WEBSOCKET/
├── server.js              # Server Node.js (Express, WebSocket wss, TikTok Live Connector)
├── package.json           # Dependensi project
├── public/
│   ├── index.html         # Dashboard Kontrol Streamer & Simulator
│   ├── style.css          # Styling CSS global dashboard & overlay lengkap
│   ├── dashboard.js       # WebSocket client & pengatur dashboard streamer
│   ├── overlay.html       # Tampilan Overlay Lengkap (Chat + Alert Gift + Top Donatur)
│   ├── overlay.js         # Script WebSocket overlay lengkap
│   ├── obs-chat.html      # Halaman Mandiri Khusus Chat OBS
│   ├── obs-chat.css       # Styling & Variabel CSS Khusus Chat OBS (Bisa di-custom)
│   ├── obs-chat.js        # Logika Controller & Render Chat OBS (Bisa di-custom)
│   └── obs-socket.js      # Library Client WebSocket Mandiri untuk OBS
└── README.md              # Dokumentasi & panduan
```


