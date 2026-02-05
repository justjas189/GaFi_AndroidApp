"""
Financial Mascot Backend - Flask API with Supabase Integration
A friendly financial advisor mascot that guides users through savings goals,
provides financial literacy tips, and offers motivational feedback.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
from datetime import datetime, timedelta
import logging
from supabase import create_client, Client
import jwt
from functools import wraps
import random

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', 'your-supabase-url')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY', 'your-supabase-service-key')
SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET', 'your-jwt-secret')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class FinancialMascot:
    """Friendly financial advisor mascot with personality and intelligence"""
    
    def __init__(self):
        self.name = "MonT"
        self.personality_traits = [
            "encouraging", "knowledgeable", "friendly", "motivational"
        ]
        
        # Financial literacy tips database
        self.literacy_tips = {
            "savings": [
                "💡 Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings!",
                "🎯 Saving ₱50 daily = ₱18,250 yearly! Small steps, big results!",
                "📈 Automate your savings - pay yourself first before any expenses!",
                "🏦 Emergency fund goal: 3-6 months of living expenses!",
                "💰 Every peso saved today is a peso earning for your future!"
            ],
            "budgeting": [
                "📊 Track every expense for a week to understand spending patterns!",
                "🎯 Set realistic budget limits - being too strict leads to failure!",
                "📱 Use the envelope method: allocate money for each category!",
                "💡 Review and adjust your budget monthly based on actual spending!",
                "🔄 Budget isn't restriction - it's permission to spend guilt-free!"
            ],
            "goals": [
                "🎯 SMART goals: Specific, Measurable, Achievable, Relevant, Time-bound!",
                "📈 Break big goals into smaller milestones for motivation!",
                "🏆 Celebrate small wins - every ₱100 saved is progress!",
                "📅 Set both short-term (1 month) and long-term (1 year) goals!",
                "💪 Visualize your goal - imagine how achieving it will feel!"
            ]
        }
        
        # Motivational responses
        self.motivational_phrases = [
            "Amazing job! 🎉",
            "You're crushing it! 💪",
            "Keep up the great work! ⭐",
            "I'm so proud of you! 🏆",
            "You're building wealth step by step! 📈",
            "Financial freedom is getting closer! 🎯"
        ]
        
        # Savings amount patterns for natural language processing
        self.savings_patterns = [
            r"(?:saved|saving|put away|set aside)\s+(?:php\s*|₱\s*)?(\d+(?:\.\d{2})?)",
            r"(?:php\s*|₱\s*)?(\d+(?:\.\d{2})?)\s*(?:saved|saving|today|yesterday)",
            r"i\s+(?:saved|put away|set aside)\s+(?:php\s*|₱\s*)?(\d+(?:\.\d{2})?)",
            r"added\s+(?:php\s*|₱\s*)?(\d+(?:\.\d{2})?)\s*to.*savings"
        ]

    def extract_savings_amount(self, message: str) -> float:
        """Extract savings amount from user message using NLP patterns"""
        message_lower = message.lower().strip()
        
        for pattern in self.savings_patterns:
            match = re.search(pattern, message_lower)
            if match:
                try:
                    amount = float(match.group(1))
                    return amount
                except (ValueError, IndexError):
                    continue
        
        return 0.0

    def generate_savings_response(self, amount: float, total_saved: float, goal_amount: float) -> dict:
        """Generate personalized response for savings input"""
        progress_percent = (total_saved / goal_amount * 100) if goal_amount > 0 else 0
        
        # Choose motivational phrase
        motivation = random.choice(self.motivational_phrases)
        
        # Generate contextual message
        if progress_percent >= 100:
            message = f"{motivation} You've reached your savings goal! 🎉 Total saved: ₱{total_saved:,.2f}"
            tip = random.choice(self.literacy_tips["goals"])
        elif progress_percent >= 75:
            message = f"{motivation} You're so close! Only ₱{goal_amount - total_saved:,.2f} left to reach your goal!"
            tip = "🔥 You're in the final stretch - keep that momentum going!"
        elif progress_percent >= 50:
            message = f"{motivation} Halfway there! You've saved ₱{amount:,.2f} today. Total: ₱{total_saved:,.2f}"
            tip = random.choice(self.literacy_tips["savings"])
        elif progress_percent >= 25:
            message = f"{motivation} Great progress! ₱{amount:,.2f} added today brings you to ₱{total_saved:,.2f}"
            tip = random.choice(self.literacy_tips["budgeting"])
        else:
            message = f"{motivation} Every journey starts with a single step! ₱{amount:,.2f} saved today."
            tip = random.choice(self.literacy_tips["savings"])
        
        return {
            "message": message,
            "tip": tip,
            "progress": round(progress_percent, 1),
            "amount_added": amount,
            "total_saved": total_saved,
            "goal_amount": goal_amount
        }

    def generate_general_response(self, message: str) -> dict:
        """Generate response for general financial queries"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["budget", "budgeting", "expense"]):
            tip = random.choice(self.literacy_tips["budgeting"])
            response = f"Great question about budgeting! {tip}"
        elif any(word in message_lower for word in ["save", "saving", "savings"]):
            tip = random.choice(self.literacy_tips["savings"])
            response = f"I love talking about savings! {tip}"
        elif any(word in message_lower for word in ["goal", "goals", "target"]):
            tip = random.choice(self.literacy_tips["goals"])
            response = f"Goals are so important! {tip}"
        else:
            response = "I'm here to help with your financial journey! Ask me about savings, budgeting, or setting goals! 💰"
            tip = random.choice(self.literacy_tips["savings"])
        
        return {
            "message": response,
            "tip": tip
        }

