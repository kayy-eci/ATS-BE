import express, { type Express, type Request, type Response } from 'express';
import cors from "cors";
import pool from './db/index.ts';
import type { ResultSetHeader } from "mysql2/promise";
import { datacategory, dataposts } from './db/data_schema.ts';

const app: Express = express();
const port = 8000;

app.use(cors());
app.use(express.json());

app.get("/api/categories", async (req: Request, res: Response) => {
    const [categories] = await pool.query("select * from categories;")

    res.status(200).json({
        message: "Berhasil fetch categori!",
        data : categories
    })
})


app.post("/api/categories", async (req: Request, res: Response) => {
  try {
    const validasiData  = datacategory.parse(req.body);

    const { name, slug, description } = validasiData;

    const [Category] = await pool.query<ResultSetHeader>(
      `INSERT INTO categories (name, slug, description, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, slug, description]
    );

    res.status(201).json({
      message: "category created succesfully",
      data: {
        categoryId: Category.insertId,
        name,
      }
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create category"
    })
  }
});

app.put("/api/categories/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({
        message: "Invalid category ID",
      });
      return;
    }

    const validasiData = datacategory.parse(req.body);

    const {name, slug, description} = validasiData;

    const [Category] = await pool.query<ResultSetHeader>(
      "UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?",
      [name, slug, description, id]
    );

    if (Category.affectedRows == 0) {
      res.status(404).json({
        message : "error"
      });
      return;
    }

    res.status(200).json({
      message: "Data category berhasil diupdate"
  });
  } catch (error){
    res.status(400).json({
      message: "Data category tidak valid"
    });
  };
});

app.delete("/api/categories/:id", async (req, res) => {
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
      [id]
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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

