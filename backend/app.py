from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
import random
import jwt
from datetime import datetime, timedelta
from supabase import create_client, Client
from functools import wraps
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for React Native

# Configuration
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'your-secret-key-change-this')

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

# Initialize Supabase client only if credentials are provided
supabase = None
if SUPABASE_URL and SUPABASE_KEY and not SUPABASE_URL.startswith('https://your-project'):
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {str(e)}")
        supabase = None
else:
    logger.warning("Supabase not configured - running in demo mode. Database features will be simulated.")
    logger.warning("To enable full functionality, update your .env file with actual Supabase credentials.")

class FinancialMascot:
    def __init__(self):
        self.name = "MonT"
        self.personality = "friendly, encouraging, and knowledgeable about finance"
        
        # Financial literacy tips
        self.financial_tips = [
            {
                "title": "Emergency Fund",
                "content": "Aim to save 3-6 months of expenses for emergencies. Start small - even ₱500 is better than nothing!"
            },
            {
                "title": "50/30/20 Rule",
                "content": "Allocate 50% for needs, 30% for wants, and 20% for savings and debt repayment."
            },
            {
                "title": "Start Early",
                "content": "The power of compound interest means that starting to save even small amounts early can make a huge difference over time."
            },
            {
                "title": "Track Your Spending",
                "content": "Knowledge is power! Understanding where your money goes is the first step to better financial health."
            },
            {
                "title": "Pay Yourself First",
                "content": "Set aside savings before spending on anything else. Automate transfers to make it easier."
            },
            {
                "title": "Avoid Lifestyle Inflation",
                "content": "As your income grows, resist the urge to spend it all. Increase your savings rate instead."
            },
            {
                "title": "Multiple Income Streams",
                "content": "Consider developing additional income sources to increase your financial security."
            },
            {
                "title": "Invest in Yourself",
                "content": "Education and skill development are investments that can pay dividends throughout your career."
            }
        ]
        
        # Natural language patterns for savings extraction
        self.savings_patterns = [
            r'(?:saved|save|put aside|set aside|deposited)\s*(?:php|₱|pesos?|p)?\s*(\d+(?:\.\d{2})?)',
            r'(?:php|₱|pesos?|p)\s*(\d+(?:\.\d{2})?)\s*(?:saved|save|put aside|set aside)',
            r'(\d+(?:\.\d{2})?)\s*(?:php|₱|pesos?|p)\s*(?:saved|save|today|yesterday)',
            r'managed to save\s*(?:php|₱|pesos?|p)?\s*(\d+(?:\.\d{2})?)',
            r'saved\s*(\d+(?:\.\d{2})?)\s*(?:php|₱|pesos?|p)?',
        ]
        
        # Motivational responses
        self.motivational_responses = [
            "🎉 Awesome job! Every peso saved is a step towards your goals!",
            "💪 You're building great financial habits! Keep it up!",
            "🌟 Fantastic! Your future self will thank you for this!",
            "🎯 Great progress! Small steps lead to big achievements!",
            "✨ Well done! You're taking control of your financial future!",
            "🚀 Amazing! You're on the right track to financial success!",
            "💖 Love seeing your commitment to your goals!",
            "🏆 Every saving counts! You're doing fantastic!"
        ]

    def extract_savings_amount(self, message):
        """Extract savings amount from natural language message"""
        message_lower = message.lower()
        
        for pattern in self.savings_patterns:
            match = re.search(pattern, message_lower)
            if match:
                try:
                    amount = float(match.group(1))
                    return amount
                except (ValueError, IndexError):
                    continue
        
        return None

    def get_currency_from_message(self, message):
        """Extract currency from message"""
        message_lower = message.lower()
        if 'php' in message_lower or '₱' in message_lower or 'peso' in message_lower:
            return 'PHP'
        return 'PHP'  # Default to PHP

    def generate_savings_response(self, amount, currency, progress_data=None):
        """Generate response for savings updates"""
        response = random.choice(self.motivational_responses)
        
        if currency.upper() == 'PHP':
            currency_symbol = '₱'
        else:
            currency_symbol = currency
            
        amount_str = f"{currency_symbol}{amount:.2f}"
        
        if progress_data:
            total = progress_data.get('new_total', 0)
            progress_percent = progress_data.get('progress', 0)
            response += f"\n\nYou've saved {amount_str} today! Your total is now {currency_symbol}{total:.2f}"
            
            if progress_percent > 0:
                response += f" ({progress_percent:.1f}% of your goal!)"
        else:
            response += f"\n\nYou saved {amount_str} today!"
            
        return response

    def get_random_tip(self):
        """Get a random financial tip"""
        return random.choice(self.financial_tips)

    def generate_motivational_message(self, context=None):
        """Generate general motivational message"""
        messages = [
            "Remember, financial freedom is a journey, not a destination! 🌟",
            "Every small step counts towards your big financial goals! 💪",
            "Building wealth is like building muscles - consistency is key! 🏋️‍♀️",
            "Your future self is cheering you on! Keep going! 🎉",
            "Smart money habits today = financial peace tomorrow! ✨"
        ]
        return random.choice(messages)

