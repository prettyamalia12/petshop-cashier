import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { getProducts, setProductBarcode } from '../db';
import Ean13Barcode, { generateEan13 } from '../components/Ean13Barcode';

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

  const saveGeneratedBarcode = async () => {
    const barcode = generateEan13(selected);
    await setProductBarcode(selected.id, barcode);
    const updated = { ...selected, barcode };
    setSelected(updated);
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const generated = selected ? generateEan13(selected) : null;
  const labelCode = selected?.barcode || generated;

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Select a product to print its labels: a SKU QR, and an EAN-13 barcode (auto-generated
        for repack products that have no barcode on the packaging).
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
            <Text style={styles.itemMeta}>
              SKU: {item.sku}{item.barcode ? ` · BC: ${item.barcode}` : ''} · {money(item.price)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Add products first.</Text>}
      />

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.labelBox}>
              {selected && (
                <>
                  <Text style={styles.labelName}>{selected.name}</Text>
                  <Text style={styles.labelPrice}>{money(selected.price)}</Text>

                  <View style={styles.divider} />

                  <Text style={styles.sectionTitle}>SKU QR Code</Text>
                  <QRCode value={selected.sku} size={180} />
                  <Text style={styles.sectionSub}>SKU: {selected.sku}</Text>

                  <View style={styles.divider} />

                  <Text style={styles.sectionTitle}>
                    {selected.barcode ? 'Packaging Barcode (EAN-13)' : 'Label Barcode (EAN-13)'}
                  </Text>
                  <Ean13Barcode value={labelCode} width={300} height={70} />
                  {!selected.barcode && (
                    <>
                      <Text style={styles.sectionSub}>
                        No barcode on the packaging? Print this label for the repack product.
                      </Text>
                      <TouchableOpacity style={styles.useButton} onPress={saveGeneratedBarcode}>
                        <Text style={styles.useButtonText}>Save this barcode to the product</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity style={styles.close} onPress={() => setSelected(null)}>
                    <Text style={styles.closeText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  labelBox: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center' },
  labelName: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  labelPrice: { fontSize: 14, color: '#2e7d32', fontWeight: '600', marginTop: 2 },
  divider: { width: '100%', height: 1, backgroundColor: '#eee', marginVertical: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 10 },
  sectionSub: { fontSize: 11, color: '#888', marginTop: 8, textAlign: 'center' },
  useButton: {
    marginTop: 10, backgroundColor: '#e8f0e8', paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 8, borderWidth: 1, borderColor: '#2e7d32',
  },
  useButtonText: { color: '#2e7d32', fontWeight: '700', fontSize: 13 },
  close: { marginTop: 18, backgroundColor: '#2e7d32', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 8 },
  closeText: { color: '#fff', fontWeight: '600' },
});
