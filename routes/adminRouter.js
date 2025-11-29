let User = require('../models/user');
let Ticket = require("../models/Ticket");
const transporter = require('../mailer');


let adminRouter=(app,emailUserName)=>{
    app.get('/getallemployees',(req,res)=>{
        User.find({ role : "employee"  }).select('-password -SecurityCode -_id')
        .then(collection=>{
            res.status(200).json(collection)
        })
    })
    app.get('/getallmanagers',(req,res)=>{
        User.find({ role : "manager"  }).select('-password -SecurityCode -_id')
        .then(collection=>{
            res.status(200).json(collection)
        })
    })
    app.post('/upgrade/:id/manager', async (req, res) => {
        try {
            const userId = req.params.id;

            // Find the user by their custom 'id' field
            const user = await User.findOne({ id: userId });
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            // Check for active tickets where the user is either the employee or the chef
            const incompleteTicketsCount = await Ticket.countDocuments({
                $or: [
                    { emp_id: userId },
                    { chef_id: userId }
                ],
                status: { $in: ['In Progress'] }
            });

            if (incompleteTicketsCount > 0) {
                return res.status(400).json({
                    message: `Upgrade failed: User still has ${incompleteTicketsCount} active tickets to finish.`
                });
            }

            // If no incomplete tickets, update the role
            user.role = 'manager';
            await user.save();

            res.status(200).json({
                message: `User ${user.firstName} ${user.lastName} successfully upgraded to manager.`,
                user: user
            });

        } catch (error) {
            console.error("Error upgrading user to manager:", error);
            res.status(500).json({ message: "Server error during upgrade process." });
        }
    });

    app.get('/pendingusers', async (req, res) => {
        try {
            const pendingUsers = await User.find({ isAccepted: false }).select('-password -SecurityCode -_id'); // Exclude sensitive fields

            res.status(200).json(pendingUsers);
        } catch (error) {
            console.error("Error fetching pending users:", error);
            res.status(500).json({ message: "Server error fetching pending users." });
        }
    });

    app.post('/acceptuser/:id', async (req, res) => {
        try {
            const userId = req.params.id;

            // Use findOneAndUpdate on the custom 'id' field
            const acceptedUser = await User.findOneAndUpdate(
                { id: userId },
                { isAccepted: true },
                { new: true, select: '-password -SecurityCode -_id' }
            );

            if (!acceptedUser) {
                return res.status(404).json({ message: "User not found or already accepted." });
            }

            // --- Step 1: Send Deletion Email ---
            const mailOptions = {
                from: emailUserName,
                to: acceptedUser.email,
                subject: 'Account Acceptance Notification',
                html: `
                    <p>Dear ${acceptedUser.firstName} ${acceptedUser.lastName},</p>
                    <p>We are writing to confirm that your account has been successfully accepted .</p>
                    <br>
                    <p>Sincerely,</p>
                    <p>The internalHelpDesk Team</p>
                `,
            };

            // Attempt to send email
            await transporter.sendMail(mailOptions);
            console.log(`acceptance email sent successfully to ${acceptedUser.email}`);

            res.status(200).json({
                message: `User ${acceptedUser.firstName} ${acceptedUser.lastName} has been accepted.`,
                user: acceptedUser
            });
        } catch (error) {
            console.error("Error accepting user:", error);
            res.status(500).json({ message: "Server error accepting user." });
        }
    });

    app.delete('/:id', async (req, res) => {
        try {
            const userId = req.params.id;

            const userToDelete = await User.findOne({ id: userId });

            if (!userToDelete) {
                return res.status(404).json({ message: "User not found." });
            }

            // --- Step 1: Send Deletion Email ---
            const mailOptions = {
                from: emailUserName,
                to: userToDelete.email,
                subject: 'Account Deletion Notification',
                html: `
                    <p>Dear ${userToDelete.firstName} ${userToDelete.lastName},</p>
                    <p>We are writing to confirm that your account with the ID <strong>${userId}</strong> has been successfully deleted from our system.</p>
                    <p>If you did not request this action, please contact support immediately.</p>
                    <br>
                    <p>Sincerely,</p>
                    <p>The System Team</p>
                `,
            };

            // Attempt to send email
            await transporter.sendMail(mailOptions);
            console.log(`Deletion email sent successfully to ${userToDelete.email}`);


            // --- Step 2: Delete User from Database ---
            await User.deleteOne({ id: userId });

            res.status(200).json({
                message: `User ${userToDelete.firstName} ${userToDelete.lastName} deleted and notification email sent.`,
            });

        } catch (error) {
            // Handle both database and email sending errors
            console.error("Error deleting user or sending email:", error);
            // Note: The user may be deleted even if email fails, or vice versa.
            // For production, you might want rollback/retry logic.
            res.status(500).json({ message: "Server error: Failed to delete user or send notification email." });
        }
    });
}


module.exports = adminRouter;