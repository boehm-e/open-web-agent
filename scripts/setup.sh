#!/bin/bash

set -e

echo "🚀 Open Web Agent - Setup Script"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  Please edit .env file and add your GitHub OAuth credentials:"
    echo "   - GITHUB_ID"
    echo "   - GITHUB_SECRET"
    echo "   - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)"
    echo ""
    read -p "Press Enter when you've updated the .env file..."
else
    echo "✅ .env file already exists"
fi

echo ""

# Set permissions for Traefik acme.json
echo "🔒 Setting permissions for Traefik SSL certificates..."
mkdir -p traefik
touch traefik/acme.json
chmod 600 traefik/acme.json
echo "✅ Traefik permissions set"
echo ""

# Pull Docker images
echo "📦 Pulling Docker images..."
docker-compose pull
echo "✅ Docker images pulled"
echo ""

# Start infrastructure services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres docker-socket-proxy traefik
echo "✅ Infrastructure services started"
echo ""

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres -q 2>/dev/null; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    sleep 2
done
echo ""

# Build and start the web application
echo "🔨 Building web application..."
docker-compose build --no-cache web
echo "✅ Web application built"
echo ""

# Start the web application
echo "🌐 Starting web application..."
docker-compose up -d web
echo "✅ Web application started"
echo ""

# Wait for web to be ready
echo "⏳ Waiting for web container to be ready..."
sleep 10
echo ""

# Push database schema inside the web container
# Use the local prisma package (version 5.22.0) to avoid Prisma 7 issues
echo "📊 Setting up database schema..."
docker-compose exec -T -e HOME=/home/nextjs web npx --package=prisma@5.22.0 prisma db push --accept-data-loss
echo "✅ Database schema created"
echo ""

echo "✨ Setup complete!"
echo ""
echo "🎉 Your application is now running at:"
echo "   - Application: http://localhost:3000"
echo "   - Traefik Dashboard: http://localhost:8080"
echo ""
echo "📝 Next steps:"
echo "   1. Make sure you've configured your GitHub OAuth app"
echo "   2. Visit http://localhost:3000 and sign in with GitHub"
echo "   3. Create your first workspace!"
echo ""
echo "📚 For more information, see README.md"
