import { validateFile } from "./validation.js";
import { createUiController } from "./ui.js";
import { promptForTitle } from "./modal.js";
import { sendToServer } from "./api.js";
import { downloadPDF } from "./download.js";
import { initDragAndDrop } from "./dragDrop.js";

function getElements() {
  const uploadButton = document.getElementById("uploadButton");
  const fileInput = document.getElementById("fileInput");
  const buttonText = uploadButton
    ? uploadButton.querySelector(".button-text")
    : null;

  return {
    uploadButton,
    fileInput,
    buttonText,
  };
}

function createFileProcessor(ui) {
  const { updateButtonState, showNotification } = ui;

  async function processBatchFiles(files) {
    if (!files || files.length === 0) return;

    const totalFiles = files.length;
    let successCount = 0;
    let errorCount = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fileNumber = index + 1;

      try {
        updateButtonState(
          "processing",
          `Processing ${fileNumber}/${totalFiles}...`
        );

        const validation = validateFile(file);
        if (!validation.success) {
          throw new Error(validation.message);
        }

        const title = await promptForTitle(file.name, fileNumber, totalFiles);
        if (!title) {
          updateButtonState("idle");
          showNotification("Batch processing cancelled", "error");
          return;
        }

        const pdfBlob = await sendToServer(file, title);
        downloadPDF(pdfBlob, title);

        successCount += 1;

        if (index < files.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        errorCount += 1;
        console.error(
          `[${fileNumber}/${totalFiles}] Error processing ${file.name}:`,
          error
        );
        showNotification(
          `Error processing ${file.name}: ${error.message}`,
          "error"
        );
      }
    }

    if (errorCount === 0) {
      updateButtonState(
        "success",
        `${successCount} PDF${successCount > 1 ? "s" : ""} Generated!`
      );
      showNotification(
        `Successfully created ${successCount} PDF${
          successCount > 1 ? "s" : ""
        }`,
        "success"
      );
    } else if (successCount > 0) {
      updateButtonState("success", `${successCount} of ${totalFiles} completed`);
      showNotification(
        `Completed ${successCount} of ${totalFiles} files. ${errorCount} failed.`,
        "error"
      );
    } else {
      updateButtonState("error", "All files failed");
      showNotification("Failed to process files", "error");
    }
  }

  async function processSingleFile(file) {
    try {
      const validation = validateFile(file);
      if (!validation.success) {
        throw new Error(validation.message);
      }

      const title = await promptForTitle(file.name);
      if (!title) {
        updateButtonState("idle");
        return;
      }

      updateButtonState("processing");

      const pdfBlob = await sendToServer(file, title);
      downloadPDF(pdfBlob, title);

      updateButtonState("success", "PDF Generated!");
      showNotification(`Successfully created PDF: ${title}`, "success");
    } catch (error) {
      console.error("Error processing file:", error);
      updateButtonState("error", "Conversion failed");
      showNotification(error.message, "error");
    }
  }

  return {
    processBatchFiles,
    processSingleFile,
  };
}

function registerEventHandlers(elements, processor) {
  const { uploadButton, fileInput } = elements;

  if (!uploadButton || !fileInput) {
    console.error("Required DOM elements not found");
    return () => {};
  }

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);

    if (files.length > 1) {
      await processor.processBatchFiles(files);
    } else if (files.length === 1) {
      await processor.processSingleFile(files[0]);
    }

    event.target.value = "";
  };

  const handleButtonClick = () => {
    console.log("Upload button clicked");
  };

  fileInput.addEventListener("change", handleFileChange);
  uploadButton.addEventListener("click", handleButtonClick);

  const cleanupDragAndDrop = initDragAndDrop(uploadButton, (files) => {
    if (files.length > 1) {
      processor.processBatchFiles(files);
    } else if (files.length === 1) {
      processor.processSingleFile(files[0]);
    }
  });

  return () => {
    fileInput.removeEventListener("change", handleFileChange);
    uploadButton.removeEventListener("click", handleButtonClick);
    cleanupDragAndDrop();
  };
}

function init() {
  const elements = getElements();
  const ui = createUiController(elements);
  const processor = createFileProcessor(ui);

  registerEventHandlers(elements, processor);

  console.log("DualRender initialized successfully");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
