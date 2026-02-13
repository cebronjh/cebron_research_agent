[README.md](https://github.com/user-attachments/files/25301009/README.md)
# Cebron M&A Discovery Agent

AI-powered research and lead generation engine for lower-middle market M&A opportunities.

## 🎯 What It Does

Automatically discovers, researches, and qualifies M&A targets ($20M-$100M revenue companies):

- **Discovers** 60-75 companies per week using AI-powered search
- **Researches** each company with comprehensive 11-section analysis
- **Enriches** contacts with verified emails and phone numbers
- **Generates** personalized outreach messaging
- **Searches** patent databases, business records, and government data

## 🚀 Features

### Automated Discovery
- Runs Sunday, Tuesday, Thursday at 7:00 PM
- Discovers 35 companies per run using Exa AI
- Scores each company 1-10 with Claude
- Auto-approves high-confidence matches
- You review edge cases (5 min, 3x/week)

### Deep Research
- 11-section investment banking-grade reports
- Strategic assessment (buy-side vs sell-side recommendation)
- Financial intelligence & valuation analysis
- Patent & IP intelligence (USPTO integration)
- Decision-maker identification
- Competitive landscape mapping
- Risk factors & diligence priorities

## 💰 Cost

**Monthly (for 300 companies):**
- Anthropic API: ~$100/month
- Exa API: ~$10/month
- Apollo: $0 (uses existing subscription)
- Railway hosting: ~$20/month
- **Total: ~$130/month**

## 🔑 Required API Keys

1. **Anthropic** - Get at console.anthropic.com
2. **Exa** - Get at exa.ai
3. **Apollo** - Get at app.apollo.io/settings/api

## 🚀 Quick Start

See `DEPLOYMENT_INSTRUCTIONS.md` for complete setup guide.

```bash
npm install
npm run db:push
npm run dev
```

## 📁 Project Structure

```
├── server/              # Backend
├── client/              # Frontend
├── drizzle/             # Database schema
└── package.json
```

## 📝 License

MIT
