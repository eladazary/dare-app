export const FONTS = {
  ui: 'SpaceGrotesk_400Regular',
  uiBold: 'SpaceGrotesk_700Bold',
  uiExtraBold: 'SpaceGrotesk_700Bold',
  challenge: 'PlayfairDisplay_700Bold',
  challengeItalic: 'PlayfairDisplay_400Regular_Italic',
  // Cipher card — typewriter aesthetic. Upgrade to SpaceMono_400Regular
  // by installing @expo-google-fonts/space-mono when available.
  mono: 'SpaceGrotesk_400Regular',
  monoBold: 'SpaceGrotesk_700Bold',
} as const;

export const TYPE_SCALE = {
  label: { fontSize: 11, letterSpacing: 3 },
  body: { fontSize: 13, lineHeight: 20 },
  ui: { fontSize: 15 },
  challenge: { fontSize: 20, lineHeight: 30 },
  mission: { fontSize: 24, lineHeight: 32, fontWeight: '800' as const }, // dare titles
  stat: { fontSize: 28, fontWeight: '800' as const },
  hero: { fontSize: 36, fontWeight: '800' as const },
} as const;
