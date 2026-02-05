# Financial Mascot Backend Test Script
# This script helps you test the Flask backend API endpoints

Write-Host "🤖 Financial Mascot Backend Test Script" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""

$baseUrl = "http://localhost:5000"

# Test 1: Health Check
Write-Host "1. Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET | ConvertFrom-Json
    Write-Host "✅ Status: $($health.status)" -ForegroundColor Green
    Write-Host "✅ Mode: $($health.mode)" -ForegroundColor Green
    Write-Host "✅ Database: $($health.database)" -ForegroundColor Green
    Write-Host "✅ Message: $($health.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Chat with Savings
Write-Host "2. Testing Chat with Savings..." -ForegroundColor Yellow
try {
    $chatBody = @{
        message = "I saved 100 pesos today"
        user_id = "test-user-123"
    } | ConvertTo-Json
    
    $chatResponse = Invoke-WebRequest -Uri "$baseUrl/api/mascot/chat" -Method POST -Body $chatBody -ContentType "application/json" | ConvertFrom-Json
    
    Write-Host "✅ Mascot Response:" -ForegroundColor Green
    Write-Host "   $($chatResponse.response)" -ForegroundColor Cyan
    Write-Host "✅ Amount Detected: ₱$($chatResponse.savings_data.amount)" -ForegroundColor Green
    Write-Host "✅ New Total: ₱$($chatResponse.savings_data.new_total)" -ForegroundColor Green
    Write-Host "✅ Progress: $($chatResponse.savings_data.progress)%" -ForegroundColor Green
} catch {
    Write-Host "❌ Chat test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Get Financial Tip
Write-Host "3. Testing Financial Tips..." -ForegroundColor Yellow
try {
    $tipResponse = Invoke-WebRequest -Uri "$baseUrl/api/mascot/tips" -Method GET | ConvertFrom-Json
    Write-Host "✅ Tip Title: $($tipResponse.tip.title)" -ForegroundColor Green
    Write-Host "✅ Tip Content: $($tipResponse.tip.content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Tips test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Get User Stats
Write-Host "4. Testing User Stats..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-WebRequest -Uri "$baseUrl/api/mascot/stats?user_id=test-user-123" -Method GET | ConvertFrom-Json
    Write-Host "✅ Total Saved: ₱$($statsResponse.total_saved)" -ForegroundColor Green
    Write-Host "✅ Goals Count: $($statsResponse.goals_count)" -ForegroundColor Green
    Write-Host "✅ Active Goals: $($statsResponse.active_goals)" -ForegroundColor Green
    Write-Host "✅ This Month Saved: ₱$($statsResponse.this_month_saved)" -ForegroundColor Green
} catch {
    Write-Host "❌ Stats test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: General Chat
Write-Host "5. Testing General Chat..." -ForegroundColor Yellow
try {
    $generalChatBody = @{
        message = "Give me some financial advice"
        user_id = "test-user-123"
    } | ConvertTo-Json
    
    $generalResponse = Invoke-WebRequest -Uri "$baseUrl/api/mascot/chat" -Method POST -Body $generalChatBody -ContentType "application/json" | ConvertFrom-Json
    
    Write-Host "✅ General Response:" -ForegroundColor Green
    Write-Host "   $($generalResponse.response)" -ForegroundColor Cyan
    Write-Host "✅ Response Type: $($generalResponse.type)" -ForegroundColor Green
} catch {
    Write-Host "❌ General chat test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Natural Language Examples to try:" -ForegroundColor Yellow
Write-Host "• 'I saved 50 pesos today'" -ForegroundColor Cyan
Write-Host "• 'Put aside ₱100 for my vacation'" -ForegroundColor Cyan  
Write-Host "• 'Managed to save 25 php'" -ForegroundColor Cyan
Write-Host "• 'Give me a financial tip'" -ForegroundColor Cyan
Write-Host "• 'I need some motivation'" -ForegroundColor Cyan
Write-Host ""
Write-Host "The backend is running in DEMO MODE." -ForegroundColor Yellow
Write-Host "To enable full functionality, update the .env file with your Supabase credentials." -ForegroundColor Yellow
