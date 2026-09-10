# Backend Blog App

Dokumentasi teknis backend REST API untuk aplikasi mobile blog yang dibuat dengan Flutter. Backend ini menyediakan autentikasi pengguna serta pengelolaan kategori dan artikel blog.

> Dokumentasi ini mengikuti implementasi yang ada saat ini pada `src/app.ts`, `src/db/index.ts`, dan `src/db/data_schema.ts`. Beberapa catatan keamanan dan keterbatasan di bagian akhir sengaja dicantumkan agar perbedaan antara kondisi saat ini dan kebutuhan production terlihat jelas.

## Daftar Isi

1. [Ringkasan](#ringkasan)
2. [Teknologi](#teknologi)
3. [Struktur Proyek](#struktur-proyek)
4. [Prasyarat](#prasyarat)
5. [Instalasi dan Menjalankan Server](#instalasi-dan-menjalankan-server)
6. [Konfigurasi Database](#konfigurasi-database)
7. [Arsitektur Request](#arsitektur-request)
8. [Autentikasi](#autentikasi)
9. [Validasi Request](#validasi-request)
10. [Referensi API](#referensi-api)
11. [Format Error](#format-error)
12. [Contoh Alur Penggunaan](#contoh-alur-penggunaan)
13. [Kode Status HTTP](#kode-status-http)
14. [Pengembangan dan Debugging](#pengembangan-dan-debugging)
15. [Catatan Keamanan dan Keterbatasan](#catatan-keamanan-dan-keterbatasan)

## Ringkasan

Server berjalan menggunakan Express pada port `8000` dan menerima request JSON. Semua endpoint selain pendaftaran user dan login membutuhkan token JWT pada header `Authorization`.

Base URL lokal:

```text
http://localhost:8000
```

Kelompok endpoint:

| Kelompok | Endpoint | Perlindungan |
|---|---|---|
| Health/probe | `GET /` | JWT |
| Auth | `POST /api/auth/login` | Publik |
| User | `POST /api/users` | Publik untuk pendaftaran |
| User | `GET/PUT/DELETE /api/users` | JWT |
| Category | `GET/POST/PUT/DELETE /api/categories` | JWT |
| Post | `GET/POST/PUT/DELETE /api/posts` | JWT |

## Teknologi

- Node.js dengan mode ES module (`"type": "module"`).
- TypeScript dengan konfigurasi strict.
- Express `5.x` sebagai HTTP server.
- `mysql2/promise` sebagai client dan connection pool MySQL.
- Zod untuk validasi body request.
- `jsonwebtoken` untuk membuat dan memverifikasi JWT.
- `cors` untuk mengaktifkan CORS.
- `tsx` untuk menjalankan TypeScript langsung dalam mode development.

## Struktur Proyek

```text
BackendATS/ (nama folder repository saat ini)
├── package.json              # Dependency dan script npm
├── package-lock.json         # Lockfile dependency
├── tsconfig.json             # Konfigurasi TypeScript
├── src/
│   ├── app.ts                # Inisialisasi Express, middleware, route, dan server
│   └── db/
│       ├── index.ts          # Konfigurasi connection pool MySQL
│       └── data_schema.ts    # Schema validasi Zod dan type input
└── README.md                # Dokumentasi ini
```

Saat ini route, middleware, konfigurasi port, dan query SQL berada dalam satu file `src/app.ts`.

## Prasyarat

- Node.js yang mendukung TypeScript/ES module sesuai dependency proyek.
- npm.
- MySQL Server yang aktif.
- Database bernama `db_ats`.
- Tabel `categories`, `posts`, dan `users` dengan kolom yang digunakan oleh query API.

## Instalasi dan Menjalankan Server

### 1. Install dependency

```bash
npm install
```

### 2. Siapkan database

Buat database terlebih dahulu:

```sql
CREATE DATABASE db_ats;
```

Kemudian buat tabel yang kompatibel dengan query pada aplikasi. Karena repository ini belum menyediakan migration atau file SQL resmi, struktur berikut adalah contoh minimum yang dapat digunakan dan perlu disesuaikan dengan kebutuhan aplikasi:

```sql
USE db_ats;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NULL,
  content TEXT NOT NULL,
  excerpt VARCHAR(255) NULL,
  cover_image VARCHAR(255) NULL,
  category_id INT UNSIGNED NOT NULL,
  author VARCHAR(100) NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_posts_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### 3. Jalankan mode development

```bash
npm run dev
```

Script tersebut menjalankan `tsx watch src/app.ts`. Jika berhasil, server mendengarkan pada:

```text
http://localhost:8000
```

Tidak ada script build, migration, atau test yang didefinisikan pada `package.json` saat ini.

## Konfigurasi Database

Konfigurasi aktif pada `src/db/index.ts`:

| Opsi | Nilai saat ini |
|---|---|
| Host | `localhost` |
| User | `root` |
| Database | `db_ats` |
| Password | Tidak diatur |
| Port | Default MySQL dari driver |

Pool dibuat saat module database di-import. Artinya aplikasi membutuhkan koneksi database yang tersedia sejak server mulai berjalan. Konfigurasi belum membaca environment variable.

## Arsitektur Request

Urutan pemrosesan request:

1. Express membuat aplikasi dan mengatur port `8000`.
2. `cors()` mengizinkan CORS dengan konfigurasi default.
3. `express.json()` membaca body JSON.
4. Route yang dilindungi menjalankan `tokenMiddleware`.
5. Body divalidasi menggunakan schema Zod untuk endpoint create/update.
6. Query SQL dijalankan melalui pool MySQL dengan parameter placeholder `?`.
7. Response JSON dikirim bersama HTTP status.

Query insert, update, dan delete memakai parameter terikat sehingga nilai input tidak digabungkan langsung ke string SQL.

## Integrasi dengan Aplikasi Flutter

Backend ini dikonsumsi oleh aplikasi mobile Flutter sebagai client. Flutter bertanggung jawab atas tampilan blog, navigasi, penyimpanan token di perangkat, dan pemanggilan HTTP; backend bertanggung jawab atas autentikasi, validasi, dan persistence data MySQL.

### Base URL pada perangkat mobile

`localhost` berarti perangkat yang menjalankan backend, bukan selalu emulator atau perangkat fisik:

| Target Flutter | Base URL yang umum |
|---|---|
| Android Emulator | `http://10.0.2.2:8000` |
| iOS Simulator | `http://localhost:8000` |
| Perangkat fisik | `http://<IP-LAN-komputer>:8000` |

Pastikan komputer dan perangkat berada pada jaringan yang sama saat menggunakan perangkat fisik. Backend juga harus mendengarkan pada interface yang dapat diakses perangkat, bukan hanya loopback, apabila konfigurasi jaringan mengharuskannya.

### Alur aplikasi mobile

1. Flutter mengirim data registrasi ke `POST /api/users`.
2. Flutter mengirim email dan password ke `POST /api/auth/login`.
3. Flutter menyimpan token yang diterima secara aman, misalnya memakai secure storage.
4. Setiap request ke endpoint protected mengirim header `Authorization: Bearer <token>`.
5. Flutter mengambil daftar kategori atau artikel dari endpoint GET.
6. Flutter memakai endpoint POST/PUT/DELETE untuk fitur pengelolaan konten yang tersedia bagi user terautentikasi.
7. Jika response `401` atau `403`, aplikasi sebaiknya menghapus token lokal dan mengarahkan user untuk login kembali.

Contoh request menggunakan package `http` di Flutter:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

const baseUrl = 'http://10.0.2.2:8000';

Future<String> login(String email, String password) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'email': email, 'password': password}),
  );

  if (response.statusCode != 200) {
    throw Exception('Login gagal: ${response.body}');
  }

  final payload = jsonDecode(response.body) as Map<String, dynamic>;
  return payload['token'] as String;
}

Future<List<dynamic>> fetchPosts(String token) async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/posts'),
    headers: {'Authorization': 'Bearer $token'},
  );

  if (response.statusCode != 200) {
    throw Exception('Gagal mengambil artikel: ${response.body}');
  }

  final payload = jsonDecode(response.body) as Map<String, dynamic>;
  return payload['data'] as List<dynamic>;
}
```

Tambahkan dependency `http` pada aplikasi Flutter, bukan pada repository backend. Untuk production, gunakan HTTPS dan simpan token dengan `flutter_secure_storage` atau mekanisme secure storage yang setara.

## Autentikasi

### Login

Gunakan `POST /api/auth/login` dengan email dan password. Jika cocok dengan record user, server membuat JWT menggunakan secret yang saat ini ditulis langsung sebagai `"tokendeh"`.

Contoh header untuk endpoint protected:

```http
Authorization: Bearer <token>
```

Middleware hanya mengambil token pada bagian kedua header yang dipisahkan spasi dan memverifikasi signature JWT. Payload hasil verifikasi belum digunakan untuk authorization berbasis role atau identitas user.

### Endpoint yang membutuhkan token

- `GET /`
- Semua endpoint `/api/categories`
- Semua endpoint `/api/posts`
- `GET /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

Endpoint publik:

- `POST /api/users`
- `POST /api/auth/login`

## Validasi Request

Validasi dilakukan dengan `schema.parse(req.body)`. Ringkasan aturan:

### Category (`datacategory`)

| Field | Tipe | Aturan |
|---|---|---|
| `name` | string | Wajib, 1-100 karakter |
| `slug` | string | Wajib, 1-120 karakter |
| `description` | string/null | Opsional, dapat `null` |

### Post (`dataposts`)

| Field | Tipe | Aturan |
|---|---|---|
| `title` | string | Wajib, 1-255 karakter |
| `slug` | string/null | Opsional, maksimal 255 karakter; jika ada hanya lowercase, angka, dan hyphen dengan pola slug |
| `content` | string | Wajib, minimal 1 karakter |
| `excerpt` | string/null | Opsional, maksimal 255 karakter |
| `cover_image` | string/null | Opsional, maksimal 255 karakter |
| `category_id` | number | Wajib, integer positif |
| `author` | string/null | Opsional, maksimal 100 karakter |
| `status` | enum | `draft` atau `published`; default `published` |

### User (`datausers`)

| Field | Tipe | Aturan |
|---|---|---|
| `username` | string | Wajib, minimal 4 karakter |
| `email` | email | Wajib, format email valid |
| `password` | string | Wajib, minimal 4 karakter |

### Credentials (`credentials`)

| Field | Tipe | Aturan |
|---|---|---|
| `email` | email | Wajib, format email valid |
| `password` | string | Wajib, minimal 4 karakter |

Zod juga menolak tipe field yang tidak sesuai. Namun, beberapa handler saat ini mengubah seluruh kegagalan validasi maupun database menjadi response status `500` atau `400`, sehingga detail error Zod tidak selalu dikembalikan ke client.

## Referensi API

Semua contoh menggunakan `http://localhost:8000`. Body request harus menggunakan:

```http
Content-Type: application/json
```

### `POST /api/users`

Mendaftarkan user baru. Endpoint ini publik.

Request:

```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "rahasia"
}
```

Response sukses (`201`):

```json
{
  "message": "User berhasil di buat",
  "data": {
    "userId": 1,
    "username": "admin",
    "email": "admin@example.com",
    "password": "rahasia"
  }
}
```

### `POST /api/auth/login`

Memvalidasi kredensial dan mengembalikan JWT.

Request:

```json
{
  "email": "admin@example.com",
  "password": "rahasia"
}
```

Response sukses (`200`):

```json
{
  "message": "Login berhasil",
  "token": "<jwt>"
}
```

Jika user tidak ditemukan atau password tidak cocok, handler mengembalikan pesan error dari exception dengan status `500`.

### `GET /api/users`

Mengambil seluruh data dari tabel `users`. Membutuhkan JWT.

Response sukses (`201`):

```json
{
  "message": "fetch data user berhasil",
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "password": "..."
    }
  ]
}
```

Response mengikuti kolom yang dikembalikan MySQL.

### `PUT /api/users/:id`

Mengganti `username`, `email`, dan `password` user. Membutuhkan JWT.

Contoh:

```bash
curl -X PUT http://localhost:8000/api/users/1 ^
  -H "Authorization: Bearer <jwt>" ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin-baru\",\"email\":\"admin-baru@example.com\",\"password\":\"rahasia-baru\"}"
```

Response sukses saat ini menggunakan status `201`:

```json
{
  "message": "Berhasil mengubah users",
  "data": {
    "username": "admin-baru",
    "email": "admin-baru@example.com",
    "password": "rahasia-baru"
  }
}
```

### `DELETE /api/users/:id`

Menghapus user berdasarkan ID. Membutuhkan JWT.

Response sukses (`200`):

```json
{
  "message": "users berhasil dihapus"
}
```

Jika ID tidak ditemukan, response `404`.

### `GET /api/categories`

Mengambil seluruh kategori. Membutuhkan JWT.

Response sukses (`200`):

```json
{
  "message": "Berhasil fetch categori!",
  "data": []
}
```

### `POST /api/categories`

Membuat kategori baru. Membutuhkan JWT.

Request:

```json
{
  "name": "Engineering",
  "slug": "engineering",
  "description": "Artikel seputar engineering"
}
```

Response sukses (`201`):

```json
{
  "message": "category created succesfully",
  "data": {
    "categoryId": 1,
    "name": "Engineering"
  }
}
```

### `PUT /api/categories/:id`

Memperbarui seluruh field kategori. Membutuhkan JWT.

Request menggunakan schema category yang sama dengan endpoint create:

```json
{
  "name": "Product Engineering",
  "slug": "product-engineering",
  "description": "Kategori yang diperbarui"
}
```

Response sukses (`200`):

```json
{
  "message": "Data category berhasil diupdate"
}
```

ID tidak valid menghasilkan `400`, sedangkan record yang tidak ditemukan menghasilkan `404`.

### `DELETE /api/categories/:id`

Menghapus kategori berdasarkan ID. Membutuhkan JWT.

Response sukses (`200`):

```json
{
  "message": "category berhasil dihapus"
}
```

Jika kategori tidak ditemukan, response `404`.

### `GET /api/posts`

Mengambil seluruh post. Membutuhkan JWT.

Response sukses (`200`):

```json
{
  "message": "Berhasil fetch posts!",
  "data": []
}
```

### `POST /api/posts`

Membuat post baru. Membutuhkan JWT.

Request:

```json
{
  "title": "Mengenal pengembangan aplikasi mobile",
  "slug": "mengenal-pengembangan-aplikasi-mobile",
  "content": "Isi artikel...",
  "excerpt": "Ringkasan artikel",
  "cover_image": "https://example.com/cover.jpg",
  "category_id": 1,
  "author": "admin",
  "status": "published"
}
```

`status` boleh dihilangkan; nilai default dari schema adalah `published`.

Response sukses (`201`):

```json
{
  "message": "post created succesfully",
  "data": {
    "postId": 1,
    "title": "Mengenal pengembangan aplikasi mobile"
  }
}
```

### `PUT /api/posts/:id`

Memperbarui seluruh field post. Membutuhkan JWT dan memakai schema post yang sama dengan endpoint create.

Response sukses (`200`):

```json
{
  "message": "Data post berhasil diupdate"
}
```

ID tidak valid menghasilkan `400`, sedangkan post yang tidak ditemukan menghasilkan `404`.

### `DELETE /api/posts/:id`

Menghapus post berdasarkan ID. Membutuhkan JWT.

Response sukses (`200`):

```json
{
  "message": "post berhasil dihapus"
}
```

Jika post tidak ditemukan, response `404`.

### `GET /`

Endpoint probe sederhana yang juga membutuhkan JWT. Handler hanya menulis `token terdeteksi` ke console dan tidak mengirim response eksplisit. Karena itu endpoint ini tidak dapat dianggap sebagai health check yang selesai dengan response JSON sampai handler diperbaiki.

## Format Error

Format error tidak sepenuhnya seragam. Contoh response yang digunakan:

```json
{
  "message": "Invalid category ID"
}
```

```json
{
  "message": "Unauthorized. No token provided"
}
```

```json
{
  "message": "Invalid token"
}
```

Kategori umum:

- `401`: header/token tidak tersedia.
- `403`: token tersedia tetapi signature/token tidak valid.
- `400`: ID path tidak valid atau data update category/post gagal divalidasi.
- `404`: record yang hendak di-update/delete tidak ditemukan.
- `500`: kegagalan query, kegagalan create/delete, atau kegagalan login pada implementasi saat ini.

## Contoh Alur Penggunaan

### Dengan PowerShell

```powershell
$base = "http://localhost:8000"

$user = Invoke-RestMethod "$base/api/users" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"admin","email":"admin@example.com","password":"rahasia"}'

$login = Invoke-RestMethod "$base/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"rahasia"}'

$headers = @{ Authorization = "Bearer $($login.token)" }

Invoke-RestMethod "$base/api/categories" `
  -Method Get `
  -Headers $headers
```

Urutan yang disarankan:

1. Pastikan MySQL dan database `db_ats` aktif.
2. Jalankan server dengan `npm run dev`.
3. Buat user melalui `POST /api/users`.
4. Login melalui `POST /api/auth/login`.
5. Simpan token JWT.
6. Kirim token pada endpoint protected.
7. Buat category sebelum membuat post agar `category_id` valid.

## Kode Status HTTP

| Status | Makna pada API |
|---:|---|
| `200` | Fetch, update, atau delete berhasil |
| `201` | Resource dibuat; juga dipakai oleh beberapa response user |
| `400` | ID atau input tertentu tidak valid |
| `401` | Token tidak diberikan |
| `403` | Token tidak valid |
| `404` | Data target tidak ditemukan |
| `500` | Error server/database atau error login yang belum dipetakan secara khusus |

## Pengembangan dan Debugging

Perintah yang tersedia:

```bash
npm run dev
```

Type-check manual dapat dijalankan dengan:

```bash
npx tsc --noEmit
```

Tidak ada test otomatis pada repository. Script `npm test` saat ini memang mengembalikan error `no test specified`.

Jika server gagal start, periksa:

1. Versi Node.js dan dependency sudah ter-install.
2. MySQL berjalan pada host lokal.
3. Database `db_ats` tersedia.
4. User MySQL `root` dapat login tanpa password, sesuai konfigurasi saat ini.
5. Tabel dan nama kolom sesuai query di `src/app.ts`.

## Catatan Keamanan dan Keterbatasan

Bagian ini penting sebelum backend dipakai di production:

1. **Password disimpan dan dibandingkan sebagai plaintext.** Gunakan hashing seperti Argon2 atau bcrypt. Password tidak boleh disimpan di database maupun dikembalikan di response dalam bentuk plaintext.
2. **Password dikembalikan oleh endpoint create/update user dan query list user.** Response publik harus menghapus field password.
3. **JWT secret hardcoded.** Secret `"tokendeh"` harus dipindahkan ke environment variable yang kuat dan tidak boleh masuk repository.
4. **JWT tidak memiliki expiry yang ditentukan.** Tambahkan masa berlaku (`expiresIn`) dan strategi refresh/revocation bila diperlukan.
5. **Belum ada authorization berbasis role atau ownership.** Semua token yang valid dapat mengakses operasi protected.
6. **CORS masih default/open.** Batasi origin sesuai frontend yang dipercaya.
7. **Belum ada rate limiting, audit log, dan validasi uniqueness yang terlihat di aplikasi.** Pertimbangkan untuk login, pendaftaran, dan operasi administratif.
8. **Penanganan error belum terpusat.** Beberapa error database dan validasi diberi status yang sama, sehingga client sulit membedakan input invalid dan server failure.
9. **Tidak ada migration resmi.** Struktur database harus dikelola melalui migration atau schema versioning agar deployment konsisten.
10. **Endpoint `GET /` tidak mengirim response.** Buat response health check eksplisit jika endpoint ini digunakan oleh monitoring.
11. **Timestamp update tidak diubah pada query update.** Jika `updated_at` diharapkan selalu berubah, query update perlu mengaturnya.
12. **Tidak ada pagination/filtering.** Endpoint list saat ini mengambil seluruh record dengan `SELECT *`, yang dapat bermasalah saat data membesar.
13. **Login mengembalikan status `500` untuk kredensial salah.** Secara API biasanya digunakan `401` dengan pesan generik agar tidak membocorkan apakah email terdaftar.

Perubahan keamanan di atas belum diterapkan oleh dokumentasi ini; daftar tersebut adalah rekomendasi berdasarkan perilaku source code saat ini.

## Referensi Source Code

- Entry point dan seluruh route: [`src/app.ts`](./src/app.ts)
- Connection pool MySQL: [`src/db/index.ts`](./src/db/index.ts)
- Schema validasi request: [`src/db/data_schema.ts`](./src/db/data_schema.ts)
- Dependency dan script: [`package.json`](./package.json)
- Konfigurasi TypeScript: [`tsconfig.json`](./tsconfig.json)
