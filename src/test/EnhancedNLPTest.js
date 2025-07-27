import BudgetNLPProcessor from '../services/BudgetNLPProcessor.js';

/**
 * Test the enhanced NLP capabilities
 */
export default function testEnhancedNLP() {
  console.log('=== Enhanced NLP Test ===');
  
  const nlp = new BudgetNLPProcessor();
  
  // Test cases with Filipino language support and context awareness
  const testCases = [
    // Basic expense logging
    "Gastos ko ₱150 sa pagkain sa Jollibee",
    "Spent 200 on transportation via Grab",
    "Bumili ng groceries worth ₱1,500 sa SM",
    
    // Amount variations
    "Dalawang daan pesos for lunch",
    "₱50.50 for coffee at Starbucks",
    "1,250 pesos worth of shopping",
    
    // Category inference
    "Kumain ako sa McDo kahapon",
    "Naglakad kami sa mall at bumili ng damit",
    "Nagbayad ng electric bill",
    
    // Context-aware follow-ups
    "Another 100 for the same category",
    "Pareho din sa kanina",
    "Isa pa ng ganun",
    
    // Complex queries
    "How much did I spend on food this week?",
    "Magkano na ang gastos ko sa transportation ngayong buwan?",
    "Show me my budget status for entertainment",
    
    // Financial advice
    "How can I save money on food expenses?",
    "Paano ako mag-ipon para sa emergency fund?",
    "Give me tips for budgeting my monthly salary"
  ];
  
  console.log('\n--- Testing Enhanced Entity Extraction ---');
  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: "${testCase}"`);
    
    try {
      const result = nlp.processInput(testCase);
      
      console.log(`Intent: ${result.intent}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log('Entities:', JSON.stringify(result.entities, null, 2));
      
      if (result.entities.amount) {
        console.log(`Amount extracted: ₱${result.entities.amount}`);
      }
      
      if (result.entities.category) {
        console.log(`Category: ${result.entities.category}`);
      }
      
      if (result.entities.description) {
        console.log(`Description: ${result.entities.description}`);
      }
      
      if (result.entities.merchant) {
        console.log(`Merchant: ${result.entities.merchant}`);
      }
      
    } catch (error) {
      console.error(`Error processing: ${error.message}`);
    }
  });
  
  // Test conversation context
  console.log('\n--- Testing Conversation Context ---');
  
  // Simulate a conversation
  const conversation = [
    "Gastos ko ₱200 sa food",
    "Another 150 for the same thing",
    "Pareho din ng amount kanina"
  ];
  
  conversation.forEach((message, index) => {
    console.log(`\nConversation ${index + 1}: "${message}"`);
    const result = nlp.processInput(message);
    console.log(`Extracted amount: ₱${result.entities.amount || 'none'}`);
    console.log(`Extracted category: ${result.entities.category || 'none'}`);
  });
  
  // Test Filipino number recognition
  console.log('\n--- Testing Filipino Number Recognition ---');
  
  const filipinoNumbers = [
    "isang daan pesos sa pagkain",
    "dalawang daan sa transport",
    "limang daan sa shopping"
  ];
  
  filipinoNumbers.forEach((test, index) => {
    console.log(`\nFilipino Number Test ${index + 1}: "${test}"`);
    const result = nlp.processInput(test);
    console.log(`Amount extracted: ₱${result.entities.amount || 'none'}`);
  });
  
  // Test brand and merchant recognition
  console.log('\n--- Testing Brand/Merchant Recognition ---');
  
  const brandTests = [
    "Bought coffee at Starbucks",
    "Kumain sa Jollibee",
    "Shopping sa SM Mall",
    "Medicine from Mercury Drug"
  ];
  
  brandTests.forEach((test, index) => {
    console.log(`\nBrand Test ${index + 1}: "${test}"`);
    const result = nlp.processInput(test);
    console.log(`Category: ${result.entities.category}`);
    console.log(`Merchant: ${result.entities.merchant || 'none'}`);
  });
  
  console.log('\n=== Enhanced NLP Test Complete ===');
}

// Export for use in test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = testEnhancedNLP;
}
