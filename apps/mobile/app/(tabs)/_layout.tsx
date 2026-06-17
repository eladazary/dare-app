import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/constants/colors';

// ---------------------------------------------------------------------------
// Tab icon helper
// ---------------------------------------------------------------------------

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  focused,
  size = 24,
}: {
  name: IoniconsName;
  focused: boolean;
  size?: number;
}) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={size}
      color={focused ? COLORS.amber : COLORS.concrete}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab layout — 5 tabs: Today, City, Map, Events, Me
// The Submit/camera action lives as a floating button on the Today screen.
// ---------------------------------------------------------------------------

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 80,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.amber,
        tabBarInactiveTintColor: COLORS.concrete,
        tabBarShowLabel: false,
      }}
    >
      {/* Map — primary screen */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Hunt',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="map" focused={focused} />
          ),
        }}
      />

      {/* Field Intel feed */}
      <Tabs.Screen
        name="city"
        options={{
          title: 'Intel',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="people" focused={focused} />
          ),
        }}
      />

      {/* Arena — social mechanics */}
      <Tabs.Screen
        name="events"
        options={{
          title: 'Arena',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="trophy" focused={focused} />
          ),
        }}
      />

      {/* Agent profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Agent',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" focused={focused} />
          ),
        }}
      />

      {/* Index — hidden from tab bar, kept for routing */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
