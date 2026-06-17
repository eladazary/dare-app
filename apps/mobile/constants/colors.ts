export const COLORS = {
  // Backgrounds
  navy: '#0A0A0A',          // true black — primary background
  navyMid: '#141414',       // near-black — card/surface background
  navyLight: '#1E1E1E',     // dark gray — elevated surfaces, inputs

  // Primary accent — gold
  amber: '#B8860B',         // gold — all CTAs, active states, cipher color
  amberDim: '#8B6508',      // dimmed gold — hover/pressed states

  // Text
  ghost: '#FFFFFF',         // pure white — primary text
  concrete: '#8A8A8A',      // neutral gray — secondary text, labels

  // State colors
  red: '#FF2D55',           // failed, rejected, danger
  green: '#00E676',         // success, mission complete, GPS lock
  purple: '#7B5EA7',        // classified content, AI verdict

  // REDACTED theme — cipher card
  cream: '#F5F0E8',         // aged paper — cipher card background (only non-dark element)
  creamDim: '#E8E2D6',      // slightly darker cream — cipher card borders/lines
  classified: '#C41E3A',    // blood red — CLASSIFIED stamp, urgency
  redaction: '#1A1A1A',     // near-black — redaction bars on cream card

  // Rewards
  gold: '#B8860B',          // achievements, top rank, legendary
} as const;

export type ColorKey = keyof typeof COLORS;
