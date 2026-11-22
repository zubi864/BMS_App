import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Alert, Modal } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Divider, IconButton } from 'react-native-paper';
import { ref, onValue, remove, update } from 'firebase/database';
import { auth, userDB } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      setUserEmail(auth.currentUser.email);
      const userId = auth.currentUser.uid;
      
      // 👇 RTDB se devices fetch karein (Real-time)
      const devicesRef = ref(userDB, `users/${userId}/devices`);
      const unsubscribe = onValue(devicesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Object ko array me convert karein
          const devicesList = Object.keys(data).map(key => data[key]);
          setDevices(devicesList);
        } else {
          setDevices([]);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    await AsyncStorage.removeItem('savedEmail');
    await AsyncStorage.removeItem('savedPassword');
    navigation.replace('SignIn');
  };

  const deleteDevice = async () => {
    if (!selectedDevice || !auth.currentUser) return;
    const userId = auth.currentUser.uid;
    
    try {
      // 1. RTDB se delete karein
      await remove(ref(userDB, `users/${userId}/devices/${selectedDevice.mac}`));
      
      // 2. Devices Count update karein
      const newCount = devices.length - 1;
      await update(ref(userDB, `users/${userId}`), { Devices_Count: newCount });
      
      setModalVisible(false);
      setSelectedDevice(null);
      Alert.alert("Success", "Device removed.");
    } catch (e) {
      Alert.alert("Error", "Remove fail ho gaya.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D32F2F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.emailText}>{userEmail}</Text>
        </View>
        <Button mode="text" textColor="#D32F2F" onPress={handleLogout}>Logout</Button>
      </View>

      {devices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No Device Added Yet</Text>
          <Text style={styles.subText}>Tap the + button below to setup a new Dongle.</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('DeviceDetails', { device: item })}
              onLongPress={() => { setSelectedDevice(item); setModalVisible(true); }}
              delayLongPress={500}
            >
              <Card style={styles.deviceCard}>
                <Card.Content>
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceMac}>MAC: {item.mac}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('DeviceSetup')} >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Delete Modal */}
      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Remove Device</Text>
            <Divider style={{ marginVertical: 10 }} />
            <Text style={styles.modalText}>
              Kya aap <Text style={{fontWeight: 'bold'}}>{selectedDevice?.name}</Text> ko remove karna chahte hain?
            </Text>
            <View style={styles.modalButtons}>
              <Button mode="outlined" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 10 }} textColor="#666">Cancel</Button>
              <Button mode="contained" onPress={deleteDevice} style={{ flex: 1 }} buttonColor="#D32F2F">Delete</Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#FFCDD2' },
  welcomeText: { fontSize: 14, color: '#666' },
  emailText: { fontSize: 16, fontWeight: 'bold', color: '#B71C1C' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#B71C1C' },
  subText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 10 },
  deviceCard: { marginHorizontal: 20, marginTop: 15, backgroundColor: '#fff', borderLeftWidth: 5, borderLeftColor: '#D32F2F' },
  deviceName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  deviceMac: { fontSize: 12, color: '#666', marginTop: 5 },
  fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 30, backgroundColor: '#D32F2F', borderRadius: 30, elevation: 5 },
  fabIcon: { fontSize: 32, color: '#fff', fontWeight: 'bold', marginTop: -3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#B71C1C' },
  modalText: { fontSize: 16, color: '#333' },
  modalButtons: { flexDirection: 'row', marginTop: 20 }
});