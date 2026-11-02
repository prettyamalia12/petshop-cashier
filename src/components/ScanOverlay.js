import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

// Visual scanning indicator drawn over the camera preview: corner frame,
// an animated laser line, and a hint label.
export default function ScanOverlay({ active = true }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.frame}>
        <Animated.View
          style={[
            styles.line,
            {
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, styles.frame.height - 6],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <Text style={styles.hint}>Aim at the barcode / QR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 250,
    height: 130,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  line: {
    height: 2,
    marginHorizontal: 6,
    backgroundColor: '#4caf50',
  },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
  },
});