# Initialize mascot
mascot = FinancialMascot()

def authenticate_user(f):
    """Decorator to authenticate user via Supabase JWT token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            # Decode JWT token
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=['HS256'])
            user_id = payload.get('sub')
            
            if not user_id:
                return jsonify({'error': 'Invalid token'}), 401
            
            # Add user_id to request context
            request.user_id = user_id
            return f(*args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
    
    return decorated_function

@app.route('/api/mascot/chat', methods=['POST'])
@authenticate_user
def chat_with_mascot():
    """Main endpoint for chatting with the financial mascot"""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()
        user_id = request.user_id
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        logger.info(f"User {user_id} sent message: {message}")
        
        # Extract savings amount from message
        savings_amount = mascot.extract_savings_amount(message)
        
        if savings_amount > 0:
            # Handle savings input
            response_data = handle_savings_input(user_id, savings_amount, message)
        else:
            # Handle general conversation
            response_data = mascot.generate_general_response(message)
            response_data['type'] = 'general'
        
        # Add mascot personality
        response_data['mascot_name'] = mascot.name
        response_data['timestamp'] = datetime.utcnow().isoformat()
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in chat_with_mascot: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

def handle_savings_input(user_id: str, amount: float, original_message: str) -> dict:
    """Process savings input and update database"""
    try:
        # Get user's active savings goal
        goal_response = supabase.table('savings_goals').select('*').eq('user_id', user_id).eq('status', 'active').execute()
        
        if not goal_response.data:
            # Create default savings goal if none exists
            default_goal = {
                'user_id': user_id,
                'goal_name': 'My Savings Goal',
                'target_amount': 10000.0,  # Default ₱10,000 goal
                'current_amount': 0.0,
                'status': 'active',
                'created_at': datetime.utcnow().isoformat(),
                'target_date': (datetime.utcnow() + timedelta(days=365)).isoformat()
            }
            
            supabase.table('savings_goals').insert(default_goal).execute()
            current_goal = default_goal
        else:
            current_goal = goal_response.data[0]
        
        # Update savings goal with new amount
        new_total = float(current_goal['current_amount']) + amount
        
        update_response = supabase.table('savings_goals').update({
            'current_amount': new_total,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('user_id', user_id).eq('id', current_goal['id']).execute()
        
        if update_response.data:
            logger.info(f"Updated savings for user {user_id}: +₱{amount}, total: ₱{new_total}")
            
            # Record savings transaction
            transaction = {
                'user_id': user_id,
                'amount': amount,
                'transaction_type': 'savings',
                'description': f"Savings added via mascot: {original_message[:100]}",
                'transaction_date': datetime.utcnow().isoformat(),
                'category': 'savings'
            }
            
            supabase.table('savings_transactions').insert(transaction).execute()
            
            # Generate motivational response
            response_data = mascot.generate_savings_response(
                amount, 
                new_total, 
                float(current_goal['target_amount'])
            )
            response_data['type'] = 'savings_update'
            response_data['goal_name'] = current_goal['goal_name']
            
            return response_data
        else:
            raise Exception("Failed to update savings goal")
            
    except Exception as e:
        logger.error(f"Error handling savings input: {str(e)}")
        return {
            'message': f"I couldn't save your ₱{amount:,.2f} right now, but I appreciate your effort! Please try again.",
            'tip': "💡 Keep tracking your savings manually until we fix this!",
            'type': 'error'
        }

@app.route('/api/mascot/goals', methods=['GET'])
@authenticate_user
def get_user_goals():
    """Get user's savings goals with progress"""
    try:
        user_id = request.user_id
        
        # Get all user's savings goals
        response = supabase.table('savings_goals').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        
        goals = []
        for goal in response.data:
            progress = (float(goal['current_amount']) / float(goal['target_amount']) * 100) if goal['target_amount'] > 0 else 0
            
            goal_data = {
                'id': goal['id'],
                'goal_name': goal['goal_name'],
                'target_amount': float(goal['target_amount']),
                'current_amount': float(goal['current_amount']),
                'progress_percent': round(progress, 1),
                'status': goal['status'],
                'target_date': goal['target_date'],
                'created_at': goal['created_at']
            }
            goals.append(goal_data)
        
        return jsonify({
            'goals': goals,
            'total_goals': len(goals),
            'active_goals': len([g for g in goals if g['status'] == 'active'])
        })
        
    except Exception as e:
        logger.error(f"Error getting user goals: {str(e)}")
        return jsonify({'error': 'Failed to fetch goals'}), 500

