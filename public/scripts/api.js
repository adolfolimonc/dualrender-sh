export async function sendToServer(file, title) {
  const formData = new FormData();
  formData.append("htmlFile", file);
  formData.append("title", title);

  const response = await fetch("/api/convert", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = "Server error occurred";
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || errorMessage;
    } catch (err) {
      // Ignore JSON parsing errors and use default message
    }
    throw new Error(errorMessage);
  }

  return response.blob();
}
