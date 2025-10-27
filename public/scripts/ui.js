export function createUiController(elements) {
  const { uploadButton, buttonText } = elements;

  function updateButtonState(state, message = "") {
    if (!uploadButton || !buttonText) {
      return;
    }

    uploadButton.classList.remove("processing", "success", "error");

    switch (state) {
      case "processing":
        uploadButton.classList.add("processing");
        uploadButton.disabled = true;
        buttonText.textContent = message || "Processing...";
        break;

      case "success":
        uploadButton.classList.add("success");
        uploadButton.disabled = false;
        buttonText.textContent = message || "Success!";
        setTimeout(() => {
          buttonText.textContent = "Upload HTML files";
          uploadButton.classList.remove("success");
        }, 3000);
        break;

      case "error":
        uploadButton.classList.add("error");
        uploadButton.disabled = false;
        buttonText.textContent = message || "Error!";
        setTimeout(() => {
          buttonText.textContent = "Upload HTML files";
          uploadButton.classList.remove("error");
        }, 3000);
        break;

      case "idle":
      default:
        uploadButton.disabled = false;
        buttonText.textContent = "Upload HTML files";
        break;
    }
  }

  function showNotification(message, type = "info") {
    // TODO: Replace with UI toast system; simple alert for now.
    console.log(`[${type.toUpperCase()}]: ${message}`);
    if (type === "error") {
      alert(message);
    }
  }

  return {
    updateButtonState,
    showNotification,
  };
}
