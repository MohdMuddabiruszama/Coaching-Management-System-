/**
 * Public Site Routes
 * No authentication required — served publicly
 */

const express = require("express");
const router = express.Router();
const publicSiteController = require("../controllers/publicSite.controller");

// GET /api/public (Reads slug from hostname or query)
router.get("/", publicSiteController.getPublicPageData);

// GET /api/public/:slug (Backward compatibility)
router.get("/:slug", publicSiteController.getPublicPageData);

// POST /api/public/enquiry (Reads slug from body or hostname)
router.post("/enquiry", publicSiteController.submitEnquiry);

// POST /api/public/:slug/enquiry (Backward compatibility)
router.post("/:slug/enquiry", publicSiteController.submitEnquiry);

module.exports = router;
