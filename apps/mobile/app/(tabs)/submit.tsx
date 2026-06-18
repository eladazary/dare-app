import { View } from 'react-native';
import { COLORS } from '@/constants/colors';

// Legacy screen — submission is now handled inline via SelfieCapture on the map screen.
export default function SubmitScreen() {
  return <View style={{ flex: 1, backgroundColor: COLORS.navy }} />;
}
