/**
 * Public Page Controller - Admin Side
 * Handles all admin dashboard public page management
 */

const {
    InstitutePublicProfile,
    InstituteGalleryPhoto,
    InstituteReview,
    PublicEnquiry,
    Institute,
    Faculty,
    User,
    Subject,
    Class,
    Plan
} = require("../models");
const { Op } = require("sequelize");
const cloudinary = require("../config/cloudinary");

// ── Helper: extract Cloudinary public_id from a URL ─────────────
function extractPublicId(url) {
    if (!url || !url.includes("cloudinary.com")) return null;
    // e.g. https://res.cloudinary.com/CLOUD/image/upload/v123/folder/name.ext
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
    return match ? match[1] : null;
}

// ── Helper: delete a Cloudinary asset (silently ignores errors) ──
async function destroyCloudinary(url, resourceType = "image") {
    const publicId = extractPublicId(url);
    if (!publicId) return;
    try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); } catch (_) {}
}

// ── Slug generator ──────────────────────────────────────────────
function generateSlug(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s.-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 80);
}

// ── Get or create unique slug ────────────────────────────────────
async function getUniqueSlug(name, excludeId = null) {
    let slug = generateSlug(name);
    let suffix = 0;
    while (true) {
        const testSlug = suffix === 0 ? slug : `${slug}-${suffix}`;
        const where = { slug: testSlug };
        if (excludeId) where.id = { [Op.ne]: excludeId };
        const existing = await InstitutePublicProfile.findOne({ where });
        if (!existing) return testSlug;
        suffix++;
    }
}

// ── Check Subdomain Availability ───────────────────────────────
exports.checkSubdomainAvailability = async (req, res) => {
    try {
        const { subdomain } = req.query;
        if (!subdomain || !/^[a-z0-9-.]+$/.test(subdomain)) {
            return res.json({ success: true, data: { available: false, reason: 'Invalid format' } });
        }
        
        const RESERVED = ['www','app','api','admin','mail','support','help','blog', 'staging'];
        if (RESERVED.includes(subdomain.toLowerCase())) {
            return res.json({ success: true, data: { available: false, reason: 'Reserved' } });
        }

        const existing = await InstitutePublicProfile.findOne({ where: { slug: subdomain } });
        return res.json({ success: true, data: { available: !existing } });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/public-page  — Get current public page data
// ─────────────────────────────────────────────────────────────────
exports.getPublicPage = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;

        const profile = await InstitutePublicProfile.findOne({
            where: { institute_id: instituteId }
        });

        if (!profile) {
            return res.json({ success: true, data: null, message: "No public page created yet" });
        }

        const currentUser = await User.findByPk(req.user.id, { attributes: ['last_enquiry_seen_at'] });
        const lastEnquirySeenAt = currentUser?.last_enquiry_seen_at || new Date(0);

        const [gallery, reviews, newEnquiryCount, totalEnquiryCount] = await Promise.all([
            InstituteGalleryPhoto.findAll({
                where: { institute_id: instituteId },
                order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
            }),
            InstituteReview.findAll({
                where: { institute_id: instituteId },
                order: [['sort_order', 'ASC'], ['created_at', 'DESC']]
            }),
            PublicEnquiry.count({
                where: { institute_id: instituteId, created_at: { [Op.gt]: lastEnquirySeenAt } }
            }),
            PublicEnquiry.count({
                where: { institute_id: instituteId }
            })
        ]);

        const parseJson = (val, defaultVal) => {
            if (!val) return defaultVal;
            try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (e) { return val; }
        };

        const profileJson = profile.toJSON();
        profileJson.usp_points = parseJson(profileJson.usp_points, []);
        profileJson.enrollment_benefits = parseJson(profileJson.enrollment_benefits, []);
        profileJson.selected_faculty_ids = parseJson(profileJson.selected_faculty_ids, []);
        profileJson.selected_subject_ids = parseJson(profileJson.selected_subject_ids, []);
        profileJson.manual_courses = parseJson(profileJson.manual_courses, []);
        profileJson.manual_faculty = parseJson(profileJson.manual_faculty, []);
        profileJson.faculty_images = parseJson(profileJson.faculty_images, {});

        return res.json({
            success: true,
            data: {
                ...profileJson,
                gallery,
                reviews,
                new_enquiry_count: newEnquiryCount,
                total_enquiries: totalEnquiryCount
            }
        });
    } catch (error) {
        console.error("getPublicPage error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/public-page  — Create / update public page
// ─────────────────────────────────────────────────────────────────
exports.createOrUpdatePublicPage = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const institute = await Institute.findByPk(instituteId);
        if (!institute) return res.status(404).json({ success: false, message: "Institute not found" });

        const existing = await InstitutePublicProfile.findOne({ where: { institute_id: instituteId } });

        // Auto-generate slug from institute name if not provided
        let slug = req.body.slug || (existing && existing.slug);
        if (!slug) {
            slug = await getUniqueSlug(institute.name);
        } else {
            slug = generateSlug(slug);
        }

        const parseJson = (val, defaultVal) => {
            if (val === undefined || val === null || val === '') return defaultVal;
            try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (e) { return val; }
        };

        // Build manual_courses array — preserve existing if not sent
        let manualCourses = existing?.manual_courses || [];
        if (req.body.manual_courses !== undefined) {
            manualCourses = parseJson(req.body.manual_courses, []);
        }

        let manualFaculty = existing?.manual_faculty || [];
        if (req.body.manual_faculty !== undefined) {
            manualFaculty = parseJson(req.body.manual_faculty, []);
        }

        // Handle manual course image uploads (field names: manual_course_img_0, manual_course_img_1, ...)
        if (req.files) {
            Object.keys(req.files).forEach(fieldName => {
                const matchCourse = fieldName.match(/^manual_course_img_(\d+)$/);
                if (matchCourse) {
                    const idx = parseInt(matchCourse[1]);
                    const file = req.files[fieldName][0];
                    if (file && manualCourses[idx]) {
                        // file.path = full Cloudinary HTTPS URL
                        manualCourses[idx].image_url = file.path;
                    }
                }
                const matchFaculty = fieldName.match(/^manual_faculty_img_(\d+)$/);
                if (matchFaculty) {
                    const idx = parseInt(matchFaculty[1]);
                    const file = req.files[fieldName][0];
                    if (file && manualFaculty[idx]) {
                        manualFaculty[idx].image_url = file.path;
                    }
                }
            });
        }

        // Handle faculty_images updates
        let facultyImages = parseJson(existing?.faculty_images, {});
        if (req.body.faculty_images !== undefined) {
            const incoming = parseJson(req.body.faculty_images, {});
            facultyImages = { ...facultyImages, ...incoming };
        }
        // Handle faculty image file uploads (field: faculty_img_<id>)
        if (req.files) {
            Object.keys(req.files).forEach(fieldName => {
                const match = fieldName.match(/^faculty_img_(\d+)$/);
                if (match) {
                    const facultyId = match[1];
                    const file = req.files[fieldName][0];
                    if (file) {
                        // Delete old Cloudinary image for this faculty (async, non-blocking)
                        if (facultyImages[facultyId]) destroyCloudinary(facultyImages[facultyId]);
                        facultyImages[facultyId] = file.path; // Cloudinary URL
                    }
                }
            });
        }

        const profileData = {
            institute_id: instituteId,
            slug,
            tagline: req.body.tagline || existing?.tagline,
            description: req.body.description || existing?.description,
            about_text: req.body.about_text || existing?.about_text,
            established_year: req.body.established_year || existing?.established_year,
            affiliation: req.body.affiliation || existing?.affiliation,
            pass_rate: req.body.pass_rate || existing?.pass_rate,
            competitive_selections: req.body.competitive_selections || existing?.competitive_selections,
            years_of_excellence: req.body.years_of_excellence || existing?.years_of_excellence,
            total_students_display: req.body.total_students_display || existing?.total_students_display,
            whatsapp_number: req.body.whatsapp_number || existing?.whatsapp_number,
            map_embed_url: req.body.map_embed_url !== undefined ? req.body.map_embed_url : existing?.map_embed_url,
            working_hours: req.body.working_hours || existing?.working_hours,
            admission_status: req.body.admission_status || existing?.admission_status,
            enrollment_benefits: req.body.enrollment_benefits !== undefined ? parseJson(req.body.enrollment_benefits, []) : (existing?.enrollment_benefits || []),
            usp_points: req.body.usp_points !== undefined ? parseJson(req.body.usp_points, []) : (existing?.usp_points || []),
            social_facebook: req.body.social_facebook !== undefined ? req.body.social_facebook : existing?.social_facebook,
            social_instagram: req.body.social_instagram !== undefined ? req.body.social_instagram : existing?.social_instagram,
            social_youtube: req.body.social_youtube !== undefined ? req.body.social_youtube : existing?.social_youtube,
            theme_color: req.body.theme_color || existing?.theme_color || '0F2340',
            seo_title: req.body.seo_title || existing?.seo_title,
            seo_description: req.body.seo_description || existing?.seo_description,
            footer_description: req.body.footer_description || existing?.footer_description,
            contact_address: req.body.contact_address || existing?.contact_address,
            contact_phone: req.body.contact_phone || existing?.contact_phone,
            contact_email: req.body.contact_email || existing?.contact_email,
            selected_faculty_ids: req.body.selected_faculty_ids !== undefined ? parseJson(req.body.selected_faculty_ids, []) : (existing?.selected_faculty_ids || []),
            selected_subject_ids: req.body.selected_subject_ids !== undefined ? parseJson(req.body.selected_subject_ids, []) : (existing?.selected_subject_ids || []),
            // New Phase fields
            course_mode: req.body.course_mode || existing?.course_mode || 'auto',
            manual_courses: manualCourses,
            faculty_mode: req.body.faculty_mode || existing?.faculty_mode || 'auto',
            manual_faculty: manualFaculty,
            youtube_intro_url: req.body.youtube_intro_url !== undefined ? req.body.youtube_intro_url : existing?.youtube_intro_url,
            faculty_images: facultyImages,
        };

        // Handle logo/cover photo uploads — use Cloudinary permanent URL
        if (req.files) {
            if (req.files.logo) profileData.logo_url = req.files.logo[0].path;
            if (req.files.cover_photo) profileData.cover_photo_url = req.files.cover_photo[0].path;
        }

        let profile;
        if (existing) {
            await existing.update(profileData);
            profile = existing;
        } else {
            profile = await InstitutePublicProfile.create(profileData);
        }

        return res.json({ success: true, data: profile, message: "Public page saved successfully" });
    } catch (error) {
        console.error("createOrUpdatePublicPage error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/public-page/publish  — Publish page
// ─────────────────────────────────────────────────────────────────
exports.publishPage = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const profile = await InstitutePublicProfile.findOne({ where: { institute_id: instituteId } });
        if (!profile) return res.status(404).json({ success: false, message: "Public page not found. Please create one first." });

        await profile.update({ is_published: true });
        return res.json({ success: true, message: "Page published successfully", slug: profile.slug });
    } catch (error) {
        console.error("publishPage error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/public-page/unpublish  — Unpublish page
// ─────────────────────────────────────────────────────────────────
exports.unpublishPage = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const profile = await InstitutePublicProfile.findOne({ where: { institute_id: instituteId } });
        if (!profile) return res.status(404).json({ success: false, message: "Public page not found." });

        await profile.update({ is_published: false });
        return res.json({ success: true, message: "Page unpublished successfully" });
    } catch (error) {
        console.error("unpublishPage error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/public-page/gallery  — Upload gallery photo
// ─────────────────────────────────────────────────────────────────
exports.uploadGalleryPhoto = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;

        // Check max 10 photos
        const count = await InstituteGalleryPhoto.count({ where: { institute_id: instituteId } });
        if (count >= 10) {
            return res.status(400).json({ success: false, message: "Maximum 10 gallery photos allowed" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const photo = await InstituteGalleryPhoto.create({
            institute_id: instituteId,
            photo_url: req.file.path, // Cloudinary permanent URL
            label: req.body.label || null,
            sort_order: count
        });

        return res.json({ success: true, data: photo, message: "Gallery photo uploaded" });
    } catch (error) {
        console.error("uploadGalleryPhoto error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/public-page/gallery/:id  — Delete gallery photo
// ─────────────────────────────────────────────────────────────────
exports.deleteGalleryPhoto = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const photo = await InstituteGalleryPhoto.findOne({
            where: { id: req.params.id, institute_id: instituteId }
        });
        if (!photo) return res.status(404).json({ success: false, message: "Photo not found" });

        // Delete from Cloudinary (permanent CDN)
        destroyCloudinary(photo.photo_url);

        await photo.destroy();
        return res.json({ success: true, message: "Gallery photo deleted" });
    } catch (error) {
        console.error("deleteGalleryPhoto error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/public-page/faculty-image/:id  — Upload faculty photo
// ─────────────────────────────────────────────────────────────────
exports.uploadFacultyImage = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const facultyId = req.params.id;

        // Verify faculty belongs to this institute
        const faculty = await Faculty.findOne({
            where: { id: facultyId, institute_id: instituteId }
        });
        if (!faculty) return res.status(404).json({ success: false, message: "Faculty not found" });

        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const imageUrl = req.file.path; // Cloudinary permanent URL

        // Update or create profile faculty_images map
        let profile = await InstitutePublicProfile.findOne({ where: { institute_id: instituteId } });
        if (!profile) {
            return res.status(404).json({ success: false, message: "Public page not found. Please create your page first." });
        }

        const existingImages = profile.faculty_images || {};
        const updatedImages = { ...existingImages, [facultyId]: imageUrl };

        // Delete old Cloudinary image if exists
        if (existingImages[facultyId]) destroyCloudinary(existingImages[facultyId]);

        await profile.update({ faculty_images: updatedImages });

        return res.json({ success: true, data: { faculty_id: facultyId, image_url: imageUrl }, message: "Faculty image uploaded" });
    } catch (error) {
        console.error("uploadFacultyImage error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/public-page/faculty-image/:id  — Remove faculty photo
// ─────────────────────────────────────────────────────────────────
exports.deleteFacultyImage = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const facultyId = req.params.id;

        let profile = await InstitutePublicProfile.findOne({ where: { institute_id: instituteId } });
        if (!profile) return res.status(404).json({ success: false, message: "Public page not found" });

        const existingImages = profile.faculty_images || {};
        if (existingImages[facultyId]) {
            // Delete from Cloudinary (non-blocking)
            destroyCloudinary(existingImages[facultyId]);
            delete existingImages[facultyId];
            await profile.update({ faculty_images: existingImages });
        }

        return res.json({ success: true, message: "Faculty image removed" });
    } catch (error) {
        console.error("deleteFacultyImage error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/public-page/reviews  — Add review
// ─────────────────────────────────────────────────────────────────
exports.addReview = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;

        const count = await InstituteReview.count({ where: { institute_id: instituteId } });
        if (count >= 10) {
            return res.status(400).json({ success: false, message: "Maximum 10 reviews allowed" });
        }

        const { student_name, review_text, rating, achievement } = req.body;
        const review = await InstituteReview.create({
            institute_id: instituteId,
            student_name,
            review_text,
            rating: parseInt(rating) || 5,
            achievement: achievement || null,
            sort_order: count
        });

        return res.json({ success: true, data: review, message: "Review added" });
    } catch (error) {
        console.error("addReview error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// PUT /api/admin/public-page/reviews/:id  — Edit review
// ─────────────────────────────────────────────────────────────────
exports.updateReview = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const review = await InstituteReview.findOne({
            where: { id: req.params.id, institute_id: instituteId }
        });
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });

        const { student_name, review_text, rating, achievement, is_approved } = req.body;
        await review.update({
            student_name: student_name || review.student_name,
            review_text: review_text || review.review_text,
            rating: rating !== undefined ? parseInt(rating) : review.rating,
            achievement: achievement !== undefined ? achievement : review.achievement,
            is_approved: is_approved !== undefined ? is_approved : review.is_approved
        });

        return res.json({ success: true, data: review, message: "Review updated" });
    } catch (error) {
        console.error("updateReview error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/public-page/reviews/:id  — Delete review
// ─────────────────────────────────────────────────────────────────
exports.deleteReview = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const review = await InstituteReview.findOne({
            where: { id: req.params.id, institute_id: instituteId }
        });
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });
        await review.destroy();
        return res.json({ success: true, message: "Review deleted" });
    } catch (error) {
        console.error("deleteReview error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/public-page/faculty  — Get faculty list for wizard
// ─────────────────────────────────────────────────────────────────
exports.getFacultyList = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const facultyList = await Faculty.findAll({
            where: { institute_id: instituteId },
            include: [{ model: User, attributes: ['name', 'email', 'phone'] }],
            attributes: ['id', 'user_id', 'designation']
        });

        // Get faculty_images from the profile
        const profile = await InstitutePublicProfile.findOne({ where: { institute_id: instituteId } });
        const facultyImages = profile?.faculty_images || {};

        const data = facultyList.map(f => ({
            id: f.id,
            user_id: f.user_id,
            name: f.User?.name || 'Unknown',
            email: f.User?.email || '',
            phone: f.User?.phone || '',
            designation: f.designation || '',
            image_url: facultyImages[f.id] || null
        }));
        return res.json({ success: true, data });
    } catch (error) {
        console.error("getFacultyList error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/public-page/subjects  — Get subjects list for wizard
// ─────────────────────────────────────────────────────────────────
exports.getSubjectList = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const subjects = await Subject.findAll({
            where: { institute_id: instituteId },
            include: [{ model: Class, attributes: ['id', 'name'] }],
            attributes: ['id', 'name', 'class_id']
        });
        return res.json({ success: true, data: subjects });
    } catch (error) {
        console.error("getSubjectList error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/enquiries  — Get enquiries for this institute
// ─────────────────────────────────────────────────────────────────
exports.getEnquiries = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const { status, page = 1, limit = 20 } = req.query;

        const where = { institute_id: instituteId };
        if (status) where.status = status;

        const { count, rows } = await PublicEnquiry.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        return res.json({
            success: true,
            data: rows,
            total: count,
            pages: Math.ceil(count / parseInt(limit)),
            page: parseInt(page)
        });
    } catch (error) {
        console.error("getEnquiries error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// PUT /api/admin/enquiries/:id/status  — Update enquiry status
// ─────────────────────────────────────────────────────────────────
exports.updateEnquiryStatus = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const enquiry = await PublicEnquiry.findOne({
            where: { id: req.params.id, institute_id: instituteId }
        });
        if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

        const { status } = req.body;
        if (!['new', 'contacted', 'enrolled', 'closed'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        await enquiry.update({ status });
        return res.json({ success: true, data: enquiry, message: "Status updated" });
    } catch (error) {
        console.error("updateEnquiryStatus error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/public-page/check-feature  — Check plan feature
// ─────────────────────────────────────────────────────────────────
exports.checkPublicPageFeature = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const institute = await Institute.findByPk(instituteId, {
            include: [{ model: Plan }]
        });
        if (!institute) return res.status(404).json({ success: false, message: "Institute not found" });

        const hasFeature = institute.Plan?.feature_public_page || institute.current_feature_public_page || false;
        return res.json({ success: true, has_feature: hasFeature });
    } catch (error) {
        console.error("checkPublicPageFeature error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
