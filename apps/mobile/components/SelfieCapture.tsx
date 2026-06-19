import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

interface Props {
  referencePhotoUrl?: string | null;  // shown as guide overlay
  distanceMeters: number;
  solveRadius: number;
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

export default function SelfieCapture({
  referencePhotoUrl, distanceMeters, solveRadius, onCapture, onCancel,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const cameraRef = useRef<CameraView>(null);

  const withinRadius = distanceMeters <= solveRadius;

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) setPreview(photo.uri);
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <Text style={styles.permText}>Camera access needed to photograph the trace.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Camera or preview */}
      {preview ? (
        <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      )}

      {/* Reference guide overlay (toggleable) */}
      {showGuide && referencePhotoUrl && !preview && (
        <View style={styles.guideOverlay}>
          <Image source={{ uri: referencePhotoUrl }} style={styles.guidePhoto} resizeMode="cover" />
          <Text style={styles.guideLabel}>MATCH THIS ANGLE</Text>
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={preview ? () => setPreview(null) : onCancel}>
          <Text style={styles.topBtn}>{preview ? '← Retake' : '✕'}</Text>
        </TouchableOpacity>
        <View style={[styles.distBadge, withinRadius && styles.distBadgeIn]}>
          <Text style={[styles.distText, withinRadius && styles.distTextIn]}>
            {withinRadius ? '✓ In range' : `📍 ${Math.round(distanceMeters)}m away`}
          </Text>
        </View>
        {referencePhotoUrl && !preview && (
          <TouchableOpacity onPress={() => setShowGuide(g => !g)}>
            <Text style={styles.topBtn}>{showGuide ? 'Hide guide' : 'Show guide'}</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        {preview ? (
          <>
            <Text style={styles.confirmHint}>
              {withinRadius ? 'Submit this photo?' : 'You need to be closer to submit.'}
            </Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.retakeBtn} onPress={() => setPreview(null)}>
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, !withinRadius && styles.submitBtnDisabled]}
                onPress={() => onCapture(preview)}
                disabled={!withinRadius}
              >
                <Text style={styles.submitBtnText}>
                  {withinRadius ? 'Submit ✓' : 'Too far'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.shootHint}>
              {withinRadius
                ? 'Match the angle and shoot'
                : `Get within ${solveRadius}m to submit`}
            </Text>
            <TouchableOpacity
              style={[styles.shutter, capturing && styles.shutterCapturing]}
              onPress={handleCapture}
              disabled={capturing}
            >
              {capturing
                ? <ActivityIndicator color={COLORS.navy} />
                : <View style={styles.shutterInner} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onCapture('dev-placeholder')}>
              <Text style={styles.devSkip}>DEV: Skip →</Text>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.navy, zIndex: 100 },
  guideOverlay: {
    position: 'absolute', bottom: 120, right: 16,
    width: 120, borderRadius: 10, overflow: 'hidden',
    borderWidth: 2, borderColor: COLORS.amber,
  },
  guidePhoto: { width: 120, height: 120 },
  guideLabel: {
    fontFamily: FONTS.monoBold, fontSize: 8,
    color: COLORS.navy, backgroundColor: COLORS.amber,
    textAlign: 'center', paddingVertical: 3, letterSpacing: 1,
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingTop: 8,
  },
  topBtn: { fontFamily: FONTS.monoBold, fontSize: 13, color: COLORS.ghost, letterSpacing: 0.5 },
  distBadge: {
    backgroundColor: 'rgba(10,10,10,0.7)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.concrete,
  },
  distBadgeIn: { borderColor: COLORS.green },
  distText: { fontFamily: FONTS.monoBold, fontSize: 11, color: COLORS.concrete, letterSpacing: 0.5 },
  distTextIn: { color: COLORS.green },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingBottom: 32, gap: 14,
  },
  shootHint: {
    fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete, letterSpacing: 1,
  },
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.ghost, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)',
  },
  shutterCapturing: { backgroundColor: COLORS.concrete },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.ghost },
  confirmHint: {
    fontFamily: FONTS.mono, fontSize: 11, color: COLORS.concrete, letterSpacing: 0.5,
  },
  confirmRow: { flexDirection: 'row', gap: 12 },
  retakeBtn: {
    paddingHorizontal: 24, paddingVertical: 13, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.concrete,
  },
  retakeBtnText: { fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.ghost },
  submitBtn: {
    paddingHorizontal: 28, paddingVertical: 13, borderRadius: 8,
    backgroundColor: COLORS.green,
  },
  submitBtnDisabled: { backgroundColor: COLORS.navyLight },
  submitBtnText: { fontFamily: FONTS.uiBold, fontSize: 14, color: COLORS.navy },
  devSkip: {
    fontFamily: FONTS.mono, fontSize: 11, color: COLORS.amber, opacity: 0.5,
  },
  permText: {
    fontFamily: FONTS.mono, fontSize: 14, color: COLORS.ghost,
    textAlign: 'center', paddingHorizontal: 40, marginTop: 200,
  },
  permBtn: {
    backgroundColor: COLORS.amber, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 4, marginTop: 20,
  },
  permBtnText: { fontFamily: FONTS.uiBold, fontSize: 13, color: COLORS.navy },
  cancelText: {
    fontFamily: FONTS.mono, fontSize: 12, color: COLORS.concrete, marginTop: 16,
  },
});
