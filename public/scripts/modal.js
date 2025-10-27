const MODAL_ID = "titleModal";

async function loadModalHTML() {
  try {
    const response = await fetch("./modal.html");
    if (!response.ok) {
      throw new Error("Failed to load modal");
    }
    const html = await response.text();
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  } catch (error) {
    console.error("Error loading modal:", error);
    return createFallbackModal();
  }
}

function createFallbackModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = MODAL_ID;

  modal.innerHTML = `
    <div class="modal-content">
      <h2 class="modal-title">Enter PDF Title</h2>
      <p class="modal-description" id="modalDescription">This title will appear on both pages of your PDF</p>
      <p class="modal-filename" id="modalFilename"></p>
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

export async function promptForTitle(
  filename,
  fileNumber = null,
  totalFiles = null
) {
  return new Promise(async (resolve) => {
    const modal = await loadModalHTML();
    document.body.appendChild(modal);

    const descriptionEl = modal.querySelector("#modalDescription");
    const filenameEl = modal.querySelector("#modalFilename");

    if (fileNumber && totalFiles) {
      descriptionEl.textContent = `File ${fileNumber} of ${totalFiles} - Enter a title for this PDF`;
      filenameEl.textContent = `Processing: ${filename}`;
    } else {
      descriptionEl.textContent =
        "This title will appear on both pages of your PDF";
      filenameEl.textContent = `File: ${filename}`;
    }

    const suggestedTitle = filename.replace(/\.(html|htm)$/i, "");
    const input = modal.querySelector("#titleInput");
    input.value = suggestedTitle;
    input.focus();
    input.select();

    const cleanup = () => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    };

    const handleSubmit = () => {
      const value = input.value.trim();
      if (value) {
        cleanup();
        resolve(value);
      } else {
        input.classList.add("error");
        setTimeout(() => input.classList.remove("error"), 300);
      }
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    modal
      .querySelector("#confirmButton")
      .addEventListener("click", handleSubmit);
    modal.querySelector("#cancelButton").addEventListener("click", handleCancel);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        handleSubmit();
      } else if (event.key === "Escape") {
        handleCancel();
      }
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        handleCancel();
      }
    });
  });
}
