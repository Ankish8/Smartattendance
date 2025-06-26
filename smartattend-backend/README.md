# SmartAttend Backend

AI-powered attendance tracking system backend built with Node.js, TypeScript, Express, and Prisma.

## Features

- 🤖 **AI-Powered Matching**: Intelligent student name matching using OpenAI/DeepSeek
- 🔐 **Secure Authentication**: JWT-based auth with refresh tokens and role-based access control
- 📊 **Real-time Analytics**: Live attendance statistics and reporting
- 📁 **File Processing**: Support for CSV/Excel attendance files with automatic processing
- 🚀 **High Performance**: Redis caching, rate limiting, and optimized database queries
- 📚 **API Documentation**: Comprehensive Swagger/OpenAPI documentation
- 🔍 **Comprehensive Logging**: Structured logging with Winston
- 🐳 **Docker Ready**: Production-ready containerization
- ⚡ **Real-time Updates**: WebSocket support for live attendance updates

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **AI**: OpenAI GPT-4 / DeepSeek
- **Authentication**: JWT with bcrypt
- **Validation**: Zod
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston
- **Testing**: Jest
- **Containerization**: Docker

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- OpenAI API key (or DeepSeek API key)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smartattend-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run generate
   
   # Run migrations
   npm run migrate
   
   # Seed sample data
   npm run seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## Environment Configuration

Key environment variables to configure:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/smartattend"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secrets (use strong secrets in production)
JWT_SECRET="your-super-secure-jwt-secret"
JWT_REFRESH_SECRET="your-super-secure-refresh-secret"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_PATH="./uploads"
```

## API Documentation

Once the server is running, visit:

- **Swagger UI**: `http://localhost:3000/api-docs`
- **OpenAPI JSON**: `http://localhost:3000/api-docs.json`
- **Health Check**: `http://localhost:3000/health`

## Demo Credentials

After running the seed script:

- **Admin**: `admin@smartattend.com` / `admin123!@#`
- **Teacher**: `teacher@smartattend.com` / `teacher123!@#`
- **Student**: `alice@student.com` / `student123!@#`

## Core Features

### 1. AI-Powered Attendance Matching

Upload CSV files and let AI automatically match student names:

```bash
POST /api/attendance/upload
Content-Type: multipart/form-data

file: attendance.csv
sessionId: optional-session-id
```

The AI system:
- Detects column types automatically
- Handles name variations and typos
- Provides confidence scores
- Falls back to pattern matching
- Learns from feedback

### 2. Authentication & Authorization

Role-based access control with three roles:
- **ADMIN**: Full system access
- **TEACHER**: Session and attendance management
- **STUDENT**: View own attendance records

### 3. Real-time Updates

WebSocket support for:
- Live file processing status
- Attendance updates
- Session notifications

### 4. Analytics & Reporting

Comprehensive analytics:
- Attendance rates by status
- Subject-wise statistics
- Trend analysis
- Export capabilities

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/profile` - Get profile

### Attendance
- `POST /api/attendance/upload` - Upload attendance file
- `GET /api/attendance/upload/:fileId/status` - Check processing status
- `POST /api/attendance/mark` - Mark individual attendance
- `POST /api/attendance/bulk-mark` - Mark bulk attendance
- `GET /api/attendance` - Get attendance records
- `GET /api/attendance/analytics` - Get analytics
- `POST /api/attendance/feedback` - Provide AI feedback

## File Upload Format

Supported formats: CSV, XLSX, XLS

Example CSV structure:
```csv
Student Name,Email,Student ID,Date,Status
Alice Johnson,alice@student.com,STU001,2024-01-15,Present
Bob Smith,bob@student.com,STU002,2024-01-15,Absent
Charlie Brown,charlie@student.com,STU003,2024-01-15,Present
```

The system automatically detects:
- Name columns (various formats)
- Email addresses
- Student IDs
- Date/time columns
- Status columns

## Database Schema

### Key Models

- **User**: Authentication and basic info
- **Student**: Student-specific data and enrollment
- **Session**: Class sessions and meetings
- **AttendanceRecord**: Individual attendance entries
- **FileUpload**: Uploaded files and processing status
- **ProcessedRecord**: AI processing results
- **AuditLog**: System activity tracking

### Relationships

- Users can be Students, Teachers, or Admins
- Students enroll in Sessions
- AttendanceRecords link Students to Sessions
- FileUploads generate ProcessedRecords

## Development

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run tests
npm run lint         # Lint code
npm run format       # Format code
npm run migrate      # Run database migrations
npm run seed         # Seed sample data
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Docker

```bash
# Build image
docker build -t smartattend-backend .

# Run container
docker run -p 3000:3000 smartattend-backend

# Or use development mode
docker build --target development -t smartattend-backend-dev .
docker run -p 3000:3000 -v $(pwd):/app smartattend-backend-dev
```

## Production Deployment

### Environment Setup

1. Set production environment variables
2. Use strong secrets for JWT and sessions
3. Configure HTTPS
4. Set up proper CORS origins
5. Configure email SMTP settings

### Security Considerations

- JWT secrets should be cryptographically secure
- Database credentials should be restricted
- API keys should be properly secured
- Rate limiting is configured for production loads
- All inputs are validated and sanitized

### Performance Optimization

- Redis caching for frequently accessed data
- Database query optimization with proper indexes
- File upload limits and validation
- Compression middleware enabled
- Request timeout configuration

## AI Configuration

### OpenAI Setup

1. Get API key from OpenAI
2. Set `OPENAI_API_KEY` in environment
3. Configure model and parameters:
   ```env
   OPENAI_MODEL="gpt-4"
   OPENAI_MAX_TOKENS=2000
   OPENAI_TEMPERATURE=0.1
   ```

### DeepSeek Alternative

1. Get API key from DeepSeek
2. Configure environment:
   ```env
   DEEPSEEK_API_KEY="your-key"
   DEEPSEEK_BASE_URL="https://api.deepseek.com"
   ```

### AI Parameters

- `AI_CONFIDENCE_THRESHOLD=0.7` - Minimum confidence for auto-matching
- `MAX_PROCESSING_TIME=30000` - Maximum processing time (ms)
- `ENABLE_LEARNING_FEEDBACK=true` - Enable learning from corrections

## Monitoring & Logging

### Health Checks

- Database connectivity
- Redis connectivity
- OpenAI API availability
- Memory and CPU usage

### Logging Levels

- `error`: System errors
- `warn`: Warning conditions
- `info`: General information
- `http`: HTTP requests
- `debug`: Debug information

### Metrics

Access metrics at `/health` endpoint for:
- Service status
- Performance metrics
- Resource usage
- Uptime information

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Run linting and tests
5. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

For support, please contact the development team or create an issue in the repository.