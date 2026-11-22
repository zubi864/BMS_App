import React, { useState } from 'react';
import { View, StyleSheet, Alert, Platform, PermissionsAndroid, ScrollView } from 'react-native';
import { Button, Text, Card, Title, List, Divider } from 'react-native-paper';
import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export default function BMSConnectScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1: Reconnect Dongle, 2: Select BMS, 3: Restart
  const [loading, setLoading] = useState(false);
  
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [bmsList, setBmsList] = useState([]);

  // 1. Dongle se dobara connect karein
  const scanAndReconnect = async () => {
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
    
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) { setLoading(false); return; }
      if (device && device.name === 'BMS_Config') {
        setDevices(prev => {
          if (!prev.find(d => d.id === device.id)) return [...prev, device];
          return prev;
        });
      }
    });

    setTimeout(() => { manager.stopDeviceScan(); setLoading(false); }, 10000); 
  };

  const connectToDongle = async (device) => {
    manager.stopDeviceScan();
    setLoading(true);
    try {
      const conn = await device.connect();
      await conn.discoverAllServicesAndCharacteristics();
      setConnectedDevice(conn);
      
      conn.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID, (err, char) => {
        if (err) return;
        if (char?.value) {
          const resp = atob(char.value);
          console.log("Dongle Response:", resp);
          if (resp.includes("devices")) {
            try {
              const json = JSON.parse(resp);
              setBmsList(json.devices || []);
            } catch (e) { console.log("JSON Parse Error", e); }
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

  // 2. BMS List Fetch karein
  const fetchBMSList = async () => {
    setLoading(true);
    setBmsList([]); 
    try {
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHAR_UUID, btoa("LIST")
      );
      setTimeout(() => setLoading(false), 3000);
    } catch (e) {
      Alert.alert("Error", "LIST command fail");
      setLoading(false);
    }
  };

  // 3. BMS ko add aur connect karein
  const addBMS = async (index) => {
    setLoading(true);
    try {
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHAR_UUID, btoa(`ADD|${index}`)
      );
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHAR_UUID, btoa("CONNECTALL")
      );
      setTimeout(() => {
        setLoading(false);
        setStep(3); 
      }, 3000);
    } catch (e) {
      Alert.alert("Error", "BMS Add fail");
      setLoading(false);
    }
  };

  // 4. Restart Dongle
  const restartDongle = async () => {
    setLoading(true);
    try {
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHAR_UUID, btoa("RESTART")
      );
      Alert.alert("Success", "Dongle restart ho raha hai!");
      setLoading(false);
      setTimeout(() => navigation.replace('Dashboard'), 2000);
    } catch (e) {
      Alert.alert("Error", "Restart fail");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {step === 1 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 3: Reconnect Dongle</Title>
              <Text style={styles.infoText}>
                Dongle ne WiFi connect kar liya hai. Ab hume BMS connect karne ke liye dobara Dongle se BLE connect karna hoga.
              </Text>
              <Button mode="outlined" onPress={scanAndReconnect} loading={loading} style={styles.btn}>
                Scan & Connect Dongle
              </Button>
              {devices.map((item, index) => (
                <View key={index}>
                  <List.Item 
                    title={item.name} 
                    description={`MAC: ${item.id}`} 
                    left={props => <List.Icon {...props} icon="bluetooth" />} 
                    onPress={() => connectToDongle(item)} 
                  />
                  <Divider />
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {step === 2 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 4: Select BMS</Title>
              <Button mode="outlined" onPress={fetchBMSList} loading={loading} style={styles.btn}>
                Fetch BMS List
              </Button>
              {bmsList.length === 0 && !loading && (
                <Text style={styles.infoText}>Button dabayein BMS list laane ke liye.</Text>
              )}
              {bmsList.map((item, index) => (
                <View key={index}>
                  <List.Item
                    title={item.name}
                    description={`MAC: ${item.mac}`}
                    left={props => <List.Icon {...props} icon="battery" />}
                    onPress={() => addBMS(item.index)} 
                  />
                  <Divider />
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {step === 3 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={[styles.title, { color: 'green' }]}>All Set! 🎉</Title>
              <Text style={styles.infoText}>BMS connect ho gaya. Ab Dongle ko restart karein.</Text>
              <Button mode="contained" onPress={restartDongle} loading={loading} style={[styles.btn, { backgroundColor: '#FF5722' }]}>
                Restart Dongle
              </Button>
            </Card.Content>
          </Card>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { padding: 10, elevation: 4, borderRadius: 10 },
  title: { textAlign: 'center', marginBottom: 20, fontSize: 22, fontWeight: 'bold' },
  btn: { marginTop: 10, paddingVertical: 5 },
  infoText: { textAlign: 'center', marginTop: 10, color: 'gray', marginBottom: 15 }
});