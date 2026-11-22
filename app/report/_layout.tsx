import React from 'react';
import { Stack } from 'expo-router';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';
import { useTheme } from '../../src/context/ThemeContext';

export default function ReportLayout() {
  const { colors } = useTheme();

  return (
    <ProtectedRoute>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="[id]"
          options={{
            title: 'Issue Details',
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </ProtectedRoute>
  );
}
