import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, {
  useSharedValue,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';

import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';
import { useChallengeStore } from '@/stores/challengeStore';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LegState = 'traveling' | 'capturing' | 'verifying' | 'leg_complete';
type SubmitState = 'idle' | 'active' | 'all_complete' | 'ceremony';

interface LegPhoto {
  uri: string;
  lat: number;
  lng: number;
  takenAt: Date;
}

interface LegConfig {
  title: string;
  clue: string;
  hint: string;
  center_hint: string;
  radius_m: number;
  points: number;
  vision_checks?: Array<{ type: string; target: string; confidence: number }>;
}

interface MultiLegTier {
  legs: LegConfig[];
  total_time_mins: number;
  total_points: number;
  completion_bonus: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LegProgressIndicator({
  total,
  currentIndex,
  completedCount,
}: {
  total: number;
  currentIndex: number;
  completedCount: number;
}) {
  return (
    <View style={styles.legProgressRow}>
      {Array.from({ length: total }).map((_, i) => {
        const isCompleted = i < completedCount;
        const isCurrent = i === currentIndex;
        return (
          <View
            key={i}
            style={[
              styles.legCircle,
              isCompleted && styles.legCircleCompleted,
              isCurrent && !isCompleted && styles.legCircleCurrent,
            ]}
          >
            {isCompleted && <Text style={styles.legCircleCheck}>✓</Text>}
            {isCurrent && !isCompleted && (
              <View style={styles.legCircleDot} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function GpsBar({ locked, distanceM }: { locked: boolean; distanceM: number }) {
  return (
    <View style={styles.gpsBar}>
      <View style={[styles.gpsDot, { backgroundColor: locked ? COLORS.green : COLORS.red }]} />
      <Text style={[styles.gpsText, { color: locked ? COLORS.green : COLORS.red }]}>
        {locked
          ? `Position confirmed · Within ${distanceM}m of dare zone`
          : `Move closer to the dare zone · ${distanceM}m away`}
      </Text>
    </View>
  );
}

function VerifyingOverlay({ legNumber }: { legNumber: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.verifyingOverlay}>
      <Text style={styles.verifyingEmoji}>🔍</Text>
      <Text style={styles.verifyingText}>Analysing your proof...</Text>
      <View style={styles.verifyingBarOuter}>
        <Animated.View style={[styles.verifyingBarFill, { width: fillWidth }]} />
      </View>
    </View>
  );
}

// Clue reveal animation wrapper
function ClueReveal({ children, animate }: { children: React.ReactNode; animate: boolean }) {
  const opacity = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (animate) {
      opacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    }
  }, [animate]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Reanimated.View style={style}>{children}</Reanimated.View>;
}

// ---------------------------------------------------------------------------
// Ceremony (multi-leg version)
// ---------------------------------------------------------------------------

interface CeremonyProps {
  legPhotos: LegPhoto[];
  legPoints: number[];
  completionBonus: number;
  aiVerdict: string | null;
  onContinue: () => void;
}

function Ceremony({ legPhotos, legPoints, completionBonus, aiVerdict, onContinue }: CeremonyProps) {
  const overlayOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const stripOpacity = useSharedValue(0);
  const stripTranslateY = useSharedValue(20);
  const pointsOpacity = useSharedValue(0);
  const pointsTranslateY = useSharedValue(40);
  const verdictOpacity = useSharedValue(0);
  const rankOpacity = useSharedValue(0);
  const continueOpacity = useSharedValue(0);

  const totalPoints = legPoints.reduce((s, p) => s + p, 0) + completionBonus;

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 300 });
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    stripOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    stripTranslateY.value = withDelay(900, withSpring(0, { damping: 15 }));
    pointsOpacity.value = withDelay(1400, withTiming(1, { duration: 400 }));
    pointsTranslateY.value = withDelay(1400, withSpring(0, { damping: 15 }));
    verdictOpacity.value = withDelay(2000, withTiming(1, { duration: 400 }));
    rankOpacity.value = withDelay(2600, withTiming(1, { duration: 400 }));
    continueOpacity.value = withDelay(3200, withTiming(1, { duration: 400 }));
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const stripStyle = useAnimatedStyle(() => ({
    opacity: stripOpacity.value,
    transform: [{ translateY: stripTranslateY.value }],
  }));
  const pointsStyle = useAnimatedStyle(() => ({
    opacity: pointsOpacity.value,
    transform: [{ translateY: pointsTranslateY.value }],
  }));
  const verdictStyle = useAnimatedStyle(() => ({ opacity: verdictOpacity.value }));
  const rankStyle = useAnimatedStyle(() => ({ opacity: rankOpacity.value }));
  const continueStyle = useAnimatedStyle(() => ({ opacity: continueOpacity.value }));

  const ROTATIONS = ['-3deg', '1.5deg', '-1deg', '2deg'];

  return (
    <Reanimated.View style={[styles.ceremonyOverlay, overlayStyle]}>
      <ScrollView
        contentContainerStyle={styles.ceremonyScroll}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.Text style={[styles.missionCompleteText, titleStyle]}>
          MISSION COMPLETE ✓
        </Reanimated.Text>

        {/* Photo strip */}
        <Reanimated.View style={[styles.photoStrip, stripStyle]}>
          {legPhotos.map((photo, i) => (
            <View
              key={i}
              style={[
                styles.stripPhoto,
                { transform: [{ rotate: ROTATIONS[i % ROTATIONS.length] }] },
              ]}
            >
              <Image source={{ uri: photo.uri }} style={styles.stripPhotoImage} />
              <Text style={styles.stripPhotoLabel}>LEG {i + 1}</Text>
            </View>
          ))}
        </Reanimated.View>

        {/* Points breakdown */}
        <Reanimated.View style={[styles.pointsCard, pointsStyle]}>
          {legPoints.map((pts, i) => (
            <View style={styles.pointsRow} key={i}>
              <Text style={styles.pointsLine}>Leg {i + 1}</Text>
              <Text style={styles.pointsValue}>+{pts} XP</Text>
            </View>
          ))}
          {completionBonus > 0 && (
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLine}>Completion bonus</Text>
              <Text style={styles.pointsValue}>+{completionBonus} XP</Text>
            </View>
          )}
          <View style={styles.pointsSeparator} />
          <View style={styles.pointsRow}>
            <Text style={styles.pointsTotalLabel}>TOTAL XP EARNED</Text>
            <Text style={styles.pointsTotal}>+{totalPoints} XP</Text>
          </View>
        </Reanimated.View>

        {/* AI Verdict */}
        {aiVerdict && (
          <Reanimated.View style={[styles.verdictCard, verdictStyle]}>
            <Text style={styles.verdictLabel}>FIELD ANALYSIS</Text>
            <Text style={styles.verdictText}>{aiVerdict}</Text>
          </Reanimated.View>
        )}

        <Reanimated.Text style={[styles.rankText, rankStyle]}>
          Updating your city rank...
        </Reanimated.Text>

        <Reanimated.View style={continueStyle}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueText}>Mission debrief →</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </ScrollView>
    </Reanimated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SubmitScreen() {
  const { todayChallenge, selectedDifficulty, getActiveTier } = useChallengeStore();

  // Multi-leg flow state
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [legState, setLegState] = useState<LegState>('traveling');
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [completedLegs, setCompletedLegs] = useState<LegPhoto[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [currentLegVerified, setCurrentLegVerified] = useState(false);

  // Per-leg photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<LegPhoto | null>(null);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState({ locked: false, distanceM: 999 });

  // Hint expansion
  const [hintExpanded, setHintExpanded] = useState(false);

  // Whether the current leg's clue should animate in (it was just unlocked)
  const [animateClue, setAnimateClue] = useState(false);

  // Ceremony data
  const [legPointsEarned, setLegPointsEarned] = useState<number[]>([]);
  const [lastAiVerdict, setLastAiVerdict] = useState<string | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const legCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive active tier — treat it as a MultiLegTier; fall back gracefully
  const rawTier = getActiveTier();
  const activeTier: MultiLegTier | null = rawTier
    ? ((rawTier as unknown) as MultiLegTier)
    : null;

  const totalLegs = activeTier?.legs?.length ?? 1;
  const currentLeg: LegConfig | null = activeTier?.legs?.[currentLegIndex] ?? null;

  // GPS watcher
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (_loc) => {
          // In production: compute real distance to current leg center.
          // Using a mock delta for now.
          const dist = Math.floor(Math.random() * 60 + 20);
          setGpsStatus({ locked: dist <= 400, distanceM: dist });
        }
      );
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (legCompleteTimerRef.current) clearTimeout(legCompleteTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Photo capture
  // -------------------------------------------------------------------------

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const photo: LegPhoto = {
      uri: compressed.uri,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      takenAt: new Date(),
    };

    setPhotoUri(compressed.uri);
    setCurrentPhoto(photo);
    setLegState('capturing');
    setRejectionMessage(null);
  }

  // -------------------------------------------------------------------------
  // Leg submission
  // -------------------------------------------------------------------------

  async function handleSubmitLeg(legIndex: number, photo: LegPhoto) {
    if (!todayChallenge || !activeTier) return;
    setLegState('verifying');

    try {
      let sid = submissionId;

      // Step 1: Create the top-level submission on first leg
      if (legIndex === 0) {
        const { data: newSub, error: insertErr } = await supabase
          .from('submissions')
          .insert({
            challenge_id: todayChallenge.id,
            difficulty: selectedDifficulty,
            status: 'pending',
            total_legs: totalLegs,
            legs_completed: 0,
            total_points: 0,
            photo_url: null,
            photo_thumb_url: null,
          })
          .select()
          .single();

        if (insertErr || !newSub) throw insertErr ?? new Error('Submission insert failed');
        sid = newSub.id;
        setSubmissionId(sid);
      }

      if (!sid) throw new Error('No submission ID');

      // Step 2: Get presigned upload URL
      const { data: uploadData, error: urlErr } = await supabase.functions.invoke(
        'get-upload-url',
        { body: { submissionId: sid, legOrder: legIndex + 1, contentType: 'image/jpeg' } }
      );
      if (urlErr || !uploadData?.url) throw urlErr ?? new Error('No upload URL');

      // Step 3: Upload photo to R2
      const blob = await fetch(photo.uri).then((r) => r.blob());
      const uploadRes = await fetch(uploadData.url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      });
      if (!uploadRes.ok) throw new Error('Photo upload failed');
      const photoUrl: string = uploadData.photo_url ?? uploadData.url.split('?')[0];

      // Step 4: Insert submission_leg row (this triggers the Lambda webhook)
      const { data: legRow, error: legErr } = await supabase
        .from('submission_legs')
        .insert({
          submission_id: sid,
          leg_order: legIndex + 1,
          photo_url: photoUrl,
          photo_taken_at: photo.takenAt.toISOString(),
          lat: photo.lat,
          lng: photo.lng,
          verification_status: 'pending',
          attempt: 1,
        })
        .select()
        .single();

      if (legErr || !legRow) throw legErr ?? new Error('Leg insert failed');

      // Step 5: Update submission.photo_url for leg 1
      if (legIndex === 0) {
        await supabase
          .from('submissions')
          .update({ photo_url: photoUrl, photo_thumb_url: photoUrl })
          .eq('id', sid);
      }

      // Step 6: Poll for verification result
      let pollCount = 0;
      const MAX_POLLS = 15; // 30s at 2s intervals

      pollRef.current = setInterval(async () => {
        pollCount++;
        const { data: updatedLeg } = await supabase
          .from('submission_legs')
          .select('verification_status, points_earned, ai_verdict')
          .eq('id', legRow.id)
          .single();

        if (!updatedLeg) return;

        if (updatedLeg.verification_status === 'approved') {
          if (pollRef.current) clearInterval(pollRef.current);
          setLegPointsEarned((prev) => {
            const next = [...prev];
            next[legIndex] = updatedLeg.points_earned ?? currentLeg?.points ?? 0;
            return next;
          });
          setLastAiVerdict(updatedLeg.ai_verdict ?? null);
          setCurrentLegVerified(true);
          setCompletedLegs((prev) => {
            const next = [...prev];
            next[legIndex] = photo;
            return next;
          });
          setLegState('leg_complete');
        } else if (updatedLeg.verification_status === 'rejected') {
          if (pollRef.current) clearInterval(pollRef.current);
          setRejectionMessage(
            updatedLeg.ai_verdict ?? 'Photo not accepted. Please retake.'
          );
          setLegState('capturing'); // allow retake
        } else if (pollCount >= MAX_POLLS) {
          if (pollRef.current) clearInterval(pollRef.current);
          // Timeout: treat as approved optimistically or show error
          setLegState('capturing');
          setRejectionMessage('Verification timed out. Please try again.');
        }
      }, 2000);
    } catch {
      setLegState('capturing');
      setRejectionMessage('Something went wrong. Please try again.');
    }
  }

  // -------------------------------------------------------------------------
  // Leg complete → advance
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (legState !== 'leg_complete') return;

    legCompleteTimerRef.current = setTimeout(() => {
      const nextIndex = currentLegIndex + 1;
      if (nextIndex >= totalLegs) {
        // All legs done
        setSubmitState('all_complete');
      } else {
        // Advance to next leg
        setCurrentLegIndex(nextIndex);
        setPhotoUri(null);
        setCurrentPhoto(null);
        setCurrentLegVerified(false);
        setHintExpanded(false);
        setAnimateClue(true);
        setLegState('traveling');
      }
    }, 1500);

    return () => {
      if (legCompleteTimerRef.current) clearTimeout(legCompleteTimerRef.current);
    };
  }, [legState, currentLegIndex, totalLegs]);

  // Transition to ceremony
  useEffect(() => {
    if (submitState === 'all_complete') {
      setSubmitState('ceremony');
    }
  }, [submitState]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderIdleState() {
    const narrativeArc =
      (todayChallenge as any)?.narrative_arc ??
      'An adventure awaits. Follow the clues, capture the moments.';

    return (
      <ScrollView contentContainerStyle={styles.idleContainer}>
        <View style={styles.narrativeCard}>
          <Text style={styles.narrativeText}>{narrativeArc}</Text>
        </View>
        <TouchableOpacity
          style={styles.beginButton}
          activeOpacity={0.85}
          onPress={() => {
            setSubmitState('active');
            setLegState('traveling');
            setAnimateClue(false);
          }}
        >
          <Text style={styles.beginButtonText}>ACCEPT THE DARE →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderTraveling() {
    if (!currentLeg) return null;
    const isFirstLeg = currentLegIndex === 0;

    return (
      <ScrollView
        contentContainerStyle={styles.activeContainer}
        showsVerticalScrollIndicator={false}
      >
        <LegProgressIndicator
          total={totalLegs}
          currentIndex={currentLegIndex}
          completedCount={completedLegs.filter(Boolean).length}
        />

        {/* Big leg card */}
        <View style={styles.legCard}>
          <Text style={styles.legNumberLabel}>
            LEG {currentLegIndex + 1} OF {totalLegs}
          </Text>
          <Text style={styles.legTitle}>{currentLeg.title}</Text>

          {/* Clue */}
          <ClueReveal animate={!isFirstLeg && animateClue}>
            <Text style={styles.clueText}>{currentLeg.clue}</Text>
          </ClueReveal>

          {/* Center hint */}
          <Text style={styles.centerHint}>📍 {currentLeg.center_hint}</Text>

          {/* Hint box */}
          <TouchableOpacity
            onPress={() => setHintExpanded((v) => !v)}
            style={styles.hintToggle}
            activeOpacity={0.7}
          >
            <Text style={styles.hintToggleText}>
              {hintExpanded ? 'Hide hint ▲' : 'Need a hint? ▼'}
            </Text>
          </TouchableOpacity>
          {hintExpanded && (
            <View style={styles.hintBox}>
              <Text style={styles.hintLabel}>HINT</Text>
              <Text style={styles.hintText}>{currentLeg.hint}</Text>
            </View>
          )}
        </View>

        <GpsBar locked={gpsStatus.locked} distanceM={gpsStatus.distanceM} />

        <TouchableOpacity
          style={[styles.photoButton, !gpsStatus.locked && styles.photoButtonDisabled]}
          disabled={!gpsStatus.locked}
          onPress={handleTakePhoto}
          activeOpacity={0.85}
        >
          <Text style={styles.photoButtonText}>Tap to take photo →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderCapturing() {
    return (
      <ScrollView
        contentContainerStyle={styles.activeContainer}
        showsVerticalScrollIndicator={false}
      >
        <LegProgressIndicator
          total={totalLegs}
          currentIndex={currentLegIndex}
          completedCount={completedLegs.filter(Boolean).length}
        />

        {photoUri && (
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
          </View>
        )}

        {rejectionMessage && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionText}>{rejectionMessage}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.photoButton}
          onPress={() => {
            if (!currentPhoto) return;
            handleSubmitLeg(currentLegIndex, currentPhoto);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.photoButtonText}>Use this photo →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.retakeButton}
          onPress={handleTakePhoto}
          activeOpacity={0.7}
        >
          <Text style={styles.retakeText}>Retake ↺</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderVerifying() {
    return (
      <View style={styles.verifyingContainer}>
        <LegProgressIndicator
          total={totalLegs}
          currentIndex={currentLegIndex}
          completedCount={completedLegs.filter(Boolean).length}
        />
        <View style={styles.photoPreviewContainer}>
          {photoUri && (
            <Image
              source={{ uri: photoUri }}
              style={[styles.photoPreview, styles.photoPreviewDimmed]}
              resizeMode="cover"
            />
          )}
          <VerifyingOverlay legNumber={currentLegIndex + 1} />
        </View>
      </View>
    );
  }

  function renderLegComplete() {
    const pts = legPointsEarned[currentLegIndex] ?? currentLeg?.points ?? 0;
    return (
      <View style={styles.legCompleteContainer}>
        <LegProgressIndicator
          total={totalLegs}
          currentIndex={currentLegIndex}
          completedCount={completedLegs.filter(Boolean).length}
        />
        <View style={styles.photoPreviewContainer}>
          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
          )}
          <View style={styles.legCompleteBanner}>
            <Text style={styles.legCompleteBannerText}>
              ✓ Leg {currentLegIndex + 1} complete
            </Text>
          </View>
        </View>
        <Text style={styles.legPointsText}>+{pts} XP</Text>
        {currentLegIndex + 1 < totalLegs && (
          <Text style={styles.nextLegHint}>
            Revealing next leg clue...
          </Text>
        )}
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Top-level render
  // -------------------------------------------------------------------------

  if (submitState === 'ceremony') {
    return (
      <Ceremony
        legPhotos={completedLegs.filter(Boolean)}
        legPoints={legPointsEarned}
        completionBonus={activeTier?.completion_bonus ?? 0}
        aiVerdict={lastAiVerdict}
        onContinue={() => {
          // Reset everything
          setSubmitState('idle');
          setLegState('traveling');
          setCurrentLegIndex(0);
          setCompletedLegs([]);
          setSubmissionId(null);
          setPhotoUri(null);
          setCurrentPhoto(null);
          setLegPointsEarned([]);
          setLastAiVerdict(null);
          setCurrentLegVerified(false);
          setRejectionMessage(null);
          setAnimateClue(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {submitState === 'idle' && renderIdleState()}

      {submitState === 'active' && (
        <>
          {legState === 'traveling' && renderTraveling()}
          {legState === 'capturing' && renderCapturing()}
          {legState === 'verifying' && renderVerifying()}
          {legState === 'leg_complete' && renderLegComplete()}
        </>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  // Idle
  idleContainer: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 24,
  },
  narrativeCard: {
    backgroundColor: COLORS.navyMid,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amber,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 4,
    marginBottom: 28,
  },
  narrativeText: {
    fontFamily: FONTS.challengeItalic,
    fontSize: 15,
    color: COLORS.ghost,
    lineHeight: 24,
  },
  beginButton: {
    backgroundColor: COLORS.amber,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  beginButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },

  // Leg progress
  legProgressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  legCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.concrete,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legCircleCompleted: {
    backgroundColor: COLORS.amber,
    borderColor: COLORS.amber,
  },
  legCircleCurrent: {
    borderColor: COLORS.amber,
  },
  legCircleCheck: {
    color: COLORS.navy,
    fontSize: 14,
    fontFamily: FONTS.uiBold,
  },
  legCircleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.amber,
  },

  // Active
  activeContainer: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Leg card
  legCard: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 24,
    marginBottom: 16,
  },
  legNumberLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 11,
    color: COLORS.concrete,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  legTitle: {
    fontFamily: FONTS.uiBold,
    fontSize: 18,
    color: COLORS.ghost,
    marginTop: 4,
    marginBottom: 12,
  },
  clueText: {
    fontFamily: FONTS.challengeItalic,
    fontSize: 15,
    color: COLORS.ghost,
    lineHeight: 24,
    marginBottom: 12,
  },
  centerHint: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.amber,
    marginBottom: 12,
  },
  hintToggle: {
    marginBottom: 4,
  },
  hintToggleText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
  },
  hintBox: {
    backgroundColor: COLORS.navyLight,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amber,
    padding: 12,
    borderRadius: 4,
    marginTop: 8,
  },
  hintLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.amber,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hintText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.ghost,
    lineHeight: 20,
  },

  // GPS
  gpsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gpsText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    flex: 1,
  },

  // Photo button
  photoButton: {
    backgroundColor: COLORS.amber,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  photoButtonDisabled: {
    opacity: 0.4,
  },
  photoButtonText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },

  // Capturing
  photoPreviewContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 260,
    borderRadius: 12,
  },
  photoPreviewDimmed: {
    opacity: 0.6,
  },
  retakeButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  retakeText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: COLORS.concrete,
  },
  rejectionBox: {
    backgroundColor: COLORS.navyLight,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  rejectionText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.red,
    lineHeight: 20,
  },

  // Verifying
  verifyingContainer: {
    flex: 1,
    paddingTop: 20,
  },
  verifyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  verifyingEmoji: {
    fontSize: 36,
  },
  verifyingText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: COLORS.concrete,
  },
  verifyingBarOuter: {
    width: '100%',
    height: 3,
    backgroundColor: COLORS.navyMid,
    borderRadius: 2,
    overflow: 'hidden',
  },
  verifyingBarFill: {
    height: 3,
    backgroundColor: COLORS.amber,
    borderRadius: 2,
  },

  // Leg complete
  legCompleteContainer: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 40,
  },
  legCompleteBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.green + 'CC',
    padding: 12,
    alignItems: 'center',
  },
  legCompleteBannerText: {
    fontFamily: FONTS.uiBold,
    fontSize: 16,
    color: COLORS.navy,
  },
  legPointsText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 20,
    color: COLORS.amber,
    textAlign: 'center',
    marginTop: 16,
  },
  nextLegHint: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    color: COLORS.concrete,
    textAlign: 'center',
    marginTop: 8,
  },

  // Ceremony
  ceremonyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.navy,
  },
  ceremonyScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 20,
  },
  missionCompleteText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 24,
    color: COLORS.ghost,
    letterSpacing: 2,
    textAlign: 'center',
  },
  photoStrip: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  stripPhoto: {
    backgroundColor: COLORS.navyMid,
    padding: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  stripPhotoImage: {
    width: 60,
    height: 60,
    borderRadius: 2,
  },
  stripPhotoLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 9,
    color: COLORS.concrete,
    letterSpacing: 1,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  pointsCard: {
    backgroundColor: COLORS.navyMid,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 8,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pointsLine: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: COLORS.concrete,
  },
  pointsValue: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.ghost,
  },
  pointsSeparator: {
    height: 1,
    backgroundColor: COLORS.navyLight,
    marginVertical: 4,
  },
  pointsTotalLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 14,
    color: COLORS.ghost,
    letterSpacing: 1,
  },
  pointsTotal: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 28,
    color: COLORS.amber,
  },
  verdictCard: {
    backgroundColor: COLORS.navyLight,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.purple,
    borderRadius: 4,
    padding: 12,
    width: '100%',
  },
  verdictLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.purple,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  verdictText: {
    fontFamily: FONTS.challengeItalic,
    fontSize: 15,
    color: COLORS.ghost,
    lineHeight: 24,
  },
  rankText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    color: COLORS.ghost,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: COLORS.amber,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  continueText: {
    fontFamily: FONTS.uiExtraBold,
    fontSize: 15,
    color: COLORS.navy,
  },
});
