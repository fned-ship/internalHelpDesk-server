const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TicketSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    emp: {
        type: Schema.Types.ObjectId, 
        ref: 'person',
        required: true 
    },
    chef: {
        type: Schema.Types.ObjectId, 
        ref: 'person',
        required: true 
    },
    status: {
        type: String,
        required: true,
        enum: [ 'In Progress', 'Closed', 'Pending'] 
    },
    priority: {
        type: String,
        required: true,
        enum: ['Low', 'Medium', 'High', 'Urgent'] 
    },
    rating: {
        type: Number,
        required: true,
        min: 0,
        max: 5
    },
    deadline: {
        type: Date,
        required: true
    },
    chatID: {
        type: String,
        required: true, 
        unique: true
    },
    description: {
        type: String,
        required: true, 
    }
});

TicketSchema.methods.Finish = function(rate) {
    this.status = 'Closed';
    this.rating = rate; 
    return this.save();
};

const Ticket = mongoose.model('Ticket', TicketSchema);

module.exports = Ticket;