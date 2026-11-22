import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ReportCategory } from '../types/report';
import { Radius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';

interface CategoryBadgeProps {
  category: ReportCategory;
  compact?: boolean;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, compact = false }) => {
  const { categoryTokens } = useTheme();
  const { isRTL } = usePreferences();
  const { t } = useTranslation();

  const token = categoryTokens[category] || categoryTokens.other;
  const labelKey = compact ? `categories.${category}Short` : `categories.${category}`;
  const translated = t(labelKey, {
    defaultValue: compact ? token.shortLabel : token.label,
  });

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: token.bg,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 4,
        },
      ]}
    >
      <Feather
        name={token.icon as any}
        size={compact ? 11 : 12}
        color={token.color}
      />
      <Text style={[styles.text, { color: token.color }, compact && styles.textCompact]}>
        {translated}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  textCompact: {
    fontSize: 11,
  },
});
