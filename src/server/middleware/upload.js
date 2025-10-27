const multer = require("multer");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/html" ||
      /\.(html|htm)$/i.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only HTML files are allowed!"), false);
    }
  },
});

module.exports = {
  upload,
  MAX_FILE_SIZE,
};
