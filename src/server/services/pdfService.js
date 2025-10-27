const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium, devices } = require("playwright");
const { PDFDocument } = require("pdf-lib");

const { DEFAULT_RENDER_CONFIG } = require("../config/defaults");
const {
  extractHeadStyles,
  extractTitle,
  extractBody,
} = require("../utils/htmlParser");
const { buildDocument } = require("../utils/templateBuilder");

function resolveRenderConfig(title, options = {}) {
  const config = {
    title: title || "HTML Preview",
    pdfWidth:
      typeof options.pdfWidth === "number"
        ? options.pdfWidth
        : DEFAULT_RENDER_CONFIG.pdfWidth,
    desktop: {
      ...DEFAULT_RENDER_CONFIG.desktop,
    },
    mobile: {
      ...DEFAULT_RENDER_CONFIG.mobile,
    },
  };

  if (typeof options.desktop === "number") {
    config.desktop.viewportWidth = options.desktop;
  } else if (
    options.desktop &&
    typeof options.desktop.viewportWidth === "number"
  ) {
    config.desktop.viewportWidth = options.desktop.viewportWidth;
  }

  if (typeof options.mobile === "number") {
    config.mobile.viewportWidth = options.mobile;
  } else if (
    options.mobile &&
    typeof options.mobile.viewportWidth === "number"
  ) {
    config.mobile.viewportWidth = options.mobile.viewportWidth;
  }

  if (typeof options.dgutter === "number") {
    config.desktop.gutter = options.dgutter;
  }
  if (typeof options.mgutter === "number") {
    config.mobile.gutter = options.mgutter;
  }
  if (typeof options.dspace === "number") {
    config.desktop.innerPadding = options.dspace;
  }
  if (typeof options.mspace === "number") {
    config.mobile.innerPadding = options.mspace;
  }
  if (typeof options.emulateMobile === "boolean") {
    config.mobile.emulateDevice = options.emulateMobile;
  }
  if (typeof options.mobileDevice === "string") {
    config.mobile.deviceName = options.mobileDevice;
  } else if (
    options.mobile &&
    typeof options.mobile.deviceName === "string"
  ) {
    config.mobile.deviceName = options.mobile.deviceName;
  }

  return config;
}

async function renderToPdfSingle({
  htmlPath,
  contextMode,
  targetWidth,
  pdfWidth,
}) {
  let browser = null;
  let context = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

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
    await page.goto(`file://${htmlPath}`, {
      waitUntil: "load",
      timeout: 30000,
    });

    const contentHeight = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const wrapper = document.querySelector(".page-wrapper");
      const heights = [
        body.scrollHeight,
        body.offsetHeight,
        html.scrollHeight,
        html.offsetHeight,
      ];

      if (wrapper) {
        heights.push(wrapper.scrollHeight, wrapper.offsetHeight);
      }

      return Math.ceil(Math.max(...heights)) + 10;
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
  } catch (error) {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    throw error;
  }
}

