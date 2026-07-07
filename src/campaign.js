const fs = require('fs');
const path = require('path');
const csvReader = require('./csvReader');
const templateEngine = require('./templateEngine');
const router = require('./router');
const rateLimiter = require('./rateLimiter');

// Providers
const { sendViaResend } = require('./providers/resend');
const { sendViaBrevo } = require('./providers/brevo');
const { sendViaMailerSend } = require('./providers/mailersend');

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runCampaign(options) {
    const { templatePath, subject, csvPath, dryRun, campaignName, logger = console } = options;
    
    // Read files
    const customers = csvReader.readCustomers(csvPath);
    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    
    // Read unsubscribe list
    let unsubList = [];
    const unsubPath = path.join(__dirname, '..', 'unsubscribe-list.json');
    if (fs.existsSync(unsubPath)) {
        unsubList = JSON.parse(fs.readFileSync(unsubPath, 'utf8'));
    }
    
    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let providerStats = { resend: 0, brevo: 0, mailersend: 0 };
    
    for (const customer of customers) {
        if (!customer.email) continue; // skip invalid rows
        
        // Check unsub
        if (unsubList.includes(customer.email)) {
            totalSkipped++;
            continue;
        }
        
        // Check dedupe
        if (rateLimiter.hasBeenSent(campaignName, customer.email)) {
            totalSkipped++;
            continue;
        }
        
        // Prepare template
        const unsubLink = `https://aaandadvisory.works/unsubscribe?email=${encodeURIComponent(customer.email)}`;
        const html = templateEngine.renderTemplate(templateHtml, {
            name: customer.name || 'Valued Client',
            unsubscribe_link: unsubLink,
            cta_link: 'https://aaandadvisory.works'
        });
        
        // Provider failover loop
        let success = false;
        let attemptedProviders = [];
        
        while (!success) {
            let nextProvider = null;
            const ALL_PROVIDERS = ['brevo', 'resend', 'mailersend'];
            for (const p of ALL_PROVIDERS) {
                if (!attemptedProviders.includes(p) && rateLimiter.getRemainingCapacity(p) > 0) {
                    nextProvider = p;
                    break;
                }
            }
            
            if (!nextProvider) {
                if (attemptedProviders.length === 0) {
                    logger.log(`\n[STOP] All providers are at their daily caps. Run again tomorrow.`);
                    return { total: customers.length, totalSent, totalSkipped, totalFailed, providerStats };
                } else {
                    logger.error(`[FAIL] ${customer.email} - All remaining available providers failed.`);
                    totalFailed++;
                    break; // Move to next customer
                }
            }
            
            attemptedProviders.push(nextProvider);
            
            try {
                if (dryRun) {
                    logger.log(`[DRY RUN] Would send to ${customer.email} via ${nextProvider}`);
                } else {
                    if (nextProvider === 'resend') await sendViaResend(customer.email, subject, html);
                    else if (nextProvider === 'brevo') await sendViaBrevo(customer.email, subject, html);
                    else if (nextProvider === 'mailersend') await sendViaMailerSend(customer.email, subject, html);
                }
                
                success = true;
                totalSent++;
                providerStats[nextProvider]++;
                
                if (!dryRun) {
                    rateLimiter.incrementCount(nextProvider, campaignName, customer.email);
                }
                
                // Progress summary
                const r = rateLimiter.getRemainingCapacity('resend');
                const b = rateLimiter.getRemainingCapacity('brevo');
                const m = rateLimiter.getRemainingCapacity('mailersend');
                const tResend = parseInt(process.env.DAILY_LIMIT_RESEND || '100');
                const tBrevo = parseInt(process.env.DAILY_LIMIT_BREVO || '300');
                const tMailerSend = parseInt(process.env.DAILY_LIMIT_MAILERSEND || '200');
                
                logger.log(`Sent ${totalSent} | Resend: ${tResend - r}/${tResend} ${r===0?'(full)':''} | Brevo: ${tBrevo - b}/${tBrevo} ${b===0?'(full)':''} | MailerSend: ${tMailerSend - m}/${tMailerSend} ${m===0?'(full)':''}`);
                
            } catch (err) {
                logger.error(`[ERROR] Failed sending to ${customer.email} via ${nextProvider}: ${err.message}. Failing over...`);
            }
        }
        
        await delay(300); // rate limiting
    }
    
    return { total: customers.length, totalSent, totalSkipped, totalFailed, providerStats };
}

module.exports = { runCampaign };
