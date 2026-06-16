import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { COLORS } from '@/constants/colors';

export default function PermissionsScreen() {
  const router = useRouter();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationGranted, setLocationGranted] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  const cameraGranted = cameraPermission?.granted ?? false;

  const requestCamera = async () => {
    await requestCameraPermission();
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(status === 'granted');
  };

  const requestNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifGranted(status === 'granted');
  };

  const canContinue = cameraGranted && locationGranted;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.heading}>Permissions</Text>
        <Text style={styles.subheading}>We need a couple of things to get started.</Text>

        <View style={styles.permissionRow}>
          <Text style={styles.permissionEmoji}>📸</Text>
          <View style={styles.permissionMiddle}>
            <Text style={styles.permissionTitle}>Proof capture</Text>
            <Text style={styles.permissionSubtitle}>Required to submit proof of your dares</Text>
          </View>
          {cameraGranted ? (
            <Text style={styles.grantedCheck}>✓</Text>
          ) : (
            <TouchableOpacity style={styles.allowButton} onPress={requestCamera}>
              <Text style={styles.allowButtonText}>Allow</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.permissionRow}>
          <Text style={styles.permissionEmoji}>📍</Text>
          <View style={styles.permissionMiddle}>
            <Text style={styles.permissionTitle}>Field positioning</Text>
            <Text style={styles.permissionSubtitle}>Required to verify you completed the dare on location</Text>
          </View>
          {locationGranted ? (
            <Text style={styles.grantedCheck}>✓</Text>
          ) : (
            <TouchableOpacity style={styles.allowButton} onPress={requestLocation}>
              <Text style={styles.allowButtonText}>Allow</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.permissionRow}>
          <Text style={styles.permissionEmoji}>🔔</Text>
          <View style={styles.permissionMiddle}>
            <Text style={styles.permissionTitle}>Notifications</Text>
            <Text style={styles.permissionSubtitle}>Get notified the moment your dare drops. Miss the notification, miss the dare.</Text>
          </View>
          {notifGranted ? (
            <Text style={styles.grantedCheck}>✓</Text>
          ) : (
            <TouchableOpacity style={styles.allowButton} onPress={requestNotifications}>
              <Text style={styles.allowButtonText}>Allow</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: canContinue ? COLORS.amber : COLORS.navyLight },
          ]}
          onPress={() => router.replace('/(tabs)')}
          disabled={!canContinue}
        >
          <Text
            style={[
              styles.continueButtonText,
              { color: canContinue ? COLORS.navy : COLORS.concrete },
            ]}
          >
            Ready. Let's go →
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  heading: {
    color: COLORS.ghost,
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 8,
  },
  subheading: {
    color: COLORS.concrete,
    fontSize: 15,
    marginBottom: 48,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    padding: 20,
    backgroundColor: COLORS.navyMid,
    borderRadius: 16,
  },
  permissionEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  permissionMiddle: {
    flex: 1,
  },
  permissionTitle: {
    color: COLORS.ghost,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  permissionSubtitle: {
    color: COLORS.concrete,
    fontSize: 13,
    marginTop: 4,
  },
  grantedCheck: {
    fontSize: 24,
    color: COLORS.green,
  },
  allowButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.amber,
    borderRadius: 20,
  },
  allowButtonText: {
    color: COLORS.navy,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  continueButton: {
    marginTop: 'auto',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
});
