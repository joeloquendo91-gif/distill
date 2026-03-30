// Absolute base URL used in JSON-LD schemas.
// Set NEXT_PUBLIC_SITE_URL in .env.local (e.g. https://yourdomain.com).
// No trailing slash.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

export default SITE_URL;
