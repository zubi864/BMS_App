import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Text, Card, Title, Divider, Chip, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Progress from 'react-native-progress'; // 👈 Circular Progress ke liye library

// Byte Parsing Helpers
const r16 = (d, p) => d[p] | (d[p + 1] << 8);
const ri16 = (d, p) => (r16(d, p) << 16) >> 16;
const r32 = (d, p) => d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24);
const ri32 = (d, p) => (r32(d, p));

export default function LiveDashboardScreen({ route, navigation }) {
  const { device, name } = route.params;
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState(0);
  const [liveData, setLiveData] = useState(null);
  const [settingsData, setSettingsData] = useState(null);

    useEffect(() => {
    let buffer = new Uint8Array(0);

    // 1. Data Receive Listener
    const subscription = device.monitorCharacteristicForService(
      '0000ffe0-0000-1000-8000-00805f9b34fb',
      '0000ffe1-0000-1000-8000-00805f9b34fb',
      (error, characteristic) => {
        if (error) { 
          console.log("Monitor Error:", error); 
          return; 
        }
        if (characteristic?.value) {
          const binaryString = atob(characteristic.value);
          const chunk = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            chunk[i] = binaryString.charCodeAt(i);
          }

          // Data buffer mein jama karein
          const newBuffer = new Uint8Array(buffer.length + chunk.length);
          newBuffer.set(buffer);
          newBuffer.set(chunk, buffer.length);
          buffer = newBuffer;

          // Frame complete hone ka wait karein (300 bytes)
          if (buffer.length >= 300) {
            if (buffer[0] === 0x55 && buffer[1] === 0xAA && buffer[2] === 0xEB && buffer[3] === 0x90) {
              const frameType = buffer[4];
              
              if (frameType === 0x02) {
                const frameData = buffer.slice(0, 300);
                setLiveData(parseCellInfoFrame(frameData));
                buffer = buffer.slice(300); 
              }
              else if (frameType === 0x01) {
                const frameData = buffer.slice(0, 140);
                setSettingsData(parseSettingsFrame(frameData));
                buffer = buffer.slice(140);
              }
              else {
                buffer = new Uint8Array(0);
              }
            } else {
               buffer = new Uint8Array(0);
            }
          }
        }
      }
    );

    // ❌ enableNotifications() hata diya hai kyunki library khud handle karti hai

    // 2. Commands bhejna
    const sendCmd = async (cmdByte) => {
      try {
        const frame = new Uint8Array(20);
        frame[0] = 0xAA; frame[1] = 0x55; frame[2] = 0x90; frame[3] = 0xEB;
        frame[4] = cmdByte; 
        let crc = 0;
        for (let i = 0; i < 19; i++) crc += frame[i];
        frame[19] = crc; 

        let binaryString = "";
        for (let i = 0; i < frame.length; i++) binaryString += String.fromCharCode(frame[i]);
        
        await device.writeCharacteristicWithResponseForService(
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000ffe1-0000-1000-8000-00805f9b34fb',
          btoa(binaryString)
        );
        console.log(`Command 0x${cmdByte.toString(16)} sent!`);
      } catch (err) { console.log("Command Error:", err); }
    };

    const initCommunication = async () => {
      // Notify enable hone ka wait karein
      await new Promise(r => setTimeout(r, 1000)); 

      await sendCmd(0x96);
      await new Promise(r => setTimeout(r, 1500)); // BMS ko reply bhejne ka time dein
      
      await sendCmd(0x01);
      await new Promise(r => setTimeout(r, 1500));
      
      await sendCmd(0x97);
    };
    
    initCommunication();

    return () => subscription.remove();
  }, []);

  const parseCellInfoFrame = (d) => {
    let cellVoltages = [];
    for (let i = 0; i < 32; i++) cellVoltages.push(r16(d, 6 + i*2) / 1000.0);
    
    let cellResistances = [];
    for (let i = 0; i < 32; i++) cellResistances.push(r16(d, 80 + i*2));

    return {
      cellVoltages,
      cellResistances,
      batteryVoltage: r32(d, 150) / 1000.0,
      batteryPower: r32(d, 154) / 1000.0,
      chargeCurrent: ri32(d, 158) / 1000.0,
      temp1: ri16(d, 162) / 10.0,
      temp2: ri16(d, 164) / 10.0,
      temp3: ri16(d, 258) / 10.0,
      temp4: ri16(d, 256) / 10.0,
      temp5: ri16(d, 254) / 10.0,
      powerTubeTemp: ri16(d, 144) / 10.0,
      soc: d[173],
      remainingCapacity: r32(d, 174) / 1000.0,
      nominalCapacity: r32(d, 178) / 1000.0,
      cycleCount: r32(d, 182),
      chgMOS: d[198],
      dchgMOS: d[199],
      balanceCurrent: ri16(d, 170) / 1000.0,
      balancingAction: d[172],
      deltaCellVoltage: r16(d, 76) / 1000.0,
      avgCellVoltage: r16(d, 74) / 1000.0,
      maxCellNum: d[78] + 1,
      minCellNum: d[79] + 1,
    };
  };

  const parseSettingsFrame = (d) => {
    return {
      cellUVP: r32(d, 10) / 1000.0,
      cellOVP: r32(d, 18) / 1000.0,
      maxChargeCurrent: r32(d, 50) / 1000.0,
      maxDischargeCurrent: r32(d, 62) / 1000.0,
      nominalCapacity: r32(d, 130) / 1000.0,
      cellCount: d[114],
    };
  };

  if (!liveData) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#D32F2F" />
        <Text style={{ marginTop: 15, fontWeight: 'bold', color: '#666' }}>Reading BMS Data...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <Title style={styles.headerTitle}>{name}</Title>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <Chip selected={activeTab === 0} onPress={() => setActiveTab(0)} style={styles.tabBtn} textStyle={{fontSize: 12, fontWeight: 'bold'}}>Dashboard</Chip>
        <Chip selected={activeTab === 1} onPress={() => setActiveTab(1)} style={styles.tabBtn} textStyle={{fontSize: 12, fontWeight: 'bold'}}>Details</Chip>
        <Chip selected={activeTab === 2} onPress={() => setActiveTab(2)} style={styles.tabBtn} textStyle={{fontSize: 12, fontWeight: 'bold'}}>Settings</Chip>
      </View>

      <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
        
        {/* ================= TAB 0: MAIN DASHBOARD ================= */}
        {activeTab === 0 && (
          <>
            <Card style={styles.card}>
              <Card.Content style={{ alignItems: 'center' }}>
                <Progress.Circle 
                  size={150} 
                  progress={liveData.soc / 100} 
                  showsText={true} 
                  thickness={10}
                  color="#D32F2F"
                  unfilledColor="#FFCDD2"
                  borderWidth={0}
                  formatText={() => `${liveData.soc}%`}
                  textStyle={{ fontSize: 32, fontWeight: 'bold', color: '#B71C1C' }}
                />
                <Text style={{ marginTop: 10, color: '#666', fontSize: 16 }}>State of Charge</Text>
                
                <Divider style={{ width: '100%', marginVertical: 15 }} />
                
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Voltage</Text>
                    <Text style={styles.statValue}>{liveData.batteryVoltage} V</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Current</Text>
                    <Text style={styles.statValue}>{liveData.chargeCurrent} A</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Power</Text>
                    <Text style={styles.statValue}>{liveData.batteryPower} W</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Capacity</Text>
                    <Text style={styles.statValue}>{liveData.remainingCapacity} Ah</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 }}>
              <Chip icon="battery-charging" style={{ backgroundColor: liveData.chgMOS ? '#E8F5E9' : '#FFEBEE' }}>CHG MOS: {liveData.chgMOS ? 'ON' : 'OFF'}</Chip>
              <Chip icon="battery-minus" style={{ backgroundColor: liveData.dchgMOS ? '#E8F5E9' : '#FFEBEE' }}>DCHG MOS: {liveData.dchgMOS ? 'ON' : 'OFF'}</Chip>
            </View>

            <Card style={styles.card}>
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Title style={styles.cardTitle}>Cell Voltages</Title>
                  <Text style={{ color: '#666', fontSize: 12 }}>Δ {liveData.deltaCellVoltage} V</Text>
                </View>
                <Divider style={{ marginVertical: 10 }} />
                <View style={styles.grid}>
                  {liveData.cellVoltages.slice(0, settingsData ? settingsData.cellCount : 16).map((v, i) => {
                    const isMax = (i + 1) === liveData.maxCellNum;
                    const isMin = (i + 1) === liveData.minCellNum;
                    return (
                      <View key={i} style={[styles.cellBox, isMax && styles.cellMax, isMin && styles.cellMin]}>
                        <Text style={styles.cellIndex}>{i + 1}</Text>
                        <Text style={[styles.cellVal, isMax && { color: '#D32F2F' }, isMin && { color: '#1976D2' }]}>
                          {v.toFixed(3)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card.Content>
            </Card>
          </>
        )}

        {/* ================= TAB 1: DETAILS ================= */}
        {activeTab === 1 && (
          <>
             <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.cardTitle}>Cell Resistances (mΩ)</Title>
                <Divider style={{ marginVertical: 10 }} />
                <View style={styles.grid}>
                  {liveData.cellResistances.slice(0, settingsData ? settingsData.cellCount : 16).map((v, i) => (
                    <View key={i} style={styles.resBox}>
                      <Text style={styles.cellIndex}>{i + 1}</Text>
                      <Text style={styles.resVal}>{v}</Text>
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.cardTitle}>Temperatures</Title>
                <Divider style={{ marginVertical: 10 }} />
                <View style={styles.row}><Text>MOS Temperature:</Text><Text style={styles.boldText}>{liveData.powerTubeTemp} °C</Text></View>
                <View style={styles.row}><Text>Temp 1:</Text><Text style={styles.boldText}>{liveData.temp1} °C</Text></View>
                <View style={styles.row}><Text>Temp 2:</Text><Text style={styles.boldText}>{liveData.temp2} °C</Text></View>
                <View style={styles.row}><Text>Temp 3:</Text><Text style={styles.boldText}>{liveData.temp3} °C</Text></View>
                <View style={styles.row}><Text>Temp 4:</Text><Text style={styles.boldText}>{liveData.temp4} °C</Text></View>
                <View style={styles.row}><Text>Temp 5:</Text><Text style={styles.boldText}>{liveData.temp5} °C</Text></View>
              </Card.Content>
            </Card>
          </>
        )}

        {/* ================= TAB 2: SETTINGS ================= */}
        {activeTab === 2 && (
          <>
            {settingsData ? (
              <>
                <Card style={styles.card}>
                  <Card.Content>
                    <Title style={styles.cardTitle}>Voltage Limits</Title>
                    <Divider style={{ marginVertical: 10 }} />
                    <View style={styles.row}><Text>Cell OVP (Max):</Text><Text style={styles.boldText}>{settingsData.cellOVP} V</Text></View>
                    <View style={styles.row}><Text>Cell UVP (Min):</Text><Text style={styles.boldText}>{settingsData.cellUVP} V</Text></View>
                  </Card.Content>
                </Card>
                <Card style={styles.card}>
                  <Card.Content>
                    <Title style={styles.cardTitle}>Current Limits</Title>
                    <Divider style={{ marginVertical: 10 }} />
                    <View style={styles.row}><Text>Max Charge Current:</Text><Text style={styles.boldText}>{settingsData.maxChargeCurrent} A</Text></View>
                    <View style={styles.row}><Text>Max Discharge Current:</Text><Text style={styles.boldText}>{settingsData.maxDischargeCurrent} A</Text></View>
                    <View style={styles.row}><Text>Nominal Capacity:</Text><Text style={styles.boldText}>{settingsData.nominalCapacity} Ah</Text></View>
                    <View style={styles.row}><Text>Cell Count:</Text><Text style={styles.boldText}>{settingsData.cellCount}</Text></View>
                  </Card.Content>
                </Card>
              </>
            ) : (
              <ActivityIndicator color="#D32F2F" style={{ marginTop: 50 }} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F5' },
  
  header: { padding: 20, backgroundColor: '#D32F2F', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 20 },
  
  tabContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: '#fff', elevation: 2 },
  tabBtn: { backgroundColor: '#F0F0F0' },
  
  card: { marginBottom: 15, backgroundColor: '#fff', elevation: 3, borderRadius: 15 },
  cardTitle: { color: '#D32F2F', fontSize: 16, fontWeight: 'bold' },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  statBox: { width: '48%', backgroundColor: '#F9F9F9', padding: 10, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  statLabel: { color: '#666', fontSize: 12 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  boldText: { fontWeight: 'bold', color: '#333' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  cellBox: { width: '22%', backgroundColor: '#F9F9F9', margin: '1.5%', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  cellMax: { borderColor: '#D32F2F', backgroundColor: '#FFF5F5' },
  cellMin: { borderColor: '#1976D2', backgroundColor: '#F0F7FF' },
  cellIndex: { fontSize: 10, color: '#888' },
  cellVal: { fontSize: 12, fontWeight: 'bold', color: '#333', marginTop: 2 },
  
  resBox: { width: '14.66%', backgroundColor: '#F9F9F9', margin: '1%', padding: 5, borderRadius: 5, alignItems: 'center' },
  resVal: { fontSize: 10, fontWeight: 'bold', color: '#666' },
});