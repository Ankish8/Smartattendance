#!/bin/bash

# SmartAttend Production Deployment Script
# This script deploys SmartAttend to production environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deployment.log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    mkdir -p logs backups monitoring nginx scripts
    mkdir -p nginx/ssl
    success "Directories created successfully"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file $ENV_FILE not found"
        exit 1
    fi
    
    success "All prerequisites met"
}

# Validate environment variables
validate_environment() {
    log "Validating environment variables..."
    
    # Source environment file
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check required variables
    required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
        "SESSION_SECRET"
        "OPENAI_API_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    success "Environment variables validated"
}

# Generate SSL certificates
generate_ssl() {
    log "Generating SSL certificates..."
    
    if [[ ! -f "nginx/ssl/smartattend.crt" ]] || [[ ! -f "nginx/ssl/smartattend.key" ]]; then
        warning "SSL certificates not found, generating self-signed certificates..."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/smartattend.key \
            -out nginx/ssl/smartattend.crt \
            -subj "/C=US/ST=State/L=City/O=SmartAttend/CN=smartattend.com"
        
        success "Self-signed SSL certificates generated"
    else
        log "SSL certificates already exist"
    fi
}

# Create database backup
backup_database() {
    log "Creating database backup..."
    
    if docker ps | grep -q smartattend-postgres-prod; then
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file="$BACKUP_DIR/backup_$timestamp.sql"
        
        docker exec smartattend-postgres-prod pg_dump \
            -U "${POSTGRES_USER:-smartattend_user}" \
            -d "${POSTGRES_DB:-smartattend_prod}" > "$backup_file"
        
        success "Database backup created: $backup_file"
    else
        warning "Database container not running, skipping backup"
    fi
}

# Deploy application
deploy() {
    log "Starting deployment..."
    
    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" pull
    
    # Build custom images
    log "Building application images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    
    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans
    
    # Start services
    log "Starting services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_health
    
    success "Deployment completed successfully"
}

# Check service health
check_health() {
    log "Checking service health..."
    
    # Check database
    if docker exec smartattend-postgres-prod pg_isready -U "${POSTGRES_USER:-smartattend_user}" > /dev/null; then
        success "Database is healthy"
    else
        error "Database health check failed"
        exit 1
    fi
    
    # Check Redis
    if docker exec smartattend-redis-prod redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping | grep -q PONG; then
        success "Redis is healthy"
    else
        error "Redis health check failed"
        exit 1
    fi
    
    # Check backend API
    sleep 10
    if curl -f http://localhost/api/health > /dev/null 2>&1; then
        success "Backend API is healthy"
    else
        error "Backend API health check failed"
        exit 1
    fi
    
    # Check frontend
    if curl -f http://localhost > /dev/null 2>&1; then
        success "Frontend is healthy"
    else
        error "Frontend health check failed"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    docker exec smartattend-backend-prod npm run migrate
    
    success "Database migrations completed"
}

# Seed initial data
seed_data() {
    log "Seeding initial data..."
    
    docker exec smartattend-backend-prod npm run seed
    
    success "Initial data seeded"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    echo "Services:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    echo ""
    echo "Application URLs:"
    echo "  Frontend: https://localhost"
    echo "  API: https://localhost/api"
    echo "  API Docs: https://localhost/api-docs"
    echo "  Health Check: https://localhost/health"
    echo "  Monitoring: http://localhost:3001 (admin/$(echo $GRAFANA_PASSWORD))"
    echo ""
    echo "Logs:"
    echo "  View logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
    echo "  Backend logs: docker logs smartattend-backend-prod -f"
    echo "  Frontend logs: docker logs smartattend-frontend-prod -f"
    echo ""
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    
    # Remove unused Docker images
    docker image prune -f
    
    # Remove old log files
    find logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Remove old backup files
    find backups -name "*.sql" -mtime +30 -delete 2>/dev/null || true
    
    success "Cleanup completed"
}

# Main deployment function
main() {
    log "=== SmartAttend Production Deployment Started ==="
    
    create_directories
    check_prerequisites
    validate_environment
    generate_ssl
    
    # Create backup if database exists
    backup_database
    
    # Deploy application
    deploy
    
    # Run migrations and seed data
    run_migrations
    seed_data
    
    # Show status
    show_status
    
    # Cleanup
    cleanup
    
    success "=== SmartAttend Production Deployment Completed ==="
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "status")
        docker-compose -f "$DOCKER_COMPOSE_FILE" ps
        ;;
    "logs")
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f
        ;;
    "stop")
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
        ;;
    "restart")
        docker-compose -f "$DOCKER_COMPOSE_FILE" restart
        ;;
    "backup")
        backup_database
        ;;
    "health")
        check_health
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|status|logs|stop|restart|backup|health|cleanup}"
        exit 1
        ;;
esac