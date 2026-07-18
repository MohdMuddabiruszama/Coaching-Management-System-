/**
 * useSEO — Lightweight per-page SEO hook for ZenithFlows
 *
 * Sets document.title, meta description, canonical link, and OG/Twitter tags
 * dynamically per page. Zero dependencies — pure DOM manipulation.
 *
 * Usage:
 *   useSEO({
 *     title: 'Pricing Plans | ZenithFlows',
 *     description: 'Compare ZenithFlows plans for your institute.',
 *     canonical: '/pricing',
 *     ogTitle: 'Pricing — ZenithFlows',       // optional, falls back to title
 *     ogDescription: '...',                   // optional, falls back to description
 *     ogImage: '/og-image.png',               // optional
 *   });
 */
import { useEffect } from 'react';

const BASE_URL = 'https://www.zenithflows.in';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

/**
 * @param {Object} params
 * @param {string} params.title          - Page <title>
 * @param {string} params.description    - <meta name="description">
 * @param {string} [params.canonical]    - Canonical path e.g. '/pricing' (default: '/')
 * @param {string} [params.ogTitle]      - OG title (fallback: title)
 * @param {string} [params.ogDescription]- OG description (fallback: description)
 * @param {string} [params.ogImage]      - OG image URL (fallback: og-image.png)
 * @param {string} [params.ogType]       - OG type (default: 'website')
 */
export function useSEO({
  title,
  description,
  canonical = '/',
  ogTitle,
  ogDescription,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
} = {}) {
  useEffect(() => {
    if (!title && !description) return;

    // ── 1. Document title ─────────────────────────────────────────────
    if (title) document.title = title;

    // ── helper: upsert <meta> tags ────────────────────────────────────
    const setMeta = (selector, attr, value) => {
      if (!value) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [key, val] = attr.split('=');
        el.setAttribute(key === 'name' ? 'name' : 'property', val.replace(/["']/g, ''));
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };

    // ── helper: upsert <link> tags ────────────────────────────────────
    const setLink = (rel, href) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // ── 2. Core meta ──────────────────────────────────────────────────
    setMeta('meta[name="description"]',          'name="description"',          description);
    setLink('canonical', `${BASE_URL}${canonical}`);

    // ── 3. Open Graph ─────────────────────────────────────────────────
    setMeta('meta[property="og:title"]',         'property="og:title"',         ogTitle || title);
    setMeta('meta[property="og:description"]',   'property="og:description"',   ogDescription || description);
    setMeta('meta[property="og:url"]',           'property="og:url"',           `${BASE_URL}${canonical}`);
    setMeta('meta[property="og:type"]',          'property="og:type"',          ogType);
    setMeta('meta[property="og:image"]',         'property="og:image"',         ogImage);

    // ── 4. Twitter Cards ──────────────────────────────────────────────
    setMeta('meta[name="twitter:title"]',        'name="twitter:title"',        ogTitle || title);
    setMeta('meta[name="twitter:description"]',  'name="twitter:description"',  ogDescription || description);
    setMeta('meta[name="twitter:image"]',        'name="twitter:image"',        ogImage);
  }, [title, description, canonical, ogTitle, ogDescription, ogImage, ogType]);
}

export default useSEO;
