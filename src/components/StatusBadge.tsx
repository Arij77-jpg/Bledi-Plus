import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ReportStatus } from '../types/report';
import { Radius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';

interface StatusBadgeProps {
  status: ReportStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const { statusTokens } = useTheme();
  const { isRTL } = usePreferences();
  const { t } = useTranslation();

  const token = statusTokens[status] || statusTokens.pending;
  const isSmall = size === 'sm';
  const translatedLabel = t(`status.${status}`, { defaultValue: token.label });

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: token.bg,
          borderColor: token.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: isSmall ? 5 : 6,
        },
        isSmall && styles.pillSm,
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: token.dot },
          isSmall && styles.dotSm,
        ]}
      />
      <Text
        style={[
          styles.text,
          { color: token.text },
          isSmall && styles.textSm,
        ]}
      >
        {translatedLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
  },
  dotSm: {
    width: 5,
    height: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  textSm: {
    fontSize: 11,
  },
});
