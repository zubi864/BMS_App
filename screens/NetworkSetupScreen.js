import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, PermissionsAndroid, ScrollView } from 'react-native';
import { TextInput, Button, Text, Card, Title, List, Divider, IconButton } from 'react-native-paper';
import { BleManager } from 'react-native-ble-plx';
import WifiInfo from 'react-native-wifi-info';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const manager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export default function NetworkSetupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1); // 1: Dongle Scan, 2: WiFi Setup
  const [loading, setLoading] = useState(false);
  
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
      if (error) { 
        console.log("Scan Error:", error);
        setLoading(false); 
        return; 
      }
      // ESP32 ka naya dynamic naam (BMS_Config_XXXX)
      if (device && device.name && device.name.startsWith('BMS_Config')) {
        setDevices(prev => {
          if (!prev.find(d => d.id === device.id)) return [...prev, device];
          return prev;
        });
      }
    });

    setTimeout(() => { 
      manager.stopDeviceScan(); 
      setLoading(false); 
    }, 15000); 
  };

  const connectToDongle = async (device) => {
    manager.stopDeviceScan();
    setLoading(true);
    try {
      const conn = await device.connect();
      await conn.requestMTU(512); 
      await conn.discoverAllServicesAndCharacteristics();
      setConnectedDevice(conn);
      
      conn.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID, (err, char) => {
        if (err) return;
        if (char?.value) {
          const resp = atob(char.value);
          if (resp.includes("OK|WiFi")) {
            // WiFi save hone ke baad ab hum BMSSetup page par jayenge
            Alert.alert("Success", "WiFi Connected! Ab BMS select karein.");
            navigation.replace('BMSSetup'); 
          } else if (resp.includes("ERROR")) {
            Alert.alert("Error", "WiFi connect nahi hua.");
            setLoading(false);
          }
        }
      });

      setStep(2); 
    } catch (e) {
      Alert.alert("Error", "Connect fail: " + e.message);
    }
    setLoading(false);
  };

  const sendWiFi = async () => {
    if (!ssid) return Alert.alert("Error", "WiFi SSID enter karein");
    if (!password) return Alert.alert("Error", "Password daalein");
    
    setLoading(true);
    try {
      const cmd = `WIFI|${ssid}|${password}`;
      await connectedDevice.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID, btoa(cmd));
    } catch (e) {
      Alert.alert("Error", "WiFi command fail");
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      <View style={[styles.statusBar, { backgroundColor: connectedDevice ? '#E8F5E9' : '#FFEBEE' }]}>
        <Text style={{ color: connectedDevice ? '#2E7D32' : '#C62828', fontWeight: 'bold', fontSize: 13 }}>
          {connectedDevice ? `Connected: ${connectedDevice.name || connectedDevice.id}` : 'Status: Disconnected'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {step === 1 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 1: Connect Dongle</Title>
              <Button mode="contained" onPress={scanBLE} loading={loading} style={styles.btn} buttonColor="#D32F2F">
                Scan for Dongle
              </Button>
              {loading && <Text style={styles.infoText}>Scanning...</Text>}
              {devices.map((item, index) => (
                <View key={index}>
                  <List.Item title={item.name || "Unknown"} description={`MAC: ${item.id}`} left={props => <List.Icon {...props} icon="bluetooth" color="#D32F2F" />} onPress={() => connectToDongle(item)} />
                  <Divider />
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {step === 2 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 2: WiFi Setup</Title>
              <View style={styles.inputRow}>
                <TextInput label="WiFi SSID" value={ssid} onChangeText={setSsid} mode="outlined" style={styles.inputFlex} theme={{ colors: { primary: '#D32F2F' } }} />
                <IconButton icon="wifi" mode="contained" size={24} iconColor="#fff" containerColor="#D32F2F" onPress={() => Alert.alert("Info", "Enter manually")} style={{ marginTop: 6 }} />
              </View>
              <TextInput
                label="WiFi Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                mode="outlined"
                style={styles.input}
                theme={{ colors: { primary: '#D32F2F' } }}
                right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} color="#D32F2F" onPress={() => setShowPassword(!showPassword)} />}
              />
              <Button mode="contained" onPress={sendWiFi} loading={loading} style={styles.btn} buttonColor="#D32F2F">
                Save WiFi & Next
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  statusBar: { padding: 10, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { padding: 10, elevation: 4, borderRadius: 10, backgroundColor: '#fff' },
  title: { textAlign: 'center', marginBottom: 10, fontSize: 22, fontWeight: 'bold', color: '#B71C1C' },
  input: { marginBottom: 15, backgroundColor: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  inputFlex: { flex: 1, backgroundColor: '#fff', marginRight: 8 },
  btn: { marginTop: 10, paddingVertical: 5 },
  infoText: { textAlign: 'center', marginTop: 10, color: 'gray' },
});