const express = require("express");

const { upload, MAX_FILE_SIZE } = require("../middleware/upload");
const { convertHtmlToPdf } = require("../services/pdfService");

const router = express.Router();

router.post("/convert", upload.single("htmlFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const title = req.body.title || "HTML Preview";
    const htmlContent = req.file.buffer.toString("utf-8");

    const pdfBytes = await convertHtmlToPdf(htmlContent, title);

    const filename = `${title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_dualrender.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBytes.length);

    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    res.status(500).json({
      error: "Failed to convert HTML to PDF",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      details: error.toString(),
    });
  }
});

router.get("/health", (req, res) => {
  res.json({ status: "ok", message: "DualRender server is running" });
});

// Multer-specific error handler for this router
router.use((error, req, res, next) => {
  if (error instanceof Error && error.message === "Only HTML files are allowed!") {
    return res.status(400).json({ error: error.message });
  }

  if (error && error.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` });
  }

  return next(error);
});

module.exports = router;
