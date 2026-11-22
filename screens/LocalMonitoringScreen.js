import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, PermissionsAndroid, Platform, ScrollView } from 'react-native';
import { Text, Card, Button, List, IconButton, Chip } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeviceInfo from 'react-native-device-info';
import { manager, globalBleState } from '../bleManager';

export default function LocalMonitoringScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectedBMS, setConnectedBMS] = useState(globalBleState.connectedDevice);

  const checkLocationAndBluetooth = async () => {
    const btState = await manager.state();
    if (btState !== 'PoweredOn') {
      Alert.alert("Bluetooth Off", "Kripya apna Bluetooth ON karein.");
      return false;
    }
    if (Platform.OS === 'android') {
      const isLocationEnabled = await DeviceInfo.isLocationEnabled();
      if (!isLocationEnabled) {
        Alert.alert("Location Off", "BLE scan ke liye apne phone ka GPS/Location ON karein.");
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    checkLocationAndBluetooth();
    if (globalBleState.connectedDevice) {
      globalBleState.connectedDevice.isConnected().then(isConn => {
        if (isConn) setConnectedBMS(globalBleState.connectedDevice);
        else {
          globalBleState.connectedDevice = null;
          setConnectedBMS(null);
        }
      });
    }
  }, []);

  const scanBMS = async () => {
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
    setDevices([]); // Sirf nayi list clear karein
    manager.stopDeviceScan();

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) { setLoading(false); return; }
      
      let isJKBMS = false;
      if (device.name && (device.name.toUpperCase().includes('JK') || device.name.toUpperCase().includes('BMS'))) {
        isJKBMS = true;
      }
      if (device.serviceUUIDs && device.serviceUUIDs.length > 0) {
        const uuids = device.serviceUUIDs.map(u => u.toLowerCase());
        if (uuids.some(u => u.includes('ffe0'))) isJKBMS = true;
      }

      if (isJKBMS) {
        setDevices(prev => (!prev.find(d => d.id === device.id)) ? [...prev, device] : prev);
      }
    });

    setTimeout(() => { manager.stopDeviceScan(); setLoading(false); }, 10000);
  };

  const handleDeviceClick = async (device) => {
    if (connectedBMS && connectedBMS.id === device.id) {
      navigation.navigate('LiveDashboard', { device: connectedBMS, name: connectedBMS.name || 'JK BMS' });
      return;
    }

    // Naya connect karne se pehle purana disconnect
    if (connectedBMS) {
      try {
        await connectedBMS.cancelConnection();
        globalBleState.connectedDevice = null;
        setConnectedBMS(null);
      } catch (e) {}
    }

    manager.stopDeviceScan();
    setLoading(true);
    try {
      const conn = await device.connect();
      await conn.requestMTU(512);
      await conn.discoverAllServicesAndCharacteristics();
      
      globalBleState.connectedDevice = conn;
      setConnectedBMS(conn);
      
      setLoading(false);
      navigation.navigate('LiveDashboard', { device: conn, name: device.name || 'JK BMS' });
    } catch (error) {
      Alert.alert("Connection Error", error.message);
      setLoading(false);
    }
  };

  const disconnectBMS = async () => {
    if (connectedBMS) {
      await connectedBMS.cancelConnection();
      globalBleState.connectedDevice = null;
      setConnectedBMS(null);
      setDevices([]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      <ScrollView contentContainerStyle={{ padding: 15 }}>
        
        {/* 👇 1. CONNECTED DEVICE BOX (Hamesha Top Par Rahega) */}
        {connectedBMS && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>Active Connection</Text>
            <Card style={styles.connectedCard} onPress={() => handleDeviceClick(connectedBMS)}>
              <List.Item
                title={connectedBMS.name || "Unknown BMS"}
                description={`MAC: ${connectedBMS.id}`}
                titleStyle={{ fontWeight: 'bold' }}
                left={props => <List.Icon {...props} icon="bluetooth-connect" color="#2E7D32" />}
                right={props => (
                  <IconButton 
                    icon="close-circle" 
                    iconColor="#D32F2F" 
                    size={24} 
                    onPress={disconnectBMS} 
                  />
                )}
              />
            </Card>
          </View>
        )}

        {/* 👇 2. SCAN SECTION */}
        <Text style={styles.sectionTitle}>Available Devices</Text>
        <Button 
          mode="contained" 
          onPress={scanBMS} 
          loading={loading} 
          buttonColor="#D32F2F" 
          style={{ marginBottom: 15 }}
          icon="radar"
        >
          Scan for Devices
        </Button>

        {devices.length === 0 && !loading && (
          <Text style={{ textAlign: 'center', color: '#666', marginTop: 10 }}>
            No devices found. Make sure BMS is ON.
          </Text>
        )}

        {/* 👇 3. NAYI SCAN LIST */}
        {devices.map((item, index) => {
          const isAlreadyConnected = connectedBMS && connectedBMS.id === item.id;
          
          return (
            <Card 
              key={index} 
              style={styles.deviceCard} 
              onPress={() => handleDeviceClick(item)}
            >
              <List.Item
                title={item.name || "Unknown BMS"}
                description={`MAC: ${item.id}`}
                left={props => <List.Icon {...props} icon="battery" color="#D32F2F" />}
                right={props => isAlreadyConnected ? (
                  <Chip style={{ backgroundColor: '#E8F5E9', alignSelf: 'center' }} textStyle={{ color: '#2E7D32', fontSize: 10 }}>
                    Connected
                  </Chip>
                ) : null}
              />
            </Card>
          );
        })}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 8, marginLeft: 5 },
  connectedCard: { backgroundColor: '#fff', borderColor: '#2E7D32', borderWidth: 1.5, elevation: 4 },
  deviceCard: { marginBottom: 10, backgroundColor: '#fff' },
});