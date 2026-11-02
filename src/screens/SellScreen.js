import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  KeyboardAvoidingView, Keyboard, FlatList, StyleSheet, Alert, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { getProductByCode, checkout } from '../db';
import ScanOverlay from '../components/ScanOverlay';

const beep = require('../../assets/beep.wav');

const playBeep = () => {
  const player = createAudioPlayer(beep);
  player.play();
  setTimeout(() => player.remove(), 1000);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

const money = (n) => `Rp ${n.toLocaleString('id-ID')}`;

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'qris', label: 'QRIS' },
  { key: 'transfer', label: 'Transfer' },
];

export default function SellScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cart, setCart] = useState([]);
  const [scanning, setScanning] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [torch, setTorch] = useState(false);
  const lastScan = useRef({ code: null, at: 0 });

  const onScanned = async ({ data }) => {
    const now = Date.now();
    if (!scanning) return;
    if (lastScan.current.code === data && now - lastScan.current.at < 2000) return;
    lastScan.current = { code: data, at: now };

    const product = await getProductByCode(data);
    if (!product) {
      Alert.alert(
        'Not found',
        `No product matches code: ${data}\n\nAdd it in the Products tab — you can scan this barcode into the Barcode field.`
      );
      return;
    }
    if (product.stock <= 0) {
      Alert.alert('Out of stock', `${product.name} is out of stock.`);
      return;
    }
    playBeep();
    setCart((prev) => {
      const i = prev.findIndex((it) => it.id === product.id);
      if (i >= 0) {
        if (prev[i].qty + 1 > product.stock) {
          Alert.alert('Stock limit', `Only ${product.stock} of ${product.name} in stock.`);
          return prev;
        }
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((it) => (it.id === id ? { ...it, qty: it.qty + delta } : it))
        .filter((it) => it.qty > 0)
    );
  };

  const doCheckout = () => {
    if (!cart.length) return;
    const income = cart.reduce((s, it) => s + it.price * it.qty, 0);
    const profit = cart.reduce((s, it) => s + (it.price - it.cost) * it.qty, 0);

    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived);
      if (isNaN(received) || received < income) {
        Alert.alert('Insufficient cash', `Total is ${money(income)}. Enter the amount received.`);
        return;
      }
      const change = received - income;
      checkout(cart, paymentMethod)
        .then(() => {
          Alert.alert(
            'Sale completed',
            `Cash received: ${money(received)}\nChange: ${money(change)}\nIncome: ${money(income)}\nProfit: ${money(profit)}`
          );
          setCart([]);
          setCashReceived('');
        })
        .catch(() => Alert.alert('Error', 'Checkout failed.'));
      return;
    }

    checkout(cart, paymentMethod)
      .then(() => {
        Alert.alert(
          'Sale completed',
          `Payment: ${PAYMENT_METHODS.find((m) => m.key === paymentMethod).label}\nIncome: ${money(income)}\nProfit: ${money(profit)}`
        );
        setCart([]);
      })
      .catch(() => Alert.alert('Error', 'Checkout failed.'));
  };

  const income = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const profit = cart.reduce((s, it) => s + (it.price - it.cost) * it.qty, 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 82 : 0}
    >
      <View style={styles.scannerBox}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'upc_a', 'upc_e', 'datamatrix'] }}
            onBarcodeScanned={scanning ? onScanned : undefined}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Camera access is needed to scan products.</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        )}
        {permission?.granted && <ScanOverlay active={scanning} />}
        {scanning && permission?.granted && (
          <View style={styles.scanControls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => setScanning(false)}>
              <Text style={styles.controlText}>Pause scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, torch && styles.controlActive]}
              onPress={() => setTorch((t) => !t)}
            >
              <Text style={[styles.controlText, torch && styles.controlTextActive]}>
                Torch {torch ? 'on' : 'off'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <FlatList
          data={cart}
          keyExtractor={(it) => String(it.id)}
          style={styles.cartList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>Scan a product QR/barcode to add it to the cart.</Text>}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartName}>{item.name}</Text>
              <Text style={styles.cartMeta}>
                {money(item.price)} × {item.qty} = {money(item.price * item.qty)}
                {'  ·  profit '}{money((item.price - item.cost) * item.qty)}
              </Text>
            </View>
            <TouchableOpacity style={styles.qtyButton} onPress={() => changeQty(item.id, -1)}>
              <Text style={styles.qtyText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qty}>{item.qty}</Text>
            <TouchableOpacity style={styles.qtyButton} onPress={() => changeQty(item.id, 1)}>
              <Text style={styles.qtyText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
        />
      </TouchableWithoutFeedback>

      <View style={styles.paymentBox}>
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodButton, paymentMethod === m.key && styles.methodActive]}
              onPress={() => setPaymentMethod(m.key)}
            >
              <Text style={[styles.methodText, paymentMethod === m.key && styles.methodTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {paymentMethod === 'cash' && (
          <View style={styles.cashRow}>
            <TextInput
              style={styles.cashInput}
              placeholder="Cash received"
              value={cashReceived}
              onChangeText={setCashReceived}
              keyboardType="numeric"
            />
            {parseFloat(cashReceived) >= income && income > 0 && (
              <Text style={styles.changeText}>
                Change: {money(parseFloat(cashReceived) - income)}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.total}>Income: {money(income)}</Text>
          <Text style={styles.profit}>Profit: {money(profit)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payButton, !cart.length && { backgroundColor: '#a5a5a5' }]}
          disabled={!cart.length}
          onPress={doCheckout}
        >
          <Text style={styles.payText}>CHARGE</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scannerBox: { height: 220, backgroundColor: '#000' },
  permissionBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionText: { color: '#fff', textAlign: 'center', marginBottom: 12 },
  permissionButton: { backgroundColor: '#2e7d32', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  permissionButtonText: { color: '#fff', fontWeight: '600' },
  pause: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  pauseText: { color: '#fff' },
  scanControls: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    flexDirection: 'row', gap: 10,
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 14,
  },
  controlActive: { backgroundColor: '#2e7d32' },
  controlText: { color: '#fff' },
  controlTextActive: { fontWeight: '700' },
  cartList: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 24, color: '#888' },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 10,
  },
  cartName: { fontSize: 15, fontWeight: '600' },
  cartMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  qtyButton: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#e0e0e0',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  qtyText: { fontSize: 18, fontWeight: '700' },
  qty: { marginLeft: 8, minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  paymentBox: { backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd' },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodButton: {
    flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#eee',
    alignItems: 'center',
  },
  methodActive: { backgroundColor: '#2e7d32' },
  methodText: { fontWeight: '600', color: '#555' },
  methodTextActive: { color: '#fff' },
  cashRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  cashInput: {
    flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  changeText: { fontWeight: '700', color: '#2e7d32' },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd',
  },
  total: { fontSize: 16, fontWeight: '700' },
  profit: { fontSize: 14, color: '#2e7d32', fontWeight: '600' },
  payButton: { backgroundColor: '#2e7d32', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10 },
  payText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
