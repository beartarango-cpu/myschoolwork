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
    let targetUrl = req.query.url;
    if (!targetUrl) return res.send("No URL provided");

    // CLOUDFLARE BYPASS INJECTION: Detect if a target page might be heavily guarded, 
    // and funnel it through Google's spider web cache if it isn't an embed asset already.
    const isMainHtmlPage = !targetUrl.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ico)$/i);
    const isAlreadyCached = targetUrl.includes('://googleusercontent.com');

    if (isMainHtmlPage && !isAlreadyCached && !targetUrl.includes('youtube') && !targetUrl.includes('google.com')) {
        targetUrl = 'https://://googleusercontent.com/search?q=cache:' + encodeURIComponent(targetUrl);
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 
                // Matches standard mobile device browser profiles
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36'
            }
        });
        let html = await response.text();

        const cleanHtml = rewriteUrls(html, targetUrl);

        // Strip incoming iframe tracking restrictions out of the header response thread
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        
        res.send(cleanHtml);
    } catch (error) {
        res.status(500).send("Proxy failed to fetch the site securely.");
    }
});

// Fixes the "/search" 404 bug by automatically routing all queries to Google's main node
app.get('/search', (req, res) => {
    const query = req.query.q || '';
    const googleSearchUrl = `https://google.com{encodeURIComponent(query)}`;
    res.redirect(`/proxy?url=${encodeURIComponent(googleSearchUrl)}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
