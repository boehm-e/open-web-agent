#!/bin/bash

set -e

echo "🧹 Open Web Agent - Cleanup Script"
echo "==================================="
echo ""

# Stop and remove all containers
echo "🛑 Stopping and removing containers..."
docker-compose down --remove-orphans 2>/dev/null || true
echo "✅ Containers stopped"

# Remove volumes (including database)
echo "🗑️  Removing volumes (including database)..."
docker-compose down -v 2>/dev/null || true
echo "✅ Volumes removed"

# Remove node_modules
if [ -d "node_modules" ]; then
    echo "🗑️  Removing node_modules..."
    rm -rf node_modules
    echo "✅ node_modules removed"
fi

# Remove .next
if [ -d ".next" ]; then
    echo "🗑️  Removing .next build cache..."
    rm -rf .next
    echo "✅ .next removed"
fi

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Run ./scripts/setup.sh to start fresh"
echo "   2. Or run: docker-compose up -d"
