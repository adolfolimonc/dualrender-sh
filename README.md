# DualRender - HTML Email to PDF Converter

Convert responsive HTML email templates into PDF with separate Desktop and Mobile views.

## Features

- **Dual View PDF** - Generates Desktop and Mobile versions in one PDF
- **Responsive Design** - Beautiful, centered UI matching Figma design
- **Custom Titles** - Add custom titles to your PDF pages
- **Device Emulation** - Uses real device emulation for accurate mobile rendering
- **Fast Processing** - Powered by Playwright and pdf-lib
- **Auto-sizing** - Dynamically fits content height
- **Auto-download** - PDF downloads automatically after generation

## Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn

## Installation

1. **Install dependencies:**

   ```powershell
   npm install
   ```

2. **Install Chromium browser for Playwright:**
   ```powershell
   npm run install-browser
   ```

## Usage

### 1. Start the Server

```powershell
npm start
```

The server will start on `http://localhost:3000`

### 2. Open in Browser

Open your browser and navigate to:

```
http://localhost:3000
```

### 3. Convert HTML to PDF

1. Click the **"Upload HTML files"** button
2. Select your responsive HTML email template
3. Enter a title for your PDF when prompted
4. Click **"Generate PDF"**
5. Wait for processing (you'll see "Processing..." on the button)
6. PDF will automatically download when ready!

> Example responsive templates are available in the `examples/` directory if you need sample inputs for testing.


## File Structure

```text
email-to-pdf/
|- public/
|  |- assets/               # Static images and icons
|  |- scripts/              # Client-side ES modules
|  |- styles/               # Stylesheets
|  |- index.html            # Front-end entry point
|  \- modal.html            # Title prompt markup
|- src/
|  \- server/
|     |- app.js             # Express bootstrap & static hosting
|     |- routes/            # API route handlers
|     |- services/          # Playwright + pdf-lib orchestration
|     |- utils/             # HTML parsing and template builders
|     |- middleware/        # Multer upload configuration
|     \- config/            # Rendering defaults
|- examples/               # Sample responsive templates
|- package.json
|- package-lock.json
|- Dockerfile
\- render.yaml
```

## Configuration

### Default Settings

The server uses these default settings for PDF generation:

```javascript
{
  desktop: 800,           // Desktop viewport width (px)
  mobile: 375,            // Mobile viewport width (px)
  emulateMobile: true,    // Use device emulation
  mobileDevice: "iPhone 12", // Device to emulate
  dgutter: 72,            // Desktop gutter (px)
  mgutter: 20,            // Mobile gutter (px)
  dspace: 0,              // Desktop inner padding (px)
  mspace: 16,             // Mobile inner padding (px)
  pdfWidth: 1080          // Fixed PDF page width (px)
}
```

### Customizing Settings

To modify these settings, edit the `DEFAULT_RENDER_CONFIG` in `src/server/config/defaults.js`.

## Development

For development with auto-reload:

```powershell
npm run dev
```

This uses `nodemon` to automatically restart the server when files change.

## API Endpoints

### POST `/api/convert`

Convert HTML to PDF.

**Request:**

- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `htmlFile`: HTML file (max 10MB)
  - `title`: PDF title (string)

**Response:**

- Content-Type: `application/pdf`
- Body: PDF file (binary)

**Example using curl:**

```powershell
curl -X POST http://localhost:3000/api/convert `
  -F "htmlFile=@template.html" `
  -F "title=My Email Template" `
  -o output.pdf
```

### GET `/api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "message": "DualRender server is running"
}
```

## Requirements for HTML Templates

Your HTML email template **MUST be responsive** for this tool to work correctly:

- Use media queries (`@media` rules)
- Include `<style>` tags in the `<head>`
- Use responsive units (%, vw, max-width, etc.)
- Test on both desktop and mobile viewports

**Example responsive template structure:**

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      /* Desktop styles */
      .container {
        max-width: 600px;
        margin: 0 auto;
      }

      /* Mobile styles */
      @media (max-width: 600px) {
        .container {
          width: 100% !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Your email content -->
    </div>
  </body>
</html>
```

## Troubleshooting

### Issue: "File size exceeds 10MB limit"

**Solution:** Optimize your HTML file by compressing images or reducing inline content.

### Issue: "Server error occurred"

**Solution:** Check server logs in the terminal for detailed error messages.

### Issue: Chromium not installed

**Solution:** Run `npm run install-browser` to install Chromium.

### Issue: Port 3000 already in use

**Solution:** Change the port in `src/server/app.js`:

```javascript
const PORT = process.env.PORT || 3001; // Change to 3001 or any available port
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Opera (latest)

## License

MIT License - feel free to use in your projects!

## Credits

Built with:

- [Playwright](https://playwright.dev/) - Browser automation
- [pdf-lib](https://pdf-lib.js.org/) - PDF generation
- [Express](https://expressjs.com/) - Web server
- [Multer](https://github.com/expressjs/multer) - File upload handling

Design by Solstice Health







