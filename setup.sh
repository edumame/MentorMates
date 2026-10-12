#!/bin/bash

# MentorMates Development Setup Script

set -e

echo "🚀 Setting up MentorMates development environment..."

# Install dependencies
echo "📦 Installing npm dependencies..."
npm i

# Copy environment file (update source path as needed)
ENV_SOURCE="${ENV_SOURCE:-../MentorMates/.env.local}"
if [ -f "$ENV_SOURCE" ]; then
    echo "📋 Copying .env.local from $ENV_SOURCE..."
    cp "$ENV_SOURCE" .env.local
else
    echo "⚠️  No .env file found at $ENV_SOURCE"
    echo "   Set ENV_SOURCE environment variable or copy .env.local manually"
fi

# Start development server
echo "🔥 Starting development server..."
npm run dev
