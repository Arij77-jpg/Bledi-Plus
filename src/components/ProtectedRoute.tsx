/**
 * Role-Based Expo Router Route Guard (`src/components/ProtectedRoute.tsx`)
 *
 * Wraps protected layouts (`/admin/*`, `/employee/*`, `/(tabs)/*`, `/report/*`):
 * - Waits cleanly until Firebase Auth + Custom Claims finish hydrating
 * - Redirects unauthenticated traffic to `/(auth)/login`
 * - Redirects unauthorized roles (e.g., Citizen accessing `/admin/*` or `/employee/*`)
 *   to `/(tabs)` without rendering protected JSX or leaking sensitive UI state
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types/report';
import { Typography, Spacing, Radius } from '../constants/theme';
import { triggerWarningHaptic } from '../utils/haptics';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Roles allowed to render child routes. If omitted, any authenticated user is allowed. */
  allowedRoles?: UserRole[];
  unauthenticatedRedirect?: string;
  unauthorizedRedirect?: string;
  showDeniedNotice?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  unauthenticatedRedirect = '/(auth)/login',
  unauthorizedRedirect = '/(tabs)',
  showDeniedNotice = true,
}) => {
  const { user, role, loading } = useAuth();
  const { colors } = useTheme();
  const notifiedRef = useRef(false);

  const isAuthorized = Boolean(
    user && (!allowedRoles || allowedRoles.includes(role))
  );

  useEffect(() => {
    if (!loading && user && allowedRoles && !allowedRoles.includes(role) && !notifiedRef.current) {
      notifiedRef.current = true;
      triggerWarningHaptic();
      if (showDeniedNotice) {
        Alert.alert(
          'Restricted Area',
          'Your current verified role does not grant access to this section.'
        );
      }
    }
  }, [loading, user, role, allowedRoles, showDeniedNotice]);

  if (loading) {
    return (
      <View style={[styles.guardBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.guardTitle, { color: colors.text }]}>
          Verifying Security Credentials
        </Text>
        <Text style={[styles.guardSub, { color: colors.textMuted }]}>
          Checking Firebase Custom Claims...
        </Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href={unauthenticatedRedirect as any} />;
  }

  if (!isAuthorized) {
    return <Redirect href={unauthorizedRedirect as any} />;
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  guardBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  guardTitle: {
    ...Typography.sectionHeader,
    fontSize: 16,
    marginTop: Spacing.sm,
  },
  guardSub: {
    ...Typography.micro,
    textAlign: 'center',
  },
  deniedIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function RoleRestrictedBanner({ requiredLabel }: { requiredLabel: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.guardBox, { backgroundColor: colors.background }]}>
      <View style={[styles.deniedIcon, { backgroundColor: colors.dangerSoft }]}>
        <Feather name="lock" size={24} color={colors.danger} />
      </View>
      <Text style={[styles.guardTitle, { color: colors.text }]}>Access Restricted</Text>
      <Text style={[styles.guardSub, { color: colors.textMuted }]}>
        Requires verified {requiredLabel} privileges.
      </Text>
    </View>
  );
}
