const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Chat = require('../models/chatbot');
const User = require('../models/user');
const dotenv = require('dotenv');

dotenv.config();

// Server URL for file access (e.g., http://localhost:3000)
const serverURL = process.env.serverURL;

let ChatBot = (app, GEMINI_API_KEY) => {

  // Configure Multer for local storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../public/chatBotFiles');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const fileName = `${Date.now()}__${file.originalname.replace(/ /g, "-")}`;
      cb(null, fileName);
    }
  });

  const upload = multer({ storage });
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Convert file buffer to Gemini input part
  function fileToGenerativePart(filePath, mimeType) {
    const fileBuffer = fs.readFileSync(filePath);
    return {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    };
  } 

  // Fetch chat history
  app.post('/chatHistory', (req, res) => {
    const { userID } = req.body;
    Chat.findOne({ userID })
      .then(collection => {
        if (collection) {
          res.status(200).json(collection.messages);
        } else {
          res.status(200).json([]);
        }
      })
      .catch(err => res.status(400).json("ERROR: " + err));
  });

  // Chatbot endpoint
  app.post('/chatbot', upload.array('files'), async (req, res) => {
    const { message, userID } = req.body;
    const files = req.files;

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    let imageParts = [];
    let imageFilePaths = [];
    let otherFilePaths = [];

    // Handle uploaded files
    if (files && files.length > 0) {
      imageParts = files.map(file => {
        const fileUrl = `${serverURL}/chatBotFiles/${file.filename}`;
        const filePath = path.join(__dirname, '../public/chatBotFiles', file.filename);

        // Separate file URLs by type
        if (file.mimetype.startsWith('image/')) {
          imageFilePaths.push(fileUrl);
        } else {
          otherFilePaths.push(fileUrl);
        }

        // Convert file to generative input for Gemini
        return fileToGenerativePart(filePath, file.mimetype);
      });
    }

    try {
      let chat = await Chat.findOne({ userID });
      const user = await User.findById(userID).lean();
      if (!user) {
        return res.status(500).json({ error: 'User not found' });
      }

      // Limit daily messages
      if (chat) {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const todaysMessageCount = chat.messages.filter(msg => {
          const createdAt = new Date(msg.createdAt);
          return createdAt >= startOfDay && createdAt < endOfDay;
        }).length;

        if (todaysMessageCount > 40) {
          return res.status(404).json({ error: 'Reached the daily message limit.' });
        }
      }

      // Send message + files to Gemini
      const result = await model.generateContent([message, ...imageParts]);
      const response = result.response;
      const text = response.text();

      // Prepare chat entries
      const newMessage = {
        role: 'user',
        text: message,
        imagesFile: imageFilePaths,
        otherFiles: otherFilePaths
      };

      const newResponse = {
        role: 'bot',
        text: text,
        imagesFile: [],
        otherFiles: []
      };

      if (!chat) {
        chat = new Chat({ userID, messages: [newMessage, newResponse] });
      } else {
        chat.messages.push(newMessage, newResponse);
      }

      await chat.save();
      res.json({ response: text });

    } catch (error) {
      console.error('Error communicating with Gemini:', error);
      res.status(500).json({ error: 'Sorry, something went wrong.' });
    }
  });
};

module.exports = ChatBot;
