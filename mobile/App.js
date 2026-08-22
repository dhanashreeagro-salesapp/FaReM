import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Font from 'expo-font';
import { Sora_600SemiBold } from '@expo-google-fonts/sora';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import * as SecureStore from 'expo-secure-store';

import HomeScreen from './screens/HomeScreen';
import FarmerProfile from './screens/FarmerProfile';
import LoginScreen from './screens/LoginScreen';
import LogVisitScreen from './screens/LogVisitScreen';
import RoutePlannerScreen from './screens/RoutePlannerScreen';
import BigFarmerDirectoryScreen from './screens/BigFarmerDirectoryScreen';
import { initDatabase } from './services/database';
import { theme } from './theme';

const Stack = createStackNavigator();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          Sora_600SemiBold,
          DMSans_400Regular,
          JetBrainsMono_400Regular,
        });
        await initDatabase();
        const token = await SecureStore.getItemAsync('ffma_access_token');
        setIsAuthenticated(!!token);
      } catch (e) {
        console.warn(e);
      } finally {
        setFontsLoaded(true);
        setLoading(false);
      }
    }
    prepare();
  }, []);

  if (!fontsLoaded || loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: theme.fonts.heading, fontWeight: '600' },
          headerBackTitleVisible: false,
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {(props) => <LoginScreen {...props} onLogin={() => setIsAuthenticated(true)} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'FFMA Dashboard' }} />
            <Stack.Screen name="FarmerProfile" component={FarmerProfile} options={{ title: 'Farmer Profile' }} />
            <Stack.Screen name="LogVisit" component={LogVisitScreen} options={{ title: 'Log Visit' }} />
            <Stack.Screen name="RoutePlanner" component={RoutePlannerScreen} options={{ title: 'Route Planner' }} />
            <Stack.Screen name="BigFarmerDirectory" component={BigFarmerDirectoryScreen} options={{ title: 'Village Insights' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
