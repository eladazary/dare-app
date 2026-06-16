export const COLORS = {
  // Backgrounds
  navy: '#0A0A0A',          // true black — primary background
  navyMid: '#141414',       // near-black — card/surface background
  navyLight: '#1E1E1E',     // dark gray — elevated surfaces, inputs

  // Primary accent — gold
  amber: '#B8860B',         // gold — all CTAs, active states, dare color
  amberDim: '#8B6508',      // dimmed gold — hover/pressed states

  // Text
  ghost: '#FFFFFF',         // pure white — primary text
  concrete: '#8A8A8A',      // neutral gray — secondary text, labels

  // State colors
  red: '#FF2D55',           // failed, rejected, danger
  green: '#00E676',         // success, mission complete, GPS lock
  purple: '#7B5EA7',        // classified content, AI verdict

  // Rewards — same as accent for consistency
  gold: '#B8860B',          // achievements, top rank, legendary
} as const;

export type ColorKey = keyof typeof COLORS;
