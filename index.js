const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const multer = require('multer');
const XLSX = require('xlsx');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(bodyParser.json());
app.use(express.static('public'));

// Serve BackstopJS reports and images
app.use('/backstop_data', express.static('backstop_data'));

// Multer setup for Excel uploads
const upload = multer({ dest: 'uploads/' });
let lastUploadedExcel = null;
let isTestRunning = false;

// Function to clear existing BackstopJS data
function clearBackstopData() {
    const dirsToClean = [
        'backstop_data/bitmaps_reference',
        'backstop_data/bitmaps_test',
        'backstop_data/html_report'
    ];

    dirsToClean.forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        fs.mkdirSync(dir, { recursive: true });
    });
}

// Function to load and scroll through a page
async function loadAndScrollPage(scenario) {
    const browser = await puppeteer.launch({
        // executablePath: '/usr/bin/chromium-browser', // or the path to your system's Chrome/Chromium
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log(`Processing URL: ${scenario.url}`);
        await page.goto(scenario.url, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('body', { visible: true, timeout: 120000 });

        // Emulate screen size to match your Backstop config (optional but recommended)
        await page.setViewport({ width: 1920, height: 1080 });

        // Scroll to load lazy content
        await page.evaluate(async () => {
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            const scrollStep = 250;
            let totalHeight = 0;

            while (totalHeight < document.body.scrollHeight) {
                window.scrollBy(0, scrollStep);
                await delay(100);
                totalHeight += scrollStep;
            }

            window.scrollTo(0, 0);
            await delay(1000);
        });

        // Wait for all images to fully load (includes Next.js lazy images)
        await page.evaluate(async () => {
            const images = Array.from(document.images);

            // Trigger lazy loading by intersecting them manually
            images.forEach(img => {
                if (img.loading === 'lazy') {
                    img.scrollIntoView({ behavior: 'instant', block: 'center' });
                }
            });

            await new Promise(resolve => {
                const interval = setInterval(() => {
                    const unloaded = images.filter(img => !img.complete || img.naturalHeight === 0);
                    if (unloaded.length === 0) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 300);
            });
        });

        console.log('✅ Scroll and lazy-loaded images loaded');
        return { url: scenario.url, status: 'success' };

    } catch (error) {
        console.error(`❌ Error processing URL: ${scenario.url}`, error);
        return { url: scenario.url, status: 'failed', error: error.message };
    } finally {
        await browser.close();
    }
}


// Function to fetch all routes from a website
async function fetchAllRoutes(url) {
    try {
        const baseUrl = url.replace(/\/$/, '');
        const baseUrlObj = new URL(baseUrl);
        const foundRoutes = new Set(['/']); // Always include homepage
        const visited = new Set();
        const toVisit = new Set(['/']);

        console.log('Starting to crawl website for routes...');

        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Process URLs in batches to avoid opening too many pages
        while (toVisit.size > 0 && visited.size < 100) { // Safety limit of 100 pages
            const currentPath = Array.from(toVisit)[0];
            toVisit.delete(currentPath);

            if (visited.has(currentPath)) continue;
            visited.add(currentPath);

            try {
                const fullUrl = baseUrl + currentPath;
                console.log(`Crawling: ${fullUrl}`);

                const page = await browser.newPage();
                await page.setDefaultNavigationTimeout(30000); // 30 seconds timeout

                // Navigate to the page and wait for network to be idle
                await page.goto(fullUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Extract all links from the page
                const links = await page.evaluate(() => {
                    const anchors = document.querySelectorAll('a[href]');
                    return Array.from(anchors).map(a => a.href);
                });

                await page.close();

                // Process each link
                for (const link of links) {
                    try {
                        const linkUrl = new URL(link);

                        // Only process links from the same domain
                        if (linkUrl.hostname !== baseUrlObj.hostname) continue;

                        // Get the pathname and clean it
                        let pathname = linkUrl.pathname;
                        if (!pathname.startsWith('/')) pathname = '/' + pathname;

                        // Skip if it's a file or already processed
                        if (pathname.match(/\.(jpg|jpeg|png|gif|css|js|ico|xml|pdf|doc|docx|txt)$/i)) continue;
                        if (visited.has(pathname)) continue;

                        foundRoutes.add(pathname);
                        toVisit.add(pathname);
                    } catch (e) {
                        console.error(`Error processing link ${link}:`, e.message);
                    }
                }

            } catch (error) {
                console.error(`Error crawling ${currentPath}:`, error.message);
            }
        }

        await browser.close();

        const routes = Array.from(foundRoutes);
        console.log(`Found ${routes.length} routes:`, routes);
        return routes;

    } catch (error) {
        console.error('Error in fetchAllRoutes:', error.message);
        return ['/'];
    }
}

// Function to generate BackstopJS config
function generateBackstopConfig(prodUrl, stagingUrl, routes) {
    const cleanProdUrl = prodUrl.replace(/\/$/, '');
    const cleanStagingUrl = stagingUrl.replace(/\/$/, '');

    const scenarios = routes.map(route => ({
        label: route,
        url: cleanProdUrl + route,
        referenceUrl: cleanStagingUrl + route,
        selectors: ["document"],
        misMatchThreshold: 0.1,
        requireSameDimensions: true,
        waitForSelector: 'body',
        delay: 2000,
        postInteractionWait: 1000
    }));

    return {
        id: "visual_regression_test",
        viewports: [
            {
                label: "phone",
                width: 375,
                height: 667
            },
            {
                label: "tablet",
                width: 1024,
                height: 768
            },
            {
                label: "desktop",
                width: 1920,
                height: 1080
            }
        ],
        scenarios,
        paths: {
            bitmaps_reference: "backstop_data/bitmaps_reference",
            bitmaps_test: "backstop_data/bitmaps_test",
            engine_scripts: "backstop_data/engine_scripts",
            html_report: "backstop_data/html_report",
            ci_report: "backstop_data/ci_report"
        },
        report: ["browser"],
        engine: "puppeteer",
        engineOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
        asyncCaptureLimit: 5,
        asyncCompareLimit: 50,
        debug: false,
        debugWindow: false
    };
}

// API endpoint to start the testing process (no Excel support)
app.post('/api/test', async (req, res) => {
    if (isTestRunning) {
        return res.status(429).json({ error: 'A test is already running. Please wait for it to finish.' });
    }
    isTestRunning = true;
    try {
        const { prodUrl, stagingUrl } = req.body;

        if (!prodUrl || !stagingUrl) {
            return res.status(400).json({ error: 'Both production and staging URLs are required' });
        }

        // Clear existing data and ensure directories
        clearBackstopData();

        io.emit('status', 'Finding all routes...');
        const routes = await fetchAllRoutes(prodUrl);

        if (routes.length === 0) {
            throw new Error('No routes found');
        }

        io.emit('status', `Found ${routes.length} routes. Pre-rendering pages...`);

        // Pre-render all pages by scrolling through them
        for (const route of routes) {
            const prodScenario = { url: prodUrl + route };
            const stagingScenario = { url: stagingUrl + route };

            io.emit('status', `Pre-rendering: ${route}`);

            // Pre-render both production and staging pages
            await loadAndScrollPage(prodScenario);
            await loadAndScrollPage(stagingScenario);
        }

        io.emit('status', 'All pages pre-rendered. Generating config...');

        // Generate and write config
        const config = generateBackstopConfig(prodUrl, stagingUrl, routes);
        const configContent = `module.exports = ${JSON.stringify(config, null, 2)};`;
        fs.writeFileSync('backstop.config.js', configContent);

        // Create reference images
        io.emit('status', 'Creating reference images...');
        const reference = spawn('npx', ['backstop', 'reference', '--config=backstop.config.js']);

        reference.stdout.on('data', (data) => {
            const message = data.toString();
            io.emit('status', message);
        });

        reference.stderr.on('data', (data) => {
            const error = data.toString();
            io.emit('error', error);
        });

        reference.on('close', async (code) => {
            if (code === 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));

                io.emit('status', 'Reference images created. Starting comparison...');
                const test = spawn('npx', ['backstop', 'test', '--config=backstop.config.js']);

                test.stdout.on('data', (data) => {
                    const message = data.toString();
                    io.emit('status', message);
                });

                test.stderr.on('data', (data) => {
                    const error = data.toString();
                    io.emit('error', error);
                });

                test.on('close', (testCode) => {
                    isTestRunning = false;
                    if (testCode === 0) {
                        io.emit('status', 'Testing completed successfully!');
                    } else {
                        io.emit('status', 'Testing completed with differences.');
                    }
                    io.emit('complete', '/backstop_data/html_report/index.html');
                });
            } else {
                isTestRunning = false;
                io.emit('error', 'Failed to create reference images');
            }
        });

        res.json({ message: 'Test process started' });
    } catch (error) {
        isTestRunning = false;
        console.error('Error:', error);
        io.emit('error', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to upload Excel file
app.post('/api/upload-excel', upload.single('excelFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    lastUploadedExcel = req.file.path;
    res.json({ message: 'Excel file uploaded successfully' });
});

// Endpoint to trigger test using uploaded Excel file
app.post('/api/test-excel', async (req, res) => {
    if (isTestRunning) {
        return res.status(429).json({ error: 'A test is already running. Please wait for it to finish.' });
    }
    isTestRunning = true;
    if (!lastUploadedExcel) {
        isTestRunning = false;
        return res.status(400).json({ error: 'No Excel file uploaded' });
    }
    try {
        // Parse Excel file and extract URLs
        const workbook = XLSX.readFile(lastUploadedExcel);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        // Flatten and filter URLs
        const urls = data.flat().filter(cell => typeof cell === 'string' && cell.startsWith('http'));
        if (urls.length === 0) {
            return res.status(400).json({ error: 'No URLs found in Excel file' });
        }
        // Clear existing data
        clearBackstopData();
        io.emit('status', 'Preparing scenarios from Excel URLs...');
        // Generate scenarios for BackstopJS
        const scenarios = urls.map((url, i) => ({
            label: `ExcelURL${i + 1}`,
            url,
            referenceUrl: url,
            selectors: ["document"],
            misMatchThreshold: 0.1,
            requireSameDimensions: true,
            waitForSelector: 'body',
            delay: 2000,
            postInteractionWait: 1000
        }));
        const config = {
            id: "excel_url_test",
            viewports: [
                { label: "desktop", width: 1920, height: 1080 }
            ],
            scenarios,
            paths: {
                bitmaps_reference: "backstop_data/bitmaps_reference",
                bitmaps_test: "backstop_data/bitmaps_test",
                engine_scripts: "backstop_data/engine_scripts",
                html_report: "backstop_data/html_report",
                ci_report: "backstop_data/ci_report"
            },
            report: ["browser"],
            engine: "puppeteer",
            engineOptions: { args: ["--no-sandbox"] },
            asyncCaptureLimit: 5,
            asyncCompareLimit: 50,
            debug: false,
            debugWindow: false
        };
        fs.writeFileSync('backstop.config.js', `module.exports = ${JSON.stringify(config, null, 2)};`);
        io.emit('status', 'Running BackstopJS for Excel URLs...');
        // Run BackstopJS reference and test
        const reference = spawn('npx', ['backstop', 'reference', '--config=backstop.config.js']);
        reference.on('close', (code) => {
            if (code !== 0) {
                isTestRunning = false;
                io.emit('status', 'BackstopJS reference failed');
                return res.status(500).json({ error: 'BackstopJS reference failed' });
            }
            const test = spawn('npx', ['backstop', 'test', '--config=backstop.config.js']);
            test.on('close', (testCode) => {
                isTestRunning = false;
                if (testCode !== 0) {
                    io.emit('error', 'BackstopJS test failed with code: ' + testCode);
                    io.emit('complete', '/backstop_data/html_report/index.html');
                } else {
                    io.emit('status', 'Excel URL test completed!');
                    io.emit('complete', '/backstop_data/html_report/index.html');
                }
            });
        });
    } catch (err) {
        isTestRunning = false;
        io.emit('status', 'Error processing Excel file');
        res.status(500).json({ error: 'Error processing Excel file' });
    }
});

// Generate mock results data (replace with actual BackstopJS results parsing)
function generateResultsData(routes, viewports) {
    const results = {};

    viewports.forEach(viewport => {
        results[viewport.label] = routes.map(route => {
            const routeLabel = route === '/' ? 'home' : route.replace(/[^a-zA-Z0-9]/g, '_');
            return {
                route: route,
                status: Math.random() > 0.7 ? 'fail' : 'pass', // Random for demo
                difference: Math.random() * 3,
                images: {
                    reference: `/backstop_data/bitmaps_reference/${viewport.label}_${routeLabel}_0_document_0.png`,
                    test: `/backstop_data/bitmaps_test/${viewport.label}_${routeLabel}_0_document_0.png`,
                    diff: `/backstop_data/bitmaps_test/${viewport.label}_${routeLabel}_0_document_0_diff.png`
                }
            };
        });
    });

    return results;
}

// API endpoint to get test results
app.get('/api/results', (req, res) => {
    try {
        const configPath = path.join(process.cwd(), 'backstop_data', 'html_report', 'config.js');
        if (fs.existsSync(configPath)) {
            // In a real implementation, parse the actual BackstopJS results
            res.json({ status: 'completed', reportUrl: '/backstop_data/html_report/index.html' });
        } else {
            res.json({ status: 'not_found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🚀 Visual Regression Testing Server running on port ${PORT}`);
    console.log(`📊 Open http://localhost:${PORT} to start testing`);

    // Ensure BackstopJS is installed
    const { exec } = require('child_process');
    exec('npx backstop --version', (error, stdout, stderr) => {
        if (error) {
            console.log('⚠️  BackstopJS not found. Installing...');
            exec('npm install -g backstopjs', (installError) => {
                if (installError) {
                    console.error('❌ Failed to install BackstopJS:', installError);
                } else {
                    console.log('✅ BackstopJS installed successfully');
                }
            });
        } else {
            console.log('✅ BackstopJS is ready:', stdout.trim());
        }
    });
});
function isValidHttpUrl(string) {
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

// When reading from Excel:

