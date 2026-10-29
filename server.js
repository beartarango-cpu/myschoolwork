const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve your custom front-end HTML file from a "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Intercepts proxy requests and routes them cleanly past firewalls
app.use('/service', (req, res, next) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Error: Missing target URL parameter.');
    }

    // Dynamic proxy configuration that safely forwards web payloads
    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        pathRewrite: () => '', // Rewrites the request path to prevent target app server errors
        onError: (err, req, res) => {
            res.status(500).send('Proxy Connection Failed: The destination server refused or timed out.');
        }
    })(req, res, next);
});

app.listen(PORT, () => {
    console.log(`Your private web proxy is live on port ${PORT}`);
});

// Example route handling your proxy requests
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.send("No URL provided");

    try {
        // Fetch the external website server-side
        const response = await fetch(targetUrl);
        let html = await response.text();

        // 1. STRIP THE SECURITY BLOCKS: Delete frame restrictions from headers
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        
        // 2. FORCE BROWSER TO ALLOW IT: Tell the browser it is safe to embed
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        
        // Send the modified HTML content to your iframe
        res.send(html);

    } catch (error) {
        res.status(500).send("Proxy failed to fetch the site.");
    }
});

