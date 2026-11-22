import React from 'react';
import { Stack } from 'expo-router';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';
import { useTheme } from '../../src/context/ThemeContext';

/**
 * Strict Admin RBAC Guard (`/admin/*`)
 * ONLY users holding Firebase Auth Custom Claim `role === 'admin'` may enter.
 * Both `citizen` and `employee` users are blocked and redirected safely to `/(tabs)`.
 */
export default function AdminLayout() {
  const { colors } = useTheme();

  return (
    <ProtectedRoute allowedRoles={['admin']} unauthorizedRedirect="/(tabs)">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Admin Governance & Triage',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="manage-staff"
          options={{
            title: 'Personnel Municipal',
            headerBackTitle: 'Retour',
          }}
        />
        <Stack.Screen
          name="edit-report"
          options={{
            presentation: 'modal',
            title: 'Édition & Modération',
            headerBackTitle: 'Retour',
          }}
        />
        <Stack.Screen
          name="resolve-modal"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </ProtectedRoute>
  );
}