# Initialize the mascot
mascot = FinancialMascot()

def verify_token(f):
    """Decorator to verify JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            # For development, you might want to implement a simpler verification
            # In production, verify with Supabase
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token is invalid'}), 401
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            return jsonify({'error': 'Token verification failed'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Financial Mascot Backend',
        'mascot': mascot.name,
        'database': 'connected' if supabase else 'demo_mode',
        'mode': 'production' if supabase else 'demo',
        'timestamp': datetime.now().isoformat(),
        'message': 'Supabase connected - full functionality' if supabase else 'Demo mode - simulated responses'
    })

@app.route('/api/mascot/chat', methods=['POST'])
def chat_with_mascot():
    """Main chat endpoint for the financial mascot"""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()
        user_id = data.get('user_id')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        logger.info(f"Chat request from user {user_id}: {message}")
        
        # Extract savings amount from message
        savings_amount = mascot.extract_savings_amount(message)
        
        if savings_amount:
            # Handle savings update
            currency = mascot.get_currency_from_message(message)
            
            if supabase:
                try:
                    # Get user's active savings goal
                    goals_response = supabase.table('savings_goals')\
                        .select('*')\
                        .eq('user_id', user_id)\
                        .order('created_at', desc=True)\
                        .limit(1)\
                        .execute()
                    
                    goal = None
                    if goals_response.data:
                        goal = goals_response.data[0]
                    
                    # Insert savings transaction
                    transaction_data = {
                        'user_id': user_id,
                        'amount': savings_amount,
                        'description': f"Savings from chat: {message}",
                        'transaction_date': datetime.now().date().isoformat()
                    }
                    
                    if goal:
                        transaction_data['goal_id'] = goal['id']
                        
                        # Update goal's current amount
                        new_current = goal['current_amount'] + savings_amount
                        progress = (new_current / goal['target_amount']) * 100 if goal['target_amount'] > 0 else 0
                        
                        supabase.table('savings_goals')\
                            .update({'current_amount': new_current, 'updated_at': datetime.now().isoformat()})\
                            .eq('id', goal['id'])\
                            .execute()
                        
                        progress_data = {
                            'new_total': new_current,
                            'progress': progress,
                            'goal_name': goal['goal_name'],
                            'target_amount': goal['target_amount']
                        }
                    else:
                        progress_data = {'new_total': savings_amount, 'progress': 0}
                    
                    supabase.table('savings_transactions').insert(transaction_data).execute()
                    
                    response_text = mascot.generate_savings_response(
                        savings_amount, 
                        currency, 
                        progress_data
                    )
                    
                    return jsonify({
                        'response': response_text,
                        'type': 'savings_update',
                        'mascot': mascot.name,
                        'savings_data': {
                            'amount': savings_amount,
                            'currency': currency,
                            'new_total': progress_data['new_total'],
                            'progress': progress_data['progress']
                        }
                    })
                    
                except Exception as e:
                    logger.error(f"Database error: {str(e)}")
                    # Fallback to demo mode but don't change the global supabase variable
                    pass
            
            # If we reach here and supabase is None or if there was a database error
            if not supabase:
                # Demo mode - simulate database functionality
                logger.info("Running in demo mode - simulating database response")
                demo_total = savings_amount * random.randint(5, 20)  # Simulate existing savings
                demo_progress = (demo_total / 1000) * 100  # Simulate progress towards ₱1000 goal
                
                progress_data = {
                    'new_total': demo_total,
                    'progress': min(demo_progress, 100),
                    'goal_name': 'Emergency Fund',
                    'target_amount': 1000
                }
                
                response_text = mascot.generate_savings_response(
                    savings_amount, 
                    currency, 
                    progress_data
                )
                response_text += "\n\n💡 *Demo Mode: Connect Supabase for real data persistence*"
                
                return jsonify({
                    'response': response_text,
                    'type': 'savings_update',
                    'mascot': mascot.name,
                    'demo_mode': True,
                    'savings_data': {
                        'amount': savings_amount,
                        'currency': currency,
                        'new_total': progress_data['new_total'],
                        'progress': progress_data['progress']
                    }
                })
        
        # Handle general financial questions and tips
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['tip', 'advice', 'help', 'learn']):
            tip = mascot.get_random_tip()
            return jsonify({
                'response': f"Here's a financial tip for you:\n\n**{tip['title']}**\n{tip['content']}",
                'type': 'tip',
                'mascot': mascot.name,
                'tip_data': tip
            })
        
        if any(word in message_lower for word in ['motivation', 'encourage', 'support']):
            motivational_msg = mascot.generate_motivational_message()
            return jsonify({
                'response': motivational_msg,
                'type': 'motivational',
                'mascot': mascot.name
            })
        
        # Default friendly response
        friendly_responses = [
            "I'm here to help you with your financial journey! Try telling me about your savings or ask for a financial tip! 💰",
            "Great to chat with you! I can help track your savings, provide financial tips, or just motivate you on your financial journey! 🌟",
            "Hello! I'm MonT, your financial buddy! Tell me about your savings goals or ask for some financial wisdom! 🎯",
            "Hi there! Ready to build some great financial habits together? Share your savings or ask me for tips! 💪"
        ]
        
        return jsonify({
            'response': random.choice(friendly_responses),
            'type': 'general',
            'mascot': mascot.name
        })
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return jsonify({
            'error': 'Something went wrong processing your message',
            'details': str(e) if app.debug else None
        }), 500

@app.route('/api/mascot/stats', methods=['GET'])
def get_user_stats():
    """Get user's financial statistics"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        if supabase:
            # Get user's savings goals
            goals_response = supabase.table('savings_goals')\
                .select('*')\
                .eq('user_id', user_id)\
                .execute()
            
            # Get user's transactions
            transactions_response = supabase.table('savings_transactions')\
                .select('*')\
                .eq('user_id', user_id)\
                .execute()
            
            goals = goals_response.data or []
            transactions = transactions_response.data or []
            
            # Calculate statistics
            total_saved = sum(t['amount'] for t in transactions)
            goals_count = len(goals)
            active_goals = len([g for g in goals if g['current_amount'] < g['target_amount']])
            
            # This month's savings
            current_month = datetime.now().strftime('%Y-%m')
            this_month_transactions = [
                t for t in transactions 
                if t['transaction_date'].startswith(current_month)
            ]
            this_month_saved = sum(t['amount'] for t in this_month_transactions)
            
            return jsonify({
                'total_saved': total_saved,
                'goals_count': goals_count,
                'active_goals': active_goals,
                'this_month_saved': this_month_saved,
                'goals': goals,
                'recent_transactions': transactions[-10:],  # Last 10 transactions
                'mascot': mascot.name
            })
        else:
            # Demo mode with simulated data
            logger.info("Stats request in demo mode")
            demo_stats = {
                'total_saved': 1250.50,
                'goals_count': 3,
                'active_goals': 2,
                'this_month_saved': 340.00,
                'goals': [
                    {
                        'id': 1,
                        'goal_name': 'Emergency Fund',
                        'target_amount': 5000,
                        'current_amount': 1250.50,
                        'progress': 25.01
                    },
                    {
                        'id': 2,
                        'goal_name': 'Vacation',
                        'target_amount': 10000,
                        'current_amount': 2500,
                        'progress': 25.0
                    }
                ],
                'recent_transactions': [
                    {
                        'id': 1,
                        'amount': 50.0,
                        'description': 'Demo savings',
                        'transaction_date': datetime.now().date().isoformat()
                    }
                ],
                'mascot': mascot.name,
                'demo_mode': True
            }
            return jsonify(demo_stats)
        
    except Exception as e:
        logger.error(f"Stats error: {str(e)}")
        return jsonify({
            'error': 'Unable to retrieve statistics',
            'details': str(e) if app.debug else None
        }), 500

