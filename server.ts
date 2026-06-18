import express from "express";
import cors from "cors";
import { runProwler } from "./agent/orchestrator.ts";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ask", async (req, res) => {
  const { query } = req.body;

  const result = await runProwler(query);

  res.json(result);
});

app.listen(3001, () => {
  console.log("COSMOS PROWLER running on http://localhost:3001");
});