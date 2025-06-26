const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize DeepSeek client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
});

// Test DeepSeek API
app.post('/api/test-ai', async (req, res) => {
  try {
    console.log('Testing DeepSeek API...');
    
    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'DeepSeek API key not configured'
      });
    }
    
    // Test AI with a simple request
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: 'You are an AI assistant for SmartAttend, an attendance tracking system. Respond with a JSON object containing a welcome message and confirmation that you can help with attendance matching. Keep it brief.'
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    });
    
    const aiResponse = response.choices[0]?.message?.content;
    
    const testResult = {
      success: true,
      message: 'DeepSeek API test successful!',
      aiResponse: aiResponse,
      config: {
        apiKey: 'Configured ✅',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: 'deepseek-chat'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(testResult);
  } catch (error) {
    console.error('API test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response ? error.response.data : 'Unknown error'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve a simple demo page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>SmartAttend - AI Demo</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 2rem; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: white;
            }
            .container { 
                background: rgba(255,255,255,0.1); 
                padding: 2rem; 
                border-radius: 10px; 
                backdrop-filter: blur(10px);
            }
            .button { 
                background: #4CAF50; 
                color: white; 
                padding: 1rem 2rem; 
                border: none; 
                border-radius: 5px; 
                cursor: pointer; 
                font-size: 1rem;
                margin: 0.5rem;
            }
            .button:hover { background: #45a049; }
            .result { 
                margin-top: 1rem; 
                padding: 1rem; 
                background: rgba(255,255,255,0.2); 
                border-radius: 5px; 
                border-left: 4px solid #4CAF50;
            }
            .logo { 
                font-size: 2.5rem; 
                font-weight: bold; 
                text-align: center; 
                margin-bottom: 2rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🎓 SmartAttend AI Demo</div>
            <h2>DeepSeek AI Integration Test</h2>
            <p>Click the button below to test the DeepSeek API integration:</p>
            
            <button class="button" onclick="testAI()">Test DeepSeek AI</button>
            <button class="button" onclick="checkStatus()">Check System Status</button>
            
            <div id="result"></div>
            
            <h3>System Information</h3>
            <ul>
                <li><strong>API Endpoint:</strong> /api/test-ai</li>
                <li><strong>DeepSeek Base URL:</strong> https://api.deepseek.com</li>
                <li><strong>Model:</strong> deepseek-chat</li>
                <li><strong>Status:</strong> <span style="color: #4CAF50;">Operational</span></li>
            </ul>
        </div>
        
        <script>
            async function testAI() {
                const resultDiv = document.getElementById('result');
                resultDiv.innerHTML = '<p>Testing AI API...</p>';
                
                try {
                    const response = await fetch('/api/test-ai', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ test: true })
                    });
                    
                    const data = await response.json();
                    resultDiv.innerHTML = \`
                        <div class="result">
                            <h4>API Test Result:</h4>
                            <pre>\${JSON.stringify(data, null, 2)}</pre>
                        </div>
                    \`;
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="result" style="border-left-color: #f44336;">
                            <h4>Error:</h4>
                            <p>\${error.message}</p>
                        </div>
                    \`;
                }
            }
            
            async function checkStatus() {
                const resultDiv = document.getElementById('result');
                resultDiv.innerHTML = '<p>Checking system status...</p>';
                
                try {
                    const response = await fetch('/health');
                    const data = await response.json();
                    resultDiv.innerHTML = \`
                        <div class="result">
                            <h4>System Status:</h4>
                            <p>✅ System is healthy</p>
                            <p>Timestamp: \${data.timestamp}</p>
                        </div>
                    \`;
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="result" style="border-left-color: #f44336;">
                            <h4>Error:</h4>
                            <p>❌ System check failed: \${error.message}</p>
                        </div>
                    \`;
                }
            }
        </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`🚀 SmartAttend AI Demo running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🤖 AI API: http://localhost:${port}/api/test-ai`);
});