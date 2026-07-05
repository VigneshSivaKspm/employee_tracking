import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    console.log('[LoginScreen] handleLogin — email:', email.trim(), 'passwordLen:', password.length);
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (!email.trim().includes('@')) {
      setError('Please enter a valid email address (e.g. yourname@gmail.com).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      console.log('[LoginScreen] calling signIn with email:', email.trim());
      const ok = await signIn(email.trim().toLowerCase(), password);
      console.log('[LoginScreen] signIn returned:', ok);
      if (!ok) {
        setError('Incorrect email or password. Please try again.');
      }
      // Navigation handled automatically by auth state change
    } catch (err: any) {
      console.error('[LoginScreen] signIn threw:', err?.message);
      setError(err?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Deep Gradient Header */}
          <LinearGradient
            colors={['#1E3A8A', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 40 }]}
          >
            <View style={styles.headerDecor1} />
            <View style={styles.headerDecor2} />
            <View style={styles.logoWrap}>
              <Ionicons name="briefcase" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.headerTitle}>Welcome Back!</Text>
            <Text style={styles.headerSubtitle}>Sign in to your account</Text>
          </LinearGradient>

          {/* White Card Body */}
          <View style={styles.card}>
            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#CBD5E1"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Enter your password"
                placeholderTextColor="#CBD5E1"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>

            {/* Remember Me + Forgot Password */}
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              <LinearGradient
                colors={['#2563EB', '#1E40AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Access note */}
            <Text style={styles.accessNote}>
              Access is provided by your branch admin. Contact them to get your login credentials.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E3A8A',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 28,
    paddingBottom: 64,
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecor1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerDecor2: {
    position: 'absolute',
    bottom: 0,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  card: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -28,
    padding: 28,
    paddingTop: 32,
    paddingBottom: 40,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    height: '100%',
    fontWeight: '500',
  },
  inputFlex: {
    flex: 1,
  },
  eyeButton: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  rememberText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 28,
  },
  primaryButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accessNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 18,
  },
});

export default LoginScreen;
