const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const User = require('../models/user.js');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/imagesProfile');
    if (!fs.existsSync(uploadPath)) {   
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);   
  },
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}_${Math.random()}_${file.originalname}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage });

const updateUserProfileRoute = (app) => {
  app.put('/user/profile/:userId', upload.single('image'), async (req, res) => {
    const { userId } = req.params;
    let data;

    try {
      data = JSON.parse(req.body.data);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid JSON in data' });
    }

    const file = req.file;
    let newImagePath;

    try {

      const user = await User.findOne({ id: userId });

      if (!user) {

        if (file) {
          const fullPath = path.join(__dirname, '../public/imagesProfile', file.filename);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
        return res.status(404).json({ message: 'User not found' });
      }


      if (data.password && data.newPassword) {
        const isPasswordValid = await bcrypt.compare(data.password, user.password);
        
        if (!isPasswordValid) {

          if (file) {
            const fullPath = path.join(__dirname, '../public/imagesProfile', file.filename);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          }
          return res.status(401).json({ message: 'Current password is incorrect' });
        }


        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(data.newPassword, salt);
      }


      if (data.firstName) user.firstName = data.firstName;
      if (data.lastName) user.lastName = data.lastName;
      if (data.number) user.number = data.number;
      if (data.birthDay) user.birthDay = data.birthDay;
      if (data.job) user.job = data.job;
      if (data.address) user.address = data.address;


      if (file) {
        newImagePath = file.filename;
        

        if (user.imageSrc) {
          const oldImagePath = path.join(__dirname, '../public/imagesProfile', user.imageSrc);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        
        user.imageSrc = newImagePath;
      }


      await user.save();


      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.SecurityCode;

      return res.status(200).json({ message: 'Profile updated successfully', user: userResponse });
    } catch (error) {

      if (file && newImagePath) {
        const fullPath = path.join(__dirname, '../public/imagesProfile', newImagePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      return res.status(500).json({ message: 'Server Error', error: error.message });
    }
  });
};

module.exports = updateUserProfileRoute;