const { Resend } = require('resend');

let resend;

function init() {
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
}

async function sendViaResend(to, subject, html) {
    init();
    const from = `${process.env.SENDER_NAME} <${process.env.SENDER_EMAIL}>`;
    
    const payload = {
        from,
        to,
        subject,
        html,
    };
    if (process.env.REPLY_TO_EMAIL) {
        payload.reply_to = process.env.REPLY_TO_EMAIL;
    }
    
    // The resend SDK throws on failure or returns an error object if there's an issue.
    const { data, error } = await resend.emails.send(payload);
    
    if (error) {
        throw new Error(`Resend Error: ${error.message}`);
    }
    
    return data;
}

module.exports = { sendViaResend };
