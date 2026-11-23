import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BleManager from 'react-native-ble-manager';


// Screens Import
import SplashScreen from './screens/SplashScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import NetworkSetupScreen from './screens/NetworkSetupScreen';
import BMSSetupScreen from './screens/BMSSetupScreen';
import DashboardScreen from './screens/DashboardScreen';
import DeviceDetailsScreen from './screens/DeviceDetailsScreen'; // 👈 Naya Screen Import
import DeviceSetupScreen from './screens/DeviceSetupScreen';
import SettingsScreen from './screens/SettingsScreen'; // 👈 Import
import LocalMonitoringScreen from './screens/LocalMonitoringScreen';
import LiveDashboardScreen from './screens/LiveDashboardScreen';
import LiveDetailsScreen from './screens/LiveDetailsScreen';
import LiveSettingsScreen from './screens/LiveSettingsScreen';

const Stack = createStackNavigator();

// Red Theme Configuration
const customTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#D32F2F',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFCDD2',
    secondary: '#B71C1C',
    background: '#FFF5F5',
    surface: '#FFFFFF',
    text: '#212121',
    onSurfaceVariant: '#666666',
  },
};

export default function App() {
  const [isSplash, setIsSplash] = useState(true);

  useEffect(() => {
    setTimeout(() => setIsSplash(false), 3500);

  }, []);

  if (isSplash) return <SplashScreen />;
  useEffect(() => {
  BleManager.start({ showAlert: false })
    .then(() => console.log('✅ BleManager initialized'))
    .catch((err) => console.log('❌ BleManager start error:', err));
}, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={customTheme}>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="SignIn"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="NetworkSetup" component={NetworkSetupScreen} />
            <Stack.Screen name="BMSSetup" component={BMSSetupScreen} />
            <Stack.Screen name="LocalMonitoring" component={LocalMonitoringScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="DeviceDetails" component={DeviceDetailsScreen} />
            <Stack.Screen name="DeviceSetup" component={DeviceSetupScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="LiveDashboard" component={LiveDashboardScreen} />
            <Stack.Screen name="LiveDetails" component={LiveDetailsScreen} />
            <Stack.Screen name="LiveSettings" component={LiveSettingsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}