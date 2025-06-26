# 🚀 SmartAttend Deployment Guide

This guide provides step-by-step instructions for deploying SmartAttend on any system with Docker support.

## 📋 Prerequisites

- **Docker**: Version 20.0 or higher
- **Docker Compose**: Version 2.0 or higher
- **DeepSeek API Key**: Get from [DeepSeek Console](https://platform.deepseek.com/)
- **Minimum System Requirements**:
  - 4GB RAM
  - 2 CPU cores
  - 20GB storage space

## 🏃‍♂️ Quick Deployment (One-Click)

### 1. Clone and Deploy

```bash
# Clone the repository
git clone https://github.com/Ankish8/Smartattendance.git
cd Smartattendance

# Copy environment file
cp .env.example .env

# Edit the environment file with your DeepSeek API key
nano .env  # or use your preferred editor

# Deploy all services
docker-compose up -d

# Check deployment status
docker-compose ps
```

### 2. Access Your Application

- **Main Dashboard**: http://localhost
- **API Documentation**: http://localhost/api/info
- **Monitoring (Grafana)**: http://localhost:3001
- **Metrics (Prometheus)**: http://localhost:9090

## 🔧 Detailed Configuration

### Environment Configuration

Edit the `.env` file with your specific settings:

```bash
# Required: DeepSeek AI API Key
DEEPSEEK_API_KEY=your-deepseek-api-key-here

# Optional: Customize passwords
POSTGRES_PASSWORD=your-secure-postgres-password
REDIS_PASSWORD=your-secure-redis-password
GRAFANA_PASSWORD=your-grafana-admin-password

# Optional: Security tokens
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-jwt-refresh-secret
SESSION_SECRET=your-session-secret
```

### Docker Services

SmartAttend deploys 7 containerized services:

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80 | Load balancer & reverse proxy |
| frontend | 3003 | Next.js React application |
| backend | 3000 | Node.js API server |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |
| prometheus | 9090 | Metrics collection |
| grafana | 3001 | Analytics dashboard |

## 🌐 Production Deployment

### Cloud Deployment Options

#### AWS ECS/Fargate
```bash
# Install AWS CLI and ECS CLI
# Configure AWS credentials
ecs-cli compose --project-name smartattend service up
```

#### Google Cloud Run
```bash
# Install gcloud CLI
# Build and push to Google Container Registry
gcloud run services replace docker-compose.yml
```

#### Azure Container Instances
```bash
# Install Azure CLI
az container create --resource-group smartattend --file docker-compose.yml
```

#### DigitalOcean Droplet/App Platform
```bash
# Direct deployment to droplet
scp -r . user@your-droplet-ip:/opt/smartattend/
ssh user@your-droplet-ip "cd /opt/smartattend && docker-compose up -d"
```

### Custom Domain Setup

1. **DNS Configuration**:
   ```bash
   # Point your domain A record to your server IP
   your-domain.com -> YOUR_SERVER_IP
   ```

2. **SSL Certificate** (Let's Encrypt):
   ```bash
   # Install certbot
   sudo apt install certbot python3-certbot-nginx
   
   # Generate certificate
   sudo certbot --nginx -d your-domain.com
   
   # Update nginx configuration
   docker-compose restart nginx
   ```

3. **Update Environment**:
   ```bash
   # Add to .env file
   DOMAIN=your-domain.com
   SSL_EMAIL=admin@your-domain.com
   ```

## 🔍 Monitoring & Maintenance

### Health Checks

```bash
# Check all services
docker-compose ps

# View service logs
docker-compose logs -f [service-name]

# Health check endpoints
curl http://localhost/health          # Nginx health
curl http://localhost/health-backend  # Backend health
```

### Monitoring Access

- **Grafana Dashboard**: http://localhost:3001
  - Username: `admin`
  - Password: Set in `.env` file
  - Pre-configured dashboards for all services

- **Prometheus Metrics**: http://localhost:9090
  - Raw metrics and alerting
  - Service discovery enabled

### Backup Strategy

```bash
# Database backup
docker exec smartattend-postgres pg_dump -U postgres smartattend > backup.sql

# Redis backup
docker exec smartattend-redis redis-cli BGSAVE

# Complete system backup
docker-compose down
tar -czf smartattend-backup-$(date +%Y%m%d).tar.gz .
```

## 🛠️ Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs [service-name]

# Check disk space
df -h

# Check memory usage
free -h

# Restart specific service
docker-compose restart [service-name]
```

#### API Connection Issues
```bash
# Verify backend is running
curl http://localhost:3000/health

# Check environment variables
docker-compose exec backend env | grep DEEPSEEK

# Test AI integration
curl -X POST http://localhost:3000/api/test-ai
```

#### Database Connection Issues
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U postgres -d smartattend

# Reset database
docker-compose down postgres
docker volume rm smartattend_postgres_data
docker-compose up -d postgres
```

### Performance Tuning

#### Scaling Services
```bash
# Scale backend API
docker-compose up -d --scale backend=3

# Scale frontend
docker-compose up -d --scale frontend=2
```

#### Resource Limits
```yaml
# Add to docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 🔒 Security Hardening

### Production Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Enable SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Enable fail2ban for SSH protection
- [ ] Set up automated security updates
- [ ] Configure log rotation
- [ ] Enable audit logging
- [ ] Set up intrusion detection

### Security Configuration

```bash
# Firewall setup (Ubuntu/Debian)
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable

# Fail2ban setup
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

## 📊 Performance Metrics

### Key Performance Indicators

- **Response Time**: < 200ms average
- **Uptime**: > 99.9%
- **Memory Usage**: < 80% of available
- **CPU Usage**: < 70% average
- **Database Connections**: < 100 concurrent

### Monitoring Alerts

Grafana provides pre-configured alerts for:
- High CPU usage (>80%)
- High memory usage (>85%)
- Database connection issues
- API response time >1s
- Service downtime

## 📞 Support & Updates

### Getting Updates

```bash
# Pull latest changes
git pull origin main

# Update containers
docker-compose pull
docker-compose up -d
```

### Getting Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/Ankish8/Smartattendance/issues)
- **Documentation**: Check the `/docs` directory
- **API Reference**: Available at `/api/info` endpoint

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Deployment successful!** 🎉

Your SmartAttend system is now running with:
- ✅ DeepSeek AI integration
- ✅ Complete monitoring stack
- ✅ Production-ready configuration
- ✅ Scalable architecture
- ✅ Security hardening

Access your dashboard at: **http://localhost**