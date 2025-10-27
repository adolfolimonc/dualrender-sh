/**
 * Default layout and rendering configuration for the DualRender service.
 */
const DEFAULT_RENDER_CONFIG = {
  pdfWidth: 1080,
  desktop: {
    viewportWidth: 800,
    gutter: 72,
    innerPadding: 0,
  },
  mobile: {
    viewportWidth: 375,
    gutter: 20,
    innerPadding: 16,
    emulateDevice: true,
    deviceName: "iPhone 12",
  },
};

module.exports = {
  DEFAULT_RENDER_CONFIG,
};
