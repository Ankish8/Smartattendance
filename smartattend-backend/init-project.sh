#!/bin/bash

# SmartAttend Backend Initialization Script
# This script sets up the complete development environment

set -e

echo "🚀 Initializing SmartAttend Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18 or higher. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

print_success "npm $(npm -v) detected"

# Install dependencies
print_status "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    print_warning "Please update the .env file with your configuration:"
    print_warning "- DATABASE_URL: PostgreSQL connection string"
    print_warning "- REDIS_URL: Redis connection string"
    print_warning "- OPENAI_API_KEY: Your OpenAI API key"
    print_warning "- JWT secrets: Use strong random strings"
else
    print_success ".env file already exists"
fi

# Check if PostgreSQL is running
print_status "Checking PostgreSQL connection..."
if command -v psql &> /dev/null; then
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        print_success "PostgreSQL is running"
    else
        print_warning "PostgreSQL is not running. Please start PostgreSQL or use Docker:"
        echo "  docker-compose up postgres -d"
    fi
else
    print_warning "PostgreSQL client not found. Install it or use Docker:"
    echo "  docker-compose up postgres -d"
fi

# Check if Redis is running
print_status "Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        print_success "Redis is running"
    else
        print_warning "Redis is not running. Please start Redis or use Docker:"
        echo "  docker-compose up redis -d"
    fi
else
    print_warning "Redis client not found. Install it or use Docker:"
    echo "  docker-compose up redis -d"
fi

# Generate Prisma client
print_status "Generating Prisma client..."
npm run generate

if [ $? -eq 0 ]; then
    print_success "Prisma client generated successfully"
else
    print_warning "Failed to generate Prisma client. Make sure DATABASE_URL is set correctly."
fi

# Build the project
print_status "Building the project..."
npm run build

if [ $? -eq 0 ]; then
    print_success "Project built successfully"
else
    print_warning "Build failed. Check TypeScript errors above."
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p uploads logs

print_success "Project initialization completed!"

echo ""
echo "🎉 SmartAttend Backend is ready for development!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with the correct configuration"
echo "2. Start your databases:"
echo "   - PostgreSQL: docker-compose up postgres -d"
echo "   - Redis: docker-compose up redis -d"
echo "3. Run database migrations: npm run migrate"
echo "4. Seed sample data: npm run seed"
echo "5. Start development server: npm run dev"
echo ""
echo "API will be available at: http://localhost:3000"
echo "API Documentation: http://localhost:3000/api-docs"
echo "Health Check: http://localhost:3000/health"
echo ""
echo "Demo credentials (after seeding):"
echo "- Admin: admin@smartattend.com / admin123!@#"
echo "- Teacher: teacher@smartattend.com / teacher123!@#"
echo "- Student: alice@student.com / student123!@#"
echo ""
echo "Happy coding! 🚀"