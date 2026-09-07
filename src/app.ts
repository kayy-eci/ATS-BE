import express, { type Express, type Request, type Response } from 'express';
import cors from "cors";
import pool from './db/index.ts';
import type { ResultSetHeader } from "mysql2/promise";


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


app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const validasiData  = dataUsers.parse(req.body);

    const { username, email, password} = validasiData;

    const [users] = await pool.query<ResultSetHeader>(`INSERT INTO users (username, email, password) VALUES(?, ?, ?)`, [username, email, password]);

    res.status(201).json({
      message: "Users created succesfully",
      data: {
        usersId: users.insertId,
        username,
      }
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create users"
    })
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});