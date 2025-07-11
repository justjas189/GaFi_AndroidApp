// Initialize Deepseek configuration
const DEEPSEEK_API_KEY = 'sk-d47e0a9154a54bae90f20ecb32795f5d';

if (!DEEPSEEK_API_KEY) {
  console.warn('Missing Deepseek API key - AI features will be disabled');
}

export const deepseekConfig = {
  apiKey: DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
  isEnabled: !!DEEPSEEK_API_KEY
};

// Helper function to analyze expenses using Deepseek
export const analyzeExpenses = async (expenses) => {
  if (!deepseekConfig.isEnabled) {
    console.log('Deepseek AI features are disabled');
    return [];
  }

  try {
    const response = await fetch(`${deepseekConfig.baseURL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekConfig.apiKey}`,
      },
      body: JSON.stringify({ expenses }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to analyze expenses');
    }

    const data = await response.json();
    return data.insights || [];
  } catch (error) {
    console.error('Error analyzing expenses:', error);
    return [];
  }
};

// Helper function to get spending recommendations
export const getRecommendations = async (userProfile, expenses) => {
  if (!deepseekConfig.isEnabled) {
    console.log('Deepseek AI features are disabled');
    return [];
  }

  try {
    const response = await fetch(`${deepseekConfig.baseURL}/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekConfig.apiKey}`,
      },
      body: JSON.stringify({ userProfile, expenses }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to get recommendations');
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return [];
  }
}; 