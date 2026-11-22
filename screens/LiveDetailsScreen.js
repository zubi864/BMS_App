import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Title, Divider } from 'react-native-paper';

export default function LiveDetailsScreen({ route }) {
  // Dummy Data (Live parse hone tak)
  const cells = [3.201, 3.198, 3.205, 3.200, 3.199, 3.202, 3.205, 3.198, 3.201, 3.200];
  const temps = [25.3, 26.1, 24.8];

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Cell Voltages (V)</Title>
          <Divider style={{ marginBottom: 10 }} />
          <View style={styles.grid}>
            {cells.map((v, i) => (
              <View key={i} style={styles.cellBox}>
                <Text style={styles.cellIndex}>{i + 1}</Text>
                <Text style={styles.cellVal}>{v.toFixed(3)}</Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Temperatures (°C)</Title>
          <Divider style={{ marginBottom: 10 }} />
          <Text>T1: {temps[0]}</Text>
          <Text>T2: {temps[1]}</Text>
          <Text>T3: {temps[2]}</Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5', padding: 10 },
  card: { marginBottom: 10, backgroundColor: '#fff' },
  title: { color: '#D32F2F' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellBox: { width: '20%', padding: 5, alignItems: 'center', borderWidth: 1, borderColor: '#eee', margin: '2%' },
  cellIndex: { fontSize: 10, color: '#666' },
  cellVal: { fontWeight: 'bold', fontSize: 12 }
});