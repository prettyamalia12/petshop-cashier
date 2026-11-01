import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { initDb, seedIfEmpty } from './src/db';
import ProductsScreen from './src/screens/ProductsScreen';
import SellScreen from './src/screens/SellScreen';
import QRScreen from './src/screens/QRScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb().then(seedIfEmpty).then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerTitleAlign: 'center',
          tabBarLabelStyle: { fontSize: 12 },
        }}
      >
        <Tab.Screen name="Sell" component={SellScreen} options={{ title: 'Cashier' }} />
        <Tab.Screen name="Products" component={ProductsScreen} options={{ title: 'Products' }} />
        <Tab.Screen name="QR Code" component={QRScreen} options={{ title: 'QR per SKU' }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Sales History' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
