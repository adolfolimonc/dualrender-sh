/**
 * Build a sandboxed HTML document that wraps the original email markup
 * with framing styles so Playwright renders consistent viewport snapshots.
 */
function buildDocument({
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
    * { box-sizing: border-box !important; }
    html, body { margin:0; padding:0; background:#ffffff; width:100%; height:auto; }
    .page-wrapper { width:100%; padding:${gutter}px; }
    .frame { width:100%; max-width:${viewportWidth}px; margin:0 auto; }
    .content { background:#fff; border:1px solid #e5e5e5; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .inner { padding:${innerPad}px; overflow-wrap: break-word; word-wrap: break-word; }
    
    /* Aggressive mobile-responsive overrides */
    table { 
      border-collapse: collapse !important; 
      width: 100% !important; 
      max-width: 100% !important; 
      min-width: auto !important;
      table-layout: auto !important;
    }
    td, th { 
      word-wrap: break-word !important; 
      overflow-wrap: break-word !important;
      word-break: break-word !important;
      max-width: 100% !important;
    }
    img { 
      max-width: 100% !important; 
      height: auto !important; 
      display: block !important;
      width: auto !important;
    }
    p, span, div { max-width: 100% !important; }
    .inner * { max-width: 100% !important; }
  </style>
  <style>${headCSS}</style>
  <title>${docTitle} - ${label}</title>
</head>
<body>
  <div class="page-wrapper">
    <div class="frame" data-label="${label}">
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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; background:#ffffff; }
    .page-wrapper { width:100%; padding:${gutter}px; }
    .frame { width:100%; max-width:${viewportWidth}px; margin:0 auto; }
    .content { background:#fff; border:1px solid #e5e5e5; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .inner { padding:${innerPad}px; overflow-wrap: break-word; word-wrap: break-word; }
  </style>
  <style>${headCSS}</style>
  <title>${docTitle} - ${label}</title>
</head>
<body>
  <div class="page-wrapper">
    <div class="frame" data-label="${label}">
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

module.exports = {
  buildDocument,
};
