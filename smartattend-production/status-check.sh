#!/bin/bash

# SmartAttend Deployment Status Check
echo "🔍 SmartAttend Deployment Status Check"
echo "========================================"

# Check Docker containers
echo ""
echo "📦 Docker Containers:"
echo "---------------------"
if command -v docker >/dev/null 2>&1; then
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep smartattend; then
        echo "✅ SmartAttend containers are running"
    else
        echo "❌ No SmartAttend containers found running"
        echo ""
        echo "🔍 All containers:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    fi
else
    echo "❌ Docker not found"
fi

# Check application availability
echo ""
echo "🌐 Application Availability:"
echo "----------------------------"

# Test local endpoints
endpoints=(
    "http://localhost/health"
    "http://localhost:3000/health"
    "http://localhost"
)

for endpoint in "${endpoints[@]}"; do
    if curl -s --max-time 5 "$endpoint" >/dev/null 2>&1; then
        echo "✅ $endpoint - Available"
    else
        echo "❌ $endpoint - Not available"
    fi
done

# Check ports
echo ""
echo "🔌 Port Status:"
echo "---------------"
ports=(80 443 3000 5432 6379 9090 3001)

for port in "${ports[@]}"; do
    if lsof -i :$port >/dev/null 2>&1; then
        echo "✅ Port $port - In use"
    else
        echo "❌ Port $port - Available"
    fi
done

# Check log files
echo ""
echo "📋 Recent Logs:"
echo "---------------"
if [[ -f "logs/deployment.log" ]]; then
    echo "Last 5 lines from deployment.log:"
    tail -5 logs/deployment.log
else
    echo "❌ No deployment log found"
fi

# Check environment
echo ""
echo "⚙️  Environment Check:"
echo "---------------------"
if [[ -f ".env" ]]; then
    echo "✅ Environment file exists"
    
    # Check critical variables
    if grep -q "DEEPSEEK_API_KEY=sk-" .env; then
        echo "✅ DeepSeek API key configured"
    else
        echo "❌ DeepSeek API key missing"
    fi
    
    if grep -q "OPENAI_API_KEY=sk-" .env; then
        echo "✅ OpenAI API key configured"
    elif grep -q "OPENAI_API_KEY=demo-key" .env; then
        echo "⚠️  OpenAI API key is demo key (update for production)"
    else
        echo "❌ OpenAI API key missing"
    fi
else
    echo "❌ Environment file missing"
fi

# Summary
echo ""
echo "📊 Quick Summary:"
echo "=================="
echo "1. Check if Docker containers are running: docker ps"
echo "2. View deployment logs: tail -f logs/deployment.log"
echo "3. Restart deployment if needed: ./deploy.sh"
echo "4. Check application: http://localhost"
echo ""
echo "If containers aren't running, the deployment may have failed."
echo "Check the deployment logs and run './deploy.sh' again."