@app.route('/api/mascot/tips', methods=['GET'])
@authenticate_user
def get_daily_tips():
    """Get daily financial literacy tips"""
    try:
        user_id = request.user_id
        tip_category = request.args.get('category', 'savings')
        
        if tip_category not in mascot.literacy_tips:
            tip_category = 'savings'
        
        # Get user's savings progress for personalized tips
        goal_response = supabase.table('savings_goals').select('*').eq('user_id', user_id).eq('status', 'active').execute()
        
        tips = mascot.literacy_tips[tip_category]
        daily_tip = random.choice(tips)
        
        response_data = {
            'tip': daily_tip,
            'category': tip_category,
            'mascot_message': f"Hi! It's {mascot.name} with your daily financial tip! 🌟",
            'available_categories': list(mascot.literacy_tips.keys())
        }
        
        # Add personalized message if user has active goals
        if goal_response.data:
            goal = goal_response.data[0]
            progress = (float(goal['current_amount']) / float(goal['target_amount']) * 100) if goal['target_amount'] > 0 else 0
            
            if progress > 0:
                response_data['personal_message'] = f"You're {progress:.1f}% towards your goal '{goal['goal_name']}'! Keep it up! 💪"
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error getting daily tips: {str(e)}")
        return jsonify({'error': 'Failed to fetch tips'}), 500

@app.route('/api/mascot/stats', methods=['GET'])
@authenticate_user
def get_user_stats():
    """Get user's financial statistics for mascot insights"""
    try:
        user_id = request.user_id
        
        # Get savings goals stats
        goals_response = supabase.table('savings_goals').select('*').eq('user_id', user_id).execute()
        
        # Get recent transactions
        transactions_response = supabase.table('savings_transactions').select('*').eq('user_id', user_id).order('transaction_date', desc=True).limit(30).execute()
        
        # Calculate statistics
        total_saved = sum(float(goal['current_amount']) for goal in goals_response.data)
        active_goals = len([g for g in goals_response.data if g['status'] == 'active'])
        completed_goals = len([g for g in goals_response.data if g['status'] == 'completed'])
        
        # Calculate savings streak (days with savings transactions)
        recent_dates = set()
        for transaction in transactions_response.data:
            if transaction['transaction_type'] == 'savings':
                date = datetime.fromisoformat(transaction['transaction_date']).date()
                recent_dates.add(date)
        
        # Calculate current streak
        streak_days = calculate_savings_streak(recent_dates)
        
        stats = {
            'total_saved': total_saved,
            'active_goals': active_goals,
            'completed_goals': completed_goals,
            'total_goals': len(goals_response.data),
            'savings_streak_days': streak_days,
            'total_transactions': len(transactions_response.data),
            'mascot_encouragement': generate_encouragement_message(total_saved, streak_days, completed_goals)
        }
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        return jsonify({'error': 'Failed to fetch statistics'}), 500

def calculate_savings_streak(recent_dates):
    """Calculate consecutive days with savings"""
    if not recent_dates:
        return 0
    
    sorted_dates = sorted(recent_dates, reverse=True)
    today = datetime.now().date()
    
    streak = 0
    current_date = today
    
    for date in sorted_dates:
        if date == current_date:
            streak += 1
            current_date -= timedelta(days=1)
        elif date == current_date:
            continue
        else:
            break
    
    return streak

def generate_encouragement_message(total_saved, streak_days, completed_goals):
    """Generate personalized encouragement based on user's progress"""
    if completed_goals > 0:
        return f"🏆 Amazing! You've completed {completed_goals} goals and saved ₱{total_saved:,.2f} total!"
    elif streak_days >= 7:
        return f"🔥 Incredible {streak_days}-day savings streak! You're building an amazing habit!"
    elif streak_days >= 3:
        return f"⭐ {streak_days} days in a row! Keep this momentum going!"
    elif total_saved >= 1000:
        return f"💰 ₱{total_saved:,.2f} saved! You're building real wealth!"
    else:
        return "🌟 Every peso saved is a step towards financial freedom! Keep going!"

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'mascot': mascot.name,
        'timestamp': datetime.utcnow().isoformat()
    })

if __name__ == '__main__':
    # Load environment variables for development
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print(f"🤖 {mascot.name} Financial Mascot API starting on port {port}")
    print(f"📊 Ready to help users with their financial journey!")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
