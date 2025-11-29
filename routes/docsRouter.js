let User = require('../models/user');
const bcrypt = require('bcrypt');
let Docs=require("../models/docs");
const path = require('path');
const fs = require('fs');
const multer = require('multer');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../public/documents');
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {

    const allowedTypes = /pdf|doc|docx|xls|xlsx|txt|png|jpg|jpeg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents and images are allowed.'));
    }
  }
});

let docsRouter=(router)=>{

    router.get('/documents/', async (req, res) => {
    try {
        const documents = await Docs.find()
        .populate('userId', 'firstName lastName email job')
        .sort({ createdAt: -1 });


        const documentsWithMetadata = documents.map(doc => {
            const filePath = path.join(__dirname, '../public/documents', doc.path);
            let fileSize = 0;
            let uploadDate = doc.createdAt;

            try {
                const stats = fs.statSync(filePath);
                fileSize = stats.size;
                uploadDate = stats.birthtime;
            } catch (err) {
                console.log('File not found:', filePath);
            }

            const ext = path.extname(doc.fileName).substring(1).toUpperCase();

            return {
                _id: doc._id,
                fileName: doc.fileName,
                userId: doc.userId,
                path: doc.path,
                comment: doc.comment,
                fileSize: fileSize,
                uploadDate: uploadDate || doc.createdAt,
                fileType: ext
            };
        });

        res.json(documentsWithMetadata);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
    });


    router.get('/documents/:id', async (req, res) => {
    try {
        const document = await Docs.findById(req.params.id)
        .populate('userId', 'name email role');

        if (!document) {
        return res.status(404).json({ message: 'Document not found' });
        }

        const filePath = path.join(__dirname, '../public/documents', document.path);
        let fileSize = 0;
        let uploadDate = document.createdAt;

        try {
        const stats = fs.statSync(filePath);
        fileSize = stats.size;
        uploadDate = stats.birthtime;
        } catch (err) {
        console.log('File not found:', filePath);
        }

        const ext = path.extname(document.fileName).substring(1).toUpperCase();

        res.json({
        _id: document._id,
        fileName: document.fileName,
        userId: document.userId,
        path: document.path,
        comment: document.comment,
        fileSize: fileSize,
        uploadDate: uploadDate || document.createdAt,
        fileType: ext
        });
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
    });


    router.post('/documents/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
        }

        const { comment , userId } = req.body;
        console.log(userId);

        if (!comment || comment.trim() === '') {

            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Comment is required' });
        }

        const newDoc = new Docs({
        fileName: req.file.originalname,
        userId,
        path: req.file.filename.replace(/\\/g, '/'),
        comment: comment.trim()
        });

        await newDoc.save();

        const populatedDoc = await Docs.findById(newDoc._id)
        .populate('userId', 'name email role');

        res.status(201).json({
        message: 'Document uploaded successfully',
        document: populatedDoc
        });
    } catch (error) {

        if (req.file) {
        fs.unlinkSync(req.file.path);
        }
        console.error('Error uploading document:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
    });


    router.get('/documents/download/:id', async (req, res) => {
    try {
        const document = await Docs.findById(req.params.id);

        if (!document) {
        return res.status(404).json({ message: 'Document not found' });
        }

        const filePath = path.join(__dirname, '../public/documents', document.path);


        if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found on server' });
        }


        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');


        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
    });


    router.delete('/documents/:id', async (req, res) => {
    try {
        const document = await Docs.findById(req.params.id);
        const {role,userId}=req.body

        if (!document) {
        return res.status(404).json({ message: 'Document not found' });
        }


        const userRole = role;
        const isAdmin = userRole === 'admin';
        const isOwner = document.userId.toString() ===userId;

        console.log(userRole,"-",req.userId);

        if (!isAdmin && !isOwner) {
        return res.status(403).json({ 
            message: 'You do not have permission to delete this document' 
        });
        }


        const filePath = path.join(__dirname, '../public/documents', document.path);
        console.log("file : ",filePath);
        if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        }


        await Docs.findByIdAndDelete(req.params.id);

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
    });


    router.get('/documents/search/:query', async (req, res) => {
    try {
        const searchQuery = req.params.query;
        
        const documents = await Docs.find({
        $or: [
            { fileName: { $regex: searchQuery, $options: 'i' } },
            { comment: { $regex: searchQuery, $options: 'i' } }
        ]
        })
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 });

        res.json(documents);
    } catch (error) {
        console.error('Error searching documents:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
    });
}
module.exports=docsRouter