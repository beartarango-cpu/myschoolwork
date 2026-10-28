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
