import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { BankGlyph } from '@/components/branding/bank-glyph';

const BRAND_BLUE = '#208AEF';

/**
 * Full-screen branded loading state shown while auth resolves, before the
 * router decides between the signed-in app and the sign-in screen. Matches
 * the native splash screen's background/glyph so the handoff is seamless,
 * and covers the gap the native splash can't (e.g. on web).
 */
export function TransitionScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center', gap: 16 }}>
        <BankGlyph size={84} />
        <Text style={styles.title}>Reconcile</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_BLUE,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
