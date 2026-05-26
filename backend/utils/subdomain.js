const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'zenithflows.in';
const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin', 'mail', 'ftp', 'staging'];

/**
 * Extracts the institute subdomain from req.hostname
 * 'iitcoaching.zenithflows.in' → 'iitcoaching'
 * 'zenithflows.in' → null (main domain)
 * 'app.zenithflows.in' → null (reserved)
 */
function extractSubdomain(hostname) {
    if (!hostname) return null;

    // Remove port if present (localhost:3000)
    const host = hostname.split(':')[0].toLowerCase();

    // Handle localhost development
    if (host === 'localhost' || host === '127.0.0.1') return null;

    // Remove main domain suffix
    const suffix = '.' + MAIN_DOMAIN;
    if (!host.endsWith(suffix) && host !== MAIN_DOMAIN) return null;

    const subdomain = host.replace(suffix, '');

    // No subdomain (main domain itself)
    if (!subdomain || subdomain === MAIN_DOMAIN) return null;

    // Reserved — not an institute
    if (RESERVED_SUBDOMAINS.includes(subdomain)) return null;

    // Validate format: lowercase letters, numbers, hyphens only
    // Note: We also allow dots here for backward compatibility with old slugs if any
    if (!/^[a-z0-9-.]+$/.test(subdomain)) return null;

    return subdomain;
}

module.exports = { extractSubdomain };
