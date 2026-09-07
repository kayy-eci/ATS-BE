import express, { type Express, type Request, type Response } from 'express';
import cors from "cors";
import pool from './db/index.ts';
import type { ResultSetHeader } from "mysql2/promise";
import { datacategory, datapost } from './db/data_schema.ts';

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

    const { name, slug, description, created_at, updated_at} = validasiData;

    const [Category] = await pool.query<ResultSetHeader>(`INSERT INTO categories (name, slug, description, created_at, updated_at) VALUES(?, ?, ?, ?, ?)`, 
        [name, slug, description, created_at, updated_at]);

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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});