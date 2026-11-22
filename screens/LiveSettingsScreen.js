import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Title, Divider } from 'react-native-paper';

export default function LiveSettingsScreen() {
  // Dummy Data (Live parse hone tak)
  const settings = {
    cellOVP: 3.650, cellUVP: 2.500, maxChgCurrent: 50, maxDchgCurrent: 100
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Voltage Limits</Title>
          <Divider style={{ marginBottom: 10 }} />
          <View style={styles.row}><Text>Cell OVP</Text><Text>{settings.cellOVP} V</Text></View>
          <View style={styles.row}><Text>Cell UVP</Text><Text>{settings.cellUVP} V</Text></View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Current Limits</Title>
          <Divider style={{ marginBottom: 10 }} />
          <View style={styles.row}><Text>Max Charge</Text><Text>{settings.maxChgCurrent} A</Text></View>
          <View style={styles.row}><Text>Max Discharge</Text><Text>{settings.maxDchgCurrent} A</Text></View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5', padding: 10 },
  card: { marginBottom: 10, backgroundColor: '#fff' },
  title: { color: '#D32F2F' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }
});