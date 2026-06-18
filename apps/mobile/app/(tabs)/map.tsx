import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import MapView, { Marker, Polygon, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_H = Dimensions.get('window').height;

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import TraceCard, { parseClue, formatDistance, type TraceStage } from '@/components/TraceCard';
import TracePin from '@/components/TracePin';
import SelfieCapture from '@/components/SelfieCapture';
import SolveReveal from '@/components/SolveReveal';
import TauntModal from '@/components/TauntModal';
import RescueModal from '@/components/RescueModal';
import ExtraAttemptsModal from '@/components/ExtraAttemptsModal';
import AnswerModal from '@/components/AnswerModal';

// Level-based radius multiplier — beginners get MORE room to succeed (hook them),
// veterans get less (mastery challenge)
const LEVEL_RADIUS_MULTIPLIER: Record<string, number> = {
  wanderer:   5.0,  // Recruit   — 5x radius, very forgiving, feel like winners
  scout:      3.0,  // Agent     — 3x, still easy
  explorer:   1.5,  // Operative — 1.5x, getting real
  chronicler: 1.0,  // Field Agent — base radius
  keeper:     0.5,  // Handler   — half radius, must be precise
  legend:     0.2,  // Legend    — 20%, standing right on it
};

function effectiveSolveRadius(baseRadius: number, userLevel: string): number {
  const mult = LEVEL_RADIUS_MULTIPLIER[userLevel] ?? 1.0;
  return Math.max(5, Math.round(baseRadius * mult)); // min 5m
}
import { useRescueStore } from '@/stores/rescueStore';
import { useLocation, useNearbyTraces, useGhostTrails, useRevealedZones, type NearbyTrace } from '@/hooks/useTraces';
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
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  const { location, error: locationError, granted } = useLocation();
  const { data: traces = [], isLoading, refetch } = useNearbyTraces(location);
  const { data: ghostTrails = [] } = useGhostTrails(location);
  const { data: revealedZones = [], refetch: refetchZones } = useRevealedZones(publicUserId);

  const [activeTrace, setActiveTrace] = useState<NearbyTrace | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [publicUserId, setPublicUserId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [solveResult, setSolveResult] = useState<{ selfieUri: string; startedAt: number } | null>(null);
  const [showTaunt, setShowTaunt] = useState(false);
  const [solveMultiplier, setSolveMultiplier] = useState(1);
  const [showExtraAttempts, setShowExtraAttempts] = useState(false);
  const [userLevel, setUserLevel] = useState('wanderer');
  const [seeding, setSeeding] = useState(false);

  // Load user level + public ID for radius scaling and fog of war
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('users').select('id, level').eq('auth_id', user.id).single()
        .then(({ data }) => {
          if (data?.level) setUserLevel(data.level);
          if (data?.id) setPublicUserId(data.id);
        });
    });
  }, []);
  const { pendingRescue, setPendingRescue } = useRescueStore();
  const startedAtRef = useRef<number>(0);

  const openTrace = useCallback((trace: NearbyTrace) => {
    setActiveTrace(trace);
    setAttemptsLeft(trace.max_attempts);
    startedAtRef.current = Date.now();
    // Roll XP multiplier (pre-set on TTL traces overrides random roll)
    const preSet = trace.xp_multiplier ?? 1;
    if (preSet > 1) { setSolveMultiplier(preSet); }
    else {
      const r = Math.random();
      setSolveMultiplier(r < 0.60 ? 1 : r < 0.85 ? 2 : r < 0.97 ? 3 : 5);
    }
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }, [slideAnim]);

  const closeTrace = useCallback(() => {
    Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }).start(() => {
      setActiveTrace(null);
      setSolveResult(null);
    });
  }, [slideAnim]);

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

    if (distNow > effectiveSolveRadius(activeTrace.solve_radius_meters, userLevel)) {
      const newLeft = Math.max(0, attemptsLeft - 1);
      setAttemptsLeft(newLeft);
      if (newLeft === 0) setShowExtraAttempts(true);
      // Last attempt used — request rescue from followers
      if (newLeft === 1) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: myUser } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();
          if (myUser) {
            await supabase.rpc('request_rescue', {
              p_trace_id: activeTrace.id,
              p_rescued_user_id: myUser.id,
            });
          }
        }
      }
      return;
    }

    // Write solve to DB using public.users.id (not auth.uid)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: publicUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (publicUser) {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        await supabase.from('trace_solves').upsert({
          trace_id: activeTrace.id,
          user_id: publicUser.id,
          attempts_used: activeTrace.max_attempts - attemptsLeft + 1,
          time_to_solve_seconds: elapsed,
          selfie_url: selfieUri,
        }, { onConflict: 'trace_id,user_id' });
      }
    }

    Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }).start();
    setSolveResult({ selfieUri, startedAt: startedAtRef.current });
    refetchZones();
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

  const effRadius = activeTrace
    ? effectiveSolveRadius(activeTrace.solve_radius_meters, userLevel)
    : 30;

  const stage: TraceStage = activeTrace
    ? activeTrace.already_solved
      ? 'solved'
      : difficultyToStage(
          activeTrace.distance_meters,
          effRadius,
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
        {/* Trace search zones — show the area, not the exact spot */}
        {traces.filter(t => !t.already_solved).map((trace) => {
          const isActive = trace.distance_meters <= trace.notify_radius_meters;
          return (
            <React.Fragment key={trace.id}>
              {/* Zone circle — fixed visual size, not tied to actual radius */}
              <Circle
                center={{ latitude: trace.lat, longitude: trace.lng }}
                radius={isActive ? 80 : 120}
                fillColor={isActive ? 'rgba(184,134,11,0.10)' : 'rgba(138,138,138,0.05)'}
                strokeColor={isActive ? 'rgba(184,134,11,0.6)' : 'rgba(138,138,138,0.2)'}
                strokeWidth={isActive ? 2 : 1}
              />
              {/* Invisible tap target at center — small dot only, no pointed pin */}
              <Marker
                coordinate={{ latitude: trace.lat, longitude: trace.lng }}
                onPress={() => openTrace(trace)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.zoneCenter}>
                  <View style={[styles.zoneDot, isActive && styles.zoneDotActive]} />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Fog of war — revealed zones */}
        {revealedZones.map((zone, i) => (
          <Polygon
            key={`zone-${i}`}
            coordinates={[
              { latitude: zone.lat - 0.0005, longitude: zone.lng - 0.0005 },
              { latitude: zone.lat + 0.0005, longitude: zone.lng - 0.0005 },
              { latitude: zone.lat + 0.0005, longitude: zone.lng + 0.0005 },
              { latitude: zone.lat - 0.0005, longitude: zone.lng + 0.0005 },
            ]}
            fillColor="rgba(184,134,11,0.10)"
            strokeColor="rgba(184,134,11,0.25)"
            strokeWidth={0.5}
          />
        ))}

        {/* Ghost trail pins — blurred friend activity */}
        {ghostTrails.map((ghost) => (
          <Marker
            key={`ghost-${ghost.id}`}
            coordinate={{ latitude: ghost.lat, longitude: ghost.lng }}
            onPress={() => {
              const sourceTrace = traces.find(t => t.id === ghost.trace_id);
              if (sourceTrace) openTrace(sourceTrace);
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <TracePin state="ghost" />
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

      {/* DEV: always-visible seed button — remove before production */}
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

      {/* Answer confirmation — must identify place before camera */}
      {activeTrace && (
        <AnswerModal
          visible={showAnswer}
          placeName={activeTrace.place_name ?? ''}
          distanceMeters={Math.round(activeTrace.distance_meters)}
          solveRadiusMeters={effRadius}
          onCorrect={() => { setShowAnswer(false); setShowCamera(true); }}
          onWrong={() => {
            setShowAnswer(false);
            const newLeft = Math.max(0, attemptsLeft - 1);
            setAttemptsLeft(newLeft);
            if (newLeft === 0) setShowExtraAttempts(true);
          }}
          onClose={() => setShowAnswer(false)}
        />
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
          xpMultiplier={solveMultiplier}
          onTaunt={() => setShowTaunt(true)}
          onContinue={handleContinue}
        />
      )}

      {/* Extra attempts purchase */}
      {activeTrace && (
        <ExtraAttemptsModal
          visible={showExtraAttempts}
          traceId={activeTrace.id}
          traceName={activeTrace.place_name ?? 'Unknown trace'}
          onPurchased={() => {
            setShowExtraAttempts(false);
            setAttemptsLeft(3);
          }}
          onClose={() => {
            setShowExtraAttempts(false);
            closeTrace();
          }}
        />
      )}

      {/* Rescue modal — shown when a follower needs help */}
      <RescueModal
        rescue={pendingRescue}
        onClose={() => setPendingRescue(null)}
      />

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

      {/* TraceCard slide-up panel */}
      {activeTrace && (
        <>
          <TouchableWithoutFeedback onPress={closeTrace}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity style={styles.panelHandle} onPress={closeTrace}>
              <View style={styles.handleBar} />
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <TraceCard
                id={activeTrace.id}
                segments={parseClue(activeTrace.clue)}
                difficulty={activeTrace.difficulty as any}
                attemptsLeft={attemptsLeft}
                maxAttempts={activeTrace.max_attempts}
                stage={stage}
                distanceMeters={Math.round(activeTrace.distance_meters)}
                expiresAt={activeTrace.expires_at}
                xpMultiplier={activeTrace.xp_multiplier ?? 1}
                onSubmit={handleSubmit}
              />
              <Text style={styles.solveCount}>
                {activeTrace.solve_count === 0
                  ? 'No one has found this yet.'
                  : `${activeTrace.solve_count} tracer${activeTrace.solve_count === 1 ? '' : 's'} found this.`}
              </Text>
            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  zoneCenter: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  zoneDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(138,138,138,0.5)',
    borderWidth: 1.5, borderColor: 'rgba(138,138,138,0.8)',
  },
  zoneDotActive: {
    backgroundColor: 'rgba(184,134,11,0.7)',
    borderColor: COLORS.amber,
  },
  zoneCenterActive: {},
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: COLORS.navyMid,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  panelHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.navyLight,
  },
  sheetContent: {
    paddingBottom: 48,
  },
  devSeedBtn: {
    position: 'absolute',
    top: 160,
    alignSelf: 'center',
    left: '20%',
    right: '20%',
    backgroundColor: COLORS.amber,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    zIndex: 999,
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
