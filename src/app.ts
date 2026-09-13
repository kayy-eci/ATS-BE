import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import pool from "./db/index.ts";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { credentials, datacategory, dataposts, datausers } from "./db/data_schema.ts";
import jwt from "jsonwebtoken"
import { z } from "zod";

const app: Express = express();
const port = 8000;

app.use(cors());
app.use(express.json());
// Untuk form urlencoded biasa (multer tetap yang handle multipart/form-data).
app.use(express.urlencoded({ extended: true }));

// ---- Upload cover image ----
// Folder uploads/ diserve publik (tanpa JWT) karena <img>/Image.network
// tidak bisa mengirim header Authorization. Upload-nya sendiri tetap
// dilindungi tokenMiddleware.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path
      .extname(file.originalname || "")
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "");
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar yang diperbolehkan"));
    }
  },
});

// ---- Helper multipart untuk posts ----
// Flutter mengirim POST/PUT /api/posts sebagai multipart/form-data dengan
// field file bernama `cover_image` + semua field teks sebagai string.
// express.json() tidak bisa parse multipart sehingga req.body undefined
// (penyebab ZodError "expected object, received undefined").
// Middleware ini menjalankan multer hanya untuk multipart, lalu
// menormalisasi req.file dari beberapa nama field yang didukung.
const postCoverUpload = upload.fields([
  { name: "cover_image", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

type RequestWithCover = Request & {
  file?: Express.Multer.File;
  files?: Record<string, Express.Multer.File[]>;
};

function runPostCover(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    if (req.body == null || typeof req.body !== "object") {
      (req as RequestWithCover).body = {};
    }
    next();
    return;
  }
  postCoverUpload(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({
        message: err instanceof Error ? err.message : "Upload cover gagal",
      });
      return;
    }
    const r = req as RequestWithCover;
    const files = (r.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    r.file = files.cover_image?.[0] ?? files.image?.[0] ?? files.file?.[0];
    if (r.body == null || typeof r.body !== "object") {
      r.body = {};
    }
    next();
  });
}

// Gabungkan body + file upload menjadi satu input untuk Zod.
// File menang atas string cover_image; string kosong dianggap tidak diisi.
function buildPostInput(req: Request) {
  const r = req as RequestWithCover;
  const raw = (r.body ?? {}) as Record<string, unknown>;
  const coverFromFile = r.file ? `/uploads/${r.file.filename}` : undefined;
  const coverRaw = coverFromFile ?? raw.cover_image;
  return {
    title: raw.title,
    slug: raw.slug === "" ? undefined : raw.slug,
    content: raw.content,
    excerpt: raw.excerpt === "" ? undefined : raw.excerpt,
    cover_image: coverRaw === "" ? undefined : coverRaw,
    category_id: raw.category_id,
    author: raw.author === "" ? undefined : raw.author,
    status: raw.status ?? undefined,
  };
}

// Balas 400 + detail issues untuk ZodError agar gampang di-debug dari Flutter,
// bukan 500 generik.
function sendZodOrServerError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      message: "Validasi gagal",
      errors: error.issues,
    });
    return;
  }
  console.error(error);
  res.status(500).json({
    message: fallback,
  });
}

app.post("/api/upload", tokenMiddleware, (req: Request, res: Response) => {
  // Terima `image` (kontrak lama) + `cover_image`/`file` (kontrak Flutter).
  postCoverUpload(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({
        message: err instanceof Error ? err.message : "Upload gagal",
      });
      return;
    }
    const r = req as RequestWithCover;
    const file =
      r.file ??
      (() => {
        const files = (r.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
        return files.cover_image?.[0] ?? files.image?.[0] ?? files.file?.[0];
      })();
    if (!file) {
      res.status(400).json({
        message: "Field 'image' (atau 'cover_image') wajib diisi",
      });
      return;
    }
    res.status(201).json({
      message: "Upload berhasil",
      url: `/uploads/${file.filename}`,
    });
  });
});

app.get("/api/categories", tokenMiddleware, async (req: Request, res: Response) => {
  const [categories] = await pool.query("select * from categories;");

  res.status(200).json({
    message: "Berhasil fetch categori!",
    data: categories,
  });
});

