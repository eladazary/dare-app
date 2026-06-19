import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

type Step = 'camera' | 'confirm' | 'uploading' | 'done';
type Difficulty = 'easy' | 'medium' | 'hard' | 'legendary';

const DIFF_CONFIG: Record<Difficulty, { label: string; color: string; solve: number; notify: number }> = {
  easy:      { label: 'EASY',      color: COLORS.green,     solve: 30,  notify: 100  },
  medium:    { label: 'MEDIUM',    color: COLORS.amber,     solve: 50,  notify: 300  },
  hard:      { label: 'HARD',      color: COLORS.classified, solve: 100, notify: 600  },
  legendary: { label: 'LEGENDARY', color: COLORS.purple,    solve: 200, notify: 1000 },
};

export default function CreateTrace() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep]         = useState<Step>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [gps, setGps]           = useState<{ lat: number; lng: number } | null>(null);
  const [difficulty, setDiff]   = useState<Difficulty>('medium');
  const [caption, setCaption]   = useState('');
  const [capturing, setCapturing] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          .then(pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
      }
    });
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      // Get fresh GPS right at capture moment
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setStep('confirm');
      }
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setCapturing(false);
    }
  };

  const handleUpload = async () => {
    if (!photoUri || !gps) return;
    setStep('uploading');

    try {
      // 1. Upload photo to Supabase Storage
      setUploadMsg('Uploading photo...');
      const filename = `trace_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

      const formData = new FormData();
      formData.append('file', { uri: photoUri, name: filename, type: 'image/jpeg' } as any);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const uploadRes = await fetch(
        `https://plecaiybtebebbhoabkw.supabase.co/storage/v1/object/trace-photos/${filename}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-upsert': 'false',
          },
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`Upload failed: ${err}`);
      }

      const photoUrl = `https://plecaiybtebebbhoabkw.supabase.co/storage/v1/object/public/trace-photos/${filename}`;

      // 2. Create trace in DB
      setUploadMsg('Creating trace...');
      const diff = DIFF_CONFIG[difficulty];

      const { error } = await supabase.rpc('seed_single_trace', {
        p_arena_id: null,
        p_lat: gps.lat,
        p_lng: gps.lng,
        p_place_name: `Trace @ ${gps.lat.toFixed(5)},${gps.lng.toFixed(5)}`,
        p_clue: caption || '',
        p_hint: caption || '',
        p_difficulty: difficulty,
        p_solve_radius: diff.solve,
        p_notify_radius: diff.notify,
      });

      if (error) throw error;

      // 3. Update with photo URL
      const { error: photoError } = await supabase
        .from('traces')
        .update({
          reference_photo_url: photoUrl,
          photo_caption: caption || null,
        })
        .eq('solve_radius_meters', diff.solve)
        .is('reference_photo_url', null)
        .order('created_at', { ascending: false })
        .limit(1);

      // Use a more targeted update
      await supabase.rpc('update_latest_trace_photo', {
        p_photo_url: photoUrl,
        p_caption: caption || null,
        p_lat: gps.lat,
        p_lng: gps.lng,
      });

      setStep('done');
    } catch (e) {
      Alert.alert('Error', String(e));
      setStep('confirm');
    }
  };

  if (!permission) return <View style={styles.root} />;
  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <Text style={styles.permText}>Camera access needed.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera ──
  if (step === 'camera') {
    return (
      <View style={styles.root}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        <SafeAreaView style={styles.topBar} edges={['top']}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.topBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>CREATE TRACE</Text>
          <View style={[styles.gpsBadge, gps && styles.gpsBadgeReady]}>
            <Text style={styles.gpsText}>{gps ? '📍 GPS locked' : '⏳ Getting GPS...'}</Text>
          </View>
        </SafeAreaView>

        <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
          <Text style={styles.hint}>
            Find something interesting.{'\n'}Frame it carefully — this IS the trace.
          </Text>
          <TouchableOpacity
            style={[styles.shutter, capturing && { opacity: 0.6 }]}
            onPress={handleCapture}
            disabled={capturing || !gps}
          >
            {capturing
              ? <ActivityIndicator color={COLORS.navy} size="large" />
              : <View style={styles.shutterInner} />}
          </TouchableOpacity>
          {!gps && <Text style={styles.gpsWait}>Waiting for GPS before you can shoot</Text>}
        </SafeAreaView>
      </View>
    );
  }

  // ── Confirm ──
  if (step === 'confirm') {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.confirmScroll}>
          <Text style={styles.confirmTitle}>Review your trace</Text>

          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
          )}

          {gps && (
            <Text style={styles.gpsConfirm}>
              📍 {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
            </Text>
          )}

          {/* Difficulty */}
          <Text style={styles.sectionLabel}>DIFFICULTY</Text>
          <View style={styles.diffRow}>
            {(Object.keys(DIFF_CONFIG) as Difficulty[]).map(d => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.diffBtn,
                  { borderColor: DIFF_CONFIG[d].color },
                  difficulty === d && { backgroundColor: DIFF_CONFIG[d].color },
                ]}
                onPress={() => setDiff(d)}
              >
                <Text style={[
                  styles.diffBtnText,
                  { color: difficulty === d ? COLORS.navy : DIFF_CONFIG[d].color },
                ]}>
                  {DIFF_CONFIG[d].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.diffHint}>
            {difficulty === 'easy'   && 'Solve radius: 30m — obvious landmark, wide area'}
            {difficulty === 'medium' && 'Solve radius: 50m — takes some searching'}
            {difficulty === 'hard'   && 'Solve radius: 100m — specific detail, hard to spot'}
            {difficulty === 'legendary' && 'Solve radius: 200m — nearly impossible, rare'}
          </Text>

          {/* Caption */}
          <Text style={styles.sectionLabel}>THE STORY (shown after solving)</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="What's special about this spot? A fact, a story, a secret..."
            placeholderTextColor={COLORS.concrete}
            value={caption}
            onChangeText={setCaption}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setStep('camera')}>
              <Text style={styles.retakeBtnText}>← Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
              <Text style={styles.uploadBtnText}>Create Trace ✓</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Uploading ──
  if (step === 'uploading') {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={COLORS.amber} size="large" />
        <Text style={styles.uploadMsg}>{uploadMsg}</Text>
      </View>
    );
  }

  // ── Done ──
  return (
    <View style={[styles.root, styles.centered]}>
      <Text style={styles.doneIcon}>✓</Text>
      <Text style={styles.doneTitle}>Trace created!</Text>
      <Text style={styles.doneSub}>Others will find this spot.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => setStep('camera')}>
        <Text style={styles.btnText}>Create another →</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.doneBack}>Back to map</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBtn: { color: COLORS.ghost, fontFamily: FONTS.monoBold, fontSize: 18, padding: 4 },
  topTitle: { color: COLORS.amber, fontFamily: FONTS.monoBold, fontSize: 12, letterSpacing: 3 },
  gpsBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.concrete,
  },
  gpsBadgeReady: { borderColor: COLORS.green },
  gpsText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.ghost },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingBottom: 32, gap: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingTop: 16,
  },
  hint: {
    fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete,
    textAlign: 'center', letterSpacing: 0.5, lineHeight: 18,
  },
  shutter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.ghost, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)',
  },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.ghost },
  gpsWait: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.classified, letterSpacing: 0.5 },
  permText: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.ghost, textAlign: 'center', marginTop: 200 },
  confirmScroll: { padding: 20, paddingBottom: 48, gap: 14 },
  confirmTitle: { fontFamily: FONTS.uiExtraBold, fontSize: 22, color: COLORS.ghost, marginBottom: 4 },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: COLORS.navyMid },
  gpsConfirm: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete },
  sectionLabel: {
    fontFamily: FONTS.monoBold, fontSize: 9, color: COLORS.concrete,
    letterSpacing: 3, marginTop: 8,
  },
  diffRow: { flexDirection: 'row', gap: 8 },
  diffBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center',
  },
  diffBtnText: { fontFamily: FONTS.monoBold, fontSize: 9, letterSpacing: 1 },
  diffHint: {
    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.concrete,
    letterSpacing: 0.3, marginTop: -6,
  },
  captionInput: {
    backgroundColor: COLORS.navyMid, borderRadius: 10, padding: 14,
    color: COLORS.ghost, fontFamily: FONTS.ui, fontSize: 14, lineHeight: 22,
    borderWidth: 1, borderColor: COLORS.navyLight, minHeight: 80,
  },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  retakeBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.concrete, alignItems: 'center',
  },
  retakeBtnText: { fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.concrete },
  uploadBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 8,
    backgroundColor: COLORS.amber, alignItems: 'center',
  },
  uploadBtnText: { fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.navy },
  uploadMsg: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.concrete, marginTop: 16 },
  doneIcon: { fontSize: 64 },
  doneTitle: { fontFamily: FONTS.uiExtraBold, fontSize: 28, color: COLORS.green },
  doneSub: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.concrete },
  btn: {
    backgroundColor: COLORS.amber, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 8, marginTop: 8,
  },
  btnText: { fontFamily: FONTS.uiBold, fontSize: 15, color: COLORS.navy },
  doneBack: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete, marginTop: 8 },
});
