import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset, useStackScreenBottomPadding } from '../../hooks/useBottomSpacing';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import BrandLogo from '../../components/common/BrandLogo';

type OnboardingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

interface Props {
  navigation: OnboardingScreenNavigationProp;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  color: string;
}

const slides: Slide[] = [
  {
    icon: 'finger-print-outline',
    title: 'Track Your Attendance',
    desc: 'Easily manage your attendance and keep track of your work hours in real time.',
    color: '#EFF6FF',
  },
  {
    icon: 'calendar-outline',
    title: 'Apply Leaves Hassle Free',
    desc: 'Submit leave requests and track approvals from your manager with ease.',
    color: '#F0FDF4',
  },
  {
    icon: 'notifications-outline',
    title: 'Stay Informed Always',
    desc: 'Get important updates and announcements from your organization instantly.',
    color: '#FFF7ED',
  },
];

const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const bottomPadding = useStackScreenBottomPadding(32);
  const headerTop = useTopInset(8);

  const handleSkip = () => {
    navigation.replace('Login');
  };

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      const nextIndex = activeIndex + 1;
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * nextIndex, animated: true });
      setActiveIndex(nextIndex);
    } else {
      navigation.replace('Login');
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const isLast = activeIndex === slides.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />

      {/* Skip Button + Brand */}
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <BrandLogo size="xs" showName theme="light" />
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => (
          <View key={index} style={styles.slide}>
            <View style={[styles.iconCircle, { backgroundColor: slide.color }]}>
              <Ionicons name={slide.icon} size={80} color="#2563EB" />
            </View>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideDesc}>{slide.desc}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Controls */}
      <View style={[styles.bottomSection, { paddingBottom: bottomPadding }]}>
        {/* Dot Indicators */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started Button */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextButtonText}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
          {!isLast && (
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.arrowIcon} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 32,
  },
  slideDesc: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 12,
    paddingHorizontal: 0,
  },
  bottomSection: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    borderRadius: 99,
  },
  activeDot: {
    width: 8,
    height: 8,
    backgroundColor: '#2563EB',
  },
  inactiveDot: {
    width: 6,
    height: 6,
    backgroundColor: '#CBD5E1',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 12,
    width: '100%',
    gap: 6,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  arrowIcon: {
    marginLeft: 2,
  },
});

export default OnboardingScreen;
