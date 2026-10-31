const express = require('express');
const path = require('path');
const { Proxy } = require('testcafe-hammerhead');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// Initialize the enterprise-grade Hammerhead proxy engine
const hammerhead = new Proxy('localhost', 3000, 3001);

// Homepage route - keeps your custom frontend design alive
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Advanced Proxy route processor
app.get('/proxy', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.send("No URL provided");

    try {
        // Hammerhead automatically opens a secure, state-synchronized session
        const session = hammerhead.openSession();
        
        // Disable strict security constraints that break iframe renderings
        session.handleFileUrl = () => true;
        session.getAuthCredentials = () => null;

        // Generate the high-performance proxy routing link
        const proxiedUrl = session.getProxiedUrl(targetUrl);
        
        // Pass everything seamlessly through the optimized server wrapper channel
        res.redirect(proxiedUrl);
    } catch (error) {
        res.status(500).send("Proxy framework encountered a synchronization error.");
    }
});

// Handles input search logic directly via the backend pipeline
app.get('/search', (req, res) => {
    const query = req.query.q || '';
    const googleSearchUrl = `https://google.com{encodeURIComponent(query)}`;
    res.redirect(`/proxy?url=${encodeURIComponent(googleSearchUrl)}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`High-performance proxy engine active on port ${PORT}`);
});
