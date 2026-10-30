const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// A clean, ultra-stable proxy engine that handles all search requests as raw streams
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.send("No URL provided");

    try {
        // Fetch the site using a clean, universal mobile signature
        const response = await fetch(targetUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36'
            }
        });
        
        let html = await response.text();

        // Fix absolute links inside the text stream so they stay inside our proxy loop
        let cleanHtml = html.replace(/(href|src)=["']\/([^"']*)["']/g, (match, attr, path) => {
            try {
                const origin = new URL(targetUrl).origin;
                return `${attr}="/proxy?url=${encodeURIComponent(origin + '/' + path)}"`;
            } catch(e) {
                return match;
            }
        });

        // Strip the security filters that cause the browser to show a blank screen
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        
        res.send(cleanHtml);
    } catch (error) {
        res.status(500).send("Proxy failed to process the request safely.");
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
