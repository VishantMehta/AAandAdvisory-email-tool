const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '..', 'data', 'send-log.json');

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function loadLog() {
    if (fs.existsSync(logFilePath)) {
        try {
            return JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
        } catch (e) {
            console.error("Failed to parse send-log.json, starting fresh.");
        }
    }
    return {};
}

function saveLog(data) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.writeFileSync(logFilePath, JSON.stringify(data, null, 2), 'utf8');
}

function ensureTodayEntry() {
    const log = loadLog();
    const today = getTodayStr();
    
    if (!log[today]) {
        log[today] = { resend: 0, brevo: 0, mailersend: 0 };
    }
    
    if (!log.history) {
        log.history = []; // Array of strings like "campaignName|email"
    }
    
    return { log, today };
}

function getRemainingCapacity(providerName) {
    const { log, today } = ensureTodayEntry();
    
    let limit = 0;
    if (providerName === 'resend') limit = parseInt(process.env.DAILY_LIMIT_RESEND || '100', 10);
    else if (providerName === 'brevo') limit = parseInt(process.env.DAILY_LIMIT_BREVO || '300', 10);
    else if (providerName === 'mailersend') limit = parseInt(process.env.DAILY_LIMIT_MAILERSEND || '200', 10);
    
    const sentCount = log[today][providerName] || 0;
    return Math.max(0, limit - sentCount);
}

function incrementCount(providerName, campaignName, email) {
    const { log, today } = ensureTodayEntry();
    log[today][providerName] = (log[today][providerName] || 0) + 1;
    log.history.push(`${campaignName}|${email}`);
    saveLog(log);
}

function hasBeenSent(campaignName, email) {
    const log = loadLog();
    if (!log.history) return false;
    return log.history.includes(`${campaignName}|${email}`);
}

module.exports = {
    getRemainingCapacity,
    incrementCount,
    hasBeenSent
};
