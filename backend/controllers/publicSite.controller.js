/**
 * Public Site Controller
 * Handles public-facing routes (no authentication required)
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
    Class
} = require("../models");
const { Op } = require("sequelize");
const { extractSubdomain } = require("../utils/subdomain");

// Simple in-memory rate limiter (per IP per institute per hour)
const enquiryRateLimit = new Map();

function checkRateLimit(ip, instituteId) {
    const key = `${ip}_${instituteId}`;
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxRequests = 3;

    if (!enquiryRateLimit.has(key)) {
        enquiryRateLimit.set(key, []);
    }

    const requests = enquiryRateLimit.get(key).filter(t => now - t < windowMs);
    enquiryRateLimit.set(key, requests);

    if (requests.length >= maxRequests) return false;

    requests.push(now);
    enquiryRateLimit.set(key, requests);
    return true;
}

// ── Convert any Google Maps URL to embed URL ─────────────────────
function normalizeMapUrl(url) {
    if (!url || !url.trim()) return null;
    url = url.trim();

    // Already an embed URL? Return as-is
    if (url.includes('/maps/embed')) return url;

    // Handle google.com/maps/place/ share links
    // e.g. https://www.google.com/maps/place/Some+Place/@lat,lng,...
    if (url.includes('google.com/maps')) {
        // Try to extract place or coordinates and build embed URL
        // Check for @lat,lng format
        const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) {
            const lat = coordMatch[1];
            const lng = coordMatch[2];
            return `https://maps.google.com/maps?q=${lat},${lng}&output=embed`;
        }

        // Check for /place/ format 
        const placeMatch = url.match(/\/place\/([^/@]+)/);
        if (placeMatch) {
            const placeName = placeMatch[1];
            return `https://maps.google.com/maps?q=${encodeURIComponent(placeName.replace(/\+/g, ' '))}&output=embed`;
        }

        // Wrap generic google maps URL into embed
        return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
    }

    // Try to use URL directly as embed (user may have given a partial/shortened link)
    return url;
}

// ─────────────────────────────────────────────────────────────────
// GET /api/public/:slug  — Get complete public page data
// ─────────────────────────────────────────────────────────────────
exports.getPublicPageData = async (req, res) => {
    try {
        let slug = req.query.subdomain || extractSubdomain(req.hostname) || req.params.slug;

        if (!slug) {
            return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'No subdomain or slug provided' });
        }

        const profile = await InstitutePublicProfile.findOne({
            where: { 
                [Op.or]: [
                    { slug: slug },
                    { slug: slug.replace(/\./g, '-') },
                    { slug: slug.replace(/-/g, '.') }
                ],
                is_published: true 
            },
            include: [{ model: Institute, attributes: ['id', 'name', 'email', 'phone', 'address', 'logo'] }]
        });

        if (!profile) {
            return res.status(404).json({ success: false, error: 'NOT_FOUND', message: "Institute page not found or not published" });
        }

        const instituteId = profile.institute_id;

        // Increment view count (non-blocking)
        profile.increment('page_views').catch(() => {});

        // Fetch all related data in parallel
        const [gallery, reviews, facultyList, subjectList] = await Promise.all([
            InstituteGalleryPhoto.findAll({
                where: { institute_id: instituteId },
                order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
            }),
            InstituteReview.findAll({
                where: { institute_id: instituteId, is_approved: true },
                order: [['sort_order', 'ASC'], ['created_at', 'DESC']]
            }),
            Faculty.findAll({
                where: { institute_id: instituteId },
                include: [{ model: User, attributes: ['name', 'email'] }],
                attributes: ['id', 'user_id', 'designation']
            }),
            Subject.findAll({
                where: { institute_id: instituteId },
                include: [{ model: Class, attributes: ['name'] }],
                attributes: ['id', 'name', 'class_id']
            })
        ]);

        const parseJson = (val, defaultVal) => {
            if (!val) return defaultVal;
            try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (e) { return val; }
        };

        // Filter faculty/subjects to selected ones only
        const selectedFacultyIds = parseJson(profile.selected_faculty_ids, []);
        const selectedSubjectIds = parseJson(profile.selected_subject_ids, []);
        const facultyImages = parseJson(profile.faculty_images, {});
        const courseMode = profile.course_mode || 'auto';
        const manualCourses = parseJson(profile.manual_courses, []);

        const facultyMode = profile.faculty_mode || 'auto';
        const manualFaculty = parseJson(profile.manual_faculty, []);

        const visibleFaculty = selectedFacultyIds.length > 0
            ? facultyList.filter(f => selectedFacultyIds.includes(f.id))
            : facultyList;

        const visibleSubjects = selectedSubjectIds.length > 0
            ? subjectList.filter(s => selectedSubjectIds.includes(s.id))
            : subjectList;

        let facultyToShow;
        if (facultyMode === 'manual' && manualFaculty && manualFaculty.length > 0) {
            facultyToShow = manualFaculty.filter(f => f.name).map(f => ({
                id: f.id,
                name: f.name,
                email: f.email,
                designation: f.designation,
                subject: null,
                image_url: f.image_url
            }));
        } else {
            facultyToShow = visibleFaculty.map(f => ({
                id: f.id,
                name: f.User?.name || 'Faculty',
                email: f.User?.email,
                designation: f.designation || null,
                subject: subjectList.filter(s => s.faculty_id === f.user_id).map(s => s.name).join(', '),
                image_url: facultyImages[String(f.id)] || null
            }));
        }

        // Determine courses to show
        let coursesToShow;
        if (courseMode === 'manual' && manualCourses && manualCourses.length > 0) {
            coursesToShow = manualCourses.filter(c => c.name); // Only show courses with a name
        } else {
            // Auto mode: use DB subjects
            coursesToShow = visibleSubjects.map(s => ({
                id: s.id,
                name: s.name,
                class_name: s.Class?.name,
                image_url: null,
                description: null,
                duration_months: null,
                max_students: null,
                hours_per_day: null,
                badge: null
            }));
        }

        // Build the YouTube embed URL if provided
        const youtubeEmbedUrl = buildYouTubeEmbedUrl(profile.youtube_intro_url);

        const responseData = {
            institute_id: instituteId,
            name: profile.Institute?.name || '',
            slug: profile.slug,
            is_published: profile.is_published,
            tagline: profile.tagline,
            description: profile.description,
            about_text: profile.about_text,
            logo_url: profile.logo_url || profile.Institute?.logo,
            cover_photo_url: profile.cover_photo_url,
            affiliation: profile.affiliation,
            admission_status: profile.admission_status,
            stats: {
                students: profile.total_students_display,
                pass_rate: profile.pass_rate,
                selections: profile.competitive_selections,
                years: profile.years_of_excellence
            },
            usp_points: parseJson(profile.usp_points, []),
            enrollment_benefits: parseJson(profile.enrollment_benefits, []),
            theme_color: profile.theme_color,
            seo_title: profile.seo_title,
            seo_description: profile.seo_description,
            contact: {
                address: profile.contact_address || profile.Institute?.address,
                phone: profile.contact_phone || profile.Institute?.phone,
                email: profile.contact_email || profile.Institute?.email,
                whatsapp: profile.whatsapp_number,
                working_hours: profile.working_hours,
                map_embed_url: normalizeMapUrl(profile.map_embed_url)
            },
            social: {
                facebook: profile.social_facebook,
                instagram: profile.social_instagram,
                youtube: profile.social_youtube
            },
            footer_description: profile.footer_description,
            gallery: gallery.map(g => ({ id: g.id, photo_url: g.photo_url, label: g.label })),
            reviews: reviews.map(r => ({
                id: r.id,
                student_name: r.student_name,
                review_text: r.review_text,
                rating: r.rating,
                achievement: r.achievement
            })),
            faculty: facultyToShow,
            faculty_mode: facultyMode,
            courses: coursesToShow,
            course_mode: courseMode,
            youtube_embed_url: youtubeEmbedUrl,
            page_views: profile.page_views
        };

        return res.json({ success: true, data: responseData });
    } catch (error) {
        console.error("getPublicPageData error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ── Convert YouTube URL to embed URL ────────────────────────────
function buildYouTubeEmbedUrl(url) {
    if (!url || !url.trim()) return null;
    url = url.trim();

    // Already an embed URL
    if (url.includes('youtube.com/embed/') || url.includes('youtube-nocookie.com/embed/')) return url;

    // youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) {
        return `https://www.youtube-nocookie.com/embed/${shortMatch[1]}?rel=0&modestbranding=1`;
    }

    // youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) {
        return `https://www.youtube-nocookie.com/embed/${watchMatch[1]}?rel=0&modestbranding=1`;
    }

    // youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) {
        return `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}?rel=0&modestbranding=1`;
    }

    // youtube.com/live/VIDEO_ID
    const liveMatch = url.match(/\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch) {
        return `https://www.youtube-nocookie.com/embed/${liveMatch[1]}?rel=0&modestbranding=1`;
    }

    return null; // Cannot parse
}

// ─────────────────────────────────────────────────────────────────
// POST /api/public/:slug/enquiry  — Submit enquiry form
// ─────────────────────────────────────────────────────────────────
exports.submitEnquiry = async (req, res) => {
    try {
        let slug = req.query.subdomain || extractSubdomain(req.hostname) || req.params.slug || req.body.slug;
        const ip = req.ip || req.connection.remoteAddress;

        if (!slug) {
            return res.status(400).json({ success: false, message: "No subdomain or slug provided" });
        }

        const profile = await InstitutePublicProfile.findOne({
            where: { 
                [Op.or]: [
                    { slug: slug },
                    { slug: slug.replace(/\./g, '-') },
                    { slug: slug.replace(/-/g, '.') }
                ],
                is_published: true 
            }
        });

        if (!profile) {
            return res.status(404).json({ success: false, error: 'NOT_FOUND', message: "Institute page not found" });
        }

        // Rate limiting check
        if (!checkRateLimit(ip, profile.institute_id)) {
            return res.status(429).json({
                success: false,
                message: "Too many enquiries submitted. Please try again after an hour."
            });
        }

        const { first_name, last_name, mobile, email, course_interest, current_class, message } = req.body;

        // Basic validation
        if (!first_name || !mobile) {
            return res.status(400).json({ success: false, message: "Name and mobile are required" });
        }

        if (!/^[6-9]\d{9}$/.test(mobile)) {
            return res.status(400).json({ success: false, message: "Please enter a valid 10-digit Indian mobile number" });
        }

        const enquiry = await PublicEnquiry.create({
            institute_id: profile.institute_id,
            first_name: first_name.trim(),
            last_name: last_name?.trim() || null,
            mobile,
            email: email?.trim() || null,
            course_interest: course_interest?.trim() || null,
            current_class: current_class?.trim() || null,
            message: message?.trim() || null,
            status: 'new',
            ip_address: ip
        });

        return res.json({
            success: true,
            message: "Enquiry submitted successfully! The institute will contact you soon.",
            enquiry_id: enquiry.id
        });
    } catch (error) {
        console.error("submitEnquiry error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
