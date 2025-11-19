const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../database/config');

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userIdSegment = (req.user && req.user.id) ? String(req.user.id) : 'public';
    const dest = path.join(__dirname, '..', 'uploads', userIdSegment);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Upload single staff document
router.post('/staff/:employeeId/document', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const uploaderId = (req.user && req.user.id) ? String(req.user.id) : 'public';
    const filePath = `/uploads/${uploaderId}/${req.file.filename}`;

    // Save metadata to database
    await query('INSERT INTO staff_documents (employee_id, filename, path, uploaded_by) VALUES (?, ?, ?, ?)', [employeeId, req.file.originalname, filePath, req.user?.id || null]);

    res.status(201).json({ success: true, message: 'File uploaded', data: { filename: req.file.originalname, path: filePath } });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: 'Error uploading file' });
  }
});

// Upload invoice for booking
router.post('/bookings/:bookingId/invoice', authenticateToken, upload.single('invoice'), async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: 'No invoice uploaded' });

    const uploaderId = (req.user && req.user.id) ? String(req.user.id) : 'public';
    const filePath = `/uploads/${uploaderId}/${req.file.filename}`;

    await query('INSERT INTO invoices (booking_id, filename, path, uploaded_by) VALUES (?, ?, ?, ?)', [bookingId, req.file.originalname, filePath, req.user?.id || null]);

    res.status(201).json({ success: true, message: 'Invoice uploaded', data: { filename: req.file.originalname, path: filePath } });
  } catch (error) {
    console.error('Invoice upload error:', error);
    res.status(500).json({ success: false, message: 'Error uploading invoice' });
  }
});

// List staff documents for an employee
router.get('/staff/:employeeId/documents', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const docs = await query('SELECT id, employee_id, filename, path, uploaded_by, uploaded_at FROM staff_documents WHERE employee_id = ? ORDER BY uploaded_at DESC', [employeeId]);
    const list = docs.rows || docs[0] || [];
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, message: 'Error fetching documents' });
  }
});

// Delete a staff document by id
router.delete('/staff/documents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT path FROM staff_documents WHERE id = ?', [id]);
    const rec = rows.rows ? rows.rows[0] : rows[0];
    if (!rec) return res.status(404).json({ success: false, message: 'Document not found' });
    const filePath = path.join(__dirname, '..', rec.path);
    // Delete DB record first
    await query('DELETE FROM staff_documents WHERE id = ?', [id]);
    // Try to remove file from disk
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, message: 'Error deleting document' });
  }
});

module.exports = router;
