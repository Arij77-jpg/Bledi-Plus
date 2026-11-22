/**
 * Root Layout (`app/_layout.tsx`)
 *
 * Initializes i18n, ThemeProvider (Light/Dark/System), PreferencesProvider,
 * and Zero-Trust AuthProvider across the entire Expo Router hierarchy.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../src/i18n';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { PreferencesProvider } from '../src/context/PreferencesContext';

function RootNavigator() {
  const { colors, statusBarStyle } = useTheme();

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="report" options={{ headerShown: false }} />
        <Stack.Screen name="employee" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
