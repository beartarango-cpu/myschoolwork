const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// 1. Homepage route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to rewrite asset and link URLs so they point through your proxy
function rewriteUrls(html, targetBaseUrl) {
    try {
        const url = new URL(targetBaseUrl);
        const origin = url.origin;

        // Remove meta tag Content-Security-Policies that browsers enforce locally
        let modifiedHtml = html.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');

        // Rewrite absolute paths starting with "/" (e.g., /style.css -> /proxy?url=://targetsite.com)
        modifiedHtml = modifiedHtml.replace(/(href|src)=["']\/([^"']*)["']/g, (match, attribute, path) => {
            const fullAssetUrl = `${origin}/${path}`;
            return `${attribute}="/proxy?url=${encodeURIComponent(fullAssetUrl)}"`;
        });

        // Rewrite relative paths (e.g., images/logo.png -> /proxy?url=://targetsite.com)
        modifiedHtml = modifiedHtml.replace(/(href|src)=["'](?!(http|https|\/))([^"']*)["']/g, (match, attribute, path) => {
            const baseUrlWithSlash = targetBaseUrl.endsWith('/') ? targetBaseUrl : targetBaseUrl + '/';
            const fullAssetUrl = `${baseUrlWithSlash}${path}`;
            return `${attribute}="/proxy?url=${encodeURIComponent(fullAssetUrl)}"`;
        });

        return modifiedHtml;
    } catch (e) {
        return html;
    }
}

// 2. The core Proxy processor
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.send("No URL provided");

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        let html = await response.text();

        // Save the last browsed site to session memory so catch-alls know where to redirect
        app.locals.lastProxiedOrigin = new URL(targetUrl).origin;

        const cleanHtml = rewriteUrls(html, targetUrl);

        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        
        res.send(cleanHtml);
    } catch (error) {
        res.status(500).send("Proxy failed to fetch the site.");
    }
});

// 3. CATCH-ALL ROUTE: Fixes the "Cannot GET /search" error by forcing broken sub-routes back to Google
app.get('/:route', (req, res) => {
    const origin = app.locals.lastProxiedOrigin || 'https://google.com';
    
    // Reconstruct the full original URL path intended for Google
    const fullOriginalUrl = origin + req.originalUrl;
    
    // Reroute it cleanly back into your proxy loop
    res.redirect(`/proxy?url=${encodeURIComponent(fullOriginalUrl)}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
