import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Easing, Image } from 'react-native';
import * as Animatable from 'react-native-animatable';

export default function SplashScreen() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPulse = (animValue, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    createPulse(ring1, 0).start();
    createPulse(ring2, 800).start();
    createPulse(ring3, 1600).start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3500,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, []);

  const ringStyle = (animValue) => ({
    transform: [
      {
        scale: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 2.5],
        }),
      },
    ],
    opacity: animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.8, 0.3, 0],
    }),
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Animated.View style={[styles.ring, ringStyle(ring1)]} />
        <Animated.View style={[styles.ring, ringStyle(ring2)]} />
        <Animated.View style={[styles.ring, ringStyle(ring3)]} />

        <Animatable.View animation="zoomIn" duration={1200} style={styles.logoBox}>
          <Image 
            source={require('../assets/ove_logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain"
          />
        </Animatable.View>
      </View>

      <Animatable.Text animation="fadeInUp" delay={500} duration={1000} style={styles.title}>
        BMS Manager
      </Animatable.Text>

      <Animatable.Text animation="fadeIn" delay={1200} duration={1000} style={styles.subtitle}>
        Smart Battery Monitoring
      </Animatable.Text>

      <View style={styles.loadingWrapper}>
        <Animated.View 
          style={[
            styles.loadingBar, 
            { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F5' },
  logoContainer: { justifyContent: 'center', alignItems: 'center', width: 250, height: 250, marginBottom: 20 },
  ring: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFCDD2', borderWidth: 2, borderColor: '#D32F2F' },
  logoBox: { backgroundColor: '#fff', padding: 15, borderRadius: 20, elevation: 10, shadowColor: '#D32F2F', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  logoImage: { width: 180, height: 90 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#B71C1C', letterSpacing: 1.5, marginTop: 20 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 8, letterSpacing: 1 },
  loadingWrapper: { position: 'absolute', bottom: 70, width: '60%', height: 6, backgroundColor: '#FFCDD2', borderRadius: 3, overflow: 'hidden' },
  loadingBar: { height: '100%', backgroundColor: '#D32F2F', borderRadius: 3 }
});