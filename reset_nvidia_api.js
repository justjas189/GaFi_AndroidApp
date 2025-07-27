// Quick fix script to reset NVIDIA API circuit breaker
// Run this in your React Native app console or debugger

const resetNvidiaAPI = () => {
  console.log('🔧 Resetting NVIDIA API Circuit Breaker...');
  
  try {
    // Import the reset function (adjust path if needed)
    const { resetCircuitBreaker, getCircuitBreakerStatus, getRateLimiterStatus } = require('./src/config/nvidia');
    
    // Check current status
    const beforeStatus = getCircuitBreakerStatus();
    const rateLimitStatus = getRateLimiterStatus();
    
    console.log('📊 Before Reset:');
    console.log('Circuit Breaker:', beforeStatus);
    console.log('Rate Limiter:', rateLimitStatus);
    
    // Reset circuit breaker
    resetCircuitBreaker();
    
    // Check status after reset
    const afterStatus = getCircuitBreakerStatus();
    
    console.log('✅ After Reset:');
    console.log('Circuit Breaker:', afterStatus);
    
    console.log('🚀 NVIDIA API should now work properly!');
    console.log('💡 Tips to prevent this:');
    console.log('   - Wait 2-3 seconds between AI requests');
    console.log('   - Don\'t make too many simultaneous requests');
    console.log('   - Check your network connection');
    
    return true;
    
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    console.log('🔄 Alternative: Restart your React Native app');
    return false;
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resetNvidiaAPI };
}

// Run immediately if in development
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('🛠️ Development mode detected - running reset...');
  resetNvidiaAPI();
}

// For manual execution, uncomment the line below:
// resetNvidiaAPI();
