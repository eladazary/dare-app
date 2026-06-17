import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

interface Props {
  distanceMeters: number;
  solveRadius: number;
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

export default function SelfieCapture({ distanceMeters, solveRadius, onCapture, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const withinRadius = distanceMeters <= solveRadius;

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (photo?.uri) setPreview(photo.uri);
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (preview) onCapture(preview);
  };

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <Text style={styles.permText}>Camera access needed to submit proof.</Text>
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
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
      )}

      {/* Dim overlay */}
      <View style={styles.overlay} />

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity onPress={preview ? () => setPreview(null) : onCancel}>
          <Text style={styles.backText}>{preview ? '← RETAKE' : '✕'}</Text>
        </TouchableOpacity>
        <View style={styles.distanceBadge}>
          <View style={[styles.distanceDot, { backgroundColor: withinRadius ? COLORS.green : COLORS.classified }]} />
          <Text style={[styles.distanceLabel, { color: withinRadius ? COLORS.green : COLORS.classified }]}>
            {withinRadius ? `WITHIN ${solveRadius}M` : `${Math.round(distanceMeters)}M AWAY`}
          </Text>
        </View>
      </SafeAreaView>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        {preview ? (
          <>
            <Text style={styles.confirmHint}>Submit this as your proof?</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, !withinRadius && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={!withinRadius}
            >
              <Text style={styles.confirmBtnText}>
                {withinRadius ? 'CONFIRM PROOF →' : 'NOT CLOSE ENOUGH'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.shootHint}>
              {withinRadius ? 'You\'re in range. Take the shot.' : `Get within ${solveRadius}m to submit.`}
            </Text>
            <TouchableOpacity
              style={[styles.shutter, capturing && styles.shutterCapturing]}
              onPress={handleCapture}
              disabled={capturing}
            >
              {capturing
                ? <ActivityIndicator color={COLORS.navy} />
                : <View style={styles.shutterInner} />
              }
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.navy,
    zIndex: 100,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backText: {
    color: COLORS.ghost,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,10,10,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  distanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  distanceLabel: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 32,
    gap: 16,
  },
  shootHint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.concrete,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  shutterCapturing: {
    backgroundColor: COLORS.concrete,
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.ghost,
  },
  confirmHint: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.concrete,
    letterSpacing: 1,
  },
  confirmBtn: {
    backgroundColor: COLORS.amber,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 4,
  },
  btnDisabled: {
    backgroundColor: COLORS.navyLight,
  },
  confirmBtnText: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: COLORS.navy,
    letterSpacing: 2,
  },
  permText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.ghost,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
    marginTop: 200,
  },
  permBtn: {
    backgroundColor: COLORS.amber,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  permBtnText: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: COLORS.navy,
  },
  cancelText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.concrete,
    letterSpacing: 1,
  },
});
