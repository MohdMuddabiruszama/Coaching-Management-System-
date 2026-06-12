async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const institute = await Institute.findByPk(id);
        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found' });
        }

        if (institute.status === 'suspended') {
            return res.status(409).json({
                success: false,
                message: 'Institute is already suspended'
            });
        }

        // Update institute status to suspended
        await institute.update({ status: 'suspended' });

        // Clear cache so it takes effect instantly
        const { clearInstituteCache } = require("../middlewares/auth.middleware");
        if (typeof clearInstituteCache === "function") clearInstituteCache(id);

        // Log the action
        console.log(`[SUSPEND] Institute: ${institute.name} (ID: ${id})`, {
            suspended_by: req.user.id,
            suspended_at: new Date().toISOString(),
            reason: reason || 'No reason provided'
        });

        res.status(200).json({
            success: true,
            message: `Institute '${institute.name}' suspended successfully.`,
            data: { id: institute.id, name: institute.name, status: 'suspended' }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async (req, res) => {
    const { id } = req.params;

    try {
        const institute = await Institute.findByPk(id);
        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found' });
        }

        if (institute.status !== 'suspended') {
            return res.status(409).json({
                success: false,
                message: 'Institute is not suspended'
            });
        }

        await institute.update({ status: 'active' });

        // Clear cache so it takes effect instantly
        const { clearInstituteCache } = require("../middlewares/auth.middleware");
        if (typeof clearInstituteCache === "function") clearInstituteCache(id);

        res.status(200).json({
            success: true,
            message: `Institute '${institute.name}' restored successfully.`,
            data: { id: institute.id, name: institute.name, status: 'active' }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}