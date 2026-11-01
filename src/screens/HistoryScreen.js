import React, { useCallback, useState } from 'react';
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSales, getSaleItems } from '../db';

const money = (n) => `Rp ${n.toLocaleString('id-ID')}`;

const METHOD_LABELS = { cash: 'Cash', qris: 'QRIS', transfer: 'Bank Transfer' };

export default function HistoryScreen() {
  const [sections, setSections] = useState([]);
  const [totals, setTotals] = useState({ income: 0, profit: 0 });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const sales = await getSales();
        const secs = [];
        let income = 0;
        let profit = 0;
        for (const s of sales) {
          const items = await getSaleItems(s.id);
          income += s.total;
          profit += s.profit;
          secs.push({
            title: `Sale #${s.id} — ${s.created_at}`,
            data: items,
            total: s.total,
            profit: s.profit,
            method: METHOD_LABELS[s.payment_method] || s.payment_method || 'Cash',
          });
        }
        setSections(secs);
        setTotals({ income, profit });
      })();
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>Total income: {money(totals.income)}</Text>
        <Text style={[styles.summaryText, { color: '#2e7d32' }]}>Total profit: {money(totals.profit)}</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(it) => String(it.id)}
        renderSectionHeader={({ section }) => (
          <View style={styles.header}>
            <Text style={styles.headerText}>{section.title}</Text>
            <Text style={styles.headerAmounts}>
              {section.method} · {money(section.total)} · profit {money(section.profit)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowName}>{item.name} × {item.qty}</Text>
            <Text style={styles.rowAmounts}>
              {money(item.subtotal)} · +{money(item.profit)}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No sales yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  summary: { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  summaryText: { fontSize: 15, fontWeight: '700' },
  header: { backgroundColor: '#e8f0e8', paddingHorizontal: 14, paddingVertical: 8 },
  headerText: { fontWeight: '700', fontSize: 13 },
  headerAmounts: { fontSize: 12, color: '#444' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  rowName: { fontSize: 14 },
  rowAmounts: { fontSize: 13, color: '#2e7d32' },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
});
