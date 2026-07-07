require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { runCampaign } = require('./src/campaign');

const REQUIRED_KEYS = [
    'RESEND_API_KEY',
    'BREVO_SMTP_USER', 'BREVO_SMTP_PASS', 'BREVO_SMTP_HOST', 'BREVO_SMTP_PORT',
    'MAILERSEND_SMTP_USER', 'MAILERSEND_SMTP_PASS', 'MAILERSEND_SMTP_HOST', 'MAILERSEND_SMTP_PORT',
    'SENDER_EMAIL', 'SENDER_NAME'
];

function checkEnv() {
    const missing = REQUIRED_KEYS.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.error(`[ERROR] Missing required environment variables:\n  - ${missing.join('\n  - ')}`);
        process.exit(1);
    }
}

async function main() {
    checkEnv();

    const args = process.argv.slice(2);
    let template = 'campaign-template.html';
    let subject = 'Hello from AAAND Advisory';
    let dryRun = false;
    let campaign = new Date().toISOString().split('T')[0];
    let csvName = 'customers.csv';
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--template') template = args[++i];
        else if (args[i] === '--subject') subject = args[++i];
        else if (args[i] === '--campaign') campaign = args[++i];
        else if (args[i] === '--csv') csvName = args[++i];
        else if (args[i] === '--dry-run') dryRun = true;
    }
    
    const templatePath = path.join(__dirname, 'templates', template);
    if (!fs.existsSync(templatePath)) {
        console.error(`[ERROR] Template not found: ${templatePath}`);
        process.exit(1);
    }
    
    const csvPath = path.join(__dirname, 'data', csvName);
    
    console.log(`Starting campaign "${campaign}"...`);
    if (dryRun) console.log("== DRY RUN MODE ==");
    
    const stats = await runCampaign({
        templatePath,
        subject,
        csvPath,
        dryRun,
        campaignName: campaign
    });
    
    console.log('\n=== Campaign Summary ===');
    console.log(`Total Customers in CSV: ${stats.total}`);
    console.log(`Total Skipped (Unsub/Dedupe): ${stats.totalSkipped}`);
    console.log(`Total Failed: ${stats.totalFailed}`);
    console.log(`Total Sent: ${stats.totalSent}`);
    console.log(`Provider Breakdown:`);
    console.log(`  - Resend: ${stats.providerStats.resend}`);
    console.log(`  - Brevo: ${stats.providerStats.brevo}`);
    console.log(`  - MailerSend: ${stats.providerStats.mailersend}`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
