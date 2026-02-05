import React from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * GaFI Piggy Bank Mascot Component
 * Displays the cute piggy bank mascot throughout the app
 */
export default function MascotImage({ size = 64, style }) {
  return (
    <Image
      source={require('../../assets/mascot/koin_tutorial.png')}
      style={[
        styles.mascot,
        {
          width: size,
          height: size,
        },
        style,
      ]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  mascot: {
    // The image will maintain aspect ratio
  },
});
