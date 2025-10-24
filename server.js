#!/usr/bin/env node

/**
 * DualRender Server
 * Express server to handle HTML to PDF conversion
 */

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium, devices } = require("playwright");
const { PDFDocument } = require("pdf-lib");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/html" ||
      file.originalname.match(/\.(html|htm)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only HTML files are allowed!"), false);
    }
  },
});

// Serve static files
app.use(express.static(__dirname));

// Body parser
app.use(express.json());

// ================================
// HTML Processing Functions
// ================================

function extractHeadStyles(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return "";
  const styles = [];
  const head = headMatch[1];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(head))) {
    styles.push(m[1]);
  }
  return styles.join("\n");
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : "";
}

function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (m) return m[1];
  return html;
}

function buildDoc({
  label,
  viewportWidth,
  gutter,
  innerPad,
  forceMetaViewport = false,
  mobileMetaWidth,
  isMobile = false,
  headCSS,
  bodyHTML,
  docTitle,
}) {
  const metaViewport = forceMetaViewport
    ? `<meta name="viewport" content="width=${
        mobileMetaWidth || viewportWidth
      }, initial-scale=1">`
    : "";

  if (isMobile) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${metaViewport}
  <style>
    html, body { margin:0; padding:0; background:#ffffff; width:100%; }
    .page-wrapper { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; width:100%; }
    .frame { padding:${gutter}px; box-sizing:border-box; max-width:100%; }
    .header { font-family: Arial, Helvetica, sans-serif; font-size:14px; color:#333; margin-bottom:8px; }
    .content { background:#fff; border:1px solid #e5e5e5; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .inner { padding:${innerPad}px; }
    img { max-width:100%; height:auto; }
    table { border-collapse: collapse; }
  </style>
  <style>${headCSS}</style>
  <title>${docTitle} – ${label}</title>
</head>
<body>
  <div class="page-wrapper">
    <div class="frame" data-label="${label}">
      <div class="header">${docTitle} — <strong>${label}</strong></div>
      <div class="content">
        <div class="inner" id="email-root">
          ${bodyHTML}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${metaViewport}
  <style>
    html, body { margin:0; padding:0; background:#ffffff; }
    .page-wrapper { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
    .frame { padding:${gutter}px; box-sizing:border-box; width:${viewportWidth}px; }
    .header { font-family: Arial, Helvetica, sans-serif; font-size:14px; color:#333; margin-bottom:8px; }
    .content { background:#fff; border:1px solid #e5e5e5; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .inner { padding:${innerPad}px; }
    img { max-width:100%; height:auto; }
    table { border-collapse: collapse; }
  </style>
  <style>${headCSS}</style>
  <title>${docTitle} – ${label}</title>
</head>
<body>
  <div class="page-wrapper">
    <div class="frame" data-label="${label}">
      <div class="header">${docTitle} — <strong>${label}</strong></div>
      <div class="content">
        <div class="inner" id="email-root">
          ${bodyHTML}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ================================
// PDF Rendering
// ================================

async function renderToPdfSingle({
  htmlPath,
  contextMode,
  targetWidth,
  pdfWidth,
}) {
  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    if (contextMode.type === "mobile-emulation") {
      const device = devices[contextMode.deviceName] || devices["iPhone 12"];
      context = await browser.newContext({
        ...device,
        viewport: { width: targetWidth, height: 1000 },
      });
    } else {
      context = await browser.newContext({
        viewport: { width: pdfWidth, height: 1000 },
        deviceScaleFactor: 1,
        isMobile: false,
        userAgent: undefined,
      });
    }

    const page = await context.newPage();
    await page.emulateMedia({ media: "screen" });
    await page.goto("file://" + htmlPath, {
      waitUntil: "load",
      timeout: 30000,
    });

    const contentHeight = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const h = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        body.clientHeight,
        html.scrollHeight,
        html.offsetHeight,
        html.clientHeight
      );
      return Math.ceil(h);
    });

    const renderWidth =
      contextMode.type === "mobile-emulation" ? targetWidth : pdfWidth;

    const pdfBuffer = await page.pdf({
      printBackground: true,
      width: `${renderWidth}px`,
      height: `${contentHeight}px`,
      pageRanges: "1",
    });

    await context.close();
    await browser.close();
    return pdfBuffer;
  } catch (err) {
    if (context) await context.close().catch(() => {});
    await browser.close().catch(() => {});
    throw err;
  }
}

// ================================
// Main Conversion Function
// ================================

async function convertHtmlToPdf(htmlContent, title, options = {}) {
  const opts = {
    title: title || "HTML Preview",
    desktop: options.desktop || 800,
    mobile: options.mobile || 375,
    emulateMobile: options.emulateMobile !== false,
    mobileDevice: options.mobileDevice || "iPhone 12",
    dgutter: options.dgutter || 72,
    mgutter: options.mgutter || 24,
    dspace: options.dspace || 0,
    mspace: options.mspace || 12,
    pdfWidth: 1080,
  };

  // Extract HTML components
  const headCSS = extractHeadStyles(htmlContent);
  const docTitle = opts.title || extractTitle(htmlContent) || "HTML Preview";
  const bodyHTML = extractBody(htmlContent);

  // Create temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html2pdf-"));

  try {
    const desktopHTMLPath = path.join(tmpDir, "desktop.html");
    const mobileHTMLPath = path.join(tmpDir, "mobile.html");

    // Write temp HTML files
    fs.writeFileSync(
      desktopHTMLPath,
      buildDoc({
        label: "Desktop",
        viewportWidth: opts.desktop,
        gutter: opts.dgutter,
        innerPad: opts.dspace,
        forceMetaViewport: false,
        headCSS,
        bodyHTML,
        docTitle,
      })
    );

    fs.writeFileSync(
      mobileHTMLPath,
      buildDoc({
        label: "Mobile",
        viewportWidth: opts.mobile,
        gutter: opts.mgutter,
        innerPad: opts.mspace,
        forceMetaViewport: true,
        mobileMetaWidth: opts.mobile,
        isMobile: true,
        headCSS,
        bodyHTML,
        docTitle,
      })
    );

    // Render PDFs
    console.log("🖥️  Rendering desktop view...");
    const desktopBuf = await renderToPdfSingle({
      htmlPath: desktopHTMLPath,
      contextMode: { type: "viewport" },
      targetWidth: opts.desktop,
      pdfWidth: opts.pdfWidth,
    });

    console.log("📱 Rendering mobile view...");
    const mobileBuf = await renderToPdfSingle({
      htmlPath: mobileHTMLPath,
      contextMode: opts.emulateMobile
        ? { type: "mobile-emulation", deviceName: opts.mobileDevice }
        : { type: "viewport" },
      targetWidth: opts.mobile,
      pdfWidth: opts.pdfWidth,
    });

    // Merge PDFs
    console.log("🔗 Merging PDFs...");
    const outDoc = await PDFDocument.create();
    const dDoc = await PDFDocument.load(desktopBuf);
    const mDoc = await PDFDocument.load(mobileBuf);

    const verticalPadding = 300;

    // Add desktop page
    const [dPageSource] = dDoc.getPages();
    const desktopWidth = dPageSource.getWidth();
    const desktopHeight = dPageSource.getHeight();

    if (desktopWidth < opts.pdfWidth) {
      const newDesktopPage = outDoc.addPage([
        opts.pdfWidth,
        desktopHeight + verticalPadding * 2,
      ]);
      const [embeddedDesktopPage] = await outDoc.embedPdf(dDoc, [0]);
      const xOffset = (opts.pdfWidth - desktopWidth) / 2;
      newDesktopPage.drawPage(embeddedDesktopPage, {
        x: xOffset,
        y: verticalPadding,
        width: desktopWidth,
        height: desktopHeight,
      });

      if (opts.title) {
        const titleFontSize = 64;
        const subtitleFontSize = 32;
        const titleY =
          desktopHeight + verticalPadding + verticalPadding / 2 + 20;
        const subtitleY = titleY - 50;

        newDesktopPage.drawText(opts.title, {
          x: opts.pdfWidth / 2 - opts.title.length * titleFontSize * 0.3,
          y: titleY,
          size: titleFontSize,
          color: { type: "RGB", red: 0, green: 0, blue: 0 },
        });

        const subtitle = "Desktop";
        newDesktopPage.drawText(subtitle, {
          x: opts.pdfWidth / 2 - subtitle.length * subtitleFontSize * 0.3,
          y: subtitleY,
          size: subtitleFontSize,
          color: { type: "RGB", red: 0.4, green: 0.4, blue: 0.4 },
        });
      }
    } else {
      const [dPage] = await outDoc.copyPages(dDoc, [0]);
      outDoc.addPage(dPage);
    }

    // Add mobile page
    const [mPageSource] = mDoc.getPages();
    const mobileWidth = mPageSource.getWidth();
    const mobileHeight = mPageSource.getHeight();

    if (mobileWidth < opts.pdfWidth) {
      const newMobilePage = outDoc.addPage([
        opts.pdfWidth,
        mobileHeight + verticalPadding * 2,
      ]);
      const [embeddedMobilePage] = await outDoc.embedPdf(mDoc, [0]);
      const xOffset = (opts.pdfWidth - mobileWidth) / 2;
      newMobilePage.drawPage(embeddedMobilePage, {
        x: xOffset,
        y: verticalPadding,
        width: mobileWidth,
        height: mobileHeight,
      });

      if (opts.title) {
        const titleFontSize = 64;
        const subtitleFontSize = 32;
        const titleY =
          mobileHeight + verticalPadding + verticalPadding / 2 + 20;
        const subtitleY = titleY - 50;

        newMobilePage.drawText(opts.title, {
          x: opts.pdfWidth / 2 - opts.title.length * titleFontSize * 0.3,
          y: titleY,
          size: titleFontSize,
          color: { type: "RGB", red: 0, green: 0, blue: 0 },
        });

        const subtitle = "Mobile";
        newMobilePage.drawText(subtitle, {
          x: opts.pdfWidth / 2 - subtitle.length * subtitleFontSize * 0.3,
          y: subtitleY,
          size: subtitleFontSize,
          color: { type: "RGB", red: 0.4, green: 0.4, blue: 0.4 },
        });
      }
    } else {
      const [mPage] = await outDoc.copyPages(mDoc, [0]);
      outDoc.addPage(mPage);
    }

    const pdfBytes = await outDoc.save();

    // Cleanup temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });

    return pdfBytes;
  } catch (error) {
    // Cleanup on error
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

// ================================
// API Endpoints
// ================================

app.post("/api/convert", upload.single("htmlFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const title = req.body.title || "HTML Preview";
    const htmlContent = req.file.buffer.toString("utf-8");

    console.log(`📄 Processing: ${req.file.originalname}`);
    console.log(`📝 Title: ${title}`);

    const pdfBytes = await convertHtmlToPdf(htmlContent, title);

    // Generate filename
    const filename = `${title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_dualrender.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBytes.length);

    res.send(Buffer.from(pdfBytes));

    console.log("✅ PDF generated successfully");
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      error: "Failed to convert HTML to PDF",
      message: error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "DualRender server is running" });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds 10MB limit" });
    }
  }
  res.status(500).json({ error: error.message });
});

// ================================
// Start Server
// ================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║     🚀 DualRender Server Running      ║
╠═══════════════════════════════════════╣
║  Port: ${PORT}                           ║
║  URL:  http://localhost:${PORT}          ║
╚═══════════════════════════════════════╝
  `);
});
