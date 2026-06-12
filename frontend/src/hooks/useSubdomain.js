import { useMemo } from 'react';

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'zenithflows.in';
const RESERVED = ['www', 'app', 'api', 'admin', 'staging', 'localhost'];

export function useSubdomain() {
    return useMemo(() => {
        const hostname = window.location.hostname;
        
        // Development / Testing: support ?institute=slug in URL
        const urlParams = new URLSearchParams(window.location.search);
        const devSubdomain = urlParams.get('institute');
        if (devSubdomain) {
            return { subdomain: devSubdomain, isInstitutePage: true, isMainDomain: false };
        }

        // Production: read from hostname
        if (hostname === MAIN_DOMAIN || hostname === `www.${MAIN_DOMAIN}`) {
            return { subdomain: null, isInstitutePage: false, isMainDomain: true };
        }

        const suffix = `.${MAIN_DOMAIN}`;
        if (hostname.endsWith(suffix)) {
            const subdomain = hostname.slice(0, -suffix.length);
            if (RESERVED.includes(subdomain.toLowerCase())) {
                return { subdomain: null, isInstitutePage: false, isMainDomain: false };
            }
            return { subdomain, isInstitutePage: true, isMainDomain: false };
        }

        // Localhost Subdomain Support (Development)
        if (hostname.endsWith('.localhost')) {
            const subdomain = hostname.slice(0, -'.localhost'.length);
            if (RESERVED.includes(subdomain.toLowerCase())) {
                return { subdomain: null, isInstitutePage: false, isMainDomain: false };
            }
            return { subdomain, isInstitutePage: true, isMainDomain: false };
        }

        // Fallback for localhost without query param, or unknown domains
        return { subdomain: null, isInstitutePage: false, isMainDomain: true };
    }, [window.location.hostname, window.location.search]);
}