async function convertHtmlToPdf(htmlContent, requestedTitle, options = {}) {
  const config = resolveRenderConfig(requestedTitle, options);
  const opts = {
    title: config.title,
    desktop: config.desktop.viewportWidth,
    mobile: config.mobile.viewportWidth,
    emulateMobile: config.mobile.emulateDevice,
    mobileDevice: config.mobile.deviceName,
    dgutter: config.desktop.gutter,
    mgutter: config.mobile.gutter,
    dspace: config.desktop.innerPadding,
    mspace: config.mobile.innerPadding,
    pdfWidth: config.pdfWidth,
  };

  let tmpDir;

  try {
    const headCSS = extractHeadStyles(htmlContent);
    const docTitle = opts.title || extractTitle(htmlContent) || "HTML Preview";
    const bodyHTML = extractBody(htmlContent);

    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "html2pdf-"));
    } catch (err) {
      tmpDir = fs.mkdtempSync(path.join("/tmp", "html2pdf-"));
    }

    const desktopHTMLPath = path.join(tmpDir, "desktop.html");
    const mobileHTMLPath = path.join(tmpDir, "mobile.html");

    fs.writeFileSync(
      desktopHTMLPath,
      buildDocument({
        label: "DESKTOP",
        viewportWidth: opts.desktop,
        gutter: opts.dgutter,
        innerPad: opts.dspace,
        forceMetaViewport: false,
        headCSS,
        bodyHTML,
        docTitle,
      }),
      "utf-8"
    );

    fs.writeFileSync(
      mobileHTMLPath,
      buildDocument({
        label: "MOBILE",
        viewportWidth: opts.mobile,
        gutter: opts.mgutter,
        innerPad: opts.mspace,
        forceMetaViewport: true,
        mobileMetaWidth: opts.mobile,
        isMobile: true,
        headCSS,
        bodyHTML,
        docTitle,
      }),
      "utf-8"
    );

    const desktopBuf = await renderToPdfSingle({
      htmlPath: desktopHTMLPath,
      contextMode: { type: "viewport" },
      targetWidth: opts.desktop,
      pdfWidth: opts.pdfWidth,
    });

    const mobileBuf = await renderToPdfSingle({
      htmlPath: mobileHTMLPath,
      contextMode: opts.emulateMobile
        ? { type: "mobile-emulation", deviceName: opts.mobileDevice }
        : { type: "viewport" },
      targetWidth: opts.mobile,
      pdfWidth: opts.pdfWidth,
    });

    const outDoc = await PDFDocument.create();
    const dDoc = await PDFDocument.load(desktopBuf);
    const mDoc = await PDFDocument.load(mobileBuf);

    const font = await outDoc.embedFont("Helvetica");
    const boldFont = await outDoc.embedFont("Helvetica-Bold");

    const verticalPadding = 300;

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
        const titleFontSize = 32;
        const subtitleFontSize = 16;
        const lineSpacing = subtitleFontSize * 1.5;

        const titleWidth = font.widthOfTextAtSize(opts.title, titleFontSize);
        const titleX = (opts.pdfWidth - titleWidth) / 2;
        const titleY =
          desktopHeight + verticalPadding + verticalPadding / 2 + 20;

        const subtitle = "DESKTOP";
        const subtitleWidth = boldFont.widthOfTextAtSize(
          subtitle,
          subtitleFontSize
        );
        const subtitleX = (opts.pdfWidth - subtitleWidth) / 2;
        const subtitleY = titleY - lineSpacing - 10;

        newDesktopPage.drawText(opts.title, {
          x: titleX,
          y: titleY,
          size: titleFontSize,
          font: font,
          color: { type: "RGB", red: 0, green: 0, blue: 0 },
        });

        newDesktopPage.drawText(subtitle, {
          x: subtitleX,
          y: subtitleY,
          size: subtitleFontSize,
          font: boldFont,
          color: { type: "RGB", red: 0.4, green: 0.4, blue: 0.4 },
        });
      }
    } else {
      const [dPage] = await outDoc.copyPages(dDoc, [0]);
      outDoc.addPage(dPage);
    }

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
        const titleFontSize = 32;
        const subtitleFontSize = 16;
        const lineSpacing = subtitleFontSize * 1.5;

        const titleWidth = font.widthOfTextAtSize(opts.title, titleFontSize);
        const titleX = (opts.pdfWidth - titleWidth) / 2;
        const titleY =
          mobileHeight + verticalPadding + verticalPadding / 2 + 20;

        const subtitle = "MOBILE";
        const subtitleWidth = boldFont.widthOfTextAtSize(
          subtitle,
          subtitleFontSize
        );
        const subtitleX = (opts.pdfWidth - subtitleWidth) / 2;
        const subtitleY = titleY - lineSpacing - 10;

        newMobilePage.drawText(opts.title, {
          x: titleX,
          y: titleY,
          size: titleFontSize,
          font: font,
          color: { type: "RGB", red: 0, green: 0, blue: 0 },
        });

        newMobilePage.drawText(subtitle, {
          x: subtitleX,
          y: subtitleY,
          size: subtitleFontSize,
          font: boldFont,
          color: { type: "RGB", red: 0.4, green: 0.4, blue: 0.4 },
        });
      }
    } else {
      const [mPage] = await outDoc.copyPages(mDoc, [0]);
      outDoc.addPage(mPage);
    }

    const pdfBytes = await outDoc.save();

    fs.rmSync(tmpDir, { recursive: true, force: true });

    return pdfBytes;
  } catch (error) {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    throw error;
  }
}

module.exports = {
  convertHtmlToPdf,
};
