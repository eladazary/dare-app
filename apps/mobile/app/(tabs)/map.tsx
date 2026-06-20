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
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_H = Dimensions.get('window').height;

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import TraceCard, { parseClue, formatDistance, type TraceStage } from '@/components/TraceCard';
// parseClue now strips markup and returns plain string
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

const DIFF_COLOR: Record<string, string> = {
  easy: COLORS.green, medium: COLORS.amber,
  hard: COLORS.classified, legendary: '#A855F7',
};

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

// ── Scanning reticle map marker ──────────────────────────────────────────────
function ReticleMarker({ color, isActive, xpMultiplier = 1 }: {
  color: string; isActive: boolean; xpMultiplier?: number;
}) {
  const col = isActive ? color : `${color}60`;
  const fill = isActive ? color : 'transparent';
  return (
    <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
      {/* Corner brackets */}
      <View style={{ position: 'absolute', top: 0,  left: 0,  width: 9, height: 9, borderTopWidth: 1.5, borderLeftWidth: 1.5,  borderColor: col }} />
      <View style={{ position: 'absolute', top: 0,  right: 0, width: 9, height: 9, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: col }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0,  width: 9, height: 9, borderBottomWidth: 1.5, borderLeftWidth: 1.5,  borderColor: col }} />
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: col }} />
      {/* Center dot */}
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: fill, borderWidth: 1.5, borderColor: col }} />
      {/* XP badge */}
      {xpMultiplier > 1 && (
        <View style={{ position: 'absolute', top: -2, right: -4, backgroundColor: color, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 }}>
          <Text style={{ fontSize: 7, color: COLORS.navy, fontFamily: FONTS.monoBold }}>{xpMultiplier}×</Text>
        </View>
      )}
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  // undefined = not yet loaded, null = loaded but not found, string = ready
  const [publicUserId, setPublicUserId] = useState<string | null | undefined>(undefined);

  const { location, error: locationError, granted } = useLocation();
  const { data: traces = [], isLoading, refetch } = useNearbyTraces(location, publicUserId);
  const { data: ghostTrails = [] } = useGhostTrails(location);
  const { data: revealedZones = [], refetch: refetchZones } = useRevealedZones(publicUserId ?? null);

  const [activeTrace, setActiveTrace] = useState<NearbyTrace | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [showCamera, setShowCamera] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [solveResult, setSolveResult] = useState<{ selfieUri: string; startedAt: number } | null>(null);
  const [showTaunt, setShowTaunt] = useState(false);
  const [diffFilter, setDiffFilter] = useState<Set<string>>(new Set(['easy','medium','hard','legendary']));
  const [solveMultiplier, setSolveMultiplier] = useState(1);
  const [showExtraAttempts, setShowExtraAttempts] = useState(false);
  const [userLevel, setUserLevel] = useState('wanderer');
  const [seeding, setSeeding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [failReason, setFailReason] = useState<'gps_fail' | 'photo_fail' | null>(null);

  // Load user level + public ID for radius scaling and fog of war
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setPublicUserId(null); return; }
      supabase.from('users').select('id, level').eq('auth_id', user.id).single()
        .then(({ data }) => {
          if (data?.level) setUserLevel(data.level);
          setPublicUserId(data?.id ?? null); // null unblocks the traces fetch even if user row missing
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
    setFailReason(null);

    // ── Step 1: GPS gate (instant, client-side) ──────────────────────────────
    const distNow = getDistance(location.lat, location.lng, activeTrace.lat, activeTrace.lng);
    const effRadius = effectiveSolveRadius(activeTrace.solve_radius_meters, userLevel);

    const burnAttempt = async (reason: 'gps_fail' | 'photo_fail') => {
      const newLeft = Math.max(0, attemptsLeft - 1);
      setAttemptsLeft(newLeft);
      setFailReason(reason);

      // Last attempt used — trigger rescue request
      if (newLeft === 1) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: myUser } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
          if (myUser) {
            await supabase.rpc('request_rescue', { p_trace_id: activeTrace.id, p_rescued_user_id: myUser.id });
          }
        }
      }

      // Exhausted — break streak, show purchase modal
      if (newLeft === 0) {
        if (publicUserId) {
          await supabase.rpc('record_trace_failure', { p_trace_id: activeTrace.id, p_user_id: publicUserId });
        }
        setShowExtraAttempts(true);
      }

      // Clear the fail reason after 3s so the card resets
      setTimeout(() => setFailReason(null), 3000);
    };

    if (distNow > effRadius) {
      await burnAttempt('gps_fail');
      return;
    }

    // ── Step 2: Upload selfie → photo gate (server-side via edge function) ───
    setVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Upload selfie to storage
      const filename = `submissions/${activeTrace.id}_${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', { uri: selfieUri, name: filename, type: 'image/jpeg' } as unknown as Blob);

      const uploadRes = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/trace-photos/${filename}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'false' }, body: formData }
      );

      let selfiePublicUrl = selfieUri; // fallback to local uri if upload fails (GPS-only validation)
      if (uploadRes.ok) {
        selfiePublicUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/trace-photos/${filename}`;
      }

      // Call verify-photo-trace edge function
      const verifyRes = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-photo-trace`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            trace_id: activeTrace.id,
            selfie_url: selfiePublicUrl,
            user_lat: location.lat,
            user_lng: location.lng,
            trace_lat: activeTrace.lat,
            trace_lng: activeTrace.lng,
            solve_radius: effRadius,
          }),
        }
      );

      // Non-200 (e.g. 401 JWT error) → treat as server_error, don't burn attempt
      if (!verifyRes.ok) {
        console.warn('verify-photo-trace HTTP error:', verifyRes.status, '— allowing solve by GPS only');
      } else {
        const verifyJson = await verifyRes.json();

        if (verifyJson.reason === 'server_error') {
          console.warn('Verification server error — allowing solve by GPS only:', verifyJson.detail);
        } else if (!verifyJson.valid) {
          await burnAttempt(verifyJson.reason === 'gps_fail' ? 'gps_fail' : 'photo_fail');
          return;
        }
      }

      // ── Step 3: Record solve ───────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: publicUser } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
        if (publicUser) {
          const attemptsUsed = activeTrace.max_attempts - attemptsLeft + 1;
          const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);

          // XP decay: attempt 1 = full, 2 = 75%, 3 = 50%
          const decayFactor = attemptsUsed === 1 ? 1.0 : attemptsUsed === 2 ? 0.75 : 0.5;
          setSolveMultiplier(prev => Math.max(0.5, Math.round(prev * decayFactor * 10) / 10));

          await supabase.from('trace_solves').upsert({
            trace_id: activeTrace.id,
            user_id: publicUser.id,
            attempts_used: attemptsUsed,
            time_to_solve_seconds: elapsed,
            selfie_url: selfiePublicUrl,
          }, { onConflict: 'trace_id,user_id' });
        }
      }

      Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }).start();
      setSolveResult({ selfieUri: selfiePublicUrl, startedAt: startedAtRef.current });
      refetchZones();
    } finally {
      setVerifying(false);
    }
  }, [activeTrace, location, attemptsLeft, userLevel, publicUserId, slideAnim, refetchZones]);

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
        {/* Trace zones — render all but hide filtered ones to avoid native unmount bugs */}
        {traces.filter(t => !t.already_solved).map((trace) => {
          const visible = diffFilter.has(trace.difficulty);
          const isActive = trace.distance_meters <= trace.notify_radius_meters;
          const col = DIFF_COLOR[trace.difficulty] ?? COLORS.amber;
          // Stable offset derived from trace ID so reticle doesn't sit on the exact answer spot
          const visualRadius = { easy: 80, medium: 120, hard: 160, legendary: 200 }[trace.difficulty] ?? 100;
          // The circle shows the search zone; the reticle is somewhere inside it
          const seed = trace.id.charCodeAt(0) + trace.id.charCodeAt(4);
          const angle = (seed * 137.5) % 360; // golden angle spread
          const offsetFrac = 0.3 + (seed % 30) / 100; // 30–60% of radius
          const offsetLat = Math.cos(angle * Math.PI / 180) * offsetFrac * visualRadius / 111320;
          const offsetLng = Math.sin(angle * Math.PI / 180) * offsetFrac * visualRadius / (111320 * Math.cos(trace.lat * Math.PI / 180));

          if (!visible) return null;
          return (
            <Marker
              key={trace.id}
              coordinate={{ latitude: trace.lat + offsetLat, longitude: trace.lng + offsetLng }}
              onPress={() => openTrace(trace)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <ReticleMarker
                color={col}
                isActive={isActive}
                xpMultiplier={trace.xp_multiplier ?? 1}
              />
            </Marker>
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
          {/* Left — trace count */}
          <TouchableOpacity
            style={styles.hudLeft}
            onLongPress={() => router.push('/admin/create-trace')}
            delayLongPress={800}
          >
            <Text style={styles.hudLabel}>TRACES NEARBY</Text>
            <Text style={styles.hudCount}>
              {isLoading ? '—' : traces.filter((t) => !t.already_solved && diffFilter.has(t.difficulty)).length}
            </Text>
          </TouchableOpacity>

          {/* Right — recenter + filters stacked */}
          <View style={styles.rightCol}>
            <TouchableOpacity
              style={styles.recenterBtn}
              onPress={() =>
                mapRef.current?.animateToRegion({
                  latitude: location.lat, longitude: location.lng,
                  latitudeDelta: 0.008, longitudeDelta: 0.008,
                }, 400)
              }
            >
              <Text style={styles.recenterIcon}>◎</Text>
            </TouchableOpacity>

            {/* Filters stacked vertically below the circle button */}
            <View style={styles.filterCol}>
              {(['easy','medium','hard','legendary'] as const).map(d => {
                const col = DIFF_COLOR[d];
                const active = diffFilter.has(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.filterChip, { borderColor: col }, active && { backgroundColor: col }]}
                    onPress={() => {
                      setDiffFilter(prev => {
                        const next = new Set(prev);
                        if (next.has(d) && next.size > 1) next.delete(d);
                        else next.add(d);
                        return next;
                      });
                    }}
                  >
                    <Text style={[styles.filterChipText, { color: active ? COLORS.navy : col }]}>
                      {d === 'legendary' ? 'LEG' : d.slice(0,3).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
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
          referencePhotoUrl={activeTrace.reference_photo_url}
          distanceMeters={activeTrace.distance_meters}
          solveRadius={effRadius}
          onCapture={handleCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {/* Solve success reveal */}
      {solveResult && activeTrace && (
        <SolveReveal
          placeName={activeTrace.place_name ?? 'Unknown place'}
          difficulty={activeTrace.difficulty}
          referencePhotoUrl={activeTrace.reference_photo_url ?? null}
          selfieUri={solveResult.selfieUri}
          timeSeconds={Math.round((Date.now() - solveResult.startedAt) / 1000)}
          caption={activeTrace.photo_caption ?? activeTrace.clue ?? null}
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

            {/* Failure toast */}
            {failReason && (
              <View style={[styles.failToast, failReason === 'photo_fail' && styles.failToastPhoto]}>
                <Text style={styles.failToastText}>
                  {failReason === 'gps_fail'
                    ? '📍 Too far — keep searching'
                    : '✗ Wrong spot — photo doesn\'t match'}
                </Text>
              </View>
            )}

            {/* Verifying overlay */}
            {verifying && (
              <View style={styles.verifyingOverlay}>
                <ActivityIndicator color={COLORS.amber} size="large" />
                <Text style={styles.verifyingText}>Verifying your spot...</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <TraceCard
                id={activeTrace.id}
                referencePhotoUrl={activeTrace.reference_photo_url}
                clue={parseClue(activeTrace.clue)}
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
  rightCol: {
    alignItems: 'center', gap: 8,
  },
  filterCol: {
    alignItems: 'center', gap: 5,
  },
  filterChip: {
    width: 44, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1.5,
    backgroundColor: 'rgba(10,10,10,0.88)',
    alignItems: 'center', justifyContent: 'center',
  },
  filterChipText: { fontFamily: FONTS.monoBold, fontSize: 8, letterSpacing: 0.5 },
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
    alignItems: 'flex-start',
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
  failToast: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(255,45,85,0.15)',
    borderWidth: 1, borderColor: COLORS.red,
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center',
  },
  failToastPhoto: {
    backgroundColor: 'rgba(123,94,167,0.15)',
    borderColor: COLORS.classified,
  },
  failToastText: {
    fontFamily: FONTS.monoBold, fontSize: 11,
    color: COLORS.ghost, letterSpacing: 0.5,
  },
  verifyingOverlay: {
    position: 'absolute', top: 48, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,10,10,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    zIndex: 10, borderRadius: 16,
  },
  verifyingText: {
    fontFamily: FONTS.mono, fontSize: 12,
    color: COLORS.amber, letterSpacing: 1.5,
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
