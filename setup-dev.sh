#!/bin/bash

echo "🚀 Setting up closet.city local development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

cd ..

# Set up environment files
echo "🔧 Setting up environment files..."

if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "📝 Created backend/.env from .env.example"
    echo "⚠️  Please edit backend/.env and add your GEMINI_API_KEY"
else
    echo "✅ backend/.env already exists"
fi

if [ ! -f ".env.local" ]; then
    echo "VITE_API_BASE_URL=http://localhost:4000" > .env.local
    echo "📝 Created .env.local for frontend"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. Edit backend/.env and add your GEMINI_API_KEY"
echo "2. Open the project in VS Code:"
echo "   code closet-city.code-workspace"
echo ""
echo "3. Start development servers:"
echo "   - Backend: cd backend && node server.js"
echo "   - Frontend: npm run dev"
echo ""
echo "   Or use VS Code tasks: Ctrl+Shift+P → 'Tasks: Run Task' → 'Start Full Stack'"
echo ""
echo "📚 See README.md for more details"