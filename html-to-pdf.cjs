#!/usr/bin/env node

// Desktop and Mobile
// Mobile page emulates a real phone device because of `min/max-device-width` media queries problems
// Falls back to viewport-only if emulateMobile=false
// Auto-sizes PDF page height to the rendered content
//
// Usage:
//   node html-to-pdf.cjs input.html output.pdf --title "My Email" \
//     --desktop 1200 --mobile 375 \
//     --emulateMobile true --mobileDevice "iPhone 12" \
//     --dgutter 72 --mgutter 24 \
//     --dspace 0 --mspace 12
//
// Notes:
// - Requires: playwright (Chromium) and pdf-lib
//     npm i playwright pdf-lib
//     npx playwright install chromium

const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium, devices } = require("playwright");
const { PDFDocument } = require("pdf-lib");

// --- Simple arg parser (no deps) ---
function parseArgs(argv) {
  const out = {};
  let key = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      key = a.slice(2);
      // boolean flags default to true if provided with no value
      if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
        out[key] = true;
        key = null;
      }
    } else if (key) {
      out[key] = a;
      key = null;
    } else if (!out._) {
      out._ = [a];
    } else {
      out._.push(a);
    }
  }
  if (!out._) out._ = [];
  return out;
}

const args = parseArgs(process.argv);
const [inputPath, outputPath] = args._;
if (!inputPath || !outputPath) {
  console.error(
    'Usage: node html-to-pdf.cjs <input.html> <output.pdf> [--title "Title"] [--desktop 1200] [--mobile 375] [--emulateMobile true|false] [--mobileDevice "iPhone 12"] [--dgutter 72] [--mgutter 24] [--dspace 0] [--mspace 12]'
  );
  process.exit(1);
}

const opts = {
  title: args.title || "",
  desktop: Number(args.desktop || 800),
  mobile: Number(args.mobile || 375),
  emulateMobile: String(args.emulateMobile || "true").toLowerCase() !== "false",
  mobileDevice: args.mobileDevice || "iPhone 12",
  dgutter: Number(args.dgutter || 72),
  mgutter: Number(args.mgutter || 24),
  dspace: Number(args.dspace || 0),
  mspace: Number(args.mspace || 12),
  pdfWidth: 1080, // Fixed PDF page width
};

// --- Read input HTML ---
const raw = fs.readFileSync(inputPath, "utf8");

// extract <head> styles and <body> html
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
  // fallback to whole doc
  return html;
}

const headCSS = extractHeadStyles(raw);
const docTitle = opts.title || extractTitle(raw) || "HTML Preview";
const bodyHTML = extractBody(raw);

