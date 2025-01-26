const express = require('express');
const { Liquid } = require('liquidjs');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3000;

// Setup Liquid Engine
const engine = new Liquid({
    root: path.join(__dirname),
    extname: '.html'
});
app.engine('html', engine.express());
app.set('view engine', 'html');

// Set the views directory to the root directory
app.set('views', __dirname);

// Serve static files
app.use(express.static('public'));

// Load sample data
async function loadSampleData() {
    const eplFixtures = JSON.parse(await fs.readFile('./epl-fixtures/sample.json', 'utf8'));
    const eplMyTeam = JSON.parse(await fs.readFile('./epl-my-team/sample.json', 'utf8'));
    return { eplFixtures, eplMyTeam };
}

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/preview/:plugin/:layout', async (req, res) => {
    const { plugin, layout } = req.params;
    const data = await loadSampleData();
    
    try {
        // Select the right data based on plugin
        const viewData = {
            matches: data[plugin === 'epl-fixtures' ? 'eplFixtures' : 'eplMyTeam'].matches
        };

        // Construct the view path
        const viewPath = path.join(plugin, layout);
        res.render(viewPath, viewData);
    } catch (error) {
        console.error('Error rendering template:', error);
        res.status(500).send('Error rendering template');
    }
});

app.listen(port, () => {
    console.log(`Test app running at http://localhost:${port}`);
}); 