import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProducts, addProduct, updateProduct, deleteProduct, generateSku, CATEGORIES } from '../db';

const emptyForm = { sku: '', name: '', category: '', brand: '', variant: '', price: '', cost: '', stock: '' };

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    getProducts().then(setProducts);
  }, []);

  useFocusEffect(load);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
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

  const save = async () => {
    const data = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      brand: form.brand.trim(),
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseInt(form.stock) || 0,
    };
    if (!data.name) {
      Alert.alert('Missing info', 'Product name is required.');
      return;
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
                {item.brand ? `${item.brand} · ` : ''}{item.category ? `${item.category} · ` : ''}SKU: {item.sku} · Stock: {item.stock} · Cost: {money(item.cost)} · Margin: {money(margin)}
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
              <TextInput
                style={styles.input}
                placeholder={editing ? 'SKU / barcode value' : 'SKU (leave blank to auto-generate)'}
                value={form.sku}
                onChangeText={(v) => setForm({ ...form, sku: v })}
                autoCapitalize="characters"
              />
              {!editing && !form.sku.trim() && skuPreview !== '' && (
                <Text style={styles.skuPreview}>Auto SKU: {skuPreview}</Text>
              )}
              <TextInput
                style={styles.input}
                placeholder="Product name"
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
              />
              <TextInput
                style={styles.input}
                placeholder="Brand (AA in SKU, e.g. Life Cat → LC)"
                value={form.brand}
                onChangeText={(v) => setForm({ ...form, brand: v })}
                autoCapitalize="words"
              />
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
                placeholder={editing ? 'Category' : 'Category (tap a chip above or type)'}
                value={form.category}
                onChangeText={(v) => setForm({ ...form, category: v })}
              />
              {!editing && (
                <TextInput
                  style={styles.input}
                  placeholder="Rasa / varian (CC in SKU, e.g. Adult Tuna → AT) — optional"
                  value={form.variant}
                  onChangeText={(v) => setForm({ ...form, variant: v })}
                />
              )}
              {[
                ['price', 'Selling price'],
                ['cost', 'Purchase cost'],
                ['stock', 'Stock qty'],
              ].map(([key, placeholder]) => (
                <TextInput
                  key={key}
                  style={styles.input}
                  placeholder={placeholder}
                  value={form[key]}
                  onChangeText={(v) => setForm({ ...form, [key]: v })}
                  keyboardType="numeric"
                />
              ))}
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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  button: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  cancel: { backgroundColor: '#eee' },
  save: { backgroundColor: '#2e7d32' },
  buttonText: { fontWeight: '600' },
});
