#!/usr/bin/env node

const express = require("express");
const path = require("path");

const convertRouter = require("./routes/convert");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, "..", "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.use("/api", convertRouter);

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Generic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Unexpected server error",
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

module.exports = app;

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(
      [
        "=============================================",
        " DualRender server running",
        ` Port: ${PORT}`,
        ` URL:  http://localhost:${PORT}`,
        "=============================================",
      ].join("\n")
    );
  });
}
