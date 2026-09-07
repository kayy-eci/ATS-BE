import express, { type Express, type Request, type Response } from 'express';
import cors from "cors";
import pool from './db/index.ts';

const app: Express = express();
const port = 8000;

app.use(cors());
app.use(express.json());

app.get("/api/users", async (req: Request, res: Response) => {
    const [users] = await pool.query("select * from users;")

    res.status(200).json({
        message: "Berhasil fetch users!",
        data : users
    })
})

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.get("/api/categories", async (req: Request, res: Response) => {
    res
})



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});