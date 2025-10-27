import { CONFIG } from "./config.js";

export function validateFile(file) {
  if (!file) {
    return {
      success: false,
      message: "No file selected",
    };
  }

  if (file.size > CONFIG.maxFileSize) {
    return {
      success: false,
      message: `File size exceeds ${
        CONFIG.maxFileSize / 1024 / 1024
      }MB limit`,
    };
  }

  const fileName = file.name.toLowerCase();
  const hasValidExtension = CONFIG.allowedExtensions.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      success: false,
      message: "Please select a valid HTML file (.html or .htm)",
    };
  }

  if (file.type && !CONFIG.acceptedMimeTypes.includes(file.type)) {
    return {
      success: false,
      message: "Invalid file type. Please select an HTML file",
    };
  }

  return {
    success: true,
    message: "File is valid",
  };
}
