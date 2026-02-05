// MonT Assets Manager - Game-style graphics sources
export const MONT_ASSET_SOURCES = {
  // Free web sources for MonT mascot graphics
  WEB_SOURCES: {
    // LottieFiles - Free animations
    lottie: {
      celebration: 'https://lottie.host/4db68bbd-31cc-4ad2-a3c6-6c3d03bd69a7/rwMJqkINpr.json',
      thinking: 'https://lottie.host/c9c3c6f2-0b4e-4a4d-9d0a-8e8c7b6a5b4a/thinking.json',
      happy: 'https://lottie.host/f1f1f1f1-2b2b-4c4c-8d8d-9e9e0f0f1f1f/happy.json',
      money: 'https://lottie.host/embed/money-animation.json'
    },
    
    // Flaticon - Free with attribution
    flaticon: {
      robot_happy: 'https://cdn-icons-png.flaticon.com/512/4712/4712139.png',
      robot_excited: 'https://cdn-icons-png.flaticon.com/512/4712/4712027.png',
      robot_thinking: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
      piggy_bank: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png'
    },
    
    // Icons8 - Free with link
    icons8: {
      robot_advisor: 'https://img.icons8.com/color/96/000000/robot-2.png',
      financial_advisor: 'https://img.icons8.com/color/96/000000/financial-advisor.png',
      savings: 'https://img.icons8.com/color/96/000000/money-box.png'
    }
  },

  // Local asset structure (for custom graphics)
  LOCAL_ASSETS: {
    // Place custom MonT graphics in assets/mont/
    directory: 'assets/mont/',
    states: {
      idle: 'mont-idle.png',
      happy: 'mont-happy.png',
      excited: 'mont-excited.png',
      celebrating: 'mont-celebrating.gif',
      thinking: 'mont-thinking.png',
      encouraging: 'mont-encouraging.png',
      worried: 'mont-worried.png',
      sleeping: 'mont-sleeping.png',
      surprised: 'mont-surprised.png',
      focused: 'mont-focused.png'
    },
    accessories: {
      crown: 'crown.png',
      coins: 'coins.png',
      trophy: 'trophy.png',
      badge: 'badge.png'
    }
  },

  // Generated graphics options
  GENERATED_OPTIONS: {
    // CSS/SVG based graphics
    css_avatars: true,
    
    // Avatar generators
    diceBear: {
      style: 'bottts', // Robot style
      seed: 'MonT',
      options: {
        mood: ['happy', 'blissful', 'excited'],
        colors: ['blue', 'green', 'orange']
      }
    },
    
    // Placeholder service
    placeholder: {
      service: 'https://robohash.org/',
      format: 'png',
      size: '300x300'
    }
  }
};

// Asset loading utilities
export class MonTAssetManager {
  static getLocalAsset(state) {
    const assetPath = MONT_ASSET_SOURCES.LOCAL_ASSETS.directory + 
                     MONT_ASSET_SOURCES.LOCAL_ASSETS.states[state.toLowerCase()];
    return { uri: assetPath };
  }

  static getWebAsset(source, key) {
    return { uri: MONT_ASSET_SOURCES.WEB_SOURCES[source][key] };
  }

  static generateRobotAvatar(seed = 'MonT', mood = 'happy') {
    return { 
      uri: `https://robohash.org/${seed}.png?set=set1&size=300x300&mood=${mood}`
    };
  }

  static generateDiceBearAvatar(seed = 'MonT', mood = 'happy') {
    return {
      uri: `https://api.dicebear.com/7.x/bottts/png?seed=${seed}&mood=${mood}&backgroundColor=2196f3`
    };
  }

  static getLottieAnimation(type) {
    return MONT_ASSET_SOURCES.WEB_SOURCES.lottie[type];
  }
}

// Recommended graphics creation workflow
export const GRAPHICS_RECOMMENDATIONS = {
  // Option 1: Use generated avatars (Easiest)
  GENERATED: {
    difficulty: 'Easy',
    cost: 'Free',
    quality: 'Good',
    customization: 'Medium',
    implementation: `
      // Use DiceBear or RoboHash for instant robot avatars
      const avatarSource = MonTAssetManager.generateDiceBearAvatar('MonT', 'happy');
      <Image source={avatarSource} style={{width: 80, height: 80}} />
    `
  },

  // Option 2: Use free web resources (Medium)
  WEB_RESOURCES: {
    difficulty: 'Medium',
    cost: 'Free (with attribution)',
    quality: 'High',
    customization: 'Low',
    sources: [
      'Flaticon.com - Free icons with attribution',
      'Icons8.com - Free icons with link',
      'LottieFiles.com - Free animations',
      'Freepik.com - Free graphics with attribution'
    ]
  },

  // Option 3: Create custom graphics (Advanced)
  CUSTOM_CREATION: {
    difficulty: 'Hard',
    cost: 'Time/Money',
    quality: 'Excellent',
    customization: 'Full',
    tools: [
      'Figma - Free design tool',
      'Canva - Easy graphic creation',
      'Adobe Illustrator - Professional',
      'Procreate - iPad illustration',
      'Blender - 3D modeling (advanced)'
    ],
    workflow: `
      1. Design MonT character in different emotional states
      2. Export as PNG/SVG files
      3. Place in assets/mont/ directory
      4. Update asset paths in code
      5. Add animations with Lottie if needed
    `
  },

  // Option 4: Commission an artist (Professional)
  COMMISSIONED: {
    difficulty: 'Easy (for you)',
    cost: '$50-500',
    quality: 'Excellent',
    customization: 'Full',
    platforms: [
      'Fiverr - $5-50 for simple mascots',
      'Upwork - $50-200 for quality work',
      'Dribbble - Professional designers',
      '99designs - Design contests'
    ]
  }
};

export default MonTAssetManager;
