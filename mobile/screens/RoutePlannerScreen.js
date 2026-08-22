import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { theme } from '../theme';
import api from '../services/api';

export default function RoutePlannerScreen({ navigation }) {
    const [location, setLocation] = useState(null);
    const [farmers, setFarmers] = useState([]);
    const [routeCoords, setRouteCoords] = useState([]);
    const [destination, setDestination] = useState(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is needed for Route Planner.');
                return;
            }

            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc.coords);
        })();
    }, []);

    const handleMapLongPress = async (e) => {
        const dest = e.nativeEvent.coordinate;
        setDestination(dest);
        
        // MVP: Just draw a straight line or simulated polyline from current to dest
        // In full implementation, call Google Maps Directions API
        if (location) {
            setRouteCoords([
                { latitude: location.latitude, longitude: location.longitude },
                dest
            ]);
            
            // Mock fetching farmers along the route
            try {
                // In production, we'd hit the real API with the polyline
                // const response = await api.post('/route-corridors/', { start: location, end: dest });
                setFarmers([
                    { id: '1', name: 'Ramesh Patil', acreage: 4.5, crop: 'Grapes', stage: 'Flowering' },
                    { id: '2', name: 'Suresh Shinde', acreage: 2.0, crop: 'Tomato', stage: 'Vegetative' }
                ]);
            } catch (error) {
                console.error("Error fetching farmers along route", error);
            }
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Route Planner</Text>
                <Text style={styles.subtitle}>Long press on map to set destination</Text>
            </View>

            {location ? (
                <MapView
                    style={styles.map}
                    initialRegion={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    onLongPress={handleMapLongPress}
                >
                    <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} title="Current Location" pinColor={theme.colors.primary} />
                    
                    {destination && <Marker coordinate={destination} title="Destination" pinColor={theme.colors.accent} />}
                    
                    {routeCoords.length > 0 && (
                        <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor={theme.colors.primary} />
                    )}

                    {/* Mock Farmer Pins */}
                    {farmers.map((f, i) => (
                        <Marker 
                            key={i}
                            coordinate={{ 
                                latitude: location.latitude + (destination.latitude - location.latitude) * 0.5 + (i * 0.005), 
                                longitude: location.longitude + (destination.longitude - location.longitude) * 0.5 + (i * 0.005)
                            }}
                            title={f.name}
                            description={`${f.crop} - ${f.acreage} acres`}
                            pinColor={theme.colors.warning}
                        />
                    ))}
                </MapView>
            ) : (
                <View style={[styles.map, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text>Getting Location...</Text>
                </View>
            )}

            <View style={styles.listContainer}>
                <Text style={styles.listTitle}>Farmers Along Route</Text>
                <FlatList
                    data={farmers}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.card}>
                            <Text style={styles.cardTitle}>{item.name}</Text>
                            <Text style={styles.cardSubtitle}>{item.crop} • {item.stage} • {item.acreage} acres</Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyText}>No farmers found on this route.</Text>}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { padding: 16, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderColor: theme.colors.border },
    title: { fontSize: 20, fontFamily: 'Sora_600SemiBold', color: theme.colors.text },
    subtitle: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: theme.colors.textMuted, marginTop: 4 },
    map: { flex: 1 },
    listContainer: { flex: 1, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderColor: theme.colors.border, padding: 16 },
    listTitle: { fontSize: 16, fontFamily: 'Sora_600SemiBold', color: theme.colors.text, marginBottom: 12 },
    card: { backgroundColor: theme.colors.background, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
    cardTitle: { fontSize: 16, fontFamily: 'Sora_600SemiBold', color: theme.colors.text },
    cardSubtitle: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: theme.colors.textMuted, marginTop: 4 },
    emptyText: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 20, fontFamily: 'DMSans_400Regular' }
});
