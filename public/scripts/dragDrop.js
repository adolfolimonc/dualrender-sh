function preventDefaults(event) {
  event.preventDefault();
  event.stopPropagation();
}

export function initDragAndDrop(dropTarget, onFiles) {
  if (!dropTarget) {
    return () => {};
  }

  const preventHandlers = ["dragenter", "dragover", "dragleave", "drop"].map(
    (eventName) => {
      dropTarget.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
      return () => {
        dropTarget.removeEventListener(eventName, preventDefaults, false);
        document.body.removeEventListener(eventName, preventDefaults, false);
      };
    }
  );

  const handleDragEnter = () => dropTarget.classList.add("drag-over");
  const handleDragLeave = () => dropTarget.classList.remove("drag-over");

  const handleDrop = (event) => {
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length > 0) {
      onFiles(files);
    }
    dropTarget.classList.remove("drag-over");
  };

  dropTarget.addEventListener("dragenter", handleDragEnter, false);
  dropTarget.addEventListener("dragover", handleDragEnter, false);
  dropTarget.addEventListener("dragleave", handleDragLeave, false);
  dropTarget.addEventListener("drop", handleDrop, false);

  return () => {
    preventHandlers.forEach((cleanup) => cleanup());
    dropTarget.removeEventListener("dragenter", handleDragEnter, false);
    dropTarget.removeEventListener("dragover", handleDragEnter, false);
    dropTarget.removeEventListener("dragleave", handleDragLeave, false);
    dropTarget.removeEventListener("drop", handleDrop, false);
  };
}
