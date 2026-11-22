/**
 * Citizen Public Registration Screen (`app/(auth)/register.tsx`)
 *
 * Security Invariant:
 * Public registration ALWAYS creates standard `citizen` accounts.
 * Municipal Worker (`employee`) and City Admin (`admin`) accounts CANNOT be
 * requested or selected during signup; they are pre-provisioned out-of-band
 * via Firebase Admin SDK Custom Claims (`scripts/set-custom-claims.mjs`).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import {
  Radius,
  Spacing,
  Typography,
  Elevation,
} from '../../src/constants/theme';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../src/utils/haptics';
import { getSafeErrorMessage } from '../../src/utils/errors';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { colors, hairlineBorder } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPass = password.trim();

    if (!cleanName || !cleanEmail || !cleanPass) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    // Public Registration Guard: Municipal staff domains prohibited on public signup
    if (cleanEmail.endsWith('@bledi.admin.tn') || cleanEmail.endsWith('@bledi.employee.tn')) {
      triggerLightHaptic();
      Alert.alert(
        'Domaine réservé',
        'Ce domaine est réservé au personnel municipal. Veuillez utiliser une adresse e-mail personnelle.'
      );
      return;
    }

    if (cleanPass.length < 6) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    triggerLightHaptic();
    setLoading(true);
    try {
      // Zero-Trust: strictly registers a `civil` citizen account
      await signUp(cleanEmail, cleanPass, cleanName);
      triggerSuccessHaptic();
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Erreur d\'inscription', getSafeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={[styles.title, { color: colors.text }]}>بلادي+ • Bledi+</Text>
          <Text style={[styles.arabicSlogan, { color: colors.accent }]}>
            "تصويرة منّك، وبلادنا تزيان بينا"
          </Text>
          <Text style={[styles.latinSlogan, { color: colors.textMuted }]}>
            Taswira mennek, w bledna tizyen bina
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: focusedField === 'name' ? colors.card : colors.inputBg,
                  borderColor: focusedField === 'name' ? colors.borderFocus : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Amine Ben Salem"
              placeholderTextColor={colors.textSubtle}
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: focusedField === 'email' ? colors.card : colors.inputBg,
                  borderColor: focusedField === 'email' ? colors.borderFocus : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="citizen@example.com"
              placeholderTextColor={colors.textSubtle}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Password (min 6 characters)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: focusedField === 'password' ? colors.card : colors.inputBg,
                  borderColor: focusedField === 'password' ? colors.borderFocus : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="••••••••"
              placeholderTextColor={colors.textSubtle}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              secureTextEntry
            />
          </View>

          {/* Transparent Security Notice replacing old unsafe role picker */}
          <View style={[styles.securityBanner, { backgroundColor: colors.accentSoft }]}>
            <Feather name="shield" size={15} color={colors.accent} />
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              Public signup issues standard <Text style={{ fontWeight: '700' }}>Citizen</Text>{' '}
              access. Municipal staff & admins are provisioned via IT Administration.
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
              loading && styles.submitBtnDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryTextOn} />
            ) : (
              <Text style={[styles.submitBtnText, { color: colors.primaryTextOn }]}>
                Create Citizen Account
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
            <Text style={[styles.loginLinkText, { color: colors.textMuted }]}>
              Already registered?{' '}
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.title,
    textAlign: 'center',
  },
  arabicSlogan: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 6,
    paddingHorizontal: Spacing.sm,
  },
  latinSlogan: {
    fontSize: 12.5,
    fontStyle: 'italic',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 3,
    maxWidth: 320,
  },
  card: {
    borderRadius: Radius.card + 4,
    padding: Spacing.lg,
    ...Elevation.ambient,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.input,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  submitBtn: {
    borderRadius: Radius.input + 2,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.xs,
    ...Elevation.ambient,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  loginLink: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 13.5,
  },
});
