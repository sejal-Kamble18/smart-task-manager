import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { router } from "./routes";

// Bootstrap only; authorization and validation are centralized in routes.ts.

// Read local environment values such as PORT before starting Express.
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

// Allow the Next.js app to call this API from a different local port.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  })
);
// Convert JSON request bodies into JavaScript objects for route handlers.
app.use(express.json());
// Keep the original path and the requested v1 path available during migration.
app.use("/api", router);
app.use("/api/v1", router);

app.listen(port, () => {
  console.log(`Smart Task Manager API running on http://localhost:${port}`);
});
