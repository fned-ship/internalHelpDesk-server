let User = require('../models/user');
let Ticket = require("../models/Ticket");
const transporter = require('../mailer');
const Chat = require("../models/chat");


let ticketRouter=(app,emailUserName)=>{
    app.get('/getalltickets', async (req, res) => {
        try {
            const tickets = await Ticket.find();
            return res.status(200).json({ body: tickets });
        } catch (err) {
            return res.status(500).json({ message: "Server error", error: err });
        }
    });


    app.delete('/deleteticket/:id', async (req, res) => {
        try {
            const deleted = await Ticket.findOneAndDelete({ id: req.params.id });

            if (!deleted)
                return res.status(404).json({ message: "Ticket not found" });

            return res.status(200).json({ message: "Ticket deleted successfully" });

        } catch (err) {
            return res.status(500).json({ message: "Server error", error: err });
        }
    });


    app.put('/updateticket/:id', async (req, res) => {
        try {
            const description = typeof req.body === "string" ? req.body : req.body.description;

            const updated = await Ticket.findOneAndUpdate(
                { id: req.params.id },
                { description },
                { new: true }
            );

            if (!updated)
                return res.status(404).json({ message: "Ticket not found" });

            return res.status(200).json({ message: "Updated successfully", data: updated });

        } catch (err) {
            return res.status(500).json({ message: "Server error", error: err });
        }
    });



    app.post('/createticket', async (req, res) => {
        try {
            const {emp_id, chef_id, status, priority, deadline, chatID, description } = req.body;


            if (!emp_id || !chef_id || !status || !priority || !deadline || !description) {
                return res.status(400).json({ message: "All fields are required" });
            }

            const chat = await Chat.create({ id:`${Date.now()}_${Math.random()}`, chef_id , emp_id, messages: [] });
            const id=`${Date.now()}_${Math.random()}`;


            const newTicket = new Ticket({
                id,
                emp_id,
                chef_id,
                status,
                priority,
                rating: 0,
                deadline: new Date(deadline),
                chatID:chat.id,
                description
            });

            await newTicket.save();


            try {
                const emp = await User.findOne({ id: emp_id });
                if (emp && emp.email) {
                    await transporter.sendMail({
                        from: emailUserName,
                        to: emp.email,
                        subject: `New Ticket Assigned - ${priority} Priority`,
                        html: `
                            <h2>New Ticket Assigned</h2>
                            <p><strong>Ticket ID:</strong> ${id}</p>
                            <p><strong>Priority:</strong> ${priority}</p>
                            <p><strong>Deadline:</strong> ${new Date(deadline).toLocaleDateString()}</p>
                            <p><strong>Description:</strong> ${description}</p>
                        `
                    });
                }
            } catch (emailErr) {
                console.log("Email notification failed:", emailErr);
            }

            return res.status(201).json({ 
                message: "Ticket created successfully", 
                data: newTicket 
            });

        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({ message: "Ticket ID or Chat ID already exists" });
            }
            return res.status(500).json({ message: "Server error", error: err });
        }
    });


    app.patch('/updateticketstatus/:id', async (req, res) => {
        try {
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({ message: "Status is required" });
            }

            const validStatuses = ['In Progress', 'Closed', 'Pending'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ 
                    message: "Invalid status. Must be one of: In Progress, Closed, Pending" 
                });
            }

            const updated = await Ticket.findOneAndUpdate(
                { id: req.params.id },
                { status },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({ message: "Ticket not found" });
            }

            return res.status(200).json({ 
                message: "Status updated successfully", 
                data: updated 
            });

        } catch (err) {
            return res.status(500).json({ message: "Server error", error: err });
        }
    });


    app.patch('/rateticket/:id', async (req, res) => {
        try {
            const { rating, closeTicket } = req.body;

            if (rating === undefined || rating === null) {
                return res.status(400).json({ message: "Rating is required" });
            }

            if (rating < 0 || rating > 5) {
                return res.status(400).json({ message: "Rating must be between 0 and 5" });
            }

            const ticket = await Ticket.findOne({ id: req.params.id });

            if (!ticket) {
                return res.status(404).json({ message: "Ticket not found" });
            }


            if (closeTicket) {
                await ticket.Finish(rating);
            } else {
                ticket.rating = rating;
                await ticket.save();
            }

            return res.status(200).json({ 
                message: "Ticket rated successfully", 
                data: ticket 
            });

        } catch (err) {
            return res.status(500).json({ message: "Server error", error: err });
        }
    });



    

    app.get('/tickets/user/:userId', async (req, res) => {
        const { userId } = req.params;

        try {

        const user = await User.findOne({ id: userId });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let tickets;


        if (user.role === 'manager' || user.role === 'chef') {
            tickets = await Ticket.find({ chef_id: userId }).sort({ createdAt: -1 });
        } else {

            tickets = await Ticket.find({ emp_id: userId }).sort({ createdAt: -1 });
        }

        return res.status(200).json(tickets);
        } catch (error) {
        return res.status(500).json({ message: 'Server Error', error: error.message });
        }
    });

    app.get('/ticket/:ticketId', async (req, res) => {
        const { ticketId } = req.params;

        try {
        const ticket = await Ticket.findOne({ id: ticketId });

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        return res.status(200).json(ticket);
        } catch (error) {
        return res.status(500).json({ message: 'Server Error', error: error.message });
        }
    });

    app.get('/ticket/last/:userId', async (req, res) => {
        const { userId } = req.params;

        try {

        const user = await User.findOne({ id: userId });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let lastTicket;


        if (user.role === 'manager' || user.role === 'chef') {
            lastTicket = await Ticket.findOne({ chef_id: userId })
            .sort({ createdAt: -1 })
            .limit(1);
        } else {

            lastTicket = await Ticket.findOne({ emp_id: userId })
            .sort({ createdAt: -1 })
            .limit(1);
        }

        if (!lastTicket) {
            return res.status(404).json({ message: 'No tickets found' });
        }

        return res.status(200).json(lastTicket);
        } catch (error) {
        return res.status(500).json({ message: 'Server Error', error: error.message });
        }
    });


}


module.exports = ticketRouter;