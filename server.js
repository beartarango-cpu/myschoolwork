const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to rewrite asset and link paths so they route correctly back through your proxy domain
function rewriteUrls(html, targetBaseUrl) {
    try {
        const url = new URL(targetBaseUrl);
        const origin = url.origin;

        // Remove meta-tag security policies embedded in the HTML body
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

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.send("No URL provided");

    try {
        // Save the last browsed domain to session memory so catch-alls know where to point fallbacks
        app.locals.lastProxiedOrigin = new URL(targetUrl).origin;

        const response = await fetch(targetUrl, {
            headers: { 
                // Spoofs an older mobile browser layout to force Google to give us simple HTML without complex script blocks
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_3 like Mac OS X) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.0 Mobile/14G60 Safari/602.1'
            }
        });
        let html = await response.text();

        const cleanHtml = rewriteUrls(html, targetUrl);

        // Strip incoming iframe tracking restrictions out of the header
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        
        res.send(cleanHtml);
    } catch (error) {
        res.status(500).send("Proxy failed to fetch the site.");
    }
});

// CATCH-ALL ROUTER: Solves the "Cannot GET /search" error by capturing raw sub-paths
app.get('/:route', (req, res) => {
    const origin = app.locals.lastProxiedOrigin || 'https://google.com';
    const fullOriginalUrl = origin + req.originalUrl;
    res.redirect(`/proxy?url=${encodeURIComponent(fullOriginalUrl)}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
