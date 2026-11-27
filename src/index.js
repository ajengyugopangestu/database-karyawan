
const COOKIE_NAME = "peopledesk_session";
const SESSION_IDLE_MINUTES = 20;
const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000;
const ITERATIONS = 100000;

const EMPLOYEE_FIELDS = [
  "nik", "name", "gender", "birthPlace", "birthDate",
  "religion", "office", "phone", "email", "address",
  "education", "department", "position", "joinDate", "status"
];

const COLUMN_MAP = {
  nik: "nik",
  name: "name",
  gender: "gender",
  birthPlace: "birth_place",
  birthDate: "birth_date",
  religion: "religion",
  office: "office",
  phone: "phone",
  email: "email",
  address: "address",
  education: "education",
  department: "department",
  position: "position",
  joinDate: "join_date",
  status: "status"
};

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function sha256(value) {
  const result = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return base64url(new Uint8Array(result));
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256
  );

  return `pbkdf2$${ITERATIONS}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  try {
    const [algorithm, iterations, saltText, expected] = stored.split("$");
    if (algorithm !== "pbkdf2") return false;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: fromBase64url(saltText),
        iterations: Number(iterations),
        hash: "SHA-256"
      },
      key,
      256
    );

    const actual = base64url(new Uint8Array(bits));
    return actual === expected;
  } catch {
    return false;
  }
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const item = cookie.split(";").map(v => v.trim())
    .find(v => v.startsWith(name + "="));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_IDLE_MINUTES * 60}`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function validOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function employeeResponse(row) {
  return {
    id: String(row.id),
    nik: row.nik,
    name: row.name,
    gender: row.gender,
    birthPlace: row.birth_place,
    birthDate: row.birth_date,
    religion: row.religion,
    office: row.office,
    phone: row.phone,
    email: row.email,
    address: row.address,
    education: row.education,
    department: row.department,
    position: row.position,
    joinDate: row.join_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function currentUser(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;

  const tokenHash = await sha256(token);

  const now = new Date().toISOString();
  const result = await env.DB.prepare(`
    SELECT
      s.id AS session_id,
      u.id,
      u.username,
      u.full_name,
      u.role,
      u.is_active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.expires_at > ?
      AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash, now).first();

  if (!result) return null;

  // Sliding expiration: setiap request API yang terautentikasi
  // memperpanjang masa berlaku sesi selama 20 menit sejak aktivitas terakhir.
  const newExpiry = new Date(Date.now() + SESSION_IDLE_MS).toISOString();
  await env.DB.prepare(
    "UPDATE sessions SET expires_at = ? WHERE id = ?"
  ).bind(newExpiry, result.session_id).run();

  // Digunakan untuk memperbarui masa berlaku cookie browser juga.
  result.session_token = token;
  return result;
}

function canManage(user) {
  return user && ["admin", "hr"].includes(user.role);
}

async function createSession(env, userId) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64url(bytes);
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_IDLE_MS).toISOString();

  await env.DB.prepare(`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).bind(userId, tokenHash, expires).run();

  return token;
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !validOrigin(request)) {
    return json({ success: false, message: "Origin tidak diizinkan." }, 403);
  }

  // STATUS API
  if (path === "/api/health" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all();

    return json({
      success: true,
      message: "PeopleDesk API terhubung ke D1",
      tables: result.results
    });
  }

  // RESET PASSWORD ADMIN - TEMPORARY
  // Hapus blok ini setelah proses reset password selesai.
  if (path === "/api/reset-admin-password" && method === "POST") {
    if (!env.ADMIN_RESET_SECRET) {
      return json({
        success: false,
        message: "Reset secret belum dikonfigurasi."
      }, 503);
    }

    const providedSecret = request.headers.get("X-Admin-Reset-Secret");

    if (providedSecret !== env.ADMIN_RESET_SECRET) {
      return json({
        success: false,
        message: "Secret tidak valid."
      }, 403);
    }

    const body = await readBody(request);

    if (!body || typeof body.password !== "string") {
      return json({
        success: false,
        message: "Password baru tidak valid."
      }, 400);
    }

    const newPassword = body.password;

    if (newPassword.length < 12) {
      return json({
        success: false,
        message: "Password minimal 12 karakter."
      }, 400);
    }

    const admin = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? AND role = 'admin' LIMIT 1"
    ).bind("admin").first();

    if (!admin) {
      return json({
        success: false,
        message: "Akun admin tidak ditemukan."
      }, 404);
    }

    const passwordHash = await hashPassword(newPassword);

    await env.DB.prepare(
      "UPDATE users SET password_hash = ? WHERE id = ?"
    ).bind(passwordHash, admin.id).run();

    await env.DB.prepare(
      "DELETE FROM sessions WHERE user_id = ?"
    ).bind(admin.id).run();

    return json({
      success: true,
      message: "Password admin berhasil direset. Silakan login kembali."
    });
  }

  // MEMBUAT ADMIN PERTAMA
  if (path === "/api/setup-admin" && method === "POST") {
    if (!env.BOOTSTRAP_SECRET) {
      return json({ success: false, message: "Bootstrap secret belum dikonfigurasi." }, 503);
    }

    const body = await readBody(request);
    if (!body || body.secret !== env.BOOTSTRAP_SECRET) {
      return json({ success: false, message: "Secret tidak valid." }, 403);
    }

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM users"
    ).first();

    if (Number(count.total) > 0) {
      return json({ success: false, message: "Admin pertama sudah dibuat." }, 409);
    }

    const username = String(body.username || "").trim();
    const fullName = String(body.fullName || "").trim();
    const password = String(body.password || "");

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username) ||
        fullName.length < 2 || password.length < 12) {
      return json({
        success: false,
        message: "Username minimal 3 karakter dan password minimal 12 karakter."
      }, 400);
    }

    const passwordHash = await hashPassword(password);

    await env.DB.prepare(`
      INSERT INTO users (username, full_name, password_hash, role)
      VALUES (?, ?, ?, 'admin')
    `).bind(username, fullName, passwordHash).run();

    return json({ success: true, message: "Admin pertama berhasil dibuat." }, 201);
  }

  // LOGIN
  if (path === "/api/login" && method === "POST") {
    const body = await readBody(request);
    if (!body) return json({ success: false, message: "Data login tidak valid." }, 400);

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    const user = await env.DB.prepare(`
      SELECT id, username, full_name, password_hash, role, is_active
      FROM users
      WHERE username = ?
      LIMIT 1
    `).bind(username).first();

    if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
      return json({ success: false, message: "Username atau password salah." }, 401);
    }

    const token = await createSession(env, user.id);

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    }, 200, {
      "Set-Cookie": sessionCookie(token)
    });
  }

  // LOGOUT
  if (path === "/api/logout" && method === "POST") {
    const token = getCookie(request, COOKIE_NAME);
    if (token) {
      await env.DB.prepare(
        "DELETE FROM sessions WHERE token_hash = ?"
      ).bind(await sha256(token)).run();
    }

    return json({ success: true, message: "Logout berhasil." }, 200, {
      "Set-Cookie": clearCookie()
    });
  }

  // IDENTITAS PENGGUNA AKTIF
  if (path === "/api/me" && method === "GET") {
    const user = await currentUser(request, env);
    if (!user) return json({ success: false, message: "Silakan login." }, 401);

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    }, 200, {
      "Set-Cookie": sessionCookie(user.session_token)
    });
  }

  // SEMUA ENDPOINT SETELAH INI MEMERLUKAN LOGIN
  const user = await currentUser(request, env);
  if (!user) return json({ success: false, message: "Silakan login." }, 401);

  // PENGGUNA MENGGANTI PASSWORD SENDIRI
  if (path === "/api/change-password" && method === "POST") {
    const body = await readBody(request);
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");
    if (newPassword.length < 12) return json({ success: false, message: "Password baru minimal 12 karakter." }, 400);
    const account = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1").bind(user.id).first();
    if (!account || !(await verifyPassword(currentPassword, account.password_hash))) return json({ success: false, message: "Password saat ini tidak sesuai." }, 400);
    const passwordHash = await hashPassword(newPassword);
    await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, user.id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").bind(user.id, user.session_id).run();
    return json({ success: true, message: "Password berhasil diperbarui. Sesi pada perangkat lain telah dicabut." });
  }

  // DAFTAR KARYAWAN
  if (path === "/api/employees" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT * FROM employees ORDER BY id DESC"
    ).all();

    return json({
      success: true,
      employees: result.results.map(employeeResponse)
    });
  }

  // TAMBAH KARYAWAN
  if (path === "/api/employees" && method === "POST") {
    if (!canManage(user)) return json({ success: false, message: "Akses ditolak." }, 403);

    const body = await readBody(request);
    if (!body || !body.nik || !body.name) {
      return json({ success: false, message: "NIK dan nama wajib diisi." }, 400);
    }

    const values = EMPLOYEE_FIELDS.map(field => body[field] ?? "");
    const columns = EMPLOYEE_FIELDS.map(field => COLUMN_MAP[field]).join(", ");
    const placeholders = EMPLOYEE_FIELDS.map(() => "?").join(", ");

    try {
      const result = await env.DB.prepare(
        `INSERT INTO employees (${columns}) VALUES (${placeholders})`
      ).bind(...values).run();

      return json({
        success: true,
        message: "Data karyawan berhasil ditambahkan.",
        id: String(result.meta.last_row_id)
      }, 201);
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        return json({ success: false, message: "NIK sudah digunakan." }, 409);
      }
      throw error;
    }
  }

  // EDIT KARYAWAN
  const employeeMatch = path.match(/^\/api\/employees\/(\d+)$/);

  if (employeeMatch && method === "PUT") {
    if (!canManage(user)) return json({ success: false, message: "Akses ditolak." }, 403);

    const body = await readBody(request);
    if (!body || !body.nik || !body.name) {
      return json({ success: false, message: "NIK dan nama wajib diisi." }, 400);
    }

    const assignments = EMPLOYEE_FIELDS.map(
      field => `${COLUMN_MAP[field]} = ?`
    ).join(", ");

    const values = EMPLOYEE_FIELDS.map(field => body[field] ?? "");

    try {
      const result = await env.DB.prepare(`
        UPDATE employees
        SET ${assignments}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(...values, Number(employeeMatch[1])).run();

      if (!result.meta.changes) {
        return json({ success: false, message: "Data karyawan tidak ditemukan." }, 404);
      }

      return json({ success: true, message: "Data karyawan berhasil diperbarui." });
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        return json({ success: false, message: "NIK sudah digunakan." }, 409);
      }
      throw error;
    }
  }

  // HAPUS KARYAWAN
  if (employeeMatch && method === "DELETE") {
    if (!canManage(user)) return json({ success: false, message: "Akses ditolak." }, 403);

    const result = await env.DB.prepare(
      "DELETE FROM employees WHERE id = ?"
    ).bind(Number(employeeMatch[1])).run();

    if (!result.meta.changes) {
      return json({ success: false, message: "Data karyawan tidak ditemukan." }, 404);
    }

    return json({ success: true, message: "Data karyawan berhasil dihapus." });
  }

  // MANAJEMEN PENGGUNA: KHUSUS ADMIN
  if (path === "/api/users" && method === "GET") {
    if (user.role !== "admin") {
      return json({ success: false, message: "Hanya Admin yang dapat melihat daftar pengguna." }, 403);
    }

    const result = await env.DB.prepare(`
      SELECT id, username, full_name, role, is_active
      FROM users
      ORDER BY full_name COLLATE NOCASE ASC
    `).all();

    return json({
      success: true,
      users: result.results.map(item => ({
        id: String(item.id),
        username: item.username,
        fullName: item.full_name,
        role: item.role,
        isActive: Boolean(item.is_active)
      }))
    });
  }

  // ADMIN MEMBUAT AKUN ADMIN, HR, ATAU USER
  if (path === "/api/users" && method === "POST") {
    if (user.role !== "admin") {
      return json({ success: false, message: "Hanya Admin yang dapat membuat akun." }, 403);
    }

    const body = await readBody(request);
    const username = String(body?.username || "").trim();
    const fullName = String(body?.fullName || "").trim();
    const password = String(body?.password || "");
    const role = String(body?.role || "");

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username) ||
        fullName.length < 2 || password.length < 12 ||
        !["admin", "hr", "user"].includes(role)) {
      return json({ success: false, message: "Username harus 3–40 karakter, nama minimal 2 karakter, password minimal 12 karakter, dan role harus valid." }, 400);
    }

    try {
      await env.DB.prepare(`
        INSERT INTO users (username, full_name, password_hash, role)
        VALUES (?, ?, ?, ?)
      `).bind(username, fullName, await hashPassword(password), role).run();

      return json({ success: true, message: "Akun berhasil dibuat." }, 201);
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        return json({ success: false, message: "Username sudah digunakan." }, 409);
      }
      throw error;
    }
  }

  // ADMIN MEMPERBARUI DATA, ROLE, STATUS, ATAU PASSWORD PENGGUNA
  const userMatch = path.match(/^\/api\/users\/(\d+)$/);
  if (userMatch && method === "PUT") {
    if (user.role !== "admin") {
      return json({ success: false, message: "Hanya Admin yang dapat mengubah akun." }, 403);
    }

    const targetId = Number(userMatch[1]);
    const body = await readBody(request);
    const fullName = String(body?.fullName || "").trim();
    const role = String(body?.role || "");
    const isActive = body?.isActive === true;
    const password = String(body?.password || "");

    if (fullName.length < 2 || !["admin", "hr", "user"].includes(role) ||
        (password && password.length < 12) ||
        typeof body?.isActive !== "boolean") {
      return json({ success: false, message: "Data akun tidak valid. Password baru minimal 12 karakter." }, 400);
    }

    const target = await env.DB.prepare(
      "SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1"
    ).bind(targetId).first();

    if (!target) return json({ success: false, message: "Akun pengguna tidak ditemukan." }, 404);

    if (targetId === Number(user.id) && (!isActive || role !== "admin")) {
      return json({ success: false, message: "Anda tidak dapat menonaktifkan akun sendiri atau mengubah role Admin milik sendiri." }, 400);
    }

    const removesAdmin = target.role === "admin" && (role !== "admin" || !isActive);
    if (removesAdmin && target.is_active) {
      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1"
      ).first();
      if (Number(count.total) <= 1) {
        return json({ success: false, message: "Tidak dapat menonaktifkan atau menurunkan role Admin terakhir." }, 400);
      }
    }

    if (password) {
      await env.DB.prepare(`
        UPDATE users SET full_name = ?, role = ?, is_active = ?, password_hash = ?
        WHERE id = ?
      `).bind(fullName, role, isActive ? 1 : 0, await hashPassword(password), targetId).run();
    } else {
      await env.DB.prepare(`
        UPDATE users SET full_name = ?, role = ?, is_active = ?
        WHERE id = ?
      `).bind(fullName, role, isActive ? 1 : 0, targetId).run();
    }

    // Cabut seluruh sesi akun yang diubah agar perubahan role/status/password
    // langsung berlaku pada perangkat yang sedang login.
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(targetId).run();

    return json({ success: true, message: "Akun pengguna berhasil diperbarui. Pengguna perlu login kembali." });
  }

  return json({ success: false, message: "Endpoint tidak ditemukan." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env);
      } catch (error) {
        console.error("PeopleDesk API error:", error);
        return json({
          success: false,
          message: "Terjadi kesalahan pada server."
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
