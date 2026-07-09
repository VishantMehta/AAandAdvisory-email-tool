require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { runCampaign } = require('./src/campaign');
const rateLimiter = require('./src/rateLimiter');
const multer = require('multer');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'data'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.csv';
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}${ext}`);
    }
});
const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const logEmitter = new EventEmitter();

const logger = {
    log: (msg) => {
        console.log(msg);
        logEmitter.emit('log', { type: 'info', message: msg });
    },
    error: (msg) => {
        console.error(msg);
        logEmitter.emit('log', { type: 'error', message: msg });
    }
};

let isCampaignRunning = false;

app.get('/api/status', (req, res) => {
    res.json({
        isRunning: isCampaignRunning,
        capacity: {
            resend: rateLimiter.getRemainingCapacity('resend'),
            brevo: rateLimiter.getRemainingCapacity('brevo'),
            mailersend: rateLimiter.getRemainingCapacity('mailersend')
        }
    });
});

app.get('/api/templates', (req, res) => {
    const templatesDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templatesDir)) return res.json([]);
    const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.html'));
    res.json(files);
});

app.get('/api/csvs', (req, res) => {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) return res.json([]);
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));
    res.json(files);
});

app.post('/api/upload-csv', upload.single('csvFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or invalid file type' });
    }
    logger.log(`[INFO] Uploaded new contact list: ${req.file.filename}`);
    res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

app.post('/api/campaign/start', async (req, res) => {
    if (isCampaignRunning) {
        return res.status(400).json({ error: 'A campaign is already running.' });
    }

    const { template, subject, csv, dryRun, campaignName } = req.body;
    
    if (!template || !subject || !csv || !campaignName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const templatePath = path.join(__dirname, 'templates', template);
    const csvPath = path.join(__dirname, 'data', csv);

    if (!fs.existsSync(templatePath)) return res.status(400).json({ error: 'Template not found' });
    if (!fs.existsSync(csvPath)) return res.status(400).json({ error: 'CSV not found' });

    isCampaignRunning = true;
    logger.log(`\n=== Started Campaign: ${campaignName} ===`);
    if (dryRun) logger.log(`=== DRY RUN MODE ===`);

    res.json({ message: 'Campaign started successfully' });

    try {
        const stats = await runCampaign({
            templatePath,
            subject,
            csvPath,
            dryRun,
            campaignName,
            logger
        });

        logger.log('\n=== Campaign Summary ===');
        logger.log(`Total Customers: ${stats.total}`);
        logger.log(`Total Skipped: ${stats.totalSkipped}`);
        logger.log(`Total Failed: ${stats.totalFailed}`);
        logger.log(`Total Sent: ${stats.totalSent}`);
        logger.log(`Resend: ${stats.providerStats.resend} | Brevo: ${stats.providerStats.brevo} | MailerSend: ${stats.providerStats.mailersend}`);
        logger.log('=== DONE ===\n');
    } catch (err) {
        logger.error(`\nFatal error during campaign: ${err.message}`);
    } finally {
        isCampaignRunning = false;
    }
});

app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection message to establish stream
    res.write(`data: ${JSON.stringify({ type: 'sys', message: 'Connected to log stream.' })}\n\n`);

    const onLog = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    logEmitter.on('log', onLog);

    req.on('close', () => {
        logEmitter.off('log', onLog);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
