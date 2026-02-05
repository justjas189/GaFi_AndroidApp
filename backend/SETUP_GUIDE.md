# Financial Mascot Backend Setup Guide

## Overview
This Flask backend provides a financial mascot chatbot with natural language processing capabilities, user authentication, and Supabase database integration.

## Features
- 🤖 Financial mascot "MonT" with personality
- 💰 Natural language savings amount extraction ("I saved Php 50 today")
- 📊 Progress tracking and motivational responses
- 💡 Financial literacy tips
- 🔐 JWT authentication with Supabase
- 📱 CORS enabled for React Native

## Quick Setup

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and update with your Supabase credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
FLASK_SECRET_KEY=your_secret_key_here
FLASK_ENV=development
```

### 3. Database Tables Required
Ensure these tables exist in your Supabase database:

```sql
-- Savings Goals Table
CREATE TABLE savings_goals (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    goal_name VARCHAR(255) NOT NULL,
    target_amount DECIMAL(10,2) NOT NULL,
    current_amount DECIMAL(10,2) DEFAULT 0,
    target_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Savings Transactions Table
CREATE TABLE savings_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    goal_id INTEGER REFERENCES savings_goals(id),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own goals" ON savings_goals
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own transactions" ON savings_transactions
    FOR ALL USING (auth.uid() = user_id);
```

### 4. Run the Server
```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### POST /api/mascot/chat
Send natural language messages to the financial mascot.

**Request:**
```json
{
  "message": "I saved Php 50 today",
  "user_id": "user-uuid-here"
}
```

**Response:**
```json
{
  "response": "Great job! You saved ₱50.00 today! 🎉",
  "type": "savings_update",
  "savings_data": {
    "amount": 50.0,
    "currency": "Php",
    "new_total": 150.0,
    "progress": 15.0
  }
}
```

### GET /api/mascot/stats
Get user's financial statistics and progress.

**Response:**
```json
{
  "total_saved": 1500.0,
  "goals_count": 3,
  "active_goals": 2,
  "this_month_saved": 300.0,
  "goals": [...]
}
```

### GET /api/mascot/tips
Get random financial literacy tips.

**Response:**
```json
{
  "tip": {
    "title": "Emergency Fund",
    "content": "Aim to save 3-6 months of expenses for emergencies..."
  }
}
```

## Usage in React Native

The `MascotService` class in `EnhancedChatScreen.js` handles all API communication:

```javascript
// Send message to mascot
const response = await this.sendMessage(message, userId);

// Get user stats
const stats = await this.getUserStats(userId);

// Get financial tip
const tip = await this.getFinancialTip();
```

## Natural Language Processing

The mascot can extract savings amounts from various formats:
- "I saved 50 pesos today"
- "I managed to save Php 100"
- "Saved ₱25 for my emergency fund"
- "Put aside 200 php for vacation"

## Error Handling

The backend includes comprehensive error handling:
- Authentication validation
- Database connection errors
- Invalid input validation
- Graceful fallbacks for NLP failures

## Development

### Adding New Features

1. **New NLP Patterns**: Add to `savings_patterns` in `FinancialMascot` class
2. **New Tips**: Add to `financial_tips` list
3. **New Responses**: Add to response templates in mascot methods

### Testing

Test the API endpoints using curl or Postman:

```bash
# Test chat endpoint
curl -X POST http://localhost:5000/api/mascot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"message": "I saved 100 pesos", "user_id": "user-id"}'
```

## Troubleshooting

### Common Issues

1. **Supabase Connection Failed**
   - Check your SUPABASE_URL and SUPABASE_KEY in `.env`
   - Verify network connectivity

2. **Authentication Errors**
   - Ensure JWT token is valid
   - Check if user exists in Supabase auth

3. **Database Errors**
   - Verify tables exist with correct schema
   - Check RLS policies are properly configured

### Logs

The Flask app includes detailed logging. Check console output for debugging information.

## Production Deployment

For production deployment:

1. Set `FLASK_ENV=production` in environment
2. Use a production WSGI server like Gunicorn
3. Set up proper SSL certificates
4. Configure rate limiting and security headers
5. Use environment variables for sensitive data

```bash
# Production run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## Support

The mascot backend is designed to be:
- ✅ Easy to extend with new features
- ✅ Secure with proper authentication
- ✅ Scalable for multiple users
- ✅ Maintainable with clean code structure

For issues or feature requests, check the application logs and validate your Supabase configuration first.
