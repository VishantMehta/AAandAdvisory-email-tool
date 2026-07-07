# Email Campaign Tool

A local Node.js email marketing automation tool that reads a CSV customer list and sends personalized emails using three different email providers on their free tiers (Resend, Brevo, MailerSend), rotating between them to stay within daily limits.

## Setup

1. Run `npm install`
2. Copy `.env.example` to `.env`: `cp .env.example .env`
3. Fill in the credentials in `.env`
4. Make sure you have your domains verified (SPF/DKIM/DMARC) in each provider's dashboard.

### API Keys / SMTP Credentials

- **Resend**: Dashboard > API Keys
- **Brevo**: Dashboard > SMTP & API > SMTP
- **MailerSend**: Dashboard > Domains > SMTP

*Note: Domain verification (SPF/DKIM/DMARC) must be done separately in each provider's dashboard and is NOT something this script handles.*

## Usage

### Dry Run (Recommended first step)

Run a dry run to verify logic without actually sending emails:

```bash
node send-campaign.js --template campaign-template.html --subject "Your Subject Here" --dry-run
```

### Real Campaign

Run a real campaign (will consume daily limits):

```bash
node send-campaign.js --template campaign-template.html --subject "Your Subject Here" --campaign "July-Newsletter"
```

## Data Files
- `data/customers.csv`: Place your contacts here (name, email)
- `unsubscribe-list.json`: Add emails here that should not be contacted.
