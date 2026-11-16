# PeopleDesk — Aplikasi Input Data Karyawan

Aplikasi web sederhana untuk mencatat dan mengelola data karyawan. Dibuat menggunakan HTML, CSS, dan JavaScript tanpa backend.

## Fitur
- Tambah, edit, dan hapus data karyawan.
- Tombol Detail Karyawan untuk menampilkan biodata lengkap dalam format lembar profil.
- Informasi tambahan agama dan lokasi/kantor.
- Pencarian berdasarkan nama atau NIK.
- Filter berdasarkan departemen dan status.
- Dashboard ringkasan jumlah karyawan, karyawan tetap/kontrak, dan jumlah departemen.
- Export data ke CSV yang dapat dibuka dengan Microsoft Excel.
- Validasi NIK agar tidak duplikat.

## Persyaratan
- Browser modern (Chrome, Edge, Firefox).
- Visual Studio Code (opsional, untuk mengedit source code).

## Cara menjalankan
1. Ekstrak file ZIP ke folder komputer.
2. Buka folder `aplikasi_data_karyawan` melalui VS Code.
3. Buka file `index.html`.
4. Klik kanan pada `index.html`, lalu pilih **Open with Live Server** (jika ekstensi Live Server sudah terpasang).
5. Jika tidak menggunakan Live Server, klik dua kali `index.html` untuk membukanya langsung di browser.

## Penyimpanan data
Data disimpan pada `localStorage` browser dengan key `peopledesk_employees_v1`. Data hanya tersedia pada browser dan profil pengguna yang sama di komputer tersebut. Menghapus data situs/browser dapat menghapus data aplikasi. Gunakan tombol **Export CSV** secara berkala sebagai backup.

## Struktur folder
```text
aplikasi_data_karyawan/
├── index.html
├── style.css
├── app.js
└── README.md
```

## Catatan pengembangan
Versi ini cocok untuk penggunaan lokal/satu browser. Untuk penggunaan multi-user, login, hak akses, dan database perusahaan, aplikasi perlu dikembangkan menggunakan backend dan database server seperti MySQL.
