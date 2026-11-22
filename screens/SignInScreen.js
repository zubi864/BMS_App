import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { TextInput, Button, Text, Divider } from 'react-native-paper';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { auth, userDB } from '../firebaseConfig'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Forgot Password states
  const [forgotVisible, setForgotVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // 👇 Sign In Function
  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Kripya Email aur Password dono enter karein.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userId = userCredential.user.uid;

      const now = new Date();
      const signInDateTime = now.toLocaleString('en-GB');
      
      await update(ref(userDB, `users/${userId}`), {
        SignIn_Date: signInDateTime
      });

      await AsyncStorage.setItem('savedEmail', email.trim());
      await AsyncStorage.setItem('savedPassword', password);

      setLoading(false);
      navigation.replace('Dashboard');
      
    } catch (error) {
      setLoading(false);
      let errorMsg = "Login fail ho gaya. Dobara koshish karein.";
      if (error.code === 'auth/user-not-found') errorMsg = "Is email se koi account nahi mila.";
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') errorMsg = "Password galat hai.";
      else if (error.code === 'auth/invalid-email') errorMsg = "Email ka format galat hai.";
      
      Alert.alert("Login Failed", errorMsg);
    }
  };

  // 👇 Forgot Password Function
  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Alert.alert("Error", "Kripya apna registered Email enter karein.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetLoading(false);
      setForgotVisible(false);
      setResetEmail('');
      Alert.alert("Email Sent", "Password reset link aapke email par bhej diya gaya hai. Inbox check karein.");
    } catch (error) {
      setResetLoading(false);
      let errorMsg = "Email bhejne me masla hua.";
      if (error.code === 'auth/user-not-found') errorMsg = "Is email se koi account nahi mila.";
      else if (error.code === 'auth/invalid-email') errorMsg = "Email ka format galat hai.";
      
      Alert.alert("Error", errorMsg);
    }
  };

  return (
    <View style={styles.container}>
      {/* Agar Forgot Password ka popup khula hai */}
      {forgotVisible ? (
        <View style={styles.forgotContainer}>
          <Text style={styles.headerText}>Reset Password</Text>
          <Text style={styles.subText}>Apna email daalein, hum reset link bhej denge.</Text>

          <TextInput
            label="Email Address"
            value={resetEmail}
            onChangeText={setResetEmail}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            theme={{ colors: { primary: '#D32F2F' } }}
            left={<TextInput.Icon icon="email" color="#D32F2F" />}
          />

          <Button 
            mode="contained" 
            onPress={handleForgotPassword} 
            style={styles.btnCloud} 
            buttonColor="#D32F2F"
            loading={resetLoading}
            disabled={resetLoading}
          >
            {resetLoading ? "Sending..." : "Send Reset Link"}
          </Button>

          <TouchableOpacity onPress={() => setForgotVisible(false)} style={styles.linkBox}>
            <Text style={styles.linkText}>Back to <Text style={styles.boldText}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      ) : (
        // 👇 Normal Sign In UI
        <>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/ove_logo.png')} style={styles.logoImage} resizeMode="contain" />
          </View>

          <Text style={styles.headerText}>Welcome Back</Text>
          <Text style={styles.subText}>Sign in to manage your Dongle</Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            theme={{ colors: { primary: '#D32F2F' } }}
            left={<TextInput.Icon icon="email" color="#D32F2F" />}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
            theme={{ colors: { primary: '#D32F2F' } }}
            left={<TextInput.Icon icon="lock" color="#D32F2F" />}
            right={
              <TextInput.Icon 
                icon={showPassword ? "eye-off" : "eye"} 
                color="#D32F2F" 
                onPress={() => setShowPassword(!showPassword)} 
              />
            }
          />

          {/* 👇 Forgot Password Link */}
          <TouchableOpacity onPress={() => setForgotVisible(true)} style={{ alignSelf: 'flex-end', marginBottom: 15 }}>
            <Text style={{ color: '#D32F2F', fontSize: 14, fontWeight: 'bold' }}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button 
            mode="contained" 
            onPress={handleSignIn} 
            style={styles.btnCloud} 
            buttonColor="#D32F2F"
            loading={loading}
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In (Cloud)"}
          </Button>

          <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.linkBox}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.boldText}>Sign Up</Text></Text>
          </TouchableOpacity>

          <Divider style={styles.divider} />

          <Button mode="outlined" icon="wifi" onPress={() => navigation.navigate('NetworkSetup')} style={styles.btnOutline} textColor="#D32F2F">
            Network Setup
          </Button>

          <Button mode="outlined" icon="battery" onPress={() => navigation.navigate('BMSSetup')} style={[styles.btnOutline, { marginTop: 10 }]} textColor="#D32F2F">
            BMS Setup
          </Button>

          <Button mode="outlined" icon="bluetooth" onPress={() => navigation.navigate('LocalMonitoring')} style={[styles.btnOutline, { marginTop: 10, borderColor: '#D32F2F' }]} textColor="#D32F2F">
            Local Bluetooth Monitoring
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#FFF5F5', justifyContent: 'center' },
  forgotContainer: { flex: 1, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 180, height: 80 },
  headerText: { fontSize: 28, fontWeight: 'bold', marginBottom: 5, color: '#B71C1C', textAlign: 'center' },
  subText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 30 },
  input: { marginBottom: 16, backgroundColor: '#fff' },
  btnCloud: { marginTop: 10, paddingVertical: 6, borderRadius: 8 },
  linkBox: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#666', fontSize: 14 },
  boldText: { color: '#D32F2F', fontWeight: 'bold' },
  divider: { marginVertical: 30, backgroundColor: '#FFCDD2' },
  btnOutline: { paddingVertical: 6, borderRadius: 8, borderColor: '#D32F2F' },
});