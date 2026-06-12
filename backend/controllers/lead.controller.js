const { Lead } = require('../models');

exports.submitLead = async (req, res) => {
    try {
        const { name, phone, email, institute, studentCount, plan, message, type } = req.body;
        
        const newLead = await Lead.create({
            name,
            phone,
            email,
            institute: institute || 'N/A',
            studentCount,
            plan,
            message,
            source: type || 'contact_form',
            status: 'new'
        });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully. We will contact you soon.',
            lead: newLead
        });
    } catch (error) {
        console.error("Lead submission error:", error);
        res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
    }
};

exports.trackPageView = async (req, res) => {
    try {
        const { LandingPageView } = require('../models');
        await LandingPageView.create({
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.headers['user-agent'],
            page_url: req.body.url || '/'
        });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Page view tracking error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getLeads = async (req, res) => {
    try {
        const leads = await Lead.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        res.status(200).json({
            success: true,
            leads: leads.map(l => ({
                id: l.id,
                name: l.name,
                mobile: l.phone,
                email: l.email,
                institute: l.institute,
                students: l.studentCount,
                plan: l.plan,
                message: l.message,
                source: l.source,
                date: l.createdAt,
                status: l.status
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch leads', error: error.message });
    }
};

exports.updateLeadStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const lead = await Lead.findByPk(id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        lead.status = status;
        await lead.save();

        res.status(200).json({
            success: true,
            message: 'Lead status updated successfully',
            lead
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update lead status', error: error.message });
    }
};

exports.clearUnreadLeads = async (req, res) => {
    try {
        await Lead.update({ is_read: true }, { where: { is_read: false } });
        res.status(200).json({ success: true, message: 'Cleared unread enquiries count' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to clear unread count', error: error.message });
    }
};
