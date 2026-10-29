const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to rewrite asset and link URLs so they point through your proxy
function rewriteUrls(html, targetBaseUrl) {
    try {
        const url = new URL(targetBaseUrl);
        const origin = url.origin;

        // 1. Remove meta tag Content-Security-Policies that browsers enforce locally
        let modifiedHtml = html.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');

        // 2. Rewrite absolute paths starting with "/" (e.g., /style.css -> /proxy?url=://targetsite.com)
        modifiedHtml = modifiedHtml.replace(/(href|src)=["']\/([^"']*)["']/g, (match, attribute, path) => {
            const fullAssetUrl = `${origin}/${path}`;
            return `${attribute}="/proxy?url=${encodeURIComponent(fullAssetUrl)}"`;
        });

        // 3. Rewrite relative paths (e.g., images/logo.png -> /proxy?url=://targetsite.com)
        modifiedHtml = modifiedHtml.replace(/(href|src)=["'](?!(http|https|\/))([^"']*)["']/g, (match, attribute, path) => {
            const baseUrlWithSlash = targetBaseUrl.endsWith('/') ? targetBaseUrl : targetBaseUrl + '/';
            const fullAssetUrl = `${baseUrlWithSlash}${path}`;
            return `${attribute}="/proxy?url=${encodeURIComponent(fullAssetUrl)}"`;
        });

        return modifiedHtml;
    } catch (e) {
        return html; // Fallback to original HTML if URL parsing fails
    }
}

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.send("No URL provided");

    try {
        const response = await fetch(targetUrl);
        let html = await response.text();

        // Run the HTML content through the URL rewriter before responding
        const cleanHtml = rewriteUrls(html, targetUrl);

        // Remove response framing restrictions
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        
        res.send(cleanHtml);
    } catch (error) {
        res.status(500).send("Proxy failed to fetch the site.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