app.post("/api/categories", tokenMiddleware, async (req: Request, res: Response) => {
  try {
    const validasiData = datacategory.parse(req.body);

    const { name, slug, description } = validasiData;

    const [Category] = await pool.query<ResultSetHeader>(
      `INSERT INTO categories (name, slug, description, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, slug, description],
    );

    res.status(201).json({
      message: "category created succesfully",
      data: {
        categoryId: Category.insertId,
        name,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create category",
    });
  }
});

app.put("/api/categories/:id", tokenMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid category ID",
      });
      return;
    }

    const validasiData = datacategory.parse(req.body);

    const { name, slug, description } = validasiData;

    const [Category] = await pool.query<ResultSetHeader>(
      "UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?",
      [name, slug, description, id],
    );

    if (Category.affectedRows == 0) {
      res.status(404).json({
        message: "error",
      });
      return;
    }

    res.status(200).json({
      message: "Data category berhasil diupdate",
    });
  } catch (error) {
    res.status(400).json({
      message: "Data category tidak valid",
    });
  }
});

app.delete("/api/categories/:id", tokenMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid category ID",
      });
      return;
    }

    const [Category] = await pool.query<ResultSetHeader>(
      "DELETE FROM categories WHERE id = ?",
      [id],
    );

    if (Category.affectedRows === 0) {
      res.status(404).json({
        message: "Category tidak ditemukan",
      });

      return;
    }

    res.status(200).json({
      message: "category berhasil dihapus",
    });
  } catch (error) {
    res.status(500).json({
      message: "category gagal dihapus",
    });
  }
});

app.get("/api/posts", tokenMiddleware, async (req: Request, res: Response) => {
  const [posts] = await pool.query("select * from posts;");
  res.status(200).json({
    message: "Berhasil fetch posts!",
    data: posts,
  });
});

app.post("/api/posts", tokenMiddleware, runPostCover, async (req: Request, res: Response) => {
  try {
    // Dukung JSON murni (tanpa gambar) + multipart (dengan gambar).
    const validasiData = dataposts.parse(buildPostInput(req));
    const {
      title,
      slug,
      content,
      excerpt,
      cover_image,
      category_id,
      author,
      status,
    } = validasiData;
    // mysql2 tidak menerima `undefined`, ubah ke NULL untuk kolom nullable.
    const [Post] = await pool.query<ResultSetHeader>(
      `INSERT INTO posts (title, slug, content, excerpt, cover_image, category_id, author, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        title,
        slug ?? null,
        content,
        excerpt ?? null,
        cover_image ?? null,
        category_id,
        author ?? null,
        status,
      ],
    );
    res.status(201).json({
      message: "post created succesfully",
      data: {
        postId: Post.insertId,
        title,
        cover_image: cover_image ?? null,
      },
    });
  } catch (error) {
    sendZodOrServerError(res, error, "Failed to create post");
  }
});

app.put("/api/posts/:id", tokenMiddleware, runPostCover, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid post ID",
      });
      return;
    }

    const validasiData = dataposts.parse(buildPostInput(req));
    const {
      title,
      slug,
      content,
      excerpt,
      cover_image,
      category_id,
      author,
      status,
    } = validasiData;

    // Kalau edit tanpa ganti gambar (tidak ada file & tidak ada field
    // cover_image), pertahankan cover lama agar tidak ke-NULL.
    let finalCover: string | null | undefined = cover_image;
    const bodyHadCover =
      (req as RequestWithCover).file != null ||
      (req.body as Record<string, unknown> | undefined)?.cover_image !== undefined;
    if (!bodyHadCover) {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT cover_image FROM posts WHERE id = ? LIMIT 1",
        [id],
      );
      if (rows.length === 0) {
        res.status(404).json({
          message: "Post tidak ditemukan",
        });
        return;
      }
      finalCover = (rows[0].cover_image as string | null) ?? null;
    }

    const [Post] = await pool.query<ResultSetHeader>(
      "UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, cover_image = ?, category_id = ?, author = ?, status = ? WHERE id = ?",
      [
        title,
        slug ?? null,
        content,
        excerpt ?? null,
        finalCover ?? null,
        category_id,
        author ?? null,
        status,
        id,
      ],
    );

    if (Post.affectedRows == 0) {
      res.status(404).json({
        message: "Post tidak ditemukan",
      });
      return;
    }
    res.status(200).json({
      message: "Data post berhasil diupdate",
      data: { cover_image: finalCover ?? null },
    });
  } catch (error) {
    sendZodOrServerError(res, error, "Data post tidak valid");
  }
});

// Fallback untuk Flutter: PUT multipart kadang ditolak client/server,
// jadi Flutter mengirim POST + field `_method=PUT` (lihat editpost.dart).
// Tanpa route ini fallback tersebut selalu 404.
app.post("/api/posts/:id", tokenMiddleware, runPostCover, async (req: Request, res: Response) => {
  const method = String(
    (req.body as Record<string, unknown> | undefined)?._method ?? "",
  ).toUpperCase();
  if (method !== "PUT") {
    res.status(405).json({
      message: "Method tidak didukung. Gunakan PUT atau POST dengan _method=PUT",
    });
    return;
  }
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid post ID",
      });
      return;
    }

    const validasiData = dataposts.parse(buildPostInput(req));
    const {
      title,
      slug,
      content,
      excerpt,
      cover_image,
      category_id,
      author,
      status,
    } = validasiData;

    let finalCover: string | null | undefined = cover_image;
    const bodyHadCover =
      (req as RequestWithCover).file != null ||
      (req.body as Record<string, unknown> | undefined)?.cover_image !== undefined;
    if (!bodyHadCover) {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT cover_image FROM posts WHERE id = ? LIMIT 1",
        [id],
      );
      if (rows.length === 0) {
        res.status(404).json({
          message: "Post tidak ditemukan",
        });
        return;
      }
      finalCover = (rows[0].cover_image as string | null) ?? null;
    }

    const [Post] = await pool.query<ResultSetHeader>(
      "UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, cover_image = ?, category_id = ?, author = ?, status = ? WHERE id = ?",
      [
        title,
        slug ?? null,
        content,
        excerpt ?? null,
        finalCover ?? null,
        category_id,
        author ?? null,
        status,
        id,
      ],
    );

    if (Post.affectedRows == 0) {
      res.status(404).json({
        message: "Post tidak ditemukan",
      });
      return;
    }
    res.status(200).json({
      message: "Data post berhasil diupdate",
      data: { cover_image: finalCover ?? null },
    });
  } catch (error) {
    sendZodOrServerError(res, error, "Data post tidak valid");
  }
});

app.delete("/api/posts/:id", tokenMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid post ID",
      });
      return;
    }

    const [Post] = await pool.query<ResultSetHeader>(
      "DELETE FROM posts WHERE id = ?",
      [id],
    );

    if (Post.affectedRows === 0) {
      res.status(404).json({
        message: "Post tidak ditemukan",
      });
      return;
    }
    res.status(200).json({
      message: "post berhasil dihapus",
    });
  } catch (error) {
    res.status(500).json({
      message: "post gagal dihapus",
    });
  }
});

app.get("/api/users", tokenMiddleware, async (req: Request, res: Response) => {
  const [users] = await pool.query("select * from users");

  res.status(201).json({
    message: "fetch data user berhasil",
    users: users,
  });
});

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const validasiData = datausers.parse(req.body);
    const { username, email, password } = validasiData;
    const [users] = await pool.query<ResultSetHeader>(
      "INSERT INTO users (username, email, password) values (?, ?, ?)",
      [username, email, password],
    );

    res.status(201).json({
      message: "User berhasil di buat",
      data: {
        userId: users.insertId,
        username: username,
        email: email,
        password: password,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal membuat users",
    });
  }
});

app.put("/api/users/:id", tokenMiddleware , async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid post ID",
      });
      return;
    }
    const validasiData = datausers.parse(req.body);
    const { username, email, password } = validasiData;
    const [users] = await pool.query<ResultSetHeader>(
      "UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?",
      [username, email, password, id],
    );

    res.status(201).json({
      message: "Berhasil mengubah users",
      data: {
        username: username,
        email: email,
        password: password,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "gagal mengubah users",
    });
  }
});

app.delete("/api/users/:id", tokenMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid post ID",
      });
      return;
    }
    const [users] = await pool.query<ResultSetHeader>(
      "DELETE FROM users WHERE id = ?",
      [id],
    );  

    if (users.affectedRows === 0) {
      res.status(404).json({
        message: "users tidak ditemukan",
      });
      return;
    }
    res.status(200).json({
      message: "users berhasil dihapus",
    });
  } catch (error) {
    res.status(500).json({
      message: "gagal menghapus users",
    });
  }
});



app.post("/api/auth/login", async (req: Request, res: Response) => {
  try { 
    const validasiData = credentials.parse(req.body);
    const { email, password } = validasiData;
    const [users] = await pool.query<RowDataPacket[]>("select * from users where email = ? limit 1", [email])

    if (users.length == 0) {
      throw new Error("data tidak ditemukan");
    }

    if (users[0].password != password) {
      throw new Error("email / password salah");
    }

    const token = jwt.sign(users[0], "tokendeh")
  
    res.status(200).json({
      message: "Login berhasil",
      token: token
    })
    
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        message: error.message 
      });
    }
  }
});

function tokenMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  // console.log(req.headers.authorization)

   if (!token) {
    return res.status(401).json({
      message: "Unauthorized. No token provided"
    })
  }

  jwt.verify(token, "tokendeh", (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "Invalid token"
      })
    }
    next()
  })
}


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
