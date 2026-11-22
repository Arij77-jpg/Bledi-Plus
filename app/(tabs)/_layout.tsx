import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/context/ThemeContext';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ProtectedRoute>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSubtle,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopWidth: StyleSheet.hairlineWidth > 0 ? Math.max(StyleSheet.hairlineWidth, 1) : 1,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 84 : 62,
            paddingBottom: Platform.OS === 'ios' ? 24 : 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 10.5,
            fontWeight: '600',
            letterSpacing: 0.1,
          },
          headerStyle: {
            backgroundColor: colors.headerBg,
          },
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 17,
            letterSpacing: -0.3,
            color: colors.text,
          },
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.feed'),
            headerTitle: t('tabs.feedHeader'),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'newspaper' : 'newspaper-outline'}
                size={size - 2}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: t('tabs.map'),
            headerTitle: t('tabs.mapHeader'),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'map' : 'map-outline'}
                size={size - 2}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="new-report"
          options={{
            title: t('tabs.report'),
            headerTitle: t('tabs.reportHeader'),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'add-circle' : 'add-circle-outline'}
                size={size + 2}
                color={focused ? colors.accent : (color as string)}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            headerTitle: t('tabs.profileHeader'),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
                size={size - 2}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            headerTitle: t('tabs.settingsHeader'),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                size={size - 2}
                color={color as string}
              />
            ),
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}
