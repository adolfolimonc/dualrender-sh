export function downloadPDF(blob, title) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()}_dualrender.pdf`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
