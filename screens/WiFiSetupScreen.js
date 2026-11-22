import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, PermissionsAndroid, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Card, Title, List, Divider, IconButton } from 'react-native-paper';
import { BleManager } from 'react-native-ble-plx';
import WifiInfo from 'react-native-wifi-info';
import WifiManager from "react-native-wifi-reborn"; // 👈 Naya Import

const manager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export default function WiFiSetupScreen({ navigation }) {
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // WiFi Scan Modal
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  const [wifiList, setWifiList] = useState([]);

  useEffect(() => {
    const getCurrentWifi = async () => {
      try {
        const wifi = await WifiInfo.getCurrentWifiInfo();
        if (wifi && wifi.ssid) setSsid(wifi.ssid);
      } catch (e) {}
    };
    getCurrentWifi();
  }, []);

  // 1. WiFi Scan karne ka function
  const scanWifiNetworks = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert("Permission Required", "WiFi scan ke liye Location allow karein.");
        return;
      }
    }

    try {
      setLoading(true);
      const list = await WifiManager.reScanAndLoadWifiList();
      // Duplicate networks hata kar unique SSID list banayein
      const uniqueList = list.reduce((acc, current) => {
        if (!acc.find(item => item.SSID === current.SSID)) {
          acc.push(current);
        }
        return acc;
      }, []);
      setWifiList(uniqueList);
      setWifiModalVisible(true);
    } catch (error) {
      Alert.alert("Error", "WiFi Scan failed.");
    } finally {
      setLoading(false);
    }
  };

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
    
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) { setLoading(false); return; }
      if (device) {
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
          if (resp.includes("OK|WiFi")) {
            Alert.alert("Success", "WiFi save ho gaya!");
            navigation.replace('BMSConnect'); 
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
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHAR_UUID, btoa(cmd)
      );
    } catch (e) {
      Alert.alert("Error", "WiFi command fail");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {step === 1 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Step 1: Connect Dongle</Title>
              <Button mode="outlined" onPress={scanBLE} loading={loading} style={styles.btn}>
                Scan for Dongle
              </Button>
              {loading && <Text style={styles.infoText}>Scanning...</Text>}
              {devices.map((item, index) => (
                <View key={index}>
                  <List.Item 
                    title={item.name || "Unknown"} 
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
              <Title style={styles.title}>Step 2: WiFi Setup</Title>
              
              {/* SSID Input with Scan Button */}
              <View style={styles.inputRow}>
                <TextInput
                  label="WiFi SSID"
                  value={ssid}
                  onChangeText={setSsid}
                  mode="outlined"
                  style={styles.inputFlex}
                />
                <IconButton 
                  icon="wifi" 
                  mode="contained" 
                  size={24} 
                  onPress={scanWifiNetworks} 
                  style={{ marginTop: 6 }}
                />
              </View>

              <TextInput
                label="WiFi Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                mode="outlined"
                style={styles.input}
                right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
              />
              <Button mode="contained" onPress={sendWiFi} loading={loading} style={styles.btn}>
                Save WiFi to Dongle
              </Button>
            </Card.Content>
          </Card>
        )}

      </ScrollView>

      {/* WIFI SCAN MODAL (List) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={wifiModalVisible}
        onRequestClose={() => setWifiModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Title style={styles.modalTitle}>Select WiFi Network</Title>
            <Divider />
            <ScrollView style={{ maxHeight: 300 }}>
              {wifiList.map((item, index) => (
                <List.Item
                  key={index}
                  title={item.SSID || "Hidden Network"}
                  description={`Signal: ${item.level} dBm`}
                  left={props => <List.Icon {...props} icon="wifi" />}
                  onPress={() => {
                    setSsid(item.SSID);
                    setWifiModalVisible(false);
                  }}
                />
              ))}
            </ScrollView>
            <Button mode="text" onPress={() => setWifiModalVisible(false)} style={{ marginTop: 10 }}>
              Cancel
            </Button>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { padding: 10, elevation: 4, borderRadius: 10 },
  title: { textAlign: 'center', marginBottom: 20, fontSize: 22, fontWeight: 'bold' },
  input: { marginBottom: 15, backgroundColor: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  inputFlex: { flex: 1, backgroundColor: '#fff', marginRight: 8 },
  btn: { marginTop: 10, paddingVertical: 5 },
  infoText: { textAlign: 'center', marginTop: 10, color: 'gray' },
  
  // Modal Styles
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20, maxHeight: '80%' },
  modalTitle: { textAlign: 'center', marginBottom: 10 }
});