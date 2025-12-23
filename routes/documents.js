const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { EmployeeDocument, Employee } = require('../models');
const staffAuth = require('../middleware/staffAuth');
const adminAuth = require('../middleware/adminAuth');

// Configure multer for document uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/documents'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Get all documents (Admin)
router.get('/', adminAuth, async (req, res, next) => {
    try {
        const { employee_id, status, type } = req.query;
        const where = {};
        if (employee_id) where.employee_id = employee_id;
        if (status) where.status = status;
        if (type) where.type = type;

        const documents = await EmployeeDocument.findAll({
            where,
            include: [{ model: Employee, as: 'employee' }],
            order: [['created_at', 'DESC']]
        });
        res.json({ documents });
    } catch (err) {
        next(err);
    }
});

// Get single document
router.get('/:id', adminAuth, async (req, res, next) => {
    try {
        const document = await EmployeeDocument.findByPk(req.params.id, {
            include: [{ model: Employee, as: 'employee' }]
        });
        if (!document) return res.status(404).json({ error: 'Document not found' });
        res.json({ document });
    } catch (err) {
        next(err);
    }
});

// Upload document (Staff/Admin)
router.post('/', staffAuth, upload.single('document'), async (req, res, next) => {
    try {
        const { type } = req.body;
        const employee_id = req.user.role === 'admin' || req.user.role === 'superadmin' 
            ? (req.body.employee_id || req.user.id) 
            : req.user.id;

        if (!type || !req.file) {
            return res.status(400).json({ error: 'Document type and file are required' });
        }

        const document = await EmployeeDocument.create({
            employee_id,
            type,
            document_path: `/uploads/documents/${req.file.filename}`,
            status: 'pending'
        });

        const created = await EmployeeDocument.findByPk(document.id, {
            include: [{ model: Employee, as: 'employee' }]
        });

        res.status(201).json({ document: created });
    } catch (err) {
        next(err);
    }
});

// Update document status (Admin)
router.put('/:id/verify', adminAuth, async (req, res, next) => {
    try {
        const { status } = req.body;
        const document = await EmployeeDocument.findByPk(req.params.id);
        if (!document) return res.status(404).json({ error: 'Document not found' });

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await document.update({ status });
        const updated = await EmployeeDocument.findByPk(document.id, {
            include: [{ model: Employee, as: 'employee' }]
        });

        res.json({ document: updated });
    } catch (err) {
        next(err);
    }
});

// Get own documents (Staff)
router.get('/me/list', staffAuth, async (req, res, next) => {
    try {
        const documents = await EmployeeDocument.findAll({
            where: { employee_id: req.user.id },
            order: [['created_at', 'DESC']]
        });
        res.json({ documents });
    } catch (err) {
        next(err);
    }
});

// Delete document (Admin)
router.delete('/:id', adminAuth, async (req, res, next) => {
    try {
        const document = await EmployeeDocument.findByPk(req.params.id);
        if (!document) return res.status(404).json({ error: 'Document not found' });
        await document.destroy();
        res.json({ message: 'Document deleted' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

