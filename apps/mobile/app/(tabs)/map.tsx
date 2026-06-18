import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import TraceCard, { parseClue, type TraceStage } from '@/components/TraceCard';
import TracePin from '@/components/TracePin';
import SelfieCapture from '@/components/SelfieCapture';
import SolveReveal from '@/components/SolveReveal';
import TauntModal from '@/components/TauntModal';
import { useLocation, useNearbyTraces, type NearbyTrace } from '@/hooks/useTraces';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────
// Dev utility — seeds 5 test traces around current location
// Remove before production
// ─────────────────────────────────────────────
async function seedTracesNearMe(lat: number, lng: number) {
  const { error } = await supabase.rpc('seed_dev_traces', {
    user_lat: lat,
    user_lng: lng,
  });
  if (error) console.error('Seed error:', error.message);
  else console.log('✅ 5 test traces seeded near you');
}

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0A0A0A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A8A8A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E1E1E' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#222222' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060606' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function difficultyToStage(
  distanceM: number,
  solveRadius: number,
  notifyRadius: number
): TraceStage {
  if (distanceM <= solveRadius) return 'close';
  if (distanceM <= notifyRadius * 0.5) return 'approaching';
  return 'locked';
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<any>(null);

  const { location, error: locationError, granted } = useLocation();
  const { data: traces = [], isLoading, refetch } = useNearbyTraces(location);

  const [activeTrace, setActiveTrace] = useState<NearbyTrace | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [showCamera, setShowCamera] = useState(false);
  const [solveResult, setSolveResult] = useState<{ selfieUri: string; startedAt: number } | null>(null);
  const [showTaunt, setShowTaunt] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const startedAtRef = useRef<number>(0);

  const openTrace = useCallback((trace: NearbyTrace) => {
    setActiveTrace(trace);
    setAttemptsLeft(trace.max_attempts);
    startedAtRef.current = Date.now();
    sheetRef.current?.expand();
  }, []);

  const closeTrace = useCallback(() => {
    sheetRef.current?.close();
    setActiveTrace(null);
    setSolveResult(null);
  }, []);

  const handleSubmit = useCallback(() => {
    setShowCamera(true);
  }, []);

  const handleCapture = useCallback(async (selfieUri: string) => {
    if (!activeTrace || !location) return;
    setShowCamera(false);

    const distNow = getDistance(
      location.lat, location.lng,
      activeTrace.lat, activeTrace.lng
    );

    if (distNow > activeTrace.solve_radius_meters) {
      setAttemptsLeft((n) => Math.max(0, n - 1));
      return;
    }

    // Write solve to DB (best-effort — preview mode may have no user)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
      await supabase.from('trace_solves').upsert({
        trace_id: activeTrace.id,
        user_id: user.id,
        attempts_used: activeTrace.max_attempts - attemptsLeft + 1,
        time_to_solve_seconds: elapsed,
        selfie_url: selfieUri,
      }, { onConflict: 'trace_id,user_id' });
    }

    setSolveResult({ selfieUri, startedAt: startedAtRef.current });
    sheetRef.current?.close();
  }, [activeTrace, location, attemptsLeft]);

  const handleContinue = useCallback(() => {
    setSolveResult(null);
    setActiveTrace(null);
    refetch();
  }, [refetch]);

  if (!granted && locationError) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>Location access needed to find traces.</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={COLORS.amber} size="large" />
        <Text style={styles.loadingText}>ACQUIRING LOCATION...</Text>
      </View>
    );
  }

  const stage: TraceStage = activeTrace
    ? activeTrace.already_solved
      ? 'solved'
      : difficultyToStage(
          activeTrace.distance_meters,
          activeTrace.solve_radius_meters,
          activeTrace.notify_radius_meters
        )
    : 'locked';

  return (
    <View style={styles.root}>
      {/* Full-screen dark map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        customMapStyle={DARK_MAP_STYLE}
        userInterfaceStyle="dark"
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        initialRegion={{
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
      >
        {traces.map((trace) => (
          <Marker
            key={trace.id}
            coordinate={{ latitude: trace.lat, longitude: trace.lng }}
            onPress={() => openTrace(trace)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <TracePin
              state={
                trace.already_solved
                  ? 'solved'
                  : trace.distance_meters <= trace.notify_radius_meters
                  ? 'active'
                  : 'undiscovered'
              }
              distanceMeters={Math.round(trace.distance_meters)}
            />
          </Marker>
        ))}
      </MapView>

      {/* HUD overlay */}
      <SafeAreaView style={styles.hud} edges={['top']} pointerEvents="box-none">
        <View style={styles.hudRow}>
          <View style={styles.hudLeft}>
            <Text style={styles.hudLabel}>TRACES NEARBY</Text>
            <Text style={styles.hudCount}>
              {isLoading ? '—' : traces.filter((t) => !t.already_solved).length}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.recenterBtn}
            onPress={() =>
              mapRef.current?.animateToRegion(
                {
                  latitude: location.lat,
                  longitude: location.lng,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                },
                400
              )
            }
          >
            <Text style={styles.recenterIcon}>◎</Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={styles.scanningBadge}>
            <ActivityIndicator color={COLORS.amber} size="small" />
            <Text style={styles.scanningText}>SCANNING AREA...</Text>
          </View>
        )}

      </SafeAreaView>

      {/* DEV: floating seed button — remove before production */}
      {!isLoading && traces.length === 0 && (
        <TouchableOpacity
          style={styles.devSeedBtn}
          disabled={seeding}
          onPress={async () => {
            setSeeding(true);
            await seedTracesNearMe(location.lat, location.lng);
            await refetch();
            setSeeding(false);
          }}
        >
          {seeding
            ? <ActivityIndicator color={COLORS.navy} size="small" />
            : <Text style={styles.devSeedText}>DEV: Seed traces here</Text>
          }
        </TouchableOpacity>
      )}

      {/* Camera overlay */}
      {showCamera && activeTrace && (
        <SelfieCapture
          distanceMeters={activeTrace.distance_meters}
          solveRadius={activeTrace.solve_radius_meters}
          onCapture={handleCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {/* Solve success reveal */}
      {solveResult && activeTrace && (
        <SolveReveal
          placeName={activeTrace.place_name ?? 'Unknown place'}
          difficulty={activeTrace.difficulty}
          selfieUri={solveResult.selfieUri}
          timeSeconds={Math.round((Date.now() - solveResult.startedAt) / 1000)}
          onTaunt={() => setShowTaunt(true)}
          onContinue={handleContinue}
        />
      )}

      {/* Taunt modal */}
      {solveResult && activeTrace && (
        <TauntModal
          visible={showTaunt}
          traceId={activeTrace.id}
          traceName={activeTrace.place_name ?? 'Unknown place'}
          solveTimeSeconds={Math.round((Date.now() - solveResult.startedAt) / 1000)}
          onClose={() => setShowTaunt(false)}
          onSent={(username) => {
            setShowTaunt(false);
            handleContinue();
          }}
        />
      )}

      {/* TraceCard bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['55%', '88%']}
        enablePanDownToClose
        onClose={closeTrace}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {activeTrace && (
            <>
              <TraceCard
                id={activeTrace.id}
                segments={parseClue(activeTrace.clue)}
                difficulty={activeTrace.difficulty as any}
                attemptsLeft={attemptsLeft}
                maxAttempts={activeTrace.max_attempts}
                stage={stage}
                distanceMeters={Math.round(activeTrace.distance_meters)}
                onSubmit={handleSubmit}
              />
              <Text style={styles.solveCount}>
                {activeTrace.solve_count === 0
                  ? 'No one has found this yet.'
                  : `${activeTrace.solve_count} tracer${activeTrace.solve_count === 1 ? '' : 's'} found this.`}
              </Text>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  centerFill: {
    flex: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.classified,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 16,
  },
  loadingText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.concrete,
    letterSpacing: 2,
    marginTop: 16,
  },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginHorizontal: 16,
    marginTop: 8,
  },
  hudLeft: {
    backgroundColor: 'rgba(10,10,10,0.88)',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.navyLight,
  },
  hudLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.concrete,
    letterSpacing: 2,
  },
  hudCount: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 26,
    color: COLORS.amber,
    marginTop: 1,
  },
  recenterBtn: {
    backgroundColor: 'rgba(10,10,10,0.88)',
    borderRadius: 4,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.navyLight,
  },
  recenterIcon: {
    fontSize: 20,
    color: COLORS.ghost,
  },
  scanningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10,10,10,0.88)',
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  scanningText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.amber,
    letterSpacing: 2,
  },
  sheetBg: {
    backgroundColor: COLORS.navyMid,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sheetHandle: {
    backgroundColor: COLORS.navyLight,
    width: 36,
  },
  sheetContent: {
    paddingTop: 8,
    paddingBottom: 48,
  },
  devSeedBtn: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    left: '25%',
    right: '25%',
    backgroundColor: COLORS.amber,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    zIndex: 50,
  },
  devSeedText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: COLORS.navy,
    letterSpacing: 1,
  },
  solveCount: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.concrete,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
});
