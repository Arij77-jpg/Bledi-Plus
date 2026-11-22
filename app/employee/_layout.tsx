import React from 'react';
import { Stack } from 'expo-router';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';
import { useTheme } from '../../src/context/ThemeContext';

/**
 * RBAC Layout Guard for `/employee/*`
 * Only pre-provisioned Municipal Employees (`employee`) and City Admins (`admin`)
 * carrying verified Firebase Auth Custom Claims can access these routes.
 */
export default function EmployeeLayout() {
  const { colors } = useTheme();

  return (
    <ProtectedRoute allowedRoles={['employee', 'admin']} unauthorizedRedirect="/(tabs)">
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
            title: 'Municipal Field Operations',
            headerBackTitle: 'Back',
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
