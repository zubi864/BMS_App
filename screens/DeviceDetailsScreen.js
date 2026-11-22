import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Text, Card, Title, Button, Divider, IconButton, Chip, TextInput, Portal, Modal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initializeApp, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DeviceDetailsScreen({ route, navigation }) {
  const { device } = route.params;
  const insets = useSafeAreaInsets();
  
  const [batteryData, setBatteryData] = useState(null);
  const [settingsData, setSettingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [password, setPassword] = useState('');

  const fetchData = async () => {
    try {
      let batteryApp;
      try {
        batteryApp = initializeApp({ apiKey: device.apiKey, projectId: device.projectId }, "BatteryProject");
      } catch (e) {
        batteryApp = getApp("BatteryProject");
      }

      const batteryAuth = getAuth(batteryApp);
      
      // 👇 Auto Sign-In aur Auto Sign-Up Logic
      if (!batteryAuth.currentUser) {
        const savedEmail = await AsyncStorage.getItem('savedEmail');
        const savedPassword = await AsyncStorage.getItem('savedPassword');
        
        if (savedEmail && savedPassword) {
          try {
            await signInWithEmailAndPassword(batteryAuth, savedEmail, savedPassword);
            console.log("✅ Battery Project: Login Successful");
          } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
              console.log("User nahi mila, naya account bana rahe hain...");
              await createUserWithEmailAndPassword(batteryAuth, savedEmail, savedPassword);
              console.log("✅ Battery Project: Sign Up Successful");
            } else {
              throw error;
            }
          }
        } else {
          throw new Error("Saved credentials nahi mile. Please device dobara add karein.");
        }
      }

      // Ab Data Fetch karein
      const db = getFirestore(batteryApp);
      
      const rtRef = doc(db, `bms_data/${device.mac}/${device.name}/real_time`);
      const rtSnap = await getDoc(rtRef);
      if (rtSnap.exists()) {
        setBatteryData(rtSnap.data());
      }

      const setRef = doc(db, `bms_data/${device.mac}/${device.name}/device_settings`);
      const setSnap = await getDoc(setRef);
      if (setSnap.exists()) {
        setSettingsData(setSnap.data());
      }

    } catch (error) {
      console.log("Error fetching data: ", error);
      Alert.alert("Access Error", error.message || "Data fetch nahi ho paya.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 25000); // 25 sec auto refresh
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSettingsAccess = () => {
    const ADMIN_PASSWORD = "ove@123"; 

    if (password === ADMIN_PASSWORD) {
      setModalVisible(false);
      setPassword('');
      navigation.navigate('Settings', { device: device }); 
    } else {
      Alert.alert("Access Denied", "Galat password! Dobara koshish karein.");
      setPassword('');
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D32F2F" />
        <Text style={{ marginTop: 10 }}>Fetching Detailed Data...</Text>
      </View>
    );
  }

  if (!batteryData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: '#B71C1C', fontSize: 16, textAlign: 'center', marginHorizontal: 20 }}>
          Dongle offline hai ya data fetch nahi ho paya.
        </Text>
        <Button mode="contained" onPress={onRefresh} style={{ marginTop: 20 }} buttonColor="#D32F2F">Refresh</Button>
        <Button mode="text" onPress={() => navigation.goBack()} textColor="#666" style={{ marginTop: 10 }}>Go Back</Button>
      </View>
    );
  }

  const D = batteryData.DATA; 
  
  let cellCount = 16;
  if (settingsData && settingsData.SETTINGS) {
    cellCount = settingsData.SETTINGS[66];
  }

  const soc = D[99];
  const soh = D[100];
  const batteryVoltage = D[96];
  const chargeCurrent = D[98];
  const batteryPower = (batteryVoltage * chargeCurrent).toFixed(2); 
  const remainingCapacity = D[101];
  const nominalCapacity = D[102];
  const cycleCount = D[103];
  
  const temp1 = D[105], temp2 = D[106], temp3 = D[107], temp4 = D[108], temp5 = D[109];
  const powerTubeTemp = D[110];
  
  const cellVoltages = D.slice(0, 32).filter((v, i) => i < cellCount);
  const cellResistances = D.slice(32, 64).filter((v, i) => i < cellCount);
  
  const avgCellVoltage = D[112];
  const deltaCellVoltage = D[113];
  const maxCellNum = D[114] + 1;
  const minCellNum = D[115] + 1;
  
  const balanceCurrent = D[111];
  const balAction = D[119];
  const balIndicator = D[120];
  const isBalancing = (balanceCurrent !== 0) || (balAction > 0) || (balIndicator > 0);
  
  const chgMOS = D[121] === 1;
  const dchgMOS = D[122] === 1;

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D32F2F']} />}
    >
            {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton icon="arrow-left" iconColor="#fff" size={24} onPress={() => navigation.goBack()} style={{ marginLeft: -10 }} />
          <View style={{ marginLeft: 5 }}>
            <Text style={styles.headerTitle}>{device.name}</Text>
            <Text style={styles.headerSub}>{device.mac}</Text>
          </View>
        </View>
        
        <View style={{ alignItems: 'flex-end' }}>
          <IconButton 
            icon="cog" 
            iconColor="#fff" 
            size={24} 
            onPress={() => setModalVisible(true)} 
            style={{ margin: 0, marginBottom: 2 }} 
          />
          {/* 👇 Yahan Date aur Time dono add kiye hain */}
          <Text style={{ color: '#FFCDD2', fontSize: 10, textAlign: 'right' }}>
            {batteryData.date ? `${batteryData.date}` : '----/--/--'}
          </Text>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'right' }}>
            {batteryData.time ? `${batteryData.time}` : '--:--:--'}
          </Text>
        </View>
      </View>

      {/* MAIN STATUS CARD */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.statusHeader}>
            <View style={styles.socCircle}>
              <Text style={styles.socValue}>{soc}%</Text>
              <Text style={{ color: '#666', fontSize: 10 }}>SOC</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 20 }}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Voltage</Text>
                <Text style={styles.statValue}>{batteryVoltage} V</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Current</Text>
                <Text style={styles.statValue}>{chargeCurrent} A</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Power</Text>
                <Text style={styles.statValue}>{batteryPower} W</Text>
              </View>
            </View>
          </View>
          <Divider style={{ marginVertical: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>SOH</Text>
              <Text style={styles.statValue}>{soh}%</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>Cycles</Text>
              <Text style={styles.statValue}>{cycleCount}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>Capacity</Text>
              <Text style={styles.statValue}>{remainingCapacity} / {nominalCapacity} Ah</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* SWITCHES STATUS */}
      <View style={styles.switchRow}>
        <Chip icon="battery-charging" style={{ backgroundColor: chgMOS ? '#E8F5E9' : '#FFEBEE' }} textStyle={{ color: chgMOS ? '#2E7D32' : '#C62828', fontSize: 12 }}>
          CHG: {chgMOS ? 'ON' : 'OFF'}
        </Chip>
        <Chip icon="battery-minus" style={{ backgroundColor: dchgMOS ? '#E8F5E9' : '#FFEBEE' }} textStyle={{ color: dchgMOS ? '#2E7D32' : '#C62828', fontSize: 12 }}>
          DCHG: {dchgMOS ? 'ON' : 'OFF'}
        </Chip>
        <Chip 
          icon="scale-balance" 
          style={{ backgroundColor: isBalancing ? '#E3F2FD' : '#F5F5F5' }} 
          textStyle={{ color: isBalancing ? '#1976D2' : '#666', fontSize: 12 }}
        >
          BAL: {isBalancing ? 'ON' : 'OFF'}
        </Chip>
      </View>

      {/* CELL VOLTAGES GRID */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title style={styles.cardTitle}>Cell Voltages</Title>
            <Text style={{ fontSize: 12, color: '#666' }}>Δ {deltaCellVoltage} V</Text>
          </View>
          <Divider style={{ marginVertical: 10 }} />
          <View style={styles.grid}>
            {cellVoltages.map((voltage, index) => {
              const isMax = (index + 1) === maxCellNum;
              const isMin = (index + 1) === minCellNum;
              const isCellBalancing = isBalancing && (voltage > avgCellVoltage);
              
              return (
                <View key={index} style={[styles.cellBox, isMax && styles.cellMax, isMin && styles.cellMin]}>
                  <Text style={styles.cellIndex}>{index + 1}</Text>
                  <Text style={[styles.cellVal, isMax && { color: '#D32F2F' }, isMin && { color: '#1976D2' }]}>
                    {voltage.toFixed(3)}
                  </Text>
                  {isCellBalancing && <View style={styles.balIndicator} />}
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>Avg: {avgCellVoltage} V</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>Bal Current: {balanceCurrent} A</Text>
          </View>
        </Card.Content>
      </Card>

      {/* TEMPERATURES */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Temperatures</Title>
          <Divider style={{ marginVertical: 10 }} />
          <View style={styles.row}><Text style={{ color: '#666' }}>MOS Temp:</Text><Text style={styles.boldText}>{powerTubeTemp} °C</Text></View>
          <View style={styles.row}><Text style={{ color: '#666' }}>T1:</Text><Text style={styles.boldText}>{temp1} °C</Text></View>
          <View style={styles.row}><Text style={{ color: '#666' }}>T2:</Text><Text style={styles.boldText}>{temp2} °C</Text></View>
          <View style={styles.row}><Text style={{ color: '#666' }}>T3:</Text><Text style={styles.boldText}>{temp3} °C</Text></View>
          <View style={styles.row}><Text style={{ color: '#666' }}>T4:</Text><Text style={styles.boldText}>{temp4} °C</Text></View>
          <View style={styles.row}><Text style={{ color: '#666' }}>T5:</Text><Text style={styles.boldText}>{temp5} °C</Text></View>
        </Card.Content>
      </Card>

      {/* CELL RESISTANCES */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Cell Resistances (mΩ)</Title>
          <Divider style={{ marginVertical: 10 }} />
          <View style={styles.grid}>
            {cellResistances.map((res, index) => (
              <View key={index} style={styles.resBox}>
                <Text style={styles.cellIndex}>{index + 1}</Text>
                <Text style={styles.resVal}>{res.toFixed(3)}</Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <View style={{ height: insets.bottom + 20 }} />

      {/* PASSWORD MODAL */}
      <Portal>
        <Modal 
          visible={modalVisible} 
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Title style={{ color: '#D32F2F' }}>Admin Access</Title>
          <Text style={{ marginBottom: 15 }}>BMS settings change karne ke liye password daalein.</Text>
          
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            theme={{ colors: { primary: '#D32F2F' } }}
            style={{ marginBottom: 20, backgroundColor: '#fff' }}
          />
          
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button mode="text" onPress={() => setModalVisible(false)} textColor="#666">Cancel</Button>
            <Button mode="contained" onPress={handleSettingsAccess} buttonColor="#D32F2F" style={{ marginLeft: 10 }}>
              Unlock
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F5' },
  header: { padding: 10, paddingHorizontal: 15, backgroundColor: '#D32F2F', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#FFCDD2', fontSize: 12 },
  
  card: { margin: 15, marginBottom: 0, backgroundColor: '#fff', elevation: 4, borderRadius: 15 },
  cardTitle: { fontSize: 16, color: '#B71C1C', fontWeight: 'bold' },
  
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  socCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 6, borderColor: '#D32F2F', justifyContent: 'center', alignItems: 'center' },
  socValue: { fontSize: 24, fontWeight: 'bold', color: '#B71C1C' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  statLabel: { color: '#666', fontSize: 12 },
  statValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 15 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  cellBox: { width: '22%', backgroundColor: '#F9F9F9', margin: '1.5%', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  cellMax: { borderColor: '#D32F2F', backgroundColor: '#FFF5F5' },
  cellMin: { borderColor: '#1976D2', backgroundColor: '#F0F7FF' },
  cellIndex: { fontSize: 10, color: '#888' },
  cellVal: { fontSize: 12, fontWeight: 'bold', color: '#333', marginTop: 2 },
  balIndicator: { position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  boldText: { fontWeight: 'bold', color: '#333' },
  
  resBox: { width: '14.66%', backgroundColor: '#F9F9F9', margin: '1%', padding: 5, borderRadius: 5, alignItems: 'center' },
  resVal: { fontSize: 10, fontWeight: 'bold', color: '#666' },

  modalContent: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10 }
});