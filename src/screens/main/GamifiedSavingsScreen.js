// GamifiedSavingsScreen.js - Placeholder redirect to LeaderboardScreen
// This functionality has been consolidated into LeaderboardScreen
import React from 'react';
import LeaderboardScreen from './LeaderboardScreen';

const GamifiedSavingsScreen = (props) => {
  // Redirect to LeaderboardScreen which contains all gamified savings functionality
  return <LeaderboardScreen {...props} />;
};

export default GamifiedSavingsScreen;
