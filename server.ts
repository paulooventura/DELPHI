import express from "express";
import cors from "cors";
import { getTaskSnapshot, runProwler } from "./agent/orchestrator.js";

const app = express();
const port = Number(process.env.PORT || 3001);
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "healthy", service: "DELPHI", port });
});

app.get("/api/tasks", (_req, res) => {
  const tasks = getTaskSnapshot();
  res.json({ count: tasks.length, tasks });
});

app.post("/ask", async (req, res) => {
  const { query } = req.body;

  const result = await runProwler(query);

  res.json(result);
});

app.listen(port, () => {
  console.log(`COSMOS PROWLER running on http://localhost:${port}`);
});