import exifReader from 'exif-reader';

export interface EXIFResult {
  valid: boolean;
  takenAt: Date | null;
  message: string;
}

export async function validateEXIF(
  imageBuffer: Buffer,
  activeFrom: Date,
  activeUntil: Date,
  submittedAt: Date
): Promise<EXIFResult> {
  let exifData: ReturnType<typeof exifReader> | null = null;

  try {
    exifData = exifReader(imageBuffer);
  } catch {
    return {
      valid: true,
      takenAt: null,
      message: 'No EXIF data found — cannot verify capture time, proceeding',
    };
  }

  const raw =
    exifData?.Image?.DateTime ??
    exifData?.Photo?.DateTimeOriginal ??
    exifData?.Photo?.DateTimeDigitized;

  if (!raw) {
    return {
      valid: true,
      takenAt: null,
      message: 'EXIF present but no DateTimeOriginal — cannot verify capture time, proceeding',
    };
  }

  // EXIF datetime format: "YYYY:MM:DD HH:MM:SS"
  const normalized = String(raw).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const takenAt = new Date(normalized);

  if (isNaN(takenAt.getTime())) {
    return {
      valid: true,
      takenAt: null,
      message: 'EXIF datetime unparseable — cannot verify capture time, proceeding',
    };
  }

  if (takenAt < activeFrom || takenAt > activeUntil) {
    return {
      valid: false,
      takenAt,
      message: `Photo taken at ${takenAt.toISOString()} is outside challenge window (${activeFrom.toISOString()} – ${activeUntil.toISOString()})`,
    };
  }

  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  if (submittedAt.getTime() - takenAt.getTime() > FIVE_MINUTES_MS) {
    return {
      valid: false,
      takenAt,
      message: `Photo was taken more than 5 minutes before submission (taken: ${takenAt.toISOString()}, submitted: ${submittedAt.toISOString()})`,
    };
  }

  return {
    valid: true,
    takenAt,
    message: `Photo capture time verified: ${takenAt.toISOString()}`,
  };
}
