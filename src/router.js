const rateLimiter = require('./rateLimiter');

// Order of preference
const PROVIDERS = ['brevo', 'resend', 'mailersend'];

function getNextProvider() {
    for (const provider of PROVIDERS) {
        const remaining = rateLimiter.getRemainingCapacity(provider);
        if (remaining > 0) {
            return provider;
        }
    }
    return null; // All exhausted
}

module.exports = { getNextProvider };
