import sharp from 'sharp';
import axios from 'axios';
import { SupabaseClient } from '@supabase/supabase-js';

export interface CheatResult {
  flagged: boolean;
  reason?: string;
  similarity?: number;
}

async function computePerceptualHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Array.from(data);
  const avg = pixels.reduce((s, p) => s + p, 0) / pixels.length;
  const bits = pixels.map((p) => (p >= avg ? '1' : '0')).join('');

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return a.length * 4;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    dist += xor.toString(2).split('').filter((c) => c === '1').length;
  }
  return dist;
}

function hashSimilarityPercent(a: string, b: string): number {
  const totalBits = a.length * 4;
  const dist = hammingDistance(a, b);
  return ((totalBits - dist) / totalBits) * 100;
}

async function isLikelyScreenshot(imageBuffer: Buffer): Promise<boolean> {
  const { data, info } = await sharp(imageBuffer)
    .resize(64, 64, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Check top and bottom rows for near-uniform color — screenshots often have solid status bars
  const getRowPixels = (row: number) => {
    const start = row * width * channels;
    const rowData = [];
    for (let x = 0; x < width; x++) {
      const base = start + x * channels;
      rowData.push({ r: data[base], g: data[base + 1], b: data[base + 2] });
    }
    return rowData;
  };

  const rowIsUniform = (pixels: { r: number; g: number; b: number }[]) => {
    const first = pixels[0];
    return pixels.every(
      (p) =>
        Math.abs(p.r - first.r) < 10 &&
        Math.abs(p.g - first.g) < 10 &&
        Math.abs(p.b - first.b) < 10
    );
  };

  const topRow = getRowPixels(0);
  const bottomRow = getRowPixels(height - 1);

  // Also check left and right columns
  const getColPixels = (col: number) => {
    const colData = [];
    for (let y = 0; y < height; y++) {
      const base = (y * width + col) * channels;
      colData.push({ r: data[base], g: data[base + 1], b: data[base + 2] });
    }
    return colData;
  };

  const leftCol = getColPixels(0);
  const rightCol = getColPixels(width - 1);

  const uniformEdges = [topRow, bottomRow, leftCol, rightCol].filter(rowIsUniform).length;

  // If 3+ edges are uniform, likely a screenshot with UI chrome
  return uniformEdges >= 3;
}

export async function detectCheat(
  imageBuffer: Buffer,
  userId: string,
  supabase: SupabaseClient
): Promise<CheatResult> {
  const screenshotDetected = await isLikelyScreenshot(imageBuffer);
  if (screenshotDetected) {
    return {
      flagged: true,
      reason: 'Image appears to be a screenshot of a screen',
    };
  }

  const currentHash = await computePerceptualHash(imageBuffer);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentSubmissions } = await supabase
    .from('submissions')
    .select('photo_url')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo)
    .limit(30);

  if (!recentSubmissions || recentSubmissions.length === 0) {
    return { flagged: false };
  }

  for (const submission of recentSubmissions) {
    if (!submission.photo_url) continue;

    try {
      const response = await axios.get<ArrayBuffer>(submission.photo_url, {
        responseType: 'arraybuffer',
        timeout: 5000,
      });
      const prevBuffer = Buffer.from(response.data);
      const prevHash = await computePerceptualHash(prevBuffer);
      const similarity = hashSimilarityPercent(currentHash, prevHash);

      if (similarity > 90) {
        return {
          flagged: true,
          reason: `Duplicate image detected (${similarity.toFixed(1)}% similar to a recent submission)`,
          similarity,
        };
      }
    } catch {
      // Skip unreachable URLs rather than failing the whole check
    }
  }

  return { flagged: false };
}
