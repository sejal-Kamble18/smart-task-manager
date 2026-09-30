import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { router } from "./routes";

// Bootstrap only; authorization and validation are centralized in routes.ts.
//server.ts is only responsible for starting/configuring Express, while authentication, authorization and validation are handled elsewhere.

dotenv.config();  //This loads .env values into=> process.env.PORT ex: PORT: 5000

const app = express();  //Creates the Express application.
const port = Number(process.env.PORT) || 5000;

// Allow the frontend to call this API from a different local port.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  })
);
// Convert JSON request bodies into JavaScript objects for route handlers.
app.use(express.json());

//fix Cannot GET method when run website
app.get("/", (_req, res) => {
  res.json({
    message: "Smart Task Manager API is running 🎉",
  });
});
//health-check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

// Keep the original path and the requested v1 path available during migration.
app.use("/api", router);
app.use("/api/v1", router);

// app.listen(port) = Uses Node's default host behavior
// app.listen(port, () => {
//   console.log(`Smart Task Manager API running on http://localhost:${port}`);
// });

// app.listen(port, "0.0.0.0") = Listen on all network interfaces — suitable for Render
app.listen(port, "0.0.0.0", () => {
  console.log(`Smart Task Manager API running on port ${port}`);
});
