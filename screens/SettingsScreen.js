import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Title, Button, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen({ route, navigation }) {
  const { device } = route.params;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" iconColor="#fff" size={24} onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>{device.name} Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={{ color: '#D32F2F' }}>BMS Configuration</Title>
            <Text style={{ marginTop: 10 }}>Yahan saari settings aayengi (Cell OVP, UVP, Max Current, etc).</Text>
            <Text style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
              (Note: Abhi ye screen under construction hai. Hum agle step mein BLE se settings fetch karenge.)
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F5' },
  header: { padding: 10, paddingHorizontal: 20, backgroundColor: '#D32F2F', flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  card: { backgroundColor: '#fff', padding: 10 }
});