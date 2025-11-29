const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

// Configure multer-s3 for center logo uploads
const uploadLogoToS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET || 'tutor-app-logo-store',
    // ACL disabled on bucket - removed acl: 'public-read'
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      // Generate unique filename with center ID
      const centerId = req.params.id || 'unknown';
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `center-${centerId}-logo-${timestamp}${ext}`;
      cb(null, filename);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'));
    }
  }
});

// Export S3 instance and upload middleware
module.exports = {
  s3,
  uploadLogoToS3
};
