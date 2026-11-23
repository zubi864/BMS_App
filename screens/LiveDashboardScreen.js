import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, DeviceEventEmitter
} from 'react-native';
import BleManager, { BleManagerEmitter } from 'react-native-ble-manager';

// ================= CONFIG =================
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

// JK BMS Commands (purane models ke liye)
const CMD_DEVICE_INFO = [0xAA, 0x55, 0x90, 0xEB, 0x96, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x12];
const CMD_CELL_INFO = [0xAA, 0x55, 0x90, 0xEB, 0x97, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x11];

export default function LocalDashboardScreen({ route, navigation }) {
  const { deviceId } = route.params || {};

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bmsData, setBmsData] = useState({
    cellVoltages: [], totalVoltage: 0, current: 0, power: 0,
    soc: 0, capacity: 0, remainingCapacity: 0, cycles: 0,
    temperature1: 0, temperature2: 0, balanceCurrent: 0, cellCount: 0,
    maxCell: 0, minCell: 0, maxCellNum: 0, minCellNum: 0, cellDiff: 0,
    chargingMos: false, dischargingMos: false, balancer: false,
  });

  const dataBuffer = useRef([]);
  const listenerRef = useRef(null);

  // ================= BLE SETUP =================
  useEffect(() => {
    if (!deviceId) return;

    let isMounted = true;

    const init = async () => {
      try {
        setLoading(true);

        // 1. Connect
        await BleManager.connect(deviceId);

        // 2. Retrieve services (zaroori hai)
        await BleManager.retrieveServices(deviceId);

        // 3. Notification listener (EK BAAR register karein)
        listenerRef.current = BleManagerEmitter.addListener(
          'BleManagerDidUpdateValueForCharacteristic',
          ({ value }) => {
            if (value && value.length > 0) {
              handleChunk(value);
            }
          }
        );

        // 4. Start notification
        await BleManager.startNotification(
          deviceId,
          SERVICE_UUID,
          CHARACTERISTIC_UUID
        );

        setConnected(true);
        setLoading(false);

        // 5. Commands bhejein
        await sendCommand(CMD_DEVICE_INFO);
        setTimeout(() => sendCommand(CMD_CELL_INFO), 300);
      } catch (err) {
        console.log('Init error:', err.message);
        if (isMounted) {
          setLoading(false);
          Alert.alert('Connection Error', err.message);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }
    };
  }, [deviceId]);

  // ================= COMMAND SEND =================
  const sendCommand = async (cmdArray) => {
    try {
      await BleManager.write(
        deviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        cmdArray
      );
      console.log('Command sent:', cmdArray[4].toString(16));
    } catch (e) {
      console.log('Write error:', e.message);
    }
  };

  // ================= CHUNK HANDLER =================
  const handleChunk = (bytes) => {
    dataBuffer.current.push(...bytes);
    processBuffer();
  };

  // ================= BUFFER PROCESS =================
  const processBuffer = () => {
    let buf = dataBuffer.current;

    // JK BMS Cell Info frame = 300 bytes
    while (buf.length >= 300) {
      // Header: 55 AA EB 90
      if (buf[0] === 0x55 && buf[1] === 0xAA && buf[2] === 0xEB && buf[3] === 0x90) {
        const frameType = buf[4];

        if (frameType === 0x02) {
          // Cell Info Frame
          const frame = buf.slice(0, 300);
          parseCellInfo(frame);
          buf = buf.slice(300);
        } else {
          // Doosra frame type, skip
          buf.shift();
        }
      } else {
        // Header nahi mila, ek byte aage
        buf.shift();
      }
    }

    dataBuffer.current = buf;
  };

  // ================= JK BMS PARSER (0x02) =================
  // Byte offsets official protocol se liye gaye hain [citation:2][citation:11]
  const parseCellInfo = (frame) => {
    try {
      const getUint16 = (o) => frame[o] | (frame[o + 1] << 8);
      const getInt16 = (o) => {
        const v = getUint16(o);
        return v & 0x8000 ? v - 0x10000 : v;
      };
      const getUint32 = (o) =>
        (frame[o] | (frame[o + 1] << 8) | (frame[o + 2] << 16) | (frame[o + 3] << 24)) >>> 0;
      const getInt32 = (o) => {
        const v = getUint32(o);
        return v & 0x80000000 ? v - 0x100000000 : v;
      };

      // Cell voltages: byte 6 se shuru, har cell 2 bytes, coefficient 0.001 [citation:2]
      const cells = [];
      for (let i = 0; i < 32; i++) {
        const mv = getUint16(6 + i * 2);
        if (mv > 0) cells.push(mv); // millivolt
      }

      // Max/Min cell info: byte 78, 79 [citation:2]
      const maxCellNum = frame[78] || 0;
      const minCellNum = frame[79] || 0;

      // Battery voltage: byte 150, uint32, coeff 0.001 [citation:2]
      const totalVoltage = getUint32(150) * 0.001;

      // Battery power: byte 154, uint32, coeff 0.001 [citation:2]
      const power = getUint32(154) * 0.001;

      // Charge current: byte 158, int32, coeff 0.001 [citation:2]
      const current = getInt32(158) * 0.001;

      // Temperature Sensor 1 & 2: byte 162, 164, int16, coeff 0.1 [citation:2]
      const temp1 = getInt16(162) * 0.1;
      const temp2 = getInt16(164) * 0.1;

      // Balance current: byte 170, int16, coeff 0.001 [citation:2]
      const balanceCurrent = getInt16(170) * 0.001;

      // State of charge: byte 173 [citation:2]
      const soc = frame[173];

      // Remaining capacity: byte 174, uint32, coeff 0.001 [citation:2]
      const remainingCapacity = getUint32(174) * 0.001;

      // Nominal capacity: byte 178, uint32, coeff 0.001 [citation:2]
      const nominalCapacity = getUint32(178) * 0.001;

      // Cycle count: byte 182, uint32 [citation:2]
      const cycles = getUint32(182);

      // MOS status: byte 198, 199 [citation:2][citation:11]
      const chargingMos = frame[198] === 1;
      const dischargingMos = frame[199] === 1;
      // Balancing indicator: byte 201 [citation:11]
      const balancer = frame[201] === 1;

      // Max/Min voltage calculate (cells se)
      const validCells = cells.filter(v => v > 0);
      const maxV = validCells.length > 0 ? Math.max(...validCells) / 1000 : 0;
      const minV = validCells.length > 0 ? Math.min(...validCells) / 1000 : 0;

      setBmsData({
        cellVoltages: cells,
        cellCount: validCells.length,
        totalVoltage: +totalVoltage.toFixed(2),
        current: +current.toFixed(2),
        power: +power.toFixed(1),
        soc,
        capacity: +nominalCapacity.toFixed(2),
        remainingCapacity: +remainingCapacity.toFixed(2),
        cycles,
        temperature1: +temp1.toFixed(1),
        temperature2: +temp2.toFixed(1),
        balanceCurrent: +balanceCurrent.toFixed(3),
        maxCell: +maxV.toFixed(3),
        minCell: +minV.toFixed(3),
        maxCellNum,
        minCellNum,
        cellDiff: +(maxV - minV).toFixed(3),
        chargingMos,
        dischargingMos,
        balancer,
      });

      console.log('✅ Parsed:', { v: totalVoltage.toFixed(2), i: current.toFixed(2), soc, cells: validCells.length });
    } catch (err) {
      console.log('Parse error:', err.message);
    }
  };

  // ================= UI =================
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>BMS se connect ho raha hai...</Text>
      </View>
    );
  }

  if (!connected) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>❌ BMS se connect nahi ho paya</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Wapas Jayein</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { cellVoltages } = bmsData;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>🔋 JK BMS Dashboard</Text>
        <Text style={styles.subtitle}>Live Data</Text>
      </View>

      <View style={styles.cardRow}>
        <StatCard label="Voltage" value={`${bmsData.totalVoltage} V`} color="#007AFF" />
        <StatCard label="Current" value={`${bmsData.current} A`} color={bmsData.current >= 0 ? '#34C759' : '#FF3B30'} />
      </View>

      <View style={styles.cardRow}>
        <StatCard label="Power" value={`${bmsData.power} W`} color="#FF9500" />
        <StatCard label="SOC" value={`${bmsData.soc}%`} color="#5856D6" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>State of Charge</Text>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${bmsData.soc}%` }]} />
        </View>
        <Text style={styles.progressText}>{bmsData.soc}%</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Capacity</Text>
        <View style={styles.row}><Text style={styles.label}>Remaining</Text><Text style={styles.value}>{bmsData.remainingCapacity} Ah</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total</Text><Text style={styles.value}>{bmsData.capacity} Ah</Text></View>
        <View style={styles.row}><Text style={styles.label}>Cycles</Text><Text style={styles.value}>{bmsData.cycles}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌡️ Temperature</Text>
        <View style={styles.row}><Text style={styles.label}>Sensor 1</Text><Text style={styles.value}>{bmsData.temperature1}°C</Text></View>
        <View style={styles.row}><Text style={styles.label}>Sensor 2</Text><Text style={styles.value}>{bmsData.temperature2}°C</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ MOS Status</Text>
        <View style={styles.row}><Text style={styles.label}>Charging</Text><Text style={[styles.value, { color: bmsData.chargingMos ? '#34C759' : '#8E8E93' }]}>{bmsData.chargingMos ? 'ON ✅' : 'OFF ⭕'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Discharging</Text><Text style={[styles.value, { color: bmsData.dischargingMos ? '#34C759' : '#8E8E93' }]}>{bmsData.dischargingMos ? 'ON ✅' : 'OFF ⭕'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Balancer</Text><Text style={[styles.value, { color: bmsData.balancer ? '#34C759' : '#8E8E93' }]}>{bmsData.balancer ? 'ON ✅' : 'OFF ⭕'}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔋 Cell Voltages ({cellVoltages.length} cells)</Text>
        <View style={styles.row}><Text style={styles.label}>Max</Text><Text style={[styles.value, { color: '#34C759' }]}>{bmsData.maxCell} V (Cell #{bmsData.maxCellNum})</Text></View>
        <View style={styles.row}><Text style={styles.label}>Min</Text><Text style={[styles.value, { color: '#FF3B30' }]}>{bmsData.minCell} V (Cell #{bmsData.minCellNum})</Text></View>
        <View style={styles.row}><Text style={styles.label}>Diff</Text><Text style={styles.value}>{bmsData.cellDiff} V</Text></View>
        <View style={styles.cellsGrid}>
          {cellVoltages.map((mv, i) => (
            <View key={i} style={styles.cellItem}>
              <Text style={styles.cellIndex}>#{i + 1}</Text>
              <Text style={styles.cellValue}>{(mv / 1000).toFixed(3)}V</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.btn} onPress={async () => { await sendCommand(CMD_DEVICE_INFO); setTimeout(() => sendCommand(CMD_CELL_INFO), 300); }}>
        <Text style={styles.btnText}>🔄 Refresh Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const StatCard = ({ label, value, color }) => (
  <View style={[styles.card, { flex: 1, marginHorizontal: 4 }]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, { color, fontSize: 22 }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', padding: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#555' },
  errorText: { fontSize: 16, color: '#FF3B30', marginBottom: 16 },
  header: { paddingVertical: 16, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  subtitle: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
  cardRow: { flexDirection: 'row', marginVertical: 4 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginVertical: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: '#8E8E93' },
  value: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  progressBg: { height: 10, backgroundColor: '#E5E5EA', borderRadius: 5, overflow: 'hidden', marginVertical: 8 },
  progressFill: { height: '100%', backgroundColor: '#34C759', borderRadius: 5 },
  progressText: { textAlign: 'right', fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  cellsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  cellItem: { width: '33%', paddingVertical: 6, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  cellIndex: { fontSize: 11, color: '#8E8E93' },
  cellValue: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', marginTop: 2 },
  btn: { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});