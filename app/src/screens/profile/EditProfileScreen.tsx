import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { pickAndUploadProfilePhoto } from '../../services/profilePhoto';

type RootStackParamList = {
  EditProfile: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FormField {
  key: 'name' | 'employeeId' | 'email' | 'phone' | 'department' | 'designation';
  label: string;
  placeholder: string;
  editable: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}

const FORM_FIELDS: FormField[] = [
  { key: 'name', label: 'Full Name', placeholder: 'Enter your full name', editable: true },
  { key: 'employeeId', label: 'Employee ID', placeholder: '', editable: false },
  { key: 'email', label: 'Email Address', placeholder: '', editable: false, keyboardType: 'email-address' },
  { key: 'phone', label: 'Mobile Number', placeholder: 'Enter mobile number', editable: true, keyboardType: 'phone-pad' },
  { key: 'department', label: 'Department', placeholder: '', editable: false },
  { key: 'designation', label: 'Designation', placeholder: '', editable: false },
];

interface FormState {
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
}

export default function EditProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState<FormState>({
    name: user?.name ?? '',
    employeeId: user?.employeeId ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    department: user?.department ?? '',
    designation: user?.designation ?? '',
  });
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name ?? '',
      employeeId: user.employeeId ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      department: user.department ?? '',
      designation: user.designation ?? '',
    });
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user]);

  const getInitials = (name: string): string => {
    if (!name?.trim()) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  async function handlePickPhoto() {
    if (!user?.id) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadProfilePhoto(user.id);
      if (!url) return;
      await updateProfile({ avatarUrl: url });
      setAvatarUrl(url);
      Alert.alert('Photo updated', 'Your profile photo has been saved.');
    } catch (e: unknown) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation Error', 'Full name cannot be empty.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'User session not found. Please log in again.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
      });
      Alert.alert('Success', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: unknown) {
      Alert.alert('Save Failed', error instanceof Error ? error.message : 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#2563EB', '#1D4ED8']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.7} disabled={saving}>
          <Text style={styles.saveText}>{saving ? '...' : 'Save'}</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.avatarCard}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.85} disabled={uploadingPhoto}>
            <View style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{getInitials(form.name)}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                )}
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarNote}>Tap photo to upload · Name and mobile are editable below</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {FORM_FIELDS.map((field, index) => (
            <View key={field.key} style={[styles.inputGroup, index < FORM_FIELDS.length - 1 && styles.inputGroupBorder]}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <TextInput
                style={[styles.textInput, !field.editable && styles.textInputDisabled]}
                value={form[field.key]}
                onChangeText={text => {
                  if (field.editable) setForm(prev => ({ ...prev, [field.key]: text }));
                }}
                placeholder={field.placeholder}
                placeholderTextColor="#94A3B8"
                editable={field.editable}
                keyboardType={field.keyboardType ?? 'default'}
                autoCapitalize={field.keyboardType === 'email-address' ? 'none' : 'words'}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  saveBtn: { width: 36, alignItems: 'flex-end' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  scrollContent: { padding: 16, gap: 16 },
  avatarCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', elevation: 4 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E2E8F0' },
  avatarInitials: { fontSize: 32, fontWeight: 'bold', color: '#2563EB' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF',
  },
  avatarNote: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 4 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 16 },
  inputGroup: { paddingVertical: 12 },
  inputGroupBorder: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  inputLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { fontSize: 15, color: '#1E293B', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  textInputDisabled: { backgroundColor: '#F1F5F9', color: '#94A3B8' },
  saveButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
