const nodemailer = require('nodemailer');

let transporter;

function init() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.MAILERSEND_SMTP_HOST,
            port: process.env.MAILERSEND_SMTP_PORT,
            secure: false, 
            auth: {
                user: process.env.MAILERSEND_SMTP_USER,
                pass: process.env.MAILERSEND_SMTP_PASS,
            },
        });
    }
}

async function sendViaMailerSend(to, subject, html) {
    init();
    const from = `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`;
    
    const payload = {
        from,
        to,
        subject,
        html,
    };
    if (process.env.REPLY_TO_EMAIL) {
        payload.replyTo = process.env.REPLY_TO_EMAIL;
    }
    
    const info = await transporter.sendMail(payload);
    
    return info;
}

module.exports = { sendViaMailerSend };
