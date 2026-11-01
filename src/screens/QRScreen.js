import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { getProducts } from '../db';

const money = (n) => `Rp ${n.toLocaleString('id-ID')}`;

export default function QRScreen() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      getProducts().then(setProducts);
    }, [])
  );

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Select a product to display its QR code. The QR encodes the SKU — print it and stick it on the product or shelf.
      </Text>
      <TextInput
        style={styles.search}
        placeholder="Search by name or SKU…"
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => setSelected(item)}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>SKU: {item.sku} · {money(item.price)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Add products first.</Text>}
      />

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.qrBox}>
            {selected && (
              <>
                <QRCode value={selected.sku} size={220} />
                <Text style={styles.qrName}>{selected.name}</Text>
                <Text style={styles.qrSku}>SKU: {selected.sku}</Text>
                <TouchableOpacity style={styles.close} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  search: {
    backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 12,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd',
  },
  hint: { padding: 14, color: '#555', fontSize: 13 },
  item: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, padding: 14, borderRadius: 10 },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  qrBox: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center' },
  qrName: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  qrSku: { fontSize: 13, color: '#666', marginTop: 4 },
  close: { marginTop: 16, backgroundColor: '#2e7d32', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 },
  closeText: { color: '#fff', fontWeight: '600' },
});
