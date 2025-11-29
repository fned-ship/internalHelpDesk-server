const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    emp_id: {
        type: String,
        required: true 
    },
    chef_id: {
        type: String,
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