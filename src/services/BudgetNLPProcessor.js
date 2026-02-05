// Natural Language Processing for Budget Chatbot
// Handles parsing and understanding user inputs for budget management

/**
 * Enhanced Intent classification and entity extraction for budget-related queries
 * Features: Multi-language support, context awareness, fuzzy matching, and learning
 */
export class BudgetNLPProcessor {
  constructor() {
    // Enhanced expense categories with synonyms
    this.categories = [
      'food', 'transportation', 'entertainment', 'shopping', 
      'utilities', 'others', 'groceries', 'dining', 'fuel',
      'movies', 'games', 'clothes', 'gadgets', 'bills', 'health', 'education'
    ];
    
    // Enhanced currency patterns for multiple formats including shorthand
    this.currencyPatterns = [
      /₱\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g, // ₱1,000.00
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:pesos?|php|₱)/gi, // 1000 pesos, 1000 php
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:piso|peso)/gi, // Filipino variants
      /(\d+(?:\.\d+)?)\s*k(?:ilo)?(?:\s|$)/gi, // Handle "1k", "2.5k", etc.
      /(\d+)\s*thousand/gi, // Handle "1 thousand"
      /(\d+(?:\.\d+)?)\s*m(?:illion)?(?:\s|$)/gi, // Handle "1m", "1.5m"
      /(\d+(?:,\d{3})*(?:\.\d{2})?)/g // plain numbers (last resort)
    ];
    
    // Enhanced gaming/entertainment terms for better category detection
    this.gamingTerms = [
      'games', 'gaming', 'game', 'steam', 'valorant', 'ml', 'mobile legends',
      'codm', 'call of duty', 'genshin', 'roblox', 'minecraft', 'pubg',
      'free fire', 'lol', 'league of legends', 'dota', 'fortnite',
      'apex', 'among us', 'clash', 'royale', 'brawl stars', 'pokemon',
      'nintendo', 'ps4', 'ps5', 'xbox', 'switch', 'console', 'pc gaming',
      'skin', 'skins', 'battle pass', 'gems', 'diamonds', 'coins',
      'top up', 'recharge', 'in-app purchase', 'dlc', 'expansion',
      'game credits', 'v-bucks', 'robux', 'cp', 'uc', 'load for games'
    ];
    
    // Enhanced intent patterns with more natural variations
    this.intentPatterns = {
      expense_log: [
        // Direct expense logging
        /(?:spent|paid|bought|purchased|cost|expense|gastos)/i,
        /(?:add|record|log|enter|input)\s+(?:expense|transaction|gastos)/i,
        /(?:i\s+(?:spent|paid|bought|purchased))/i,
        /(?:bili|bayad|gastos)\s+(?:ako|ng)/i, // Filipino patterns
        /(?:nagastos|nagbayad|bumili)/i,
        
        // Amount-first patterns
        /^\s*₱?\d+.*(?:for|sa|para sa|on|spent on|bought)/i,
        /^\s*₱?\d+.*(?:food|transportation|entertainment|shopping|utilities)/i,
        
        // Merchant/location patterns
        /(?:at|sa)\s+(?:jollibee|mcdonalds|kfc|7-eleven|sm|ayala|grab|taxi)/i,
        
        // Context patterns
        /(?:just|kanina|ngayon)\s+(?:spent|bought|paid)/i
      ],
      
      budget_update: [
        /(?:set|update|change|modify|ayusin)\s+(?:my\s+)?budget/i,
        /(?:budget|total|kabuuan)\s+(?:to|is|should be|dapat|ay)/i,
        /(?:new|updated?|bagong)\s+budget/i,
        /(?:i want|gusto ko)\s+(?:my budget|budget ko)\s+(?:to be|na)/i,
        /(?:make|gawing)\s+(?:my budget|budget ko)/i
      ],
      
      budget_query: [
        /(?:how much|magkano|what'?s my|show me|ipakita)\s+(?:budget|spending|gastos)/i,
        /(?:budget|spending|gastos)\s+(?:status|summary|report|kalagayan)/i,
        /(?:remaining|left|natitira|sobra)\s+(?:budget|money|pera)/i,
        /(?:check|tingnan|show|ipakita)\s+(?:my\s+)?(?:budget|spending|gastos)/i,
        /(?:balance|natitira)\s+(?:ko|akin)/i
      ],
      
      category_query: [
        /(?:how much|magkano|what'?s)\s+(?:did i spend|spent|gastos ko)\s+(?:on|sa)/i,
        /(?:spending|expenses|gastos)\s+(?:for|on|in|sa)\s+(\w+)/i,
        /(\w+)\s+(?:expenses|spending|budget|gastos)/i,
        /(?:gastos|spending)\s+(?:sa|for|on)\s+(\w+)/i,
        /(?:show|ipakita)\s+(?:my|ko|ang)\s+(\w+)\s+(?:spending|expenses|gastos)/i,
        /(?:show|check|tingnan)\s+(?:my\s+)?(\w+)\s+(?:category|spending|budget)/i
      ],
      
      financial_advice: [
        /(?:tips|advice|suggestion|payo|recommendation)/i,
        /(?:how to|paano)\s+(?:save|mag-save|makatipid|budget)/i,
        /(?:saving|tipid|budgeting)\s+(?:tips|advice|suggestions)/i,
        /(?:financial|pera)\s+(?:advice|tips|help|tulong)/i
      ],
      
      expense_history: [
        /(?:show|list|display|ipakita)\s+(?:my\s+)?(?:expenses|transactions|gastos)/i,
        /(?:recent|latest|last|nakaraang)\s+(?:expenses|transactions|gastos)/i,
        /(?:expense|transaction|gastos)\s+(?:history|list|records)/i
      ],
      
      savings_goal: [
        /(?:save|savings|goal|target|layunin)/i,
        /(?:saving|nakatipid)\s+(?:goal|target|layunin)/i,
        /(?:emergency|emergency fund|pangkagipitan)/i
      ],
      
      debug_data: [
        /(?:debug|diagnostic|check)\s+(?:data|user data|my data)/i,
        /(?:show|display)\s+(?:diagnostic|debug|data summary)/i,
        /(?:data\s+check|verify\s+data|user\s+validation)/i
      ],
      
      help: [
        /(?:help|how|what can|tulong|paano)/i,
        /(?:commands|options|features|ano ang|pwede)/i,
        /(?:what\s+(?:can you do|are you capable of))/i
      ]
    };
    
    // Enhanced category mapping with Filipino terms and brand names
    this.categoryMappings = {
      // Food category
      'jollibee': 'food', 'mcdonalds': 'food', 'kfc': 'food', 'chowking': 'food',
      'mang inasal': 'food', 'kenny rogers': 'food', 'burger king': 'food',
      'starbucks': 'food', 'dunkin': 'food', 'tim hortons': 'food',
      'lunch': 'food', 'dinner': 'food', 'breakfast': 'food', 'merienda': 'food',
      'meal': 'food', 'snack': 'food', 'coffee': 'food', 'drink': 'food',
      'groceries': 'food', 'grocery': 'food', 'tindahan': 'food', 'palengke': 'food',
      'pagkain': 'food', 'kain': 'food', 'ulam': 'food', 'kanin': 'food',
      'restaurant': 'food', 'carinderia': 'food', 'fastfood': 'food',
      
      // Transportation category
      'jeepney': 'transportation', 'bus': 'transportation', 'taxi': 'transportation',
      'grab': 'transportation', 'uber': 'transportation', 'angkas': 'transportation',
      'mrt': 'transportation', 'lrt': 'transportation', 'pnr': 'transportation',
      'fare': 'transportation', 'pamasahe': 'transportation', 'gas': 'transportation',
      'gasoline': 'transportation', 'diesel': 'transportation', 'fuel': 'transportation',
      'parking': 'transportation', 'toll': 'transportation', 'motor': 'transportation',
      'kotse': 'transportation', 'sasakyan': 'transportation', 'byahe': 'transportation',
      
      // Entertainment category
      'movie': 'entertainment', 'cinema': 'entertainment', 'netflix': 'entertainment',
      'spotify': 'entertainment', 'youtube premium': 'entertainment',
      'game': 'entertainment', 'gaming': 'entertainment', 'ps4': 'entertainment',
      'xbox': 'entertainment', 'nintendo': 'entertainment', 'mobile legends': 'entertainment',
      'concert': 'entertainment', 'gig': 'entertainment', 'party': 'entertainment',
      'bar': 'entertainment', 'club': 'entertainment', 'karaoke': 'entertainment',
      'gym': 'entertainment', 'sports': 'entertainment', 'swimming': 'entertainment',
      
      // Shopping category
      'clothes': 'shopping', 'damit': 'shopping', 'shirt': 'shopping', 'shoes': 'shopping',
      'bag': 'shopping', 'phone': 'shopping', 'laptop': 'shopping', 'gadget': 'shopping',
      'sm': 'shopping', 'ayala': 'shopping', 'robinsons': 'shopping', 'mall': 'shopping',
      'lazada': 'shopping', 'shopee': 'shopping', 'zalora': 'shopping',
      'books': 'shopping', 'school supplies': 'shopping', 'office supplies': 'shopping',
      
      // Utilities category
      'electric': 'utilities', 'electricity': 'utilities', 'kuryente': 'utilities',
      'water': 'utilities', 'tubig': 'utilities', 'internet': 'utilities', 'wifi': 'utilities',
      'globe': 'utilities', 'smart': 'utilities', 'pldt': 'utilities', 'converge': 'utilities',
      'bill': 'utilities', 'bayarin': 'utilities', 'load': 'utilities', 'prepaid': 'utilities',
      'postpaid': 'utilities', 'cable': 'utilities', 'tv': 'utilities',
      
      // Health category
      'medicine': 'health', 'gamot': 'health', 'doctor': 'health', 'hospital': 'health',
      'dentist': 'health', 'checkup': 'health', 'vitamins': 'health', 'pharmacy': 'health',
      'mercury drug': 'health', 'watson': 'health', 'rose pharmacy': 'health',
      
      // Education category
      'tuition': 'education', 'school': 'education', 'university': 'education',
      'college': 'education', 'books': 'education', 'uniform': 'education',
      'supplies': 'education', 'project': 'education', 'thesis': 'education',
      
      // Others
      'miscellaneous': 'others', 'misc': 'others', 'other': 'others', 'iba': 'others',
      'gift': 'others', 'regalo': 'others', 'donation': 'others', 'tulong': 'others'
    };
    
    // Context memory for better understanding
    this.conversationContext = {
      lastIntent: null,
      lastCategory: null,
      lastAmount: null,
      recentMentions: []
    };
    
    // Common Filipino number words
    this.filipinoNumbers = {
      'isa': 1, 'dalawa': 2, 'tatlo': 3, 'apat': 4, 'lima': 5,
      'anim': 6, 'pito': 7, 'walo': 8, 'siyam': 9, 'sampu': 10,
      'labing-isa': 11, 'labindalawa': 12, 'dalawampu': 20,
      'tatlumpu': 30, 'apatnapu': 40, 'limampu': 50,
      'aammpu': 60, 'pitumpu': 70, 'walumpu': 80, 'siyamnapu': 90,
      'isandaan': 100, 'dalawandaan': 200, 'isanlibo': 1000
    };
  }

  /**
   * Enhanced main method to process user input with context awareness and error handling
   * @param {string} input - User's natural language input
   * @returns {Object} Processed result with intent, entities, and confidence
   */
  async processInput(input) {
    const startTime = Date.now();
    
    console.log('[NLP DEBUG] Processing input:', input);
    
    try {
      // Input validation
      if (!input || typeof input !== 'string' || input.trim().length === 0) {
        return {
          intent: 'unknown',
          entities: {},
          confidence: 0,
          validation: {
            isValid: false,
            errors: ['Empty or invalid input'],
            missingFields: [],
            suggestions: ['Please provide a clear message about your expense or question']
          },
          processingTime: Date.now() - startTime
        };
      }

      // Limit input length for security
      if (input.length > 1000) {
        input = input.substring(0, 1000);
      }
      
      // Clean and normalize input
      const cleanInput = this.cleanInput(input);
      console.log('[NLP DEBUG] Cleaned input:', cleanInput);
      
      // Update conversation context
      this.updateContext(cleanInput);
      
      // Extract intent with context awareness
      const intent = this.extractIntentWithContext(cleanInput);
      console.log('[NLP DEBUG] Extracted intent:', intent);
      
      // Extract entities based on intent with enhanced methods
      const entities = this.extractEntitiesEnhanced(cleanInput, intent);
      console.log('[NLP DEBUG] Extracted entities:', entities);
      
      // Apply context corrections
      this.applyContextCorrections(entities);
      
      // Calculate enhanced confidence score
      const confidence = this.calculateEnhancedConfidence(cleanInput, intent, entities);
      console.log('[NLP DEBUG] Confidence score:', confidence);
      
      // Validate extraction with context
      const validation = this.validateExtractionEnhanced(intent, entities, cleanInput);
      console.log('[NLP DEBUG] Validation result:', validation);
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        success: validation.isValid,
        intent,
        entities,
        confidence,
        validation,
        processingTime,
        originalInput: input,
        cleanInput,
        contextUsed: this.conversationContext
      };
      
      console.log('[NLP DEBUG] Final processing result:', result);
      return result;
    } catch (error) {
      console.error('NLP Processing error:', error);
      return {
        success: false,
        intent: 'unknown',
        entities: {},
        confidence: 0,
        error: error.message,
        processingTime: Date.now() - startTime,
        originalInput: input
      };
    }
  }

  /**
   * Enhanced input cleaning with better normalization
   * @param {string} input - Raw user input
   * @returns {string} Cleaned input
   */
  cleanInput(input) {
    return input
      .toLowerCase()
      .trim()
      // Handle common Filipino text shortcuts
      .replace(/\bu\b/g, 'you')
      .replace(/\bur\b/g, 'your')
      .replace(/\bn\b/g, 'and')
      .replace(/\bko\b/g, 'my')
      .replace(/\bsa\b/g, 'for')
      // Normalize currency symbols
      .replace(/php|peso|pesos|piso/gi, '₱')
      // Keep only relevant characters
      .replace(/[^\w\s₱.,]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Update conversation context for better understanding
   * @param {string} input - Cleaned input
   */
  updateContext(input) {
    // Add to recent mentions
    this.conversationContext.recentMentions.unshift(input);
    if (this.conversationContext.recentMentions.length > 5) {
      this.conversationContext.recentMentions.pop();
    }
    
    // Extract and remember categories mentioned
    const category = this.extractCategoryEnhanced(input);
    if (category) {
      this.conversationContext.lastCategory = category;
    }
    
    // Extract and remember amounts mentioned
    const amount = this.extractAmountEnhanced(input);
    if (amount) {
      this.conversationContext.lastAmount = amount;
    }
  }

  /**
   * Extract intent with conversation context awareness
   * @param {string} input - Cleaned user input
   * @returns {string} Detected intent
   */
  extractIntentWithContext(input) {
    // First try standard intent extraction
    const standardIntent = this.extractIntent(input);
    
    // If unclear and we have context, try to infer
    if (standardIntent === 'unknown' && this.conversationContext.lastIntent) {
      // Check if this might be a follow-up
      if (this.isFollowUpPattern(input)) {
        return this.conversationContext.lastIntent;
      }
      
      // Check if it's a clarification
      if (this.isClarificationPattern(input)) {
        return this.conversationContext.lastIntent;
      }
    }
    
    // Try fuzzy matching for partial matches
    if (standardIntent === 'unknown') {
      return this.fuzzyIntentMatch(input);
    }
    
    // Update context
    this.conversationContext.lastIntent = standardIntent;
    return standardIntent;
  }

  /**
   * Check if input is a follow-up pattern
   * @param {string} input - Cleaned input
   * @returns {boolean} Is follow-up
   */
  isFollowUpPattern(input) {
    const followUpPatterns = [
      /^(yes|yeah|yep|oo|opo|sige|ok|okay)$/i,
      /^(no|nope|hindi|ayaw|wag)$/i,
      /^(another|isa pa|more|dagdag)$/i,
      /^(same|pareho|ganun din)$/i
    ];
    
    return followUpPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check if input is a clarification pattern
   * @param {string} input - Cleaned input
   * @returns {boolean} Is clarification
   */
  isClarificationPattern(input) {
    const clarificationPatterns = [
      /^(\d+|₱\d+)$/i, // Just an amount
      /^(food|transportation|entertainment|shopping|utilities|others)$/i, // Just a category
      /^(today|yesterday|kanina|ngayon)$/i // Just a time
    ];
    
    return clarificationPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Fuzzy intent matching for partial matches
   * @param {string} input - Cleaned input
   * @returns {string} Best match intent
   */
  fuzzyIntentMatch(input) {
    let bestMatch = 'unknown';
    let bestScore = 0;
    
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        const score = this.calculatePatternSimilarity(input, pattern);
        if (score > bestScore && score > 0.3) { // 30% similarity threshold
          bestScore = score;
          bestMatch = intent;
        }
      }
    }
    
    return bestMatch;
  }

  /**
   * Calculate similarity between input and regex pattern
   * @param {string} input - User input
   * @param {RegExp} pattern - Regex pattern
   * @returns {number} Similarity score (0-1)
   */
  calculatePatternSimilarity(input, pattern) {
    // Convert regex to string and extract keywords
    const patternStr = pattern.source.toLowerCase();
    const keywords = patternStr.match(/\w+/g) || [];
    const inputWords = input.split(' ');
    
    let matches = 0;
    keywords.forEach(keyword => {
      if (keyword.length > 2 && inputWords.some(word => 
        word.includes(keyword) || keyword.includes(word))) {
        matches++;
      }
    });
    
    return keywords.length > 0 ? matches / keywords.length : 0;
  }

  /**
   * Extract intent from user input
   * @param {string} input - Cleaned user input
   * @returns {string} Detected intent
   */
  extractIntent(input) {
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return intent;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Extract entities based on intent
   * @param {string} input - Cleaned user input
   * @param {string} intent - Detected intent
   * @returns {Object} Extracted entities
   */
  extractEntities(input, intent) {
    const entities = {};
    
    switch (intent) {
      case 'expense_log':
        entities.amount = this.extractAmount(input);
        entities.category = this.extractCategory(input);
        entities.description = this.extractDescription(input);
        entities.date = this.extractDate(input);
        break;
        
      case 'budget_update':
        entities.amount = this.extractAmount(input);
        entities.budgetType = this.extractBudgetType(input);
        entities.period = this.extractPeriod(input);
        break;
        
      case 'budget_query':
      case 'category_query':
        entities.category = this.extractCategory(input);
        entities.period = this.extractPeriod(input);
        break;
    }
    
    return entities;
  }

  /**
   * Enhanced entity extraction with better pattern matching
   * @param {string} input - Cleaned user input
   * @param {string} intent - Detected intent
   * @returns {Object} Extracted entities
   */
  extractEntitiesEnhanced(input, intent) {
    const entities = {};
    
    switch (intent) {
      case 'expense_log':
        entities.amount = this.extractAmountEnhanced(input);
        entities.category = this.extractCategoryEnhanced(input);
        entities.description = this.extractDescriptionEnhanced(input);
        entities.date = this.extractDateEnhanced(input);
        entities.merchant = this.extractMerchant(input);
        break;
        
      case 'budget_update':
        entities.amount = this.extractAmountEnhanced(input);
        entities.budgetType = this.extractBudgetType(input);
        entities.category = this.extractCategoryEnhanced(input);
        entities.period = this.extractPeriodEnhanced(input);
        break;
        
      case 'budget_query':
      case 'category_query':
        entities.category = this.extractCategoryEnhanced(input);
        entities.period = this.extractPeriodEnhanced(input);
        break;
        
      case 'financial_advice':
        entities.topic = this.extractAdviceTopic(input);
        entities.category = this.extractCategoryEnhanced(input);
        break;
        
      case 'expense_history':
        entities.period = this.extractPeriodEnhanced(input);
        entities.category = this.extractCategoryEnhanced(input);
        entities.limit = this.extractLimit(input);
        break;
        
      case 'savings_goal':
        entities.amount = this.extractAmountEnhanced(input);
        entities.timeline = this.extractTimeline(input);
        entities.purpose = this.extractSavingsPurpose(input);
        break;
    }
    
    // Apply context corrections
    this.applyContextCorrections(entities);
    
    return entities;
  }

  /**
   * Extract monetary amount from input
   * @param {string} input - User input
   * @returns {number|null} Extracted amount
   */
  extractAmount(input) {
    for (const pattern of this.currencyPatterns) {
      const matches = [...input.matchAll(pattern)];
      if (matches.length > 0) {
        const amountStr = matches[0][1] || matches[0][0];
        const amount = parseFloat(amountStr.replace(/[₱,\s]/g, ''));
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    return null;
  }

  /**
   * Extract expense category from input
   * @param {string} input - User input
   * @returns {string|null} Extracted category
   */
  extractCategory(input) {
    console.log('[NLP DEBUG] Extracting category from input:', input);
    
    // Direct category matches
    for (const category of this.categories) {
      if (input.includes(category)) {
        console.log('[NLP DEBUG] Found direct category match:', category);
        const normalized = this.normalizeCategory(category);
        console.log('[NLP DEBUG] Normalized category:', normalized);
        return normalized;
      }
    }
    
    // Context-based category inference
    const categoryMap = {
      'jollibee': 'food',
      'mcdonalds': 'food',
      'kfc': 'food',
      'jolibee': 'food',
      'lunch': 'food',
      'dinner': 'food',
      'breakfast': 'food',
      'meal': 'food',
      'snack': 'food',
      'coffee': 'food',
      'drink': 'food',
      'jeepney': 'transportation',
      'bus': 'transportation',
      'taxi': 'transportation',
      'grab': 'transportation',
      'uber': 'transportation',
      'fare': 'transportation',
      'gas': 'transportation',
      'gasoline': 'transportation',
      'movie': 'entertainment',
      'cinema': 'entertainment',
      'game': 'entertainment',
      'concert': 'entertainment',
      'party': 'entertainment',
      'clothes': 'shopping',
      'shirt': 'shopping',
      'shoes': 'shopping',
      'bag': 'shopping',
      'phone': 'shopping',
      'laptop': 'shopping',
      'gadget': 'shopping',
      'electric': 'utilities',
      'water': 'utilities',
      'internet': 'utilities',
      'wifi': 'utilities',
      'load': 'utilities',
      'bill': 'utilities'
    };
    
    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (input.includes(keyword)) {
        console.log('[NLP DEBUG] Found keyword match:', keyword, '-> category:', category);
        return category;
      }
    }
    
    console.log('[NLP DEBUG] No category found, defaulting to "others"');
    return 'others'; // Default category instead of null
  }

  /**
   * Extract description from input
   * @param {string} input - User input
   * @returns {string|null} Extracted description
   */
  extractDescription(input) {
    console.log('[NLP DEBUG] Basic description extraction from:', input);
    
    // Extract text after "for", "on", or before amounts
    const patterns = [
      /(?:for|on)\s+(.+?)(?:\s+(?:at|in|from)|$)/i,
      /(?:bought|purchased)\s+(.+?)(?:\s+(?:at|in|from)|$)/i,
      /₱?\d+[^a-z]*(?:for|on)\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        let description = match[1].trim();
        
        console.log('[NLP DEBUG] Pattern matched:', pattern, 'Raw description:', description);
        
        // Clean up the description by removing expense action words
        description = description
          .replace(/^(i\s+)?(spent|paid|bought|bumili|gastos|bayad|nagastos|nagbayad)\s*/i, '')
          .replace(/^(on|sa|para sa|ng)\s+/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (description.length > 2 && 
            !this.categories.includes(description.toLowerCase()) &&
            !/^\d+/.test(description) &&
            !/(₱|peso|pesos|php)/i.test(description)) {
          console.log('[NLP DEBUG] Valid description found:', description);
          return description;
        }
      }
    }
    
    console.log('[NLP DEBUG] No valid description found');
    return null;
  }

  /**
   * Extract date from input
   * @param {string} input - User input
   * @returns {string} ISO date string (defaults to today)
   */
  extractDate(input) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if there are explicit date patterns in the input
    const hasExplicitDate = /\d{1,2}[\/\-]\d{1,2}/i.test(input);
    const hasExplicitTimeReference = /(?:yesterday|today)/i.test(input);
    
    // If no explicit date patterns or time references, return null for real-time entries
    if (!hasExplicitDate && !hasExplicitTimeReference) {
      return null;
    }
    
    if (input.includes('yesterday')) {
      return yesterday.toISOString().split('T')[0];
    }
    
    if (input.includes('today') || !hasExplicitDate) {
      return today.toISOString().split('T')[0];
    }
    
    // Try to extract specific date patterns
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
      /(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?/
    ];
    
    for (const pattern of datePatterns) {
      const match = input.match(pattern);
      if (match) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        const year = match[3] ? parseInt(match[3]) : today.getFullYear();
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // If we reach here with explicit date patterns but couldn't parse, return today
    return hasExplicitDate ? today.toISOString().split('T')[0] : null;
  }

  /**
   * Extract budget type (total, category-specific)
   * @param {string} input - User input
   * @returns {string} Budget type
   */
  extractBudgetType(input) {
    const category = this.extractCategory(input);
    return category ? 'category' : 'total';
  }

  /**
   * Extract time period from input
   * @param {string} input - User input
   * @returns {string} Time period
   */
  extractPeriod(input) {
    if (input.includes('month') || input.includes('monthly')) return 'monthly';
    if (input.includes('week') || input.includes('weekly')) return 'weekly';
    if (input.includes('year') || input.includes('yearly')) return 'yearly';
    if (input.includes('today')) return 'today';
    if (input.includes('this week')) return 'this_week';
    if (input.includes('this month')) return 'this_month';
    return 'monthly'; // default
  }

  /**
   * Normalize category names to ensure consistency
   * @param {string} category - Raw category
   * @returns {string} Normalized category (lowercase)
   */
  normalizeCategory(category) {
    if (!category) return 'others';
    
    // First normalize to lowercase
    const normalized = category.toLowerCase().trim();
    
    // Map alternative category names to standard categories
    const categoryMap = {
      'groceries': 'food',
      'dining': 'food',
      'restaurant': 'food',
      'meals': 'food',
      'fuel': 'transportation',
      'gas': 'transportation',
      'commute': 'transportation',
      'transport': 'transportation',
      'movies': 'entertainment',
      'cinema': 'entertainment',
      'games': 'entertainment',
      'gaming': 'entertainment',
      'hobby': 'entertainment',
      'clothes': 'shopping',
      'clothing': 'shopping',
      'gadgets': 'shopping',
      'electronics': 'shopping',
      'bills': 'utilities',
      'electricity': 'utilities',
      'water': 'utilities',
      'internet': 'utilities',
      'phone': 'utilities',
      'miscellaneous': 'others',
      'misc': 'others',
      'other': 'others'
    };
    
    // Return mapped category or the normalized input if no mapping exists
    const mappedCategory = categoryMap[normalized] || normalized;
    
    // Validate that the category is one of our allowed categories
    const allowedCategories = ['food', 'transportation', 'entertainment', 'shopping', 'utilities', 'others'];
    
    return allowedCategories.includes(mappedCategory) ? mappedCategory : 'others';
  }

  /**
   * Enhanced amount extraction with multiple currency formats
   * @param {string} input - User input
   * @returns {number|null} Extracted amount
   */
  extractAmountEnhanced(input) {
    // Try different currency patterns in order of specificity
    const patterns = [
      // Handle "k" notation first (1k, 2.5k, etc.)
      {
        pattern: /(\d+(?:\.\d+)?)\s*k(?:ilo)?(?:\s|$|[^\w])/gi,
        multiplier: 1000
      },
      // Handle "m" notation (1m, 1.5m, etc.)
      {
        pattern: /(\d+(?:\.\d+)?)\s*m(?:illion)?(?:\s|$|[^\w])/gi,
        multiplier: 1000000
      },
      // Handle "thousand" word
      {
        pattern: /(\d+)\s*thousand/gi,
        multiplier: 1000
      },
      // Standard currency patterns
      {
        pattern: /₱\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
        multiplier: 1
      },
      {
        pattern: /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:pesos?|php|piso)/gi,
        multiplier: 1
      },
      {
        pattern: /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:₱|php)/gi,
        multiplier: 1
      },
      {
        pattern: /(?:worth|value|halaga)\s*(?:of\s*)?₱?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
        multiplier: 1
      },
      // Plain numbers (last resort)
      {
        pattern: /(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
        multiplier: 1
      }
    ];
    
    for (const { pattern, multiplier } of patterns) {
      const match = pattern.exec(input);
      if (match) {
        const baseAmount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(baseAmount) && baseAmount > 0) {
          const finalAmount = baseAmount * multiplier;
          console.log(`Extracted amount: ${baseAmount} * ${multiplier} = ${finalAmount} from "${match[0]}"`);
          return finalAmount;
        }
      }
    }
    
    // Try Filipino number words
    return this.extractFilipinoAmount(input);
  }

  /**
   * Extract amount from Filipino number words
   * @param {string} input - User input
   * @returns {number|null} Extracted amount
   */
  extractFilipinoAmount(input) {
    const words = input.split(' ');
    let amount = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (this.filipinoNumbers[word]) {
        amount += this.filipinoNumbers[word];
      }
    }
    
    return amount > 0 ? amount : null;
  }

  /**
   * Enhanced category extraction with brand recognition and context
   * @param {string} input - User input
   * @returns {string|null} Extracted category
   */
  extractCategoryEnhanced(input) {
    // Convert to lowercase for easier matching
    const lowerInput = input.toLowerCase();
    
    // Check for gaming terms first (more specific)
    const foundGamingTerm = this.gamingTerms.find(term => 
      lowerInput.includes(term.toLowerCase())
    );
    
    if (foundGamingTerm) {
      return 'entertainment';
    }
    
    // Enhanced category patterns with context awareness
    const categoryPatterns = {
      food: [
        /(?:food|meal|lunch|dinner|breakfast|snack|eat|ate|restaurant|fast food|jollibee|mcdonalds|kfc|burger|pizza|rice|ulam|kanin|pagkain|kain)/i,
        /(?:coffee|starbucks|cafe|milk tea|drinks|beverage|inom)/i,
        /(?:groceries|grocery|market|supermarket|palengke|tindahan)/i,
        /(?:delivery|grab food|food panda|takeout|order)/i
      ],
      
      transportation: [
        /(?:transport|travel|commute|jeepney|bus|taxi|grab|angkas|tricycle|motorcycle|habal|lrt|mrt|pnr)/i,
        /(?:fuel|gas|gasoline|diesel|load|pamasahe|fare|ticket)/i,
        /(?:parking|toll|bayad)/i,
        /(?:uber|grab car|booking)/i
      ],
      
      entertainment: [
        /(?:movie|cinema|netflix|spotify|entertainment|concert|show|event)/i,
        /(?:games?|gaming|steam|mobile legends|ml|valorant|genshin|pubg|codm|free fire)/i,
        /(?:skin|battle pass|gems|diamonds|top up|recharge|in-app)/i,
        /(?:console|ps4|ps5|xbox|nintendo|switch|pc)/i,
        /(?:party|club|bar|drinking|alcohol|birthday|celebration)/i
      ],
      
      shopping: [
        /(?:shopping|shop|bought|buy|purchase|bili|mall|sm|ayala|robinsons)/i,
        /(?:clothes|shirt|pants|shoes|bag|accessories|damit|sapatos)/i,
        /(?:gadget|phone|laptop|computer|headset|mouse|keyboard|tech)/i,
        /(?:supplies|school|books|notebook|pen|ballpen|papel)/i,
        /(?:personal|toiletries|shampoo|soap|toothbrush|hygiene)/i
      ],
      
      utilities: [
        /(?:bill|bills|electricity|water|internet|wifi|phone|cellphone|load|prepaid|postpaid)/i,
        /(?:rent|apartment|dorm|boarding|house|kuryente|tubig)/i,
        /(?:cable|netflix|subscription|monthly|bayarin)/i
      ]
    };
    
    // Check each category's patterns
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return category;
        }
      }
    }
    
    // Brand/merchant based categorization
    const merchantPatterns = {
      food: ['jollibee', 'mcdonalds', 'kfc', 'pizza hut', 'dominos', 'starbucks', 'dunkin', 'chowking', 'mang inasal', 'kenny rogers', 'greenwich', 'yellow cab'],
      shopping: ['sm', 'ayala', 'robinsons', 'lazada', 'shopee', 'zalora', 'uniqlo', 'h&m', 'zara', 'nike', 'adidas'],
      transportation: ['grab', 'angkas', 'joyride', 'uber', 'wunder', 'petron', 'shell', 'caltex'],
      entertainment: ['sm cinema', 'ayala cinema', 'netflix', 'spotify', 'steam', 'playstation', 'xbox']
    };
    
    for (const [category, merchants] of Object.entries(merchantPatterns)) {
      const foundMerchant = merchants.find(merchant => 
        lowerInput.includes(merchant.toLowerCase())
      );
      if (foundMerchant) {
        return category;
      }
    }
    
    // Check for prepositions that might indicate category
    const prepositionPatterns = [
      { pattern: /(?:for|on|sa)\s+(food|pagkain|kain)/i, category: 'food' },
      { pattern: /(?:for|on|sa)\s+(games?|gaming|laro)/i, category: 'entertainment' },
      { pattern: /(?:for|on|sa)\s+(transport|commute|pamasahe)/i, category: 'transportation' },
      { pattern: /(?:for|on|sa)\s+(shopping|bili|pamili)/i, category: 'shopping' },
      { pattern: /(?:for|on|sa)\s+(bills?|bayarin)/i, category: 'utilities' }
    ];
    
    for (const { pattern, category } of prepositionPatterns) {
      if (pattern.test(input)) {
        return category;
      }
    }
    
    return null;
  }

  /**
   * Enhanced description extraction with better parsing
   * @param {string} input - User input
   * @returns {string|null} Extracted description
   */
  extractDescriptionEnhanced(input) {
    console.log('[NLP DEBUG] Enhanced description extraction from:', input);
    
    // Enhanced patterns for description extraction
    const patterns = [
      // "for X" or "sa X" - prioritize this pattern
      /(?:for|sa|para sa)\s+([^₱\d]+?)(?:\s+(?:₱|\d+|at|in|from)|$)/i,
      // "bought X" or "bumili ng X"
      /(?:bought|purchased|bumili ng|bumili)\s+([^₱\d]+?)(?:\s+(?:₱|\d+|at|in|from)|$)/i,
      // "at X" or "sa X" (location/merchant)
      /(?:at|sa)\s+([^₱\d]+?)(?:\s+(?:₱|\d+)|$)/i,
      // "on X" pattern
      /(?:on|ng)\s+([^₱\d]+?)(?:\s+(?:₱|\d+|at|in|from)|$)/i,
      // Amount followed by description
      /₱?\d+[^a-z]*(?:for|sa|para sa|on|ng)\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(input);
      if (match && match[1]) {
        let description = match[1].trim();
        
        console.log('[NLP DEBUG] Pattern matched:', pattern, 'Description:', description);
        
        // Clean up the description by removing expense action words
        description = description
          .replace(/^(i\s+)?(spent|paid|bought|bumili|gastos|bayad|nagastos|nagbayad)\s*/i, '')
          .replace(/^(on|sa|para sa|ng)\s+/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Filter out category words and amounts
        if (description.length > 2 && 
            !this.categories.includes(description.toLowerCase()) &&
            !/^\d+/.test(description) &&
            !/(₱|peso|pesos|php)/i.test(description)) {
          console.log('[NLP DEBUG] Valid description found:', description);
          return description;
        }
      }
    }
    
    // If merchant found but no description, use merchant as description
    const merchant = this.extractMerchant(input);
    if (merchant) {
      console.log('[NLP DEBUG] Using merchant as description:', merchant);
      return merchant;
    }
    
    console.log('[NLP DEBUG] No valid description found');
    return null;
  }

  /**
   * Extract merchant/location from input
   * @param {string} input - User input
   * @returns {string|null} Extracted merchant
   */
  extractMerchant(input) {
    const merchants = [
      'jollibee', 'mcdonalds', 'kfc', 'chowking', 'mang inasal',
      'starbucks', 'dunkin', 'tim hortons', '7-eleven', 'ministop',
      'sm', 'ayala', 'robinsons', 'landmark', 'puregold',
      'mercury drug', 'watson', 'rose pharmacy',
      'grab', 'uber', 'angkas', 'lalamove'
    ];
    
    for (const merchant of merchants) {
      if (input.includes(merchant)) {
        return merchant;
      }
    }
    
    // Pattern for "at [merchant]" or "sa [merchant]"
    const merchantPattern = /(?:at|sa)\s+([a-z\s]+?)(?:\s|$)/i;
    const match = merchantPattern.exec(input);
    if (match && match[1] && match[1].trim().length > 2) {
      return match[1].trim();
    }
    
    return null;
  }

  /**
   * Enhanced date extraction with Filipino date terms
   * @param {string} input - User input
   * @returns {string} ISO date string
   */
  extractDateEnhanced(input) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if there are explicit date/time references in the input
    const hasExplicitDateReference = /(?:yesterday|kahapon|today|ngayon|kanina|last week|last month|noong linggo|noong buwan|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/i.test(input);
    
    // If no explicit date reference, return null for real-time entries
    if (!hasExplicitDateReference) {
      return null;
    }
    
    // Filipino date terms
    if (input.includes('kahapon') || input.includes('yesterday')) {
      return yesterday.toISOString().split('T')[0];
    }
    
    if (input.includes('ngayon') || input.includes('today') || input.includes('kanina')) {
      return today.toISOString().split('T')[0];
    }
    
    // Check for relative dates
    const relativeDates = {
      'last week': -7,
      'last month': -30,
      'noong linggo': -7,
      'noong buwan': -30
    };
    
    for (const [term, days] of Object.entries(relativeDates)) {
      if (input.includes(term)) {
        const date = new Date(today);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
      }
    }
    
    // Try standard date extraction
    return this.extractDate(input);
  }

  /**
   * Enhanced period extraction
   * @param {string} input - User input
   * @returns {string} Time period
   */
  extractPeriodEnhanced(input) {
    const periodMap = {
      'today': 'today',
      'ngayon': 'today',
      'week': 'this_week',
      'linggo': 'this_week',
      'this week': 'this_week',
      'ngayong linggo': 'this_week',
      'month': 'this_month',
      'buwan': 'this_month',
      'this month': 'this_month',
      'ngayong buwan': 'this_month',
      'year': 'this_year',
      'taon': 'this_year',
      'all time': 'all_time',
      'lahat': 'all_time'
    };
    
    for (const [term, period] of Object.entries(periodMap)) {
      if (input.includes(term)) {
        return period;
      }
    }
    
    return 'this_month'; // default
  }

  /**
   * Apply context corrections to extracted entities
   * @param {Object} entities - Extracted entities
   */
  applyContextCorrections(entities) {
    // If no amount but we have context amount and this looks like a follow-up
    if (!entities.amount && this.conversationContext.lastAmount) {
      const followUpWords = ['same', 'pareho', 'din', 'ganun din'];
      if (this.conversationContext.recentMentions[0] && 
          followUpWords.some(word => this.conversationContext.recentMentions[0].includes(word))) {
        entities.amount = this.conversationContext.lastAmount;
      }
    }
    
    // If no category but we have context category
    if ((!entities.category || entities.category === 'others') && 
        this.conversationContext.lastCategory) {
      const contextWords = ['same', 'pareho', 'din', 'another', 'isa pa'];
      if (this.conversationContext.recentMentions[0] && 
          contextWords.some(word => this.conversationContext.recentMentions[0].includes(word))) {
        entities.category = this.conversationContext.lastCategory;
      }
    }
  }

  /**
   * Calculate confidence score for extraction
   * @param {string} input - Cleaned input
   * @param {string} intent - Detected intent
   * @param {Object} entities - Extracted entities
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(input, intent, entities) {
    let score = 0;
    
    // Base score for intent detection
    if (intent !== 'unknown') score += 0.3;
    
    // Score for entity extraction
    switch (intent) {
      case 'expense_log':
        if (entities.amount) score += 0.4;
        if (entities.category) score += 0.3;
        break;
      case 'budget_update':
        if (entities.amount) score += 0.5;
        if (entities.budgetType) score += 0.2;
        break;
      case 'budget_query':
      case 'category_query':
        score += 0.4; // Queries are generally straightforward
        break;
    }
    
    // Penalty for ambiguous input
    if (input.split(' ').length < 3) score -= 0.1;
    if (!entities.amount && (intent === 'expense_log' || intent === 'budget_update')) {
      score -= 0.2;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Enhanced confidence calculation with better scoring
   * @param {string} input - Cleaned input
   * @param {string} intent - Detected intent
   * @param {Object} entities - Extracted entities
   * @returns {number} Enhanced confidence score (0-1)
   */
  calculateEnhancedConfidence(input, intent, entities) {
    let score = 0;
    
    // Base score for intent detection
    if (intent !== 'unknown') {
      score += 0.3;
      
      // Bonus for strong intent matches
      if (intent === 'expense_log' && input.includes('spent')) score += 0.1;
      if (intent === 'budget_update' && input.includes('budget')) score += 0.1;
      if (intent === 'budget_query' && input.includes('budget')) score += 0.1;
    }
    
    // Enhanced entity scoring
    switch (intent) {
      case 'expense_log':
        if (entities.amount) score += 0.4;
        if (entities.category && entities.category !== 'others') score += 0.2;
        if (entities.category === 'others') score += 0.1; // Lower score for generic category
        if (entities.description) score += 0.1;
        if (entities.merchant) score += 0.1;
        break;
        
      case 'budget_update':
        if (entities.amount) score += 0.5;
        if (entities.budgetType) score += 0.2;
        if (entities.category) score += 0.1;
        break;
        
      case 'budget_query':
      case 'category_query':
        score += 0.4; // Queries are generally straightforward
        if (entities.category) score += 0.2;
        if (entities.period) score += 0.1;
        break;
        
      case 'financial_advice':
        if (entities.topic) score += 0.3;
        if (entities.category) score += 0.2;
        break;
        
      case 'expense_history':
        if (entities.period) score += 0.3;
        if (entities.category) score += 0.2;
        break;
        
      case 'savings_goal':
        if (entities.amount) score += 0.4;
        if (entities.timeline) score += 0.2;
        if (entities.purpose) score += 0.1;
        break;
    }
    
    // Context bonuses
    if (this.conversationContext.lastIntent === intent) {
      score += 0.05; // Small bonus for conversation continuity
    }
    
    if (this.conversationContext.recentMentions.length > 0) {
      score += 0.02; // Tiny bonus for having conversation history
    }
    
    // Input quality adjustments
    const wordCount = input.split(' ').length;
    if (wordCount < 2) score -= 0.15; // Penalty for very short input
    if (wordCount > 15) score -= 0.05; // Small penalty for very long input
    
    // Currency format bonus
    if (input.includes('₱') || input.includes('peso')) score += 0.05;
    
    // Brand/merchant recognition bonus
    if (entities.merchant) score += 0.05;
    
    // Filipino language bonus (shows understanding)
    const filipinoWords = ['gastos', 'bumili', 'pagkain', 'kahapon', 'ngayon', 'pareho'];
    if (filipinoWords.some(word => input.includes(word))) {
      score += 0.05;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Enhanced validation with better error handling
   * @param {string} intent - Detected intent
   * @param {Object} entities - Extracted entities
   * @param {string} input - Original input for context
   * @returns {Object} Enhanced validation result
   */
  validateExtractionEnhanced(intent, entities, input) {
    const validation = {
      isValid: true,
      errors: [],
      missingFields: [],
      suggestions: [],
      contextUsed: false,
      fallbacksApplied: []
    };
    
    console.log('[NLP DEBUG] Enhanced validation for:', { intent, entities, input });
    
    switch (intent) {
      case 'expense_log':
        // Amount validation
        if (!entities.amount) {
          validation.errors.push('Amount not found');
          validation.missingFields.push('amount');
          validation.suggestions.push('Please specify the amount (e.g., "₱200" or "dalawang daan pesos")');
        } else if (entities.amount <= 0) {
          validation.errors.push('Invalid amount');
          validation.suggestions.push('Amount must be greater than zero');
        }
        
        // Category validation with smart fallbacks
        if (!entities.category) {
          entities.category = 'others';
          validation.fallbacksApplied.push('category defaulted to others');
          console.log('[NLP DEBUG] No category extracted, defaulted to "others"');
        }
        
        // Description enhancement
        if (!entities.description && entities.merchant) {
          entities.description = entities.merchant;
          validation.fallbacksApplied.push('description set from merchant');
        }
        
        // Date validation - DO NOT default to today for expense_log
        // Let null dates pass through so database service can use current timestamp
        if (!entities.date && entities.date !== null) {
          // Only apply fallback for other intents, not expense_log
          console.log('[NLP DEBUG] Date is undefined/falsy but not explicitly null - keeping as null for real-time entry');
        }
        
        break;
        
      case 'budget_update':
        if (!entities.amount) {
          validation.errors.push('Budget amount not found');
          validation.missingFields.push('amount');
          validation.suggestions.push('Please specify the budget amount (e.g., "₱10,000")');
        } else if (entities.amount <= 0) {
          validation.errors.push('Invalid budget amount');
          validation.suggestions.push('Budget amount must be greater than zero');
        }
        
        // Budget type fallback
        if (!entities.budgetType) {
          entities.budgetType = entities.category ? 'category' : 'total';
          validation.fallbacksApplied.push('budget type inferred');
        }
        
        break;
        
      case 'budget_query':
      case 'category_query':
        // Period fallback
        if (!entities.period) {
          entities.period = 'this_month';
          validation.fallbacksApplied.push('period defaulted to this month');
        }
        
        break;
        
      case 'expense_history':
        // Period fallback
        if (!entities.period) {
          entities.period = 'this_month';
          validation.fallbacksApplied.push('period defaulted to this month');
        }
        
        // Limit fallback
        if (!entities.limit) {
          entities.limit = 10;
          validation.fallbacksApplied.push('limit defaulted to 10');
        }
        
        break;
        
      case 'savings_goal':
        if (!entities.amount) {
          validation.errors.push('Savings amount not found');
          validation.missingFields.push('amount');
          validation.suggestions.push('Please specify the savings goal amount');
        }
        
        break;
    }
    
    // Context usage detection
    if (this.conversationContext.lastCategory && entities.category === this.conversationContext.lastCategory) {
      validation.contextUsed = true;
    }
    
    if (this.conversationContext.lastAmount && entities.amount === this.conversationContext.lastAmount) {
      validation.contextUsed = true;
    }
    
    validation.isValid = validation.errors.length === 0;
    
    console.log('[NLP DEBUG] Enhanced validation result:', validation);
    return validation;
  }

  /**
   * Validate extraction results
   * @param {string} intent - Detected intent
   * @param {Object} entities - Extracted entities
   * @returns {Object} Validation result
   */
  validateExtraction(intent, entities) {
    const validation = {
      isValid: true,
      errors: [],
      missingFields: [],
      suggestions: []
    };
    
    console.log('[NLP DEBUG] Validating extraction:', { intent, entities });
    
    switch (intent) {
      case 'expense_log':
        if (!entities.amount) {
          validation.errors.push('Amount not found');
          validation.missingFields.push('amount');
          validation.suggestions.push('Please specify the amount (e.g., "₱200")');
        }
        
        // Ensure category is always present (fallback to 'others')
        if (!entities.category) {
          console.log('[NLP DEBUG] No category extracted, setting to "others"');
          entities.category = 'others';
        }
        
        console.log('[NLP DEBUG] Final category after validation:', entities.category);
        break;
        
      case 'budget_update':
        if (!entities.amount) {
          validation.errors.push('Budget amount not found');
          validation.missingFields.push('amount');
          validation.suggestions.push('Please specify the budget amount (e.g., "₱10,000")');
        }
        break;
    }
    
    validation.isValid = validation.errors.length === 0;
    console.log('[NLP DEBUG] Validation result:', validation);
    return validation;
  }

  /**
   * Generate response for unclear inputs
   * @param {Object} validation - Validation result
   * @param {string} intent - Detected intent
   * @returns {string} Clarification message
   */
  generateClarificationMessage(validation, intent) {
    if (validation.isValid) return null;
    
    const messages = {
      expense_log: [
        "I'd like to help you record that expense! Could you please provide:",
        ...validation.suggestions,
        "\nFor example: 'I spent ₱250 on lunch at Jollibee'"
      ],
      budget_update: [
        "I can help you update your budget! Please specify:",
        ...validation.suggestions,
        "\nFor example: 'Set my budget to ₱15,000'"
      ],
      unknown: [
        "I'm not sure I understood that. Here's what I can help you with:",
        "• Record expenses: 'I spent ₱200 on food'",
        "• Check spending: 'How much did I spend on food?'",
        "• View budget: 'Show me my budget status'"
      ]
    };
    
    const messageLines = messages[intent] || messages.unknown;
    return messageLines.join('\n');
  }

  /**
   * Extract advice topic from input
   * @param {string} input - User input
   * @returns {string|null} Advice topic
   */
  extractAdviceTopic(input) {
    const topics = {
      'saving': ['save', 'savings', 'ipon', 'mag-ipon'],
      'budgeting': ['budget', 'plan', 'plano', 'gastos'],
      'investing': ['invest', 'investment', 'puhunan'],
      'debt': ['debt', 'utang', 'loan'],
      'emergency': ['emergency', 'emerhensya', 'bigla']
    };
    
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        return topic;
      }
    }
    
    return 'general';
  }

  /**
   * Extract limit for queries
   * @param {string} input - User input
   * @returns {number} Query limit
   */
  extractLimit(input) {
    const limitMatch = input.match(/(?:last|recent|huling)\s+(\d+)/i);
    if (limitMatch) {
      return parseInt(limitMatch[1]);
    }
    
    if (input.includes('all') || input.includes('lahat')) {
      return 0; // No limit
    }
    
    return 10; // Default limit
  }

  /**
   * Extract timeline for savings goals
   * @param {string} input - User input
   * @returns {string|null} Timeline
   */
  extractTimeline(input) {
    const timelinePatterns = {
      'month': /(\d+)\s*(?:months?|buwan)/i,
      'year': /(\d+)\s*(?:years?|taon)/i,
      'week': /(\d+)\s*(?:weeks?|linggo)/i
    };
    
    for (const [unit, pattern] of Object.entries(timelinePatterns)) {
      const match = pattern.exec(input);
      if (match) {
        return `${match[1]} ${unit}${parseInt(match[1]) > 1 ? 's' : ''}`;
      }
    }
    
    return null;
  }

  /**
   * Extract savings purpose
   * @param {string} input - User input
   * @returns {string|null} Savings purpose
   */
  extractSavingsPurpose(input) {
    const purposePatterns = [
      /(?:for|para sa)\s+([^₱\d]+?)(?:\s+(?:₱|\d+)|$)/i,
      /(?:want to|gusto)\s+([^₱\d]+?)(?:\s+(?:₱|\d+)|$)/i,
      /(?:save for|mag-ipon para sa)\s+([^₱\d]+?)(?:\s+(?:₱|\d+)|$)/i
    ];
    
    for (const pattern of purposePatterns) {
      const match = pattern.exec(input);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }
}
