import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, userDB } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignUpScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 👇 Dono passwords ke liye alag show/hide state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullName || !email || !confirmEmail || !password || !confirmPassword) {
      Alert.alert("Error", "Kripya saari details fill karein.");
      return;
    }

    // 👇 Check 1: Email match hona chahiye
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      Alert.alert("Error", "Dono Email addresses match nahi kar rahe hain.");
      return;
    }

    // 👇 Check 2: Password match hona chahiye
    if (password !== confirmPassword) {
      Alert.alert("Error", "Dono Passwords match nahi kar rahe hain.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password kam se kam 6 characters ka hona chahiye.");
      return;
    }

    setLoading(true);
    try {
      // 1. Firebase Auth me naya user create karein
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const userId = userCredential.user.uid;

      // 2. RTDB me user ki details save karein
      const now = new Date();
      const signupDateTime = now.toLocaleString('en-GB');

      await set(ref(userDB, `users/${userId}`), {
        FullName: fullName,
        Email: email.trim(),
        SignUp_Date: signupDateTime,
        Devices_Count: 0
      });

      // 3. Email/Password local memory me save karein
      await AsyncStorage.setItem('savedEmail', email.trim());
      await AsyncStorage.setItem('savedPassword', password);

      setLoading(false);
      Alert.alert("Success", "Account ban gaya! Ab aap login kar sakte hain.");
      navigation.navigate('SignIn');
      
    } catch (error) {
      setLoading(false);
      let errorMsg = "Sign Up fail ho gaya.";
      if (error.code === 'auth/email-already-in-use') errorMsg = "Ye email pehle se registered hai.";
      else if (error.code === 'auth/weak-password') errorMsg = "Password kamzor hai.";
      
      Alert.alert("Sign Up Failed", errorMsg);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        <Image source={require('../assets/ove_logo.png')} style={styles.logoImage} resizeMode="contain" />
      </View>

      <Text style={styles.headerText}>Create Account</Text>
      <Text style={styles.subText}>Join us to monitor your battery</Text>

      <TextInput 
        label="Full Name" 
        value={fullName}
        onChangeText={setFullName}
        mode="outlined" 
        style={styles.input} 
        theme={{ colors: { primary: '#D32F2F' } }} 
        left={<TextInput.Icon icon="account" color="#D32F2F" />} 
      />
      
      {/* 👇 Email Box 1 */}
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

      {/* 👇 Email Box 2 (Confirm) */}
      <TextInput 
        label="Confirm Email" 
        value={confirmEmail}
        onChangeText={setConfirmEmail}
        mode="outlined" 
        style={styles.input} 
        keyboardType="email-address" 
        autoCapitalize="none"
        theme={{ colors: { primary: '#D32F2F' } }} 
        left={<TextInput.Icon icon="email-check" color="#D32F2F" />} 
      />
      
      {/* 👇 Password Box 1 */}
      <TextInput 
        label="Password" 
        value={password}
        onChangeText={setPassword}
        mode="outlined" 
        secureTextEntry={!showPassword}
        style={styles.input} 
        theme={{ colors: { primary: '#D32F2F' } }}
        left={<TextInput.Icon icon="lock" color="#D32F2F" />}
        right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} color="#D32F2F" onPress={() => setShowPassword(!showPassword)} />}
      />

      {/* 👇 Password Box 2 (Confirm) */}
      <TextInput 
        label="Confirm Password" 
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        mode="outlined" 
        secureTextEntry={!showConfirmPassword}
        style={styles.input} 
        theme={{ colors: { primary: '#D32F2F' } }}
        left={<TextInput.Icon icon="lock-check" color="#D32F2F" />}
        right={<TextInput.Icon icon={showConfirmPassword ? "eye-off" : "eye"} color="#D32F2F" onPress={() => setShowConfirmPassword(!showConfirmPassword)} />}
      />

      <Button 
        mode="contained" 
        onPress={handleSignUp} 
        style={styles.btn} 
        buttonColor="#D32F2F"
        loading={loading}
        disabled={loading}
      >
        {loading ? "Creating Account..." : "Sign Up"}
      </Button>

      <TouchableOpacity onPress={() => navigation.navigate('SignIn')} style={styles.linkBox}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.boldText}>Sign In</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#FFF5F5', justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 180, height: 80 },
  headerText: { fontSize: 28, fontWeight: 'bold', marginBottom: 5, color: '#B71C1C', textAlign: 'center' },
  subText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 30 },
  input: { marginBottom: 12, backgroundColor: '#fff' }, // Margin thoda kam kiya taaki saare boxes fit ho jayein
  btn: { marginTop: 15, paddingVertical: 6, borderRadius: 8 },
  linkBox: { marginTop: 20, alignItems: 'center', marginBottom: 20 },
  linkText: { color: '#666', fontSize: 14 },
  boldText: { color: '#D32F2F', fontWeight: 'bold' },
});