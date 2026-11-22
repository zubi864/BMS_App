import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, PermissionsAndroid, ScrollView } from 'react-native';
import { Button, Text, Card, Title, List, Divider, ActivityIndicator, ProgressBar, IconButton } from 'react-native-paper';
import { BleManager } from 'react-native-ble-plx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth as mainAuth, userDB } from '../firebaseConfig';

const manager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export default function BMSSetupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progress, setProgress] = useState(0);

  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [bmsList, setBmsList] = useState([]);
  
  const receivedEspInfoRef = React.useRef(null);

  // Bluetooth aur Location check
  const checkLocationAndBluetooth = async () => {
    const btState = await manager.state();
    if (btState !== 'PoweredOn') {
      Alert.alert("Bluetooth Off", "Kripya apna Bluetooth ON karein.");
      return false;
    }
    if (Platform.OS === 'android') {
      const isLocationEnabled = await DeviceInfo.isLocationEnabled();
      if (!isLocationEnabled) {
        Alert.alert("Location Off", "BLE scan ke liye GPS ON karein.");
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    checkLocationAndBluetooth();
  }, []);

  const scanAndReconnect = async () => {
    const isReady = await checkLocationAndBluetooth();
    if (!isReady) return;

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

              if (resp.includes("devices")) {
                try { setBmsList(JSON.parse(resp).devices || []); } catch (e) {}
              } 
              else if (resp.includes("XXSECRETXX")) {
                try { receivedEspInfoRef.current = JSON.parse(resp); } catch (e) {}
              }
              else if (resp === "OK|WiFi+Firebase") {
                setProgressText("WiFi Connected! Fetching BMS...");
                setProgress(0.6);
                connectedDeviceFunc(conn).fetchList();
              }
            }
            receivedData = messages[messages.length - 1];
          }
        }
      });

      setStep(2);
      setLoading(false);
      
      function connectedDeviceFunc(c) {
        return {
          fetchList: async () => {
            try {
              await c.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID, btoa("LIST"));
              setTimeout(() => { setLoading(false); setStep(3); setProgress(0); }, 2000);
            } catch (e) { console.log(e); }
          }
        };
      }
    } catch (e) {
      Alert.alert("Error", "Connect fail: " + e.message);
      setLoading(false);
    }
  };

  const disconnectDongle = async () => {
    if (connectedDevice) {
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
      setStep(1);
      setBmsList([]);
      receivedEspInfoRef.current = null;
    }
  };

  const sendWiFi = async () => {
    if (!connectedDevice) return;
    setLoading(true);
    setProgressText("Connecting WiFi...");
    setProgress(0.3);
    try {
      // WiFi logic here (same as before)
    } catch (e) {
      Alert.alert("Error", "WiFi command fail");
      setLoading(false);
    }
  };

  const selectBMSAndSave = async (index) => {
    // ... (Purana logic same rahega)
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* 👇 CONNECTION STATUS BAR */}
      {connectedDevice ? (
        <View style={[styles.statusBar, { backgroundColor: '#E8F5E9' }]}>
          <Text style={{ color: '#2E7D32', fontWeight: 'bold' }}>
            Connected: {connectedDevice.name || connectedDevice.id}
          </Text>
          <IconButton icon="close" size={20} iconColor="#C62828" onPress={disconnectDongle} style={{ margin: 0 }} />
        </View>
      ) : (
        <View style={[styles.statusBar, { backgroundColor: '#FFEBEE' }]}>
          <Text style={{ color: '#C62828', fontWeight: 'bold' }}>Status: Disconnected</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* 👇 Agar connected hai, toh scan UI hide karein */}
        {!connectedDevice && step === 1 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 1: Select Dongle</Title>
              <Button mode="contained" onPress={scanAndReconnect} loading={loading} buttonColor="#D32F2F">
                Scan for Dongle
              </Button>
              {devices.map((item, index) => (
                <List.Item key={index} title={item.name} description={`ID: ${item.id}`} left={props => <List.Icon {...props} icon="bluetooth" />} onPress={() => connectToDongle(item)} />
              ))}
            </Card.Content>
          </Card>
        )}

        {connectedDevice && step === 2 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 2: WiFi Setup</Title>
              <Button mode="contained" onPress={sendWiFi} loading={loading} buttonColor="#D32F2F">Connect WiFi & Next</Button>
            </Card.Content>
          </Card>
        )}

        {connectedDevice && step === 3 && (
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
  statusBar: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scrollContainer: { padding: 20 },
  card: { marginVertical: 10, padding: 10, backgroundColor: '#fff' },
  title: { textAlign: 'center', marginBottom: 15, fontWeight: 'bold', color: '#B71C1C' },
  progressCard: { marginVertical: 20, padding: 20, backgroundColor: '#fff', elevation: 5 }
});