// Build a framed document (keeps original CSS + media queries)
function buildDoc({
  label,
  viewportWidth,
  gutter,
  innerPad,
  forceMetaViewport = false,
  mobileMetaWidth,
  isMobile = false,
}) {
  const metaViewport = forceMetaViewport
    ? `<meta name="viewport" content="width=${
        mobileMetaWidth || viewportWidth
      }, initial-scale=1">`
    : "";

  // For mobile view, center a mobile-width container on the page
  if (isMobile) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${metaViewport}
  <style>
    html, body { margin:0; padding:0; background:#ffffff; width:100%; }
    /* Centering wrapper */
    .page-wrapper { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; width:100%; }
    /* Frame + header - flexible width */
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
    /* Centering wrapper */
    .page-wrapper { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
    /* Frame + header */
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

// write temp files
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html2pdf-"));
const desktopHTMLPath = path.join(tmpDir, "desktop.html");
const mobileHTMLPath = path.join(tmpDir, "mobile.html");

// Desktop doc uses viewport-only; mobile doc includes meta viewport as a hint
fs.writeFileSync(
  desktopHTMLPath,
  buildDoc({
    label: "Desktop",
    viewportWidth: opts.desktop,
    gutter: opts.dgutter,
    innerPad: opts.dspace,
    forceMetaViewport: false,
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
    mobileMetaWidth: opts.mobile, // ensure viewport-based media queries trigger
    isMobile: true,
  })
);

async function renderToPdfSingle({
  htmlPath,
  contextMode,
  targetWidth,
  pdfWidth,
}) {
  const browser = await chromium.launch();
  let context;
  try {
    if (contextMode.type === "mobile-emulation") {
      const device = devices[contextMode.deviceName] || devices["iPhone 12"];
      // Use mobile device settings with targetWidth viewport to trigger media queries
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
    // Emulate screen media so CSS @media screen applies
    await page.emulateMedia({ media: "screen" });
    await page.goto("file://" + htmlPath, { waitUntil: "load" });

    // Expand height to fit content
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

    // For mobile: capture at mobile width, then we'll handle centering in PDF
    // For desktop: render at full PDF width
    const renderWidth =
      contextMode.type === "mobile-emulation" ? targetWidth : pdfWidth;

    // Generate PDF with explicit pixel width/height
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

async function main() {
  // Render desktop
  const desktopBuf = await renderToPdfSingle({
    htmlPath: desktopHTMLPath,
    contextMode: { type: "viewport" },
    targetWidth: opts.desktop,
    pdfWidth: opts.pdfWidth,
  });

  // Render mobile — either emulate a real phone or just set a narrow viewport
  const mobileBuf = await renderToPdfSingle({
    htmlPath: mobileHTMLPath,
    contextMode: opts.emulateMobile
      ? { type: "mobile-emulation", deviceName: opts.mobileDevice }
      : { type: "viewport" },
    targetWidth: opts.mobile,
    pdfWidth: opts.pdfWidth,
  });

  // Merge two single-page PDFs - both pages should be 1080px wide
  const outDoc = await PDFDocument.create();
  const dDoc = await PDFDocument.load(desktopBuf);
  const mDoc = await PDFDocument.load(mobileBuf);

  // Handle desktop page - center it on 1080px page if needed
  const [dPageSource] = dDoc.getPages();
  const desktopWidth = dPageSource.getWidth();
  const desktopHeight = dPageSource.getHeight();
  const verticalPadding = 300; // 300px top and bottom

  if (desktopWidth < opts.pdfWidth) {
    // Create a new page with full PDF width and add vertical padding
    const newDesktopPage = outDoc.addPage([
      opts.pdfWidth,
      desktopHeight + verticalPadding * 2,
    ]);
    const [embeddedDesktopPage] = await outDoc.embedPdf(dDoc, [0]);
    const xOffset = (opts.pdfWidth - desktopWidth) / 2;
    newDesktopPage.drawPage(embeddedDesktopPage, {
      x: xOffset,
      y: verticalPadding, // Add padding at bottom (PDF coordinates start from bottom)
      width: desktopWidth,
      height: desktopHeight,
    });

    // Add title text in the top padding area if title is provided
    if (opts.title) {
      const titleFontSize = 64;
      const subtitleFontSize = 32;
      const titleY = desktopHeight + verticalPadding + verticalPadding / 2 + 20; // Center in top padding, slightly above middle
      const subtitleY = titleY - 50; // Position subtitle below title

      // Draw title (64px)
      newDesktopPage.drawText(opts.title, {
        x: opts.pdfWidth / 2 - opts.title.length * titleFontSize * 0.3, // Approximate centering
        y: titleY,
        size: titleFontSize,
        color: { type: "RGB", red: 0, green: 0, blue: 0 },
      });

      // Draw subtitle (32px) - "Desktop"
      const subtitle = "Desktop";
      newDesktopPage.drawText(subtitle, {
        x: opts.pdfWidth / 2 - subtitle.length * subtitleFontSize * 0.3, // Approximate centering
        y: subtitleY,
        size: subtitleFontSize,
        color: { type: "RGB", red: 0.4, green: 0.4, blue: 0.4 },
      });
    }
  } else {
    const [dPage] = await outDoc.copyPages(dDoc, [0]);
    outDoc.addPage(dPage);
  }

  // Handle mobile page - center it on 1080px page if needed
  const [mPageSource] = mDoc.getPages();
  const mobileWidth = mPageSource.getWidth();
  const mobileHeight = mPageSource.getHeight();

  if (mobileWidth < opts.pdfWidth) {
    // Create a new page with full PDF width and add vertical padding
    const newMobilePage = outDoc.addPage([
      opts.pdfWidth,
      mobileHeight + verticalPadding * 2,
    ]);
    const [embeddedMobilePage] = await outDoc.embedPdf(mDoc, [0]);
    const xOffset = (opts.pdfWidth - mobileWidth) / 2;
    newMobilePage.drawPage(embeddedMobilePage, {
      x: xOffset,
      y: verticalPadding, // Add padding at bottom (PDF coordinates start from bottom)
      width: mobileWidth,
      height: mobileHeight,
    });

    // Add title text in the top padding area if title is provided
    if (opts.title) {
      const titleFontSize = 64;
      const subtitleFontSize = 32;
      const titleY = mobileHeight + verticalPadding + verticalPadding / 2 + 20; // Center in top padding, slightly above middle
      const subtitleY = titleY - 50; // Position subtitle below title

      // Draw title (64px)
      newMobilePage.drawText(opts.title, {
        x: opts.pdfWidth / 2 - opts.title.length * titleFontSize * 0.3, // Approximate centering
        y: titleY,
        size: titleFontSize,
        color: { type: "RGB", red: 0, green: 0, blue: 0 },
      });

      // Draw subtitle (32px) - "Mobile"
      const subtitle = "Mobile";
      newMobilePage.drawText(subtitle, {
        x: opts.pdfWidth / 2 - subtitle.length * subtitleFontSize * 0.3, // Approximate centering
        y: subtitleY,
        size: subtitleFontSize,
        color: { type: "RGB", red: 0.4, green: 0.4, blue: 0.4 },
      });
    }
  } else {
    const [mPage] = await outDoc.copyPages(mDoc, [0]);
    outDoc.addPage(mPage);
  }

  const merged = await outDoc.save();

  fs.writeFileSync(outputPath, merged);
  console.log("✅ Done");
  console.log(`• PDF page width: ${opts.pdfWidth}px`);
  console.log(
    `• Desktop frame: ${opts.desktop}px (gutter ${opts.dgutter}px, inner ${opts.dspace}px) — centered`
  );
  console.log(
    `• Mobile frame:  ${opts.mobile}px (gutter ${opts.mgutter}px, inner ${opts.mspace}px) — centered`
  );
  console.log(
    `• Mobile emulation: ${opts.emulateMobile ? "ON" : "OFF"}${
      opts.emulateMobile ? ` (${opts.mobileDevice})` : ""
    }`
  );
  console.log(`→ ${path.resolve(outputPath)}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
