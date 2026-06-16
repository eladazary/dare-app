export type BadgeRarity = 'common' | 'rare' | 'legendary';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  rarity: BadgeRarity;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: 'waterproof',
    name: 'Waterproof',
    description: 'Completed a dare in the rain.',
    emoji: '🌧️',
    rarity: 'common',
  },
  {
    id: 'lightning',
    name: 'Lightning',
    description: 'Submitted proof within 5 minutes of the dare dropping.',
    emoji: '⚡',
    rarity: 'common',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'First agent to submit in your city today.',
    emoji: '🌅',
    rarity: 'common',
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: '7-day active run.',
    emoji: '🔥',
    rarity: 'common',
  },
  {
    id: 'streak_30',
    name: 'Monthly Legend',
    description: '30-day active run. Uncommon.',
    emoji: '💎',
    rarity: 'rare',
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Perfect proof. 100% confirmed.',
    emoji: '✨',
    rarity: 'rare',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Submitted proof after 10pm.',
    emoji: '🦉',
    rarity: 'common',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Dared in 10 different mission types.',
    emoji: '🗺️',
    rarity: 'rare',
  },
  {
    id: 'legend_tier',
    name: 'Legend',
    description: 'Completed a hard dare. Not many do.',
    emoji: '👑',
    rarity: 'legendary',
  },
];

export const BADGES_BY_ID = Object.fromEntries(
  BADGES.map((badge) => [badge.id, badge])
) as Record<string, BadgeDefinition>;
