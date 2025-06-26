# 🎓 SmartAttend - AI-Powered Attendance Tracking System

SmartAttend is a comprehensive AI-powered attendance tracking system that leverages DeepSeek AI for intelligent student name matching and provides real-time analytics and reporting.

## 🚀 Features

- **AI-Powered Name Matching**: Uses DeepSeek AI for intelligent student name matching with high confidence scores
- **Real-time Processing**: Fast CSV file processing and attendance tracking
- **Modern UI**: Beautiful responsive dashboard with real-time status indicators
- **Comprehensive Analytics**: Built-in monitoring with Prometheus and Grafana
- **Docker Deployment**: Complete containerized deployment with Docker Compose
- **Secure**: JWT authentication, rate limiting, and security headers
- **Scalable**: Microservices architecture with load balancing

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (Next.js)     │◄──►│   (Node.js)     │◄──►│  (PostgreSQL)   │
│   Port: 3003    │    │   Port: 3000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │  DeepSeek AI    │    │     Redis       │
│  Load Balancer  │    │   Integration   │    │     Cache       │
│   Port: 80      │    │                 │    │   Port: 6379    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲
         │
┌─────────────────┐    ┌─────────────────┐
│   Prometheus    │    │    Grafana      │
│   Monitoring    │    │   Analytics     │
│   Port: 9090    │    │   Port: 3001    │
└─────────────────┘    └─────────────────┘
```

## 🛠️ Quick Start

### Prerequisites

- Docker and Docker Compose
- DeepSeek API Key

### 1. Clone the Repository

```bash
git clone https://github.com/Ankish8/Smartattendance.git
cd Smartattendance
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your DeepSeek API key
```

### 3. Deploy with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Access the Application

- **Frontend Dashboard**: http://localhost
- **Backend API**: http://localhost/api
- **Grafana Analytics**: http://localhost:3001 (admin/[GRAFANA_PASSWORD])
- **Prometheus Monitoring**: http://localhost:9090

## 📋 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek AI API Key | Required |
| `POSTGRES_PASSWORD` | PostgreSQL password | smartattend_secure_password_2024 |
| `REDIS_PASSWORD` | Redis password | smartattend_redis_password_2024 |
| `JWT_SECRET` | JWT secret key | Generated |
| `GRAFANA_PASSWORD` | Grafana admin password | smartattend_grafana_admin_2024 |

## 🔧 Development

### Backend Development

```bash
cd smartattend-backend
npm install
npm run dev
```

### Frontend Development

```bash
cd smartattend-frontend
npm install
npm run dev
```

## 📊 API Endpoints

### Health Check
- `GET /health` - Service health status

### Information
- `GET /api/info` - API information and features

### AI Testing
- `POST /api/test-ai` - Test DeepSeek AI integration

### Attendance Processing
- `POST /api/process-attendance` - Process attendance CSV files

## 🐳 Docker Commands

```bash
# Build and start all services
docker-compose up --build -d

# Stop all services
docker-compose down

# Remove all data (⚠️ Destructive)
docker-compose down -v

# View service logs
docker-compose logs [service-name]

# Scale services
docker-compose up -d --scale backend=3

# Update services
docker-compose pull && docker-compose up -d
```

## 📈 Monitoring

SmartAttend includes comprehensive monitoring:

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Beautiful dashboards and analytics
- **Health Checks**: Automated service health monitoring
- **Log Aggregation**: Centralized logging

Access Grafana at http://localhost:3001 with:
- Username: `admin`
- Password: Set in `.env` file

## 🔒 Security Features

- JWT authentication with refresh tokens
- Rate limiting (API: 10 req/s, General: 100 req/s)
- Security headers (XSS, CSRF protection)
- Input validation and sanitization
- Secure password hashing with bcrypt
- SSL/TLS ready configuration

## 🚀 Production Deployment

### Cloud Deployment

1. **AWS/GCP/Azure**: Use Docker Compose with cloud container services
2. **Kubernetes**: Deployment manifests available in `/k8s` directory
3. **VPS/Dedicated Server**: Direct Docker Compose deployment

### SSL Configuration

1. Update `nginx/nginx.conf` with SSL configuration
2. Add SSL certificates to `ssl/` directory
3. Update `docker-compose.yml` environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Ankish8/Smartattendance/issues)
- **Documentation**: Check the `/docs` directory
- **API Docs**: Available at `/api/docs` when running

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **DeepSeek AI**: For powerful AI capabilities
- **Next.js**: For the amazing React framework
- **Docker**: For containerization made easy
- **Prometheus & Grafana**: For monitoring excellence

---

Made with ❤️ by the SmartAttend Team