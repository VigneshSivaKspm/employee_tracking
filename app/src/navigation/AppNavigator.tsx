import React from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { LOGO } from '../constants/brand';
import { useTabBarLayout, useTopInset } from '../hooks/useBottomSpacing';
import { AttendanceProvider } from '../context/AttendanceContext';

import type { RootStackParamList, BottomTabParamList } from '../types';

// Auth screens
import SplashScreen from '../screens/auth/SplashScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import PermissionsScreen from '../screens/auth/PermissionsScreen';

// Main tab screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import LeaveManagementScreen from '../screens/leave/LeaveManagementScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SalesScreen from '../screens/sales/SalesScreen';

// Stack screens (push/modal)
import ApplyLeaveScreen from '../screens/leave/ApplyLeaveScreen';
import LeaveHistoryScreen from '../screens/leave/LeaveHistoryScreen';
import AttendanceHistoryScreen from '../screens/attendance/AttendanceHistoryScreen';
import AnnouncementDetailsScreen from '../screens/announcements/AnnouncementDetailsScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import SubscriptionPlansScreen from '../screens/subscription/SubscriptionPlansScreen';
import PaymentMethodScreen from '../screens/payment/PaymentMethodScreen';
import PaymentGatewayScreen from '../screens/payment/PaymentGatewayScreen';
import PaymentSuccessScreen from '../screens/payment/PaymentSuccessScreen';
import TargetsScreen from '../screens/targets/TargetsScreen';
import { EnterpriseSyncProvider } from '../context/EnterpriseSyncContext';
import ServiceRequestScreen from '../screens/service/ServiceRequestScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

type TabIconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<keyof BottomTabParamList, { active: TabIconName; inactive: TabIconName }> = {
  Dashboard: { active: 'home', inactive: 'home-outline' },
  Tasks: { active: 'checkbox', inactive: 'checkbox-outline' },
  Sales: { active: 'wallet', inactive: 'wallet-outline' },
  Analytics: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

const TAB_LABELS: Record<keyof BottomTabParamList, string> = {
  Dashboard: 'Home',
  Tasks: 'Tasks',
  Sales: 'Sales',
  Analytics: 'Analytics',
  Profile: 'Profile',
};

function MainTabs() {
  const { bottomInset, height: tabBarHeight } = useTabBarLayout();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={size - 2} color={color} />;
        },
        tabBarLabel: TAB_LABELS[route.name],
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Tasks" component={TargetsScreen} />
      <Tab.Screen name="Sales" component={SalesScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthenticatedNavigator() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <EnterpriseSyncProvider user={user}>
    <AttendanceProvider user={user}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          statusBarTranslucent: false,
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />

        {/* Attendance and Leave are bottom tabs — no stack entry needed */}

        {/* Leave screens */}
        <Stack.Screen
          name="ApplyLeave"
          component={ApplyLeaveScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="LeaveHistory"
          component={LeaveHistoryScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Leave"
          component={LeaveManagementScreen}
          options={{ animation: 'slide_from_right' }}
        />

        {/* Attendance (punch in/out — opened from Home quick action) */}
        <Stack.Screen
          name="Attendance"
          component={AttendanceScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AttendanceHistory"
          component={AttendanceHistoryScreen}
          options={{ animation: 'slide_from_right' }}
        />

        {/* Announcements */}
        <Stack.Screen
          name="AnnouncementDetail"
          component={AnnouncementDetailsScreen}
          options={{ animation: 'slide_from_right' }}
        />

        {/* Profile */}
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
          options={{ animation: 'slide_from_right' }}
        />

        {/* Settings & Notifications */}
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ animation: 'slide_from_right' }}
        />

        {/* Subscription & Payment */}
        <Stack.Screen
          name="SubscriptionPlans"
          component={SubscriptionPlansScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PaymentMethod"
          component={PaymentMethodScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PaymentGateway"
          component={PaymentGatewayScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PaymentSuccess"
          component={PaymentSuccessScreen}
          options={{ animation: 'fade', presentation: 'fullScreenModal' }}
        />

        {/* Feature screens */}
        <Stack.Screen
          name="ServiceRequests"
          component={ServiceRequestScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Sales"
          component={SalesScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </AttendanceProvider>
    </EnterpriseSyncProvider>
  );
}

function UnauthenticatedNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarTranslucent: false,
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const topInset = useTopInset();

  if (isLoading) {
    return (
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={[loadingStyles.container, { paddingTop: topInset }]}
      >
        <Image source={LOGO} style={loadingStyles.logo} resizeMode="contain" />
        <ActivityIndicator size="large" color="#FFFFFF" style={loadingStyles.spinner} />
      </LinearGradient>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AuthenticatedNavigator /> : <UnauthenticatedNavigator />}
    </NavigationContainer>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
});
