/**
 * Uploads & Image Persistence Module
 * Decodes base64 images to physical files in /uploads
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function saveBase64Image(dataUrl, prefix = 'img') {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  // If it's already an upload URL (e.g., '/uploads/xxx.png'), return it
  if (dataUrl.startsWith('/uploads/')) return dataUrl;

  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches) return null;

  let ext = matches[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  const base64Data = matches[2];

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > MAX_PAYLOAD_BYTES) {
    throw new Error('Image exceeds 5MB limit');
  }

  const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`;
}

function deleteUploadedFile(receiptUrl) {
  if (!receiptUrl || !receiptUrl.startsWith('/uploads/')) return;
  const filename = path.basename(receiptUrl);
  const filePath = path.join(UPLOADS_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Error deleting file:', err);
  }
}

module.exports = {
  UPLOADS_DIR,
  saveBase64Image,
  deleteUploadedFile
};
