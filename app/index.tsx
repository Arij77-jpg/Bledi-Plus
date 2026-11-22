/**
 * Root Index Route
 * Directs incoming app traffic to either (auth)/login or (tabs)
 * based on the user's authentication state.
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Image } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';

export default function IndexScreen() {
  const { user, role, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={[styles.brandTitle, { color: colors.text }]}>بلادي+ • Bledi+</Text>
        <Text style={[styles.arabicSlogan, { color: colors.accent }]}>
          "تصويرة منّك، وبلادنا تزيان بينا"
        </Text>
        <Text style={[styles.latinSlogan, { color: colors.textMuted }]}>
          Taswira mennek, w bledna tizyen bina
        </Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 28 }} />
      </View>
    );
  }

  // If not authenticated, redirect to Login
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Role-based routing: send staff directly to their workspace
  if (role === 'admin') {
    return <Redirect href="/admin" />;
  }
  if (role === 'employee') {
    return <Redirect href="/employee" />;
  }

  // Citizens navigate to Main Tabs
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  splashLogo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  arabicSlogan: {
    fontSize: 16.5,
    fontWeight: '700',
    lineHeight: 25,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  latinSlogan: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
  },
});
