/**
 * Küçük, bağımlılıksız QR kod üretici (ISO/IEC 18004): bayt kipi, hata düzeltme seviyesi M, sürüm 1–10
 * (en fazla 213 bayt — davet linki için yeterli). Algoritma Project Nayuki'nin açık anlatımını izler.
 * Çıktı: modül matrisi (true = koyu) ve SVG path verisi.
 */

interface EcInfo { ecPerBlock: number; groups: readonly (readonly [count: number, dataLen: number])[] }

// Seviye M blok yapısı (sürüm 1..10)
const EC_M: readonly EcInfo[] = [
  { ecPerBlock: 10, groups: [[1, 16]] },
  { ecPerBlock: 16, groups: [[1, 28]] },
  { ecPerBlock: 26, groups: [[1, 44]] },
  { ecPerBlock: 18, groups: [[2, 32]] },
  { ecPerBlock: 24, groups: [[2, 43]] },
  { ecPerBlock: 16, groups: [[4, 27]] },
  { ecPerBlock: 18, groups: [[4, 31]] },
  { ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
  { ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
  { ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
];

const ALIGN: readonly (readonly number[])[] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const EC_LEVEL_M_BITS = 0; // L=1, M=0, Q=3, H=2

function dataCapacity(version: number): number {
  return EC_M[version - 1].groups.reduce((s, [n, len]) => s + n * len, 0);
}

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const res = new Array<number>(degree).fill(0);
  res[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      res[j] = gfMul(res[j], root);
      if (j + 1 < degree) res[j] ^= res[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return res;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const res = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (res.shift() as number);
    res.push(0);
    divisor.forEach((coef, i) => { res[i] ^= gfMul(coef, factor); });
  }
  return res;
}

function encodeData(bytes: readonly number[], version: number): number[] {
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capBits = dataCapacity(version) * 8;
  push(0, Math.min(4, capBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < dataCapacity(version); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

function addEcAndInterleave(data: readonly number[], version: number): number[] {
  const info = EC_M[version - 1];
  const divisor = rsDivisor(info.ecPerBlock);
  const blocks: { data: number[]; ec: number[] }[] = [];
  let k = 0;
  for (const [count, len] of info.groups) {
    for (let i = 0; i < count; i++) {
      const d = data.slice(k, k + len);
      k += len;
      blocks.push({ data: d, ec: rsRemainder(d, divisor) });
    }
  }
  const out: number[] = [];
  const maxLen = Math.max(...blocks.map(b => b.data.length));
  for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < info.ecPerBlock; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

class Grid {
  readonly mod: boolean[][];
  readonly fn: boolean[][];
  readonly size: number;
  constructor(size: number) {
    this.size = size;
    this.mod = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  set(x: number, y: number, dark: boolean): void {
    this.mod[y][x] = dark;
    this.fn[y][x] = true;
  }
}

function drawFunctionPatterns(g: Grid, version: number): void {
  const size = g.size;
  for (let i = 0; i < size; i++) { g.set(6, i, i % 2 === 0); g.set(i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      g.set(x, y, dist !== 2 && dist !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const pos = ALIGN[version - 1];
  const n = pos.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      g.set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  drawFormat(g, 0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      g.set(a, b, bit); g.set(b, a, bit);
    }
  }
}

function drawFormat(g: Grid, mask: number): void {
  const data = (EC_LEVEL_M_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  const size = g.size;
  for (let i = 0; i <= 5; i++) g.set(8, i, bit(i));
  g.set(8, 7, bit(6)); g.set(8, 8, bit(7)); g.set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) g.set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) g.set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) g.set(8, size - 15 + i, bit(i));
  g.set(8, size - 8, true);
}

function drawCodewords(g: Grid, data: readonly number[]): void {
  const size = g.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!g.fn[y][x] && i < data.length * 8) {
          g.mod[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(g: Grid, mask: number): void {
  for (let y = 0; y < g.size; y++) for (let x = 0; x < g.size; x++) {
    if (!g.fn[y][x] && maskBit(mask, x, y)) g.mod[y][x] = !g.mod[y][x];
  }
}

function penalty(m: readonly boolean[][]): number {
  const size = m.length;
  let score = 0;
  const lines: boolean[][] = [];
  for (let y = 0; y < size; y++) lines.push(m[y]);
  for (let x = 0; x < size; x++) lines.push(m.map(row => row[x]));
  const finderLike = /(?:0000|^)1011101(?:0000|$)/;
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) { run++; continue; }
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
    const s = line.map(b => (b ? '1' : '0')).join('');
    for (let i = 0; i + 7 <= s.length; i++) {
      if (s.startsWith('1011101', i) && (finderLike.test(s.slice(Math.max(0, i - 4), i + 11)))) score += 40;
    }
  }
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
  }
  const dark = m.reduce((s, row) => s + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

function utf8Bytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

/** Metni QR modül matrisine çevirir. Sığmazsa hata fırlatır. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = utf8Bytes(text);
  let version = 1;
  while (version <= 10 && (4 + (version <= 9 ? 8 : 16) + bytes.length * 8) > dataCapacity(version) * 8) version++;
  if (version > 10) throw new Error('qr-too-long');
  const codewords = addEcAndInterleave(encodeData(bytes, version), version);
  const size = version * 4 + 17;

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = new Grid(size);
    drawFunctionPatterns(g, version);
    drawCodewords(g, codewords);
    applyMask(g, mask);
    drawFormat(g, mask);
    const sc = penalty(g.mod);
    if (sc < bestScore) { bestScore = sc; best = g.mod; }
  }
  return best as boolean[][];
}

/** SVG path (her koyu modül 1×1 kare). viewBox: `-4 -4 (size+8) (size+8)` (sessiz bölge 4 modül). */
export function qrSvgPath(matrix: readonly boolean[][]): string {
  let d = '';
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x} ${y}h1v1h-1z`; }));
  return d;
}
