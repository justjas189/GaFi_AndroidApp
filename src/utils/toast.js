// src/utils/toast.js
// Thin wrapper over react-native-toast-message so screens call toast.error(...)
// instead of importing the lib + remembering the custom type names. text1 = bold
// title, text2 = optional supporting line. Copy guidance: sentence case, active
// voice, specific, no apology — e.g. toast.error('Login failed', 'Check your email and password.').

import Toast from 'react-native-toast-message';

export const toast = {
  success: (text1, text2) => Toast.show({ type: 'gafiSuccess', text1, text2 }),
  error: (text1, text2) => Toast.show({ type: 'gafiError', text1, text2 }),
  info: (text1, text2) => Toast.show({ type: 'gafiInfo', text1, text2 }),
};

export default toast;
