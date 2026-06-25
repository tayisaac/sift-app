import sharp from 'sharp';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function tokenize(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}

function basename(urlOrName: string): string {
  try {
    const u = new URL(urlOrName);
    urlOrName = u.pathname;
  } catch {
    // not a full URL, treat as already a path/filename
  }
  const parts = urlOrName.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? urlOrName);
}

/** Filename similarity: blend of Jaccard token overlap and normalized Levenshtein distance, 0-100. */
export function filenameSimilarity(referenceFilename: string, candidateUrl: string): number {
  const refName = basename(referenceFilename);
  const candName = basename(candidateUrl);

  const refTokens = tokenize(refName);
  const candTokens = tokenize(candName);
  let jaccard = 0;
  if (refTokens.size || candTokens.size) {
    const intersection = [...refTokens].filter((t) => candTokens.has(t)).length;
    const union = new Set([...refTokens, ...candTokens]).size;
    jaccard = union === 0 ? 0 : intersection / union;
  }

  const a = refName.toLowerCase();
  const b = candName.toLowerCase();
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  const levSim = 1 - dist / maxLen;

  const blended = (jaccard + levSim) / 2;
  return Math.round(Math.max(0, Math.min(1, blended)) * 100);
}

// ── Perceptual hash (dHash) ──────────────────────────────────────────────────

/** Compute a 64-bit dHash: resize to 9×8 grayscale, compare adjacent pixel pairs per row. */
export async function computeDHash(buffer: Buffer): Promise<bigint> {
  const { data } = await sharp(buffer)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let hash = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      hash = (hash << 1n) | (data[row * 9 + col] > data[row * 9 + col + 1] ? 1n : 0n);
    }
  }
  return hash;
}

function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let n = 0;
  while (xor > 0n) { n += Number(xor & 1n); xor >>= 1n; }
  return n;
}

/** Hash similarity: 0–100 based on Hamming distance of two 64-bit dHashes. */
export function hashSimilarity(refHash: bigint, candHash: bigint): number {
  return Math.round((1 - hammingDistance(refHash, candHash) / 64) * 100);
}

/**
 * Crop-resistant hash similarity: tries the full image plus square crops along
 * the long axis (left / center / right for landscape, top / center / bottom for
 * portrait) and returns the highest similarity found.  This handles the common
 * case where the reference is a tight crop of a hero banner on the candidate page.
 */
export async function hashSimilarityBestCrop(refHash: bigint, candBuffer: Buffer): Promise<number> {
  const fullHash = await computeDHash(candBuffer);
  let best = hashSimilarity(refHash, fullHash);
  if (best >= 90) return best; // early exit — already very good

  const meta = await sharp(candBuffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const ratio = w > 0 && h > 0 ? Math.max(w, h) / Math.min(w, h) : 1;
  if (ratio < 1.4) return best; // roughly square — no useful crops to try

  const sq = Math.min(w, h);
  const steps = 15; // sample 15 positions along the long axis for fine coverage
  const crops: { left: number; top: number; width: number; height: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    if (w >= h) {
      crops.push({ left: Math.round((w - sq) * t), top: 0, width: sq, height: sq });
    } else {
      crops.push({ left: 0, top: Math.round((h - sq) * t), width: sq, height: sq });
    }
  }

  for (const region of crops) {
    try {
      const cropped = await sharp(candBuffer).extract(region).toBuffer();
      const cropHash = await computeDHash(cropped);
      const sim = hashSimilarity(refHash, cropHash);
      if (sim > best) best = sim;
      if (best >= 90) break;
    } catch { /* skip bad crops */ }
  }
  return best;
}

// ── Sliding-window NCC (normalised cross-correlation) sizes ──────────────────
// REF_SIZE: reference thumbnail side length.
// CAND_SIZE: candidate thumbnail side length — larger so the ref kernel can slide over it.
// A ref image that fills its frame will match a candidate where it appears at any position/crop.
const REF_SIZE = 16;
const CAND_SIZE = 32;

/** Downscale an image to REF_SIZE × REF_SIZE grayscale for use as a sliding-window kernel. */
export async function computeRefPixels(buffer: Buffer): Promise<Float32Array> {
  const { data } = await sharp(buffer)
    .grayscale()
    .resize(REF_SIZE, REF_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Float32Array(data);
}

/** Downscale a candidate image to CAND_SIZE × CAND_SIZE grayscale. */
export async function computeCandPixels(buffer: Buffer): Promise<Float32Array> {
  const { data } = await sharp(buffer)
    .grayscale()
    .resize(CAND_SIZE, CAND_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Float32Array(data);
}

/**
 * Sliding-window normalised cross-correlation similarity, 0–100.
 * Slides the REF_SIZE kernel across the CAND_SIZE candidate and returns
 * the best matching window score, so a cropped or repositioned version of
 * the reference is still detected.
 */
export function slideNCC(refPixels: Float32Array, candPixels: Float32Array): number {
  const n = REF_SIZE * REF_SIZE;
  const refMean = refPixels.reduce((s, v) => s + v, 0) / n;
  let refVar = 0;
  for (let i = 0; i < n; i++) refVar += (refPixels[i] - refMean) ** 2;
  const refStd = Math.sqrt(refVar / n);
  if (refStd === 0) return 50; // flat reference — undefined correlation

  const steps = CAND_SIZE - REF_SIZE + 1; // 17 steps each axis → 289 windows
  let best = -1;

  for (let ry = 0; ry < steps; ry++) {
    for (let rx = 0; rx < steps; rx++) {
      // Extract window pixels and compute mean
      let winMean = 0;
      const win = new Float32Array(n);
      for (let y = 0; y < REF_SIZE; y++) {
        for (let x = 0; x < REF_SIZE; x++) {
          const v = candPixels[(ry + y) * CAND_SIZE + (rx + x)];
          win[y * REF_SIZE + x] = v;
          winMean += v;
        }
      }
      winMean /= n;

      let num = 0, winVar = 0;
      for (let i = 0; i < n; i++) {
        const a = refPixels[i] - refMean;
        const b = win[i] - winMean;
        num += a * b;
        winVar += b * b;
      }
      const winStd = Math.sqrt(winVar / n);
      const ncc = winStd === 0 ? 0 : num / (n * refStd * winStd);
      if (ncc > best) best = ncc;
    }
  }

  // Map NCC [-1, 1] → similarity [0, 100]
  return Math.round(Math.max(0, Math.min(1, (best + 1) / 2)) * 100);
}
