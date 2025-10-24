/**
 * DualRender - HTML to PDF Converter
 * Main application script for file upload and processing
 */

// ================================
// Constants & Configuration
// ================================
const CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: [".html", ".htm"],
  acceptedMimeTypes: ["text/html"],
};

// ================================
// DOM Elements
// ================================
const elements = {
  uploadButton: null,
  fileInput: null,
  buttonText: null,
};

// ================================
// Utility Functions
// ================================

/**
 * Validate file before processing
 * @param {File} file - The file to validate
 * @returns {Object} - Validation result with success boolean and message
 */
function validateFile(file) {
  if (!file) {
    return {
      success: false,
      message: "No file selected",
    };
  }

  // Check file size
  if (file.size > CONFIG.maxFileSize) {
    return {
      success: false,
      message: `File size exceeds ${CONFIG.maxFileSize / 1024 / 1024}MB limit`,
    };
  }

  // Check file extension
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

  // Check MIME type
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

/**
 * Update button state with visual feedback
 * @param {string} state - Button state ('idle', 'processing', 'success', 'error')
 * @param {string} message - Optional message to display
 */
function updateButtonState(state, message = "") {
  const { uploadButton, buttonText } = elements;

  // Remove all state classes
  uploadButton.classList.remove("processing", "success", "error");

  switch (state) {
    case "processing":
      uploadButton.classList.add("processing");
      uploadButton.disabled = true;
      buttonText.textContent = "Processing...";
      break;

    case "success":
      uploadButton.classList.add("success");
      uploadButton.disabled = false;
      buttonText.textContent = message || "Success!";
      setTimeout(() => {
        buttonText.textContent = "Upload html file";
        uploadButton.classList.remove("success");
      }, 3000);
      break;

    case "error":
      uploadButton.classList.add("error");
      uploadButton.disabled = false;
      buttonText.textContent = message || "Error!";
      setTimeout(() => {
        buttonText.textContent = "Upload html file";
        uploadButton.classList.remove("error");
      }, 3000);
      break;

    case "idle":
    default:
      uploadButton.disabled = false;
      buttonText.textContent = "Upload html file";
      break;
  }
}

/**
 * Show user notification
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('success', 'error', 'info')
 */
function showNotification(message, type = "info") {
  // TODO: Implement notification system (toast/modal)
  // For now, using console and alert
  console.log(`[${type.toUpperCase()}]: ${message}`);

  if (type === "error") {
    alert(message);
  }
}

// ================================
// File Processing Functions
// ================================

/**
 * Process the uploaded HTML file
 * @param {File} file - The HTML file to process
 */
async function processHTMLFile(file) {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.success) {
      throw new Error(validation.message);
    }

    // Prompt user for title
    const title = await promptForTitle(file.name);
    if (!title) {
      // User cancelled
      updateButtonState("idle");
      return;
    }

    updateButtonState("processing");

    // Log file info for debugging
    console.log("File processing started:", {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      type: file.type,
      title: title,
    });

    // Send to server for conversion
    const pdfBlob = await sendToServer(file, title);

    // Download the PDF
    downloadPDF(pdfBlob, title);

    updateButtonState("success", "PDF Generated!");
    showNotification(`Successfully created PDF: ${title}`, "success");
  } catch (error) {
    console.error("Error processing file:", error);
    updateButtonState("error", "Conversion failed");
    showNotification(error.message, "error");
  }
}

/**
 * Load modal HTML from external file
 * @returns {Promise<HTMLElement>} - Modal element
 */
async function loadModalHTML() {
  try {
    const response = await fetch("modal.html");
    if (!response.ok) {
      throw new Error("Failed to load modal");
    }
    const html = await response.text();
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstChild;
  } catch (error) {
    console.error("Error loading modal:", error);
    // Fallback: create modal inline if file fails to load
    return createFallbackModal();
  }
}

/**
 * Create fallback modal if external HTML fails to load
 * @returns {HTMLElement} - Modal element
 */
function createFallbackModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "titleModal";

  modal.innerHTML = `
    <div class="modal-content">
      <h2 class="modal-title">Enter PDF Title</h2>
      <p class="modal-description">This title will appear on both pages of your PDF</p>
      <input 
        type="text" 
        id="titleInput" 
        class="modal-input" 
        placeholder="e.g., My Email Template"
        maxlength="100"
        autocomplete="off"
      />
      <div class="modal-buttons">
        <button id="cancelButton" class="modal-button modal-button-secondary">Cancel</button>
        <button id="confirmButton" class="modal-button modal-button-primary">Generate PDF</button>
      </div>
    </div>
  `;

  return modal;
}

/**
 * Prompt user for PDF title
 * @param {string} filename - Original filename for suggestion
 * @returns {Promise<string|null>} - Title or null if cancelled
 */
async function promptForTitle(filename) {
  return new Promise(async (resolve) => {
    // Load modal from external HTML file
    const modal = await loadModalHTML();
    document.body.appendChild(modal);

    // Set suggested title
    const suggestedTitle = filename.replace(/\.(html|htm)$/i, "");
    const input = modal.querySelector("#titleInput");
    input.value = suggestedTitle;

    // Focus on input
    input.focus();
    input.select();

    // Handle submit
    const handleSubmit = () => {
      const value = input.value.trim();
      if (value) {
        document.body.removeChild(modal);
        resolve(value);
      } else {
        input.classList.add("error");
        setTimeout(() => input.classList.remove("error"), 300);
      }
    };

    // Handle cancel
    const handleCancel = () => {
      document.body.removeChild(modal);
      resolve(null);
    };

    // Event listeners
    modal
      .querySelector("#confirmButton")
      .addEventListener("click", handleSubmit);
    modal
      .querySelector("#cancelButton")
      .addEventListener("click", handleCancel);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    });
  });
}

/**
 * Send file to server for conversion
 * @param {File} file - HTML file
 * @param {string} title - PDF title
 * @returns {Promise<Blob>} - PDF blob
 */
async function sendToServer(file, title) {
  const formData = new FormData();
  formData.append("htmlFile", file);
  formData.append("title", title);

  const response = await fetch("/api/convert", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Server error occurred");
  }

  return await response.blob();
}

/**
 * Download PDF file
 * @param {Blob} blob - PDF blob
 * @param {string} title - Title for filename
 */
function downloadPDF(blob, title) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()}_dualrender.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ================================
// Event Handlers
// ================================

/**
 * Handle file input change
 * @param {Event} event - Change event
 */
function handleFileChange(event) {
  const file = event.target.files[0];

  if (file) {
    processHTMLFile(file);
  }

  // Reset input to allow selecting the same file again
  event.target.value = "";
}

/**
 * Handle button click (delegates to file input)
 * @param {Event} event - Click event
 */
function handleButtonClick(event) {
  // The file input will handle the actual click
  // This is just for additional feedback
  console.log("Upload button clicked");
}

/**
 * Handle drag and drop events
 */
function setupDragAndDrop() {
  const { uploadButton } = elements;

  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadButton.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when dragging over it
  ["dragenter", "dragover"].forEach((eventName) => {
    uploadButton.addEventListener(
      eventName,
      () => {
        uploadButton.classList.add("drag-over");
      },
      false
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadButton.addEventListener(
      eventName,
      () => {
        uploadButton.classList.remove("drag-over");
      },
      false
    );
  });

  // Handle dropped files
  uploadButton.addEventListener("drop", handleDrop, false);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;

  if (files.length > 0) {
    processHTMLFile(files[0]);
  }
}

// ================================
// Initialization
// ================================

/**
 * Initialize the application
 */
function init() {
  // Cache DOM elements
  elements.uploadButton = document.getElementById("uploadButton");
  elements.fileInput = document.getElementById("fileInput");
  elements.buttonText = elements.uploadButton.querySelector(".button-text");

  // Verify elements exist
  if (!elements.uploadButton || !elements.fileInput || !elements.buttonText) {
    console.error("Required DOM elements not found");
    return;
  }

  // Attach event listeners
  elements.fileInput.addEventListener("change", handleFileChange);
  elements.uploadButton.addEventListener("click", handleButtonClick);

  // Setup drag and drop
  setupDragAndDrop();

  console.log("DualRender initialized successfully");
}

// ================================
// App Entry Point
// ================================

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Export for potential module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    validateFile,
    processHTMLFile,
    CONFIG,
  };
}
