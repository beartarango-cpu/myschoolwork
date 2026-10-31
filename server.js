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
    let targetUrl = req.query.url;
    if (!targetUrl) return res.send("No URL provided");

    const isMainHtmlPage = !targetUrl.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ico)$/i);
    const isAlreadyCached = targetUrl.includes('://googleusercontent.com');

    // 1. FIRST ATTEMPT: Try the Google Cache path for HTML layouts to pass Cloudflare screens
    if (isMainHtmlPage && !isAlreadyCached && !targetUrl.includes('youtube') && !targetUrl.includes('google.com')) {
        let cacheUrl = 'https://://googleusercontent.com/search?q=cache:' + encodeURIComponent(targetUrl);
        try {
            const cacheResponse = await fetch(cacheUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (cacheResponse.ok) {
                let html = await cacheResponse.text();
                res.removeHeader('X-Frame-Options');
                res.removeHeader('Content-Security-Policy');
                res.setHeader('X-Frame-Options', 'ALLOWALL');
                return res.send(rewriteUrls(html, targetUrl));
            }
        } catch (e) {
            // Fall through seamlessly to direct fetching if cache isn't accessible
        }
    }

    // 2. DIRECT FALLBACK PATHWAY: Connect directly if cache check fails or is an asset
    try {
        const response = await fetch(targetUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36'
            }
        });
        let html = await response.text();
        const cleanHtml = rewriteUrls(html, targetUrl);

        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        res.send(cleanHtml);
    } catch (error) {
        res.status(500).send("Proxy failed to connect to this specific network layout pathway.");
    }
});

// Fixes the "/search" 404 bug by automatically routing queries to Google's mobile node via proxy
app.get('/search', (req, res) => {
    const query = req.query.q || '';
    const googleSearchUrl = `https://google.com{encodeURIComponent(query)}`;
    res.redirect(`/proxy?url=${encodeURIComponent(googleSearchUrl)}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
