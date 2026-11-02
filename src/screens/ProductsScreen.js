import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getProducts, addProduct, updateProduct, deleteProduct, generateSku, getProductByBarcode, CATEGORIES } from '../db';

const emptyForm = { sku: '', name: '', category: '', brand: '', variant: '', barcode: '', price: '', cost: '', stock: '' };

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const lastScan = useRef({ code: null, at: 0 });

  const load = useCallback(() => {
    getProducts().then(setProducts);
  }, []);

  useFocusEffect(load);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()) ||
      (p.barcode || '').includes(query)
  );

  const openForm = (product) => {
    setEditing(product || null);
    setForm(
      product
        ? {
            sku: product.sku,
            name: product.name,
            category: product.category || '',
            brand: product.brand || '',
            variant: '',
            barcode: product.barcode || '',
            price: String(product.price),
            cost: String(product.cost),
            stock: String(product.stock),
          }
        : emptyForm
    );
    setModalVisible(true);
  };

  // Live preview of the auto-generated SKU (new products only, blank SKU only).
  const [skuPreview, setSkuPreview] = useState('');
  useEffect(() => {
    if (editing || form.sku.trim() || !modalVisible) {
      setSkuPreview('');
      return;
    }
    let cancelled = false;
    generateSku({
      brand: form.brand,
      category: form.category,
      variant: form.variant,
      name: form.name,
    }).then((sku) => {
      if (!cancelled) setSkuPreview(sku);
    });
    return () => {
      cancelled = true;
    };
  }, [form.brand, form.category, form.variant, form.name, editing, modalVisible]);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const onBarcodeScanned = ({ data }) => {
    const now = Date.now();
    if (lastScan.current.code === data && now - lastScan.current.at < 1500) return;
    lastScan.current = { code: data, at: now };
    setForm((prev) => ({ ...prev, barcode: data }));
    setScanning(false);
  };

  const save = async () => {
    const data = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      brand: form.brand.trim(),
      barcode: form.barcode.trim(),
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseInt(form.stock) || 0,
    };
    if (!data.name) {
      Alert.alert('Missing info', 'Product name is required.');
      return;
    }
    if (data.barcode) {
      const taken = await getProductByBarcode(data.barcode, editing?.id);
      if (taken) {
        Alert.alert('Barcode in use', `This barcode is already assigned to "${taken.name}".`);
        return;
      }
    }
    // Auto-generate the SKU for new products when left blank.
    if (!editing && !data.sku) {
      data.sku = await generateSku({ ...data, variant: form.variant });
    }
    if (!data.sku) {
      Alert.alert('Missing info', 'SKU is required.');
      return;
    }
    try {
      if (editing) await updateProduct(editing.id, data);
      else await addProduct(data);
      setModalVisible(false);
      load();
    } catch (e) {
      Alert.alert('Error', 'SKU already exists.');
    }
  };

  const confirmDelete = (p) =>
    Alert.alert('Delete product', `Delete ${p.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProduct(p.id).then(load) },
    ]);

  const money = (n) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <View style={styles.container}>
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
        ListEmptyComponent={<Text style={styles.empty}>No products yet. Tap + to add one.</Text>}
        renderItem={({ item }) => {
          const margin = item.price - item.cost;
          return (
            <TouchableOpacity style={styles.card} onPress={() => openForm(item)} onLongPress={() => confirmDelete(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>{money(item.price)}</Text>
              </View>
              <Text style={styles.meta}>
                {item.brand ? `${item.brand} · ` : ''}{item.category ? `${item.category} · ` : ''}SKU: {item.sku}{item.barcode ? ` · BC: ${item.barcode}` : ''} · Stock: {item.stock} · Cost: {money(item.cost)} · Margin: {money(margin)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity style={styles.fab} onPress={() => openForm(null)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Product' : 'New Product'}</Text>

              <Text style={styles.fieldLabel}>SKU</Text>
              <TextInput
                style={styles.input}
                placeholder={editing ? 'SKU / barcode value' : 'Leave blank to auto-generate'}
                placeholderTextColor="#aaa"
                value={form.sku}
                onChangeText={(v) => setForm({ ...form, sku: v })}
                autoCapitalize="characters"
              />
              <Text style={styles.fieldSub}>
                Unique product code in the AABBCC00X format. Used for QR labels and lookup.
              </Text>
              {!editing && !form.sku.trim() && skuPreview !== '' && (
                <Text style={styles.skuPreview}>Auto SKU: {skuPreview}</Text>
              )}

              <Text style={styles.fieldLabel}>Product Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Cat Choize Mother Kitten (800g)"
                placeholderTextColor="#aaa"
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
              />
              <Text style={styles.fieldSub}>Name shown on the cashier and sales history.</Text>

              <Text style={styles.fieldLabel}>Brand</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Cat Choize"
                placeholderTextColor="#aaa"
                value={form.brand}
                onChangeText={(v) => setForm({ ...form, brand: v })}
                autoCapitalize="words"
              />
              <Text style={styles.fieldSub}>The "AA" part of the SKU. Life Cat → LC, Whiskas → WH.</Text>

              <Text style={styles.fieldLabel}>Category (Jenis Produk)</Text>
              {!editing && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, form.category === c && styles.chipActive]}
                      onPress={() => setForm({ ...form, category: c })}
                    >
                      <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TextInput
                style={styles.input}
                placeholder={editing ? 'Category' : 'Tap a chip above, or type a custom one'}
                placeholderTextColor="#aaa"
                value={form.category}
                onChangeText={(v) => setForm({ ...form, category: v })}
              />
              <Text style={styles.fieldSub}>The "BB" part of the SKU: Dry Food → D, Wet Food Kaleng → WC, and so on.</Text>

              {!editing && (
                <>
                  <Text style={styles.fieldLabel}>Rasa / Varian (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Adult Tuna"
                    placeholderTextColor="#aaa"
                    value={form.variant}
                    onChangeText={(v) => setForm({ ...form, variant: v })}
                  />
                  <Text style={styles.fieldSub}>The "CC" part of the SKU. Adult Tuna → AT, Kitten → K.</Text>
                </>
              )}

              <Text style={styles.fieldLabel}>Packaging Barcode (optional)</Text>
              <View style={styles.barcodeRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. 8994125000705"
                  placeholderTextColor="#aaa"
                  value={form.barcode}
                  onChangeText={(v) => setForm({ ...form, barcode: v })}
                  keyboardType="number-pad"
                />
                <TouchableOpacity style={styles.scanButton} onPress={() => setScanning(true)}>
                  <Text style={styles.scanButtonText}>Scan</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldSub}>
                The barcode already printed on the packaging. At the cashier, the camera accepts this barcode and the SKU QR.
              </Text>

              <Text style={styles.fieldLabel}>Selling Price (Harga Jual)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 22000"
                placeholderTextColor="#aaa"
                value={form.price}
                onChangeText={(v) => setForm({ ...form, price: v })}
                keyboardType="numeric"
              />
              <Text style={styles.fieldSub}>Price the customer pays per unit.</Text>

              <Text style={styles.fieldLabel}>Purchase Cost (Harga Beli / pcs)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 18800"
                placeholderTextColor="#aaa"
                value={form.cost}
                onChangeText={(v) => setForm({ ...form, cost: v })}
                keyboardType="numeric"
              />
              <Text style={styles.fieldSub}>What you paid per unit. Profit = selling price − cost.</Text>

              <Text style={styles.fieldLabel}>Stock Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 25"
                placeholderTextColor="#aaa"
                value={form.stock}
                onChangeText={(v) => setForm({ ...form, stock: v })}
                keyboardType="numeric"
              />
              <Text style={styles.fieldSub}>Units on hand. Decreases automatically with each sale.</Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.button, styles.cancel]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.save]} onPress={save}>
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scannerContainer}>
          <Text style={styles.scannerTitle}>Scan the product's packaging barcode</Text>
          {cameraPermission?.granted ? (
            <CameraView
              style={styles.scannerCamera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'upc_a', 'upc_e', 'qr', 'datamatrix'] }}
              onBarcodeScanned={onBarcodeScanned}
            />
          ) : (
            <TouchableOpacity style={styles.scannerPermission} onPress={requestCameraPermission}>
              <Text style={styles.scannerPermissionText}>Tap to allow camera access</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.scannerClose} onPress={() => setScanning(false)}>
            <Text style={styles.scannerCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  search: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, paddingHorizontal: 12,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd',
  },
  empty: { textAlign: 'center', marginTop: 60, color: '#888' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, padding: 14, borderRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  price: { fontSize: 16, fontWeight: '700', color: '#2e7d32' },
  meta: { marginTop: 4, color: '#666', fontSize: 12 },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2e7d32', justifyContent: 'center', alignItems: 'center', elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  skuPreview: { color: '#2e7d32', fontWeight: '700', marginTop: -6, marginBottom: 8, fontSize: 13 },
  chipRow: { marginBottom: 10, flexGrow: 0 },
  chip: {
    backgroundColor: '#eee', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 6, alignSelf: 'flex-start',
  },
  chipActive: { backgroundColor: '#2e7d32' },
  chipText: { fontSize: 12, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4 },
  fieldSub: { fontSize: 11, color: '#888', marginBottom: 10 },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  scanButton: {
    backgroundColor: '#2e7d32', paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 8, marginBottom: 0,
  },
  scanButtonText: { color: '#fff', fontWeight: '700' },
  scannerContainer: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  scannerTitle: { color: '#fff', textAlign: 'center', fontSize: 16, marginBottom: 16 },
  scannerCamera: { flex: 1 },
  scannerPermission: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scannerPermissionText: { color: '#fff', fontSize: 16 },
  scannerClose: {
    alignSelf: 'center', marginVertical: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10,
  },
  scannerCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  button: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  cancel: { backgroundColor: '#eee' },
  save: { backgroundColor: '#2e7d32' },
  buttonText: { fontWeight: '600' },
});
