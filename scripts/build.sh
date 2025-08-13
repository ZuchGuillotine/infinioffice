#!/bin/bash

# Production build script for InfiniOffice

echo "🏗️  Building InfiniOffice for Production"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install backend dependencies (need dev deps for build)
echo "📦 Installing backend dependencies..."
npm ci

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend && npm ci && cd ..

# Build frontend
echo "🎨 Building frontend..."
npm run build:frontend

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
npx prisma generate

echo ""
echo "✅ Production build complete!"
echo "🚀 Ready for deployment"
echo ""
echo "📁 Built assets located in:"
echo "   - Frontend: frontend/dist/"
echo "   - Backend: src/"
echo ""
echo "🐳 To build Docker image:"
echo "   docker build -t infinioffice ."
echo ""
echo "📱 To start production server:"
echo "   npm start"