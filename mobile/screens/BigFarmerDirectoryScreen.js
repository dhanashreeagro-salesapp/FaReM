import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import api from '../services/api';

export default function BigFarmerDirectoryScreen({ route }) {
    const [farmers, setFarmers] = useState([]);
    const [loading, setLoading] = useState(true);
    const village = route.params?.village || 'Sinnar'; // Defaulting for MVP demo

    useEffect(() => {
        fetchTopFarmers();
    }, [village]);

    const fetchTopFarmers = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/route/big-farmers/?village=${village}`);
            setFarmers(response.data);
        } catch (error) {
            console.error("Error fetching top farmers", error);
            // Mock data fallback for MVP if API is not fully reachable
            setFarmers([
                { id: '1', full_name: 'Ananda Deshmukh', village: 'Sinnar', total_acreage: 15.5 },
                { id: '2', full_name: 'Baburao Kadam', village: 'Sinnar', total_acreage: 12.0 },
                { id: '3', full_name: 'Kashinath Pawar', village: 'Sinnar', total_acreage: 8.5 }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Top Farmers in {village}</Text>
                <Text style={styles.subtitle}>Ranked by total cultivated acreage</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={farmers}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item, index }) => (
                        <View style={styles.card}>
                            <View style={styles.rankBadge}>
                                <Text style={styles.rankText}>#{index + 1}</Text>
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={styles.farmerName}>{item.full_name}</Text>
                                <Text style={styles.acreageText}>{item.total_acreage} Acres Total</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No farmers with recorded acreage found in this village.</Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { padding: 16, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderColor: theme.colors.border },
    title: { fontSize: 20, fontFamily: 'Sora_600SemiBold', color: theme.colors.text },
    subtitle: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: theme.colors.textMuted, marginTop: 4 },
    list: { padding: 16 },
    card: { 
        flexDirection: 'row', 
        backgroundColor: theme.colors.surface, 
        padding: 12, 
        borderRadius: 8, 
        marginBottom: 12, 
        borderWidth: 1, 
        borderColor: theme.colors.border,
        alignItems: 'center'
    },
    rankBadge: {
        backgroundColor: theme.colors.primary,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    rankText: { color: theme.colors.surface, fontFamily: 'Sora_600SemiBold', fontSize: 14 },
    cardContent: { flex: 1 },
    farmerName: { fontSize: 16, fontFamily: 'Sora_600SemiBold', color: theme.colors.text },
    acreageText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: theme.colors.accent, marginTop: 4 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 20, fontFamily: 'DMSans_400Regular' }
});
