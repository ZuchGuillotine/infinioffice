#!/bin/bash

# Development script for InfiniOffice
# This script runs the backend server and frontend dev server simultaneously

echo "🚀 Starting InfiniOffice Development Environment"
echo "📝 Backend server: http://localhost:3001"
echo "🌐 Frontend dev server: http://localhost:5173"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Function to handle cleanup
cleanup() {
    echo ""
    echo "🛑 Shutting down development servers..."
    kill 0  # Kill all processes in the current process group
    exit 0
}

# Set trap to call cleanup function when script is interrupted
trap cleanup SIGINT SIGTERM

# Start backend server in background
echo "🔧 Starting backend server on port 3001..."
NODE_ENV=development PORT=3001 node src/index.js &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# Start frontend dev server in background
echo "🎨 Starting frontend dev server on port 5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo "📱 To test Twilio webhooks, run in another terminal:"
echo "   npm run dev:ngrok"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID