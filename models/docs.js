const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DocsSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId, 
        ref: 'person',
        required: true,
    },
    path: {
        type: String,
        required: true 
    },
    comment: {
        type: String,
        required: true,
    }
}, {
  timestamps: true,
});


const Docs = mongoose.model('docs', DocsSchema);

module.exports = Docs;