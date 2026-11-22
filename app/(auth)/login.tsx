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
  Image,
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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { colors, hairlineBorder } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Champs requis', 'Veuillez saisir votre adresse e-mail et mot de passe.');
      return;
    }

    triggerLightHaptic();
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      triggerSuccessHaptic();
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail.endsWith('@bledi.admin.tn')) {
        router.replace('/admin');
      } else if (cleanEmail.endsWith('@bledi.employee.tn')) {
        router.replace('/employee');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      Alert.alert('Échec de connexion', getSafeErrorMessage(err));
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
        <View style={styles.brandHeader}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.appTitle, { color: colors.text }]}>بلادي+ • Bledi+</Text>
          <Text style={[styles.arabicSlogan, { color: colors.accent }]}>
            "تصويرة منّك، وبلادنا تزيان بينا"
          </Text>
          <Text style={[styles.latinSlogan, { color: colors.textMuted }]}>
            Taswira mennek, w bledna tizyen bina
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }, hairlineBorder]}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Adresse e-mail</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: focusedField === 'email' ? colors.card : colors.inputBg,
                  borderColor: focusedField === 'email' ? colors.borderFocus : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="votre.email@domaine.tn"
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
            <Text style={[styles.inputLabel, { color: colors.text }]}>Mot de passe</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: focusedField === 'password' ? colors.card : colors.inputBg,
                  borderColor: focusedField === 'password' ? colors.borderFocus : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Saisissez votre mot de passe"
              placeholderTextColor={colors.textSubtle}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.loginBtn,
              { backgroundColor: colors.primary },
              loading && styles.loginBtnDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryTextOn} />
            ) : (
              <Text style={[styles.loginBtnText, { color: colors.primaryTextOn }]}>
                Se connecter
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.secureKeychainRow}>
            <Feather name="shield" size={13} color={colors.emerald} />
            <Text style={[styles.secureKeychainText, { color: colors.textMuted }]}>
              Routage automatique par domaine & Claims sécurisés
            </Text>
          </View>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={[styles.registerLinkText, { color: colors.textMuted }]}>
              Nouveau citoyen ?{' '}
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Créer un compte</Text>
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
  brandHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: Spacing.sm,
    ...Elevation.floating,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  crestBadge: {
    width: 54,
    height: 54,
    borderRadius: Radius.card + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Elevation.floating,
  },
  appTitle: {
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
  inputLabel: {
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
  loginBtn: {
    borderRadius: Radius.input + 2,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.xs,
    ...Elevation.ambient,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  secureKeychainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: Spacing.md,
  },
  secureKeychainText: {
    fontSize: 11.5,
  },
  registerLink: {
    marginTop: Spacing.md + 2,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 13.5,
  },
});
