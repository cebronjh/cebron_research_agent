#!/bin/bash

# Cebron M&A Agent - Quick Deploy Script
# Run this in your local repository to set up everything

echo "🚀 Cebron M&A Discovery Agent - Quick Setup"
echo "=========================================="
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    echo "Please run this script from your repository root"
    exit 1
fi

echo "✓ Git repository detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install @anthropic-ai/sdk exa-js node-cron

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Add your API keys here
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
EXA_API_KEY=exa_your-key-here
APOLLO_API_KEY=your-apollo-key-here
DATABASE_URL=postgresql://user:pass@localhost:5432/cebron

# Optional
NODE_ENV=development
TZ=America/Chicago
ADMIN_EMAIL=your@email.com
EOF
    echo "✓ Created .env file - PLEASE EDIT IT WITH YOUR ACTUAL API KEYS!"
else
    echo "✓ .env file already exists"
fi
echo ""

# Create directories if they don't exist
echo "📁 Creating directory structure..."
mkdir -p server
mkdir -p client/src/components
mkdir -p client/src/pages
mkdir -p drizzle
echo "✓ Directories ready"
echo ""

# Run database migration
echo "🗄️  Running database migration..."
npm run db:push

if [ $? -eq 0 ]; then
    echo "✓ Database tables created"
else
    echo "⚠️  Database migration failed - you may need to run this manually"
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your actual API keys"
echo "2. Copy the agent code files into:"
echo "   - server/agent-orchestrator.ts"
echo "   - server/apollo-enrichment.ts"
echo "   - server/uspto-patents.ts"
echo "   - server/scheduler.ts"
echo "   - client/src/components/agent-dashboard.tsx"
echo "   - client/src/components/research-library.tsx"
echo "   - client/src/pages/agent.tsx"
echo "   - client/src/pages/library.tsx"
echo "3. Update your existing files (see DEPLOYMENT_INSTRUCTIONS.md)"
echo "4. Test locally: npm run dev"
echo "5. Commit and push: git push"
echo ""
echo "Railway will auto-deploy when you push!"
