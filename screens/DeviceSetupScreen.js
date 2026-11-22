import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Platform, PermissionsAndroid, ScrollView } from 'react-native';
import { TextInput, Button, Text, Card, Title, List, Divider, ActivityIndicator, ProgressBar } from 'react-native-paper';
import { BleManager } from 'react-native-ble-plx';
import WifiInfo from 'react-native-wifi-info';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  getReactNativePersistence, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import DeviceInfo from 'react-native-device-info';

const manager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export default function DeviceSetupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progress, setProgress] = useState(0);

  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [bmsList, setBmsList] = useState([]);
  
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 👇 useRef use kiya taaki state reset na ho
  const receivedEspInfoRef = useRef(null);

  useEffect(() => {
    const getCurrentWifi = async () => {
      try {
        const wifi = await WifiInfo.getCurrentWifiInfo();
        if (wifi && wifi.ssid) setSsid(wifi.ssid);
      } catch (e) {}
    };
    getCurrentWifi();
  }, []);

  const scanBLE = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
      } catch (err) {}
    }

    setLoading(true);
    setDevices([]);
    manager.stopDeviceScan(); 

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) { setLoading(false); return; }
      if (device && device.name && device.name.startsWith('BMS_Config')) {
        setDevices(prev => (!prev.find(d => d.id === device.id)) ? [...prev, device] : prev);
      }
    });

    setTimeout(() => { manager.stopDeviceScan(); setLoading(false); }, 10000); 
  };

  const connectToDongle = async (device) => {
    manager.stopDeviceScan();
    setLoading(true);
    try {
      const conn = await device.connect();
      await conn.requestMTU(512); 
      await conn.discoverAllServicesAndCharacteristics();
      setConnectedDevice(conn);
      
      let receivedData = "";
      conn.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID, (err, char) => {
        if (err) return;
        if (char?.value) {
          const chunk = atob(char.value);
          receivedData += chunk; 

          if (receivedData.includes("\n")) {
            const messages = receivedData.split("\n");
            for (let i = 0; i < messages.length - 1; i++) {
              const resp = messages[i].trim();
              if (!resp) continue;
              console.log("📩 Reply:", resp);

              if (resp.includes("devices")) {
                try { setBmsList(JSON.parse(resp).devices || []); } catch (e) {}
              } 
              else if (resp.includes("XXSECRETXX")) {
                try { 
                  receivedEspInfoRef.current = JSON.parse(resp); 
                  console.log("Info Save ho gayi");
                } catch (e) {}
              }
              else if (resp === "OK|WiFi+Firebase") {
                setProgressText("WiFi Connected! Fetching BMS...");
                setProgress(0.6);
                // Chhota sa delay taaki list fetch ho sake
                setTimeout(async () => {
                  try {
                    await conn.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID, btoa("LIST"));
                    setTimeout(() => { setLoading(false); setStep(3); setProgress(0); }, 2000);
                  } catch (e) { console.log(e); }
                }, 500);
              }
            }
            receivedData = messages[messages.length - 1];
          }
        }
      });

      setStep(2);
      setLoading(false);
    } catch (e) {
      Alert.alert("Error", "Connect fail: " + e.message);
      setLoading(false);
    }
  };

  const sendWiFi = async () => {
    if (!ssid) return Alert.alert("Error", "WiFi SSID enter karein");
    if (!password) return Alert.alert("Error", "Password daalein");
    
    setLoading(true);
    setProgressText("Connecting WiFi...");
    setProgress(0.3);
    try {
      const cmd = `WIFI|${ssid}|${password}`;
      await connectedDevice.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID, btoa(cmd));
    } catch (e) {
      Alert.alert("Error", "WiFi command fail");
      setLoading(false);
      setProgress(0);
    }
  };

    const selectBMSAndSave = async (index) => {
    setLoading(true);
    setProgressText("Adding BMS...");
    setProgress(0.3);

    try {
      await connectedDevice.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID, btoa(`ADD|${index}`));
      await new Promise(r => setTimeout(r, 1500));

      setProgressText("Fetching Dongle Info...");
      setProgress(0.6);
      await connectedDevice.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID, btoa("GET_INFO"));
      
      await new Promise(r => setTimeout(r, 2000));

      const espInfo = receivedEspInfoRef.current;

      if (!espInfo) {
        throw new Error("Dongle se info nahi mili. Dobara try karein.");
      }

      setProgressText("Authenticating...");
      setProgress(0.8);
      const realApiKey = espInfo.apiKey.replace("XXSECRETXX", "");
      
      let batteryApp;
      try { 
        batteryApp = initializeApp({ apiKey: realApiKey, projectId: espInfo.projectId }, "BatteryProject"); 
      } catch (e) { 
        batteryApp = getApp("BatteryProject"); 
      }
      
      let batteryAuth;
      try {
        batteryAuth = initializeAuth(batteryApp, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
      } catch (error) {
        batteryAuth = getAuth(batteryApp);
      }
      
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      const savedPassword = await AsyncStorage.getItem('savedPassword');

      if (savedEmail && savedPassword) {
        try { 
          await signInWithEmailAndPassword(batteryAuth, savedEmail, savedPassword); 
        } 
        catch (error) { 
          if (error.code === 'auth/user-not-found') {
            await createUserWithEmailAndPassword(batteryAuth, savedEmail, savedPassword); 
          }
        }
      }

      setProgressText("Saving Device...");
      setProgress(0.9);
      const deviceData = {
        mac: espInfo.mac,
        name: espInfo.name,
        projectId: espInfo.projectId,
        apiKey: realApiKey
      };

      let devicesArray = JSON.parse(await AsyncStorage.getItem('userDevices')) || [];
      if (!devicesArray.find(d => d.mac === deviceData.mac)) {
        devicesArray.push(deviceData);
        await AsyncStorage.setItem('userDevices', JSON.stringify(devicesArray));
      }

      setProgress(1);
      
      // 👇 RESTART bhejein par error ko ignore karein
      try {
        await connectedDevice.writeCharacteristicWithResponseForService(
          SERVICE_UUID, 
          CHAR_UUID, 
          btoa("RESTART")
        );
      } catch (error) {
        // ESP32 reset hone ki wajah se BLE disconnect ho jayega, usko ignore karein
        console.log("Restart command bhej di, connection drop hua.");
      }

      await new Promise(r => setTimeout(r, 500));
      setLoading(false);
      navigation.replace('Dashboard');

    } catch (e) {
      console.log("Process Error Detail:", e); 
      Alert.alert("Process Error", e.message || "Kuch ghalat ho gaya");
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.statusBar, { backgroundColor: connectedDevice ? '#E8F5E9' : '#FFEBEE' }]}>
        <Text style={{ color: connectedDevice ? '#2E7D32' : '#C62828', fontWeight: 'bold' }}>
          {connectedDevice ? `Connected: ${connectedDevice.name}` : 'Status: Disconnected'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {step === 1 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 1: Select Dongle</Title>
              <Button mode="contained" onPress={scanBLE} loading={loading} buttonColor="#D32F2F">
                Scan for Dongle
              </Button>
              {devices.map((item, index) => (
                <List.Item key={index} title={item.name} description={`ID: ${item.id}`} left={props => <List.Icon {...props} icon="bluetooth" />} onPress={() => connectToDongle(item)} />
              ))}
            </Card.Content>
          </Card>
        )}

        {step === 2 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 2: WiFi Setup</Title>
              <TextInput label="WiFi SSID" value={ssid} onChangeText={setSsid} mode="outlined" style={{ marginBottom: 10 }} />
              <TextInput label="WiFi Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} mode="outlined" style={{ marginBottom: 15 }} />
              <Button mode="contained" onPress={sendWiFi} loading={loading} buttonColor="#D32F2F">
                Connect WiFi & Next
              </Button>
            </Card.Content>
          </Card>
        )}

        {step === 3 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 3: Select BMS</Title>
              {bmsList.map((item, index) => (
                <List.Item key={index} title={item.name} description={`MAC: ${item.mac}`} left={props => <List.Icon {...props} icon="battery" />} onPress={() => selectBMSAndSave(item.index)} />
              ))}
            </Card.Content>
          </Card>
        )}

        {loading && progress > 0 && (
          <Card style={styles.progressCard}>
            <Card.Content>
              <ActivityIndicator animating={true} color="#D32F2F" style={{ marginBottom: 10 }} />
              <Text style={{ textAlign: 'center', marginBottom: 10 }}>{progressText}</Text>
              <ProgressBar progress={progress} color="#D32F2F" />
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  statusBar: { padding: 10, alignItems: 'center' },
  scrollContainer: { padding: 20 },
  card: { marginVertical: 10, padding: 10, backgroundColor: '#fff' },
  title: { textAlign: 'center', marginBottom: 15, fontWeight: 'bold', color: '#B71C1C' },
  progressCard: { marginVertical: 20, padding: 20, backgroundColor: '#fff', elevation: 5 }
});