import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pool from "./db/index.ts";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { credentials, datacategory, dataposts, datausers } from "./db/data_schema.ts";
import jwt from "jsonwebtoken"

const app: Express = express();
const port = 8000;

app.use(cors());
app.use(express.json());

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

app.post("/api/posts", tokenMiddleware, async (req: Request, res: Response) => {
  try {
    const validasiData = dataposts.parse(req.body);
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
    const [Post] = await pool.query<ResultSetHeader>(
      `INSERT INTO posts (title, slug, content, excerpt, cover_image, category_id, author, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [title, slug, content, excerpt, cover_image, category_id, author, status],
    );
    res.status(201).json({
      message: "post created succesfully",
      data: {
        postId: Post.insertId,
        title,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to create post",
    });
  }
});

app.put("/api/posts/:id", tokenMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid post ID",
      });
      return;
    }

    const validasiData = dataposts.parse(req.body);
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
    const [Post] = await pool.query<ResultSetHeader>(
      "UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, cover_image = ?, category_id = ?, author = ?, status = ? WHERE id = ?",
      [
        title,
        slug,
        content,
        excerpt,
        cover_image,
        category_id,
        author,
        status,
        id,
      ],
    );

    if (Post.affectedRows == 0) {
      res.status(404).json({
        message: "error",
      });
      return;
    }
    res.status(200).json({
      message: "Data post berhasil diupdate",
    });
  } catch (error) {
    res.status(400).json({
      message: "Data post tidak valid",
    });
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

app.get("/", tokenMiddleware, (req : Request, res : Response) => {
  console.log("token terdeteksi")
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
