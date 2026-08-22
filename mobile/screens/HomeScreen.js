import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import api from '../services/api';
import { theme } from '../theme';
import { syncOfflineData } from '../services/sync';
import * as Location from 'expo-location';

export default function HomeScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      await syncOfflineData();
      const plan = await api.getDailyPlan();
      setData(plan);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // MVP Geo-Fencing & Proximity Logic (Foreground)
    let locationSubscription;
    (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            locationSubscription = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 100 },
                (loc) => {
                    // Logic to check proximity to planned visits and trigger pop-up
                    // Example: if distance < 500m, show advisory/promotion popup
                    console.log("Foreground location update:", loc.coords);
                }
            );
        }
    })();
    
    return () => {
        if (locationSubscription) {
            locationSubscription.remove();
        }
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, Staff</Text>
        <Text style={styles.date}>{new Date().toDateString()}</Text>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{data?.summary?.overdue_count || 0}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{data?.summary?.pending_visits || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>
      
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('RoutePlanner')}>
          <Text style={styles.actionBtnText}>📍 Route Planner</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('BigFarmerDirectory', { village: 'Sinnar' })}>
          <Text style={styles.actionBtnText}>🏆 Village Insights</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.sectionTitle}>Today's Smart Plan</Text>
      
      {data?.plan?.length > 0 ? (
        data.plan.map((item, index) => (
          <TouchableOpacity 
            key={item.id}
            style={styles.card}
            onPress={() => navigation.navigate('FarmerProfile', { farmerId: item.id })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.farmerName}>{item.full_name}</Text>
              {item.is_overdue && (
                <View style={styles.badge}><Text style={styles.badgeText}>Overdue</Text></View>
              )}
            </View>
            <Text style={styles.farmerDetail}>Village: {item.village} | {item.distance_km?.toFixed(1)}km away</Text>
            {item.current_crop && (
                <Text style={styles.farmerDetail}>Crop: {item.current_crop} ({item.current_stage})</Text>
            )}
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No visits planned for today.</Text>
        </View>
      )}
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 25, backgroundColor: theme.colors.primary, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 50 },
  greeting: { fontSize: 24, fontFamily: theme.fonts.heading, fontWeight: 'bold', color: '#fff' },
  date: { fontSize: 14, fontFamily: theme.fonts.body, color: '#E8F5E9', marginTop: 5 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, marginTop: -30 },
  statBox: { backgroundColor: '#fff', padding: 20, borderRadius: 15, alignItems: 'center', width: '45%', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statNumber: { fontSize: 28, fontFamily: theme.fonts.heading, fontWeight: 'bold', color: theme.colors.accent },
  statLabel: { fontSize: 13, fontFamily: theme.fonts.body, color: theme.colors.textMuted, marginTop: 5 },
  sectionTitle: { fontSize: 18, fontFamily: theme.fonts.heading, fontWeight: 'bold', padding: 20, color: theme.colors.text, marginTop: 10 },
  card: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 15, padding: 18, borderRadius: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, borderLeftWidth: 4, borderLeftColor: theme.colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  farmerName: { fontSize: 16, fontFamily: theme.fonts.heading, fontWeight: 'bold', color: theme.colors.text },
  badge: { backgroundColor: theme.colors.danger, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: theme.fonts.heading, fontWeight: 'bold' },
  farmerDetail: { fontSize: 14, fontFamily: theme.fonts.body, color: theme.colors.textMuted, marginBottom: 4 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontFamily: theme.fonts.body, color: theme.colors.textMuted },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20 },
  actionBtn: { flex: 1, backgroundColor: theme.colors.surface, padding: 12, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  actionBtnText: { fontFamily: theme.fonts.heading, fontSize: 13, color: theme.colors.primary, fontWeight: 'bold' }
});
