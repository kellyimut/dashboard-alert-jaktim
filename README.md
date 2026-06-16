# 🚨 Dashboard Alert – Jakarta Timur

Dashboard real-time monitoring alert per STO, dengan breakdown Customer Type.
Data diambil langsung dari Google Spreadsheet.

---

## 📋 Struktur File

```
dashboard-alert-jaktim/
├── index.html    ← Halaman utama dashboard
├── style.css     ← Tampilan / styling
├── app.js        ← Logic fetch data & render
└── README.md     ← Panduan ini
```

---

## ✅ LANGKAH 1 — Set Spreadsheet ke Publik

> ⚠️ **Wajib dilakukan** agar dashboard bisa baca data.

1. Buka spreadsheet kamu di Google Sheets
2. Klik **Share** (pojok kanan atas)
3. Klik **"Change to anyone with the link"**
4. Pastikan role-nya **Viewer**
5. Klik **Done**

---

## ✅ LANGKAH 2 — Sesuaikan Nama Kolom di `app.js`

Buka file `app.js`, cari bagian `CONFIG` di baris paling atas:

```javascript
const CONFIG = {
  SHEET_ID:   '1q_Ifa8RXrXm4fxs8gzcEMROU9jGp5NfW2cMeUGFbsFg',
  SHEET_NAME: 'hari ini',          // ← Nama sheet (harus sama persis, case-sensitive)

  COL_STO:   'STO',               // ← Sesuaikan dengan nama header kolom STO di sheet kamu
  COL_SN:    'SN',                // ← Sesuaikan dengan nama header kolom Serial Number
  COL_CTYPE: 'CUSTOMER TYPE',     // ← Sesuaikan dengan nama header kolom Customer Type
};
```

> Pastikan nama kolom (`COL_STO`, `COL_SN`, `COL_CTYPE`) **sama persis** dengan header di baris pertama sheet kamu (case-insensitive sudah ditangani).

---

## ✅ LANGKAH 3 — Upload ke GitHub

### 3a. Buat Repository Baru
1. Buka [github.com](https://github.com) → Login
2. Klik **"+"** → **"New repository"**
3. Nama repo: `dashboard-alert-jaktim`
4. Pilih **Public**
5. Klik **"Create repository"**

### 3b. Upload File via Browser (cara termudah)
1. Di halaman repo baru, klik **"uploading an existing file"**
2. Drag & drop semua file:
   - `index.html`
   - `style.css`
   - `app.js`
3. Tulis commit message: `first commit: dashboard alert jaktim`
4. Klik **"Commit changes"**

### 3c. Upload via Terminal (opsional)
```bash
cd dashboard-alert-jaktim
git init
git add .
git commit -m "first commit: dashboard alert jaktim"
git branch -M main
git remote add origin https://github.com/USERNAME/dashboard-alert-jaktim.git
git push -u origin main
```

---

## ✅ LANGKAH 4 — Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → Login dengan GitHub
2. Klik **"Add New…"** → **"Project"**
3. Pilih repo **`dashboard-alert-jaktim`** → klik **"Import"**
4. Konfigurasi:
   - **Framework Preset**: `Other` (bukan Next.js atau Vite)
   - **Root Directory**: `.` (default)
   - **Build Command**: *(kosongkan)*
   - **Output Directory**: `.` (titik satu)
5. Klik **"Deploy"**
6. Tunggu ±30 detik — Vercel akan beri link seperti:
   ```
   https://dashboard-alert-jaktim.vercel.app
   ```

---

## 🔄 Update Data Otomatis

Dashboard **auto-refresh setiap 5 menit** secara otomatis.
Kamu tidak perlu reload halaman — data akan diperbarui sendiri.

Untuk mengubah interval refresh, edit baris ini di `app.js`:
```javascript
REFRESH_MS: 5 * 60 * 1000,   // 5 menit. Ubah angka 5 sesuai kebutuhan
```

---

## 🔄 Update Dashboard ke Vercel

Setiap kali kamu edit file dan push ke GitHub, Vercel otomatis deploy ulang:
```bash
git add .
git commit -m "update dashboard"
git push
```

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---|---|
| Data tidak muncul | Pastikan spreadsheet sudah publik (Langkah 1) |
| Kolom tidak ditemukan | Cek nama kolom di `app.js` bagian `CONFIG` |
| Dashboard kosong | Buka DevTools (F12) → Console, lihat error merah |
| Sheet name salah | Pastikan `SHEET_NAME` di `app.js` sama persis dengan nama tab sheet |

---

## 📌 Fitur Dashboard

- ✅ Total alert real-time per STO
- ✅ Breakdown Customer Type per STO dengan progress bar
- ✅ Klik angka total → modal detail semua alert STO tersebut
- ✅ Klik angka per Customer Type → modal detail filter per type
- ✅ Modal dilengkapi fitur pencarian SN / Customer Type
- ✅ Auto-refresh setiap 5 menit
- ✅ Tampilan dark mode, responsif di mobile