@app.route('/api/mascot/tips', methods=['GET'])
def get_financial_tip():
    """Get a random financial tip"""
    try:
        tip = mascot.get_random_tip()
        return jsonify({
            'tip': tip,
            'mascot': mascot.name,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Tips error: {str(e)}")
        return jsonify({
            'error': 'Unable to retrieve tip',
            'details': str(e) if app.debug else None
        }), 500

@app.route('/api/mascot/goals', methods=['POST'])
def create_savings_goal():
    """Create a new savings goal"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        goal_name = data.get('goal_name')
        target_amount = data.get('target_amount')
        target_date = data.get('target_date')
        
        if not all([user_id, goal_name, target_amount]):
            return jsonify({'error': 'User ID, goal name, and target amount are required'}), 400
        
        goal_data = {
            'user_id': user_id,
            'goal_name': goal_name,
            'target_amount': target_amount,
            'current_amount': 0,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        if target_date:
            goal_data['target_date'] = target_date
        
        if supabase:
            result = supabase.table('savings_goals').insert(goal_data).execute()
            goal_result = result.data[0] if result.data else goal_data
        else:
            # Demo mode
            logger.info("Goal creation in demo mode")
            goal_result = {**goal_data, 'id': random.randint(100, 999)}
        
        response_msg = f"🎯 Great! I've created your '{goal_name}' goal for ₱{target_amount:.2f}. Start saving towards it!"
        
        if not supabase:
            response_msg += "\n\n💡 *Demo Mode: Connect Supabase to save goals permanently*"
        
        return jsonify({
            'response': response_msg,
            'goal': goal_result,
            'mascot': mascot.name,
            'demo_mode': not bool(supabase)
        })
        
    except Exception as e:
        logger.error(f"Goal creation error: {str(e)}")
        return jsonify({
            'error': 'Unable to create goal',
            'details': str(e) if app.debug else None
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'mascot': mascot.name,
        'available_endpoints': [
            '/health',
            '/api/mascot/chat',
            '/api/mascot/stats',
            '/api/mascot/tips',
            '/api/mascot/goals'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'mascot': mascot.name
    }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f"Starting Financial Mascot Backend on port {port}")
    logger.info(f"Mascot: {mascot.name}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
