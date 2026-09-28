// Reusable radix-2 FFT. Fixed 48 kHz PCM capture; no audio is played back.
export class AudioAnalysis {
  constructor(size = 2048) {
    this.n = size;
    this.ring = new Float32Array(size);
    this.re = new Float32Array(size);
    this.im = new Float32Array(size);
    this.spectrum = new Float32Array(128);
    this.cursor = 0;
    this.received = 0;
    this.previous = new Float32Array(size / 2);
    this.fluxMean = 0.001;
    this.lastBeat = -1;
    this.energy = 0;
    this.bass = 0;
    this.mid = 0;
    this.high = 0;
    this.beat = 0;
    this.dirty = false;
  }
  push(samples) {
    for (const x of samples) {
      this.ring[this.cursor] = Number.isFinite(x) ? x : 0;
      this.cursor = (this.cursor + 1) % this.n;
    }
    this.received += samples.length;
    this.dirty = true;
  }
  update(dt, time) {
    this.beat *= Math.exp(-dt * 5);
    if (!this.dirty) return;
    this.dirty = false;
    const n = this.n,
      re = this.re,
      im = this.im;
    let rms = 0;
    for (let i = 0; i < n; i++) {
      const x = this.ring[(this.cursor + i) % n];
      rms += x * x;
      re[i] = x * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
      im[i] = 0;
    }
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        const t = re[i];
        re[i] = re[j];
        re[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const angle = (-2 * Math.PI) / len;
      for (let i = 0; i < n; i += len) {
        for (let j = 0; j < len / 2; j++) {
          const c = Math.cos(angle * j),
            s = Math.sin(angle * j),
            a = i + j,
            b = a + len / 2,
            tr = re[b] * c - im[b] * s,
            ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    let low = 0,
      mid = 0,
      hi = 0,
      flux = 0;
    for (let i = 1; i < n / 2; i++) {
      const m = (2 * Math.hypot(re[i], im[i])) / n;
      const hz = (i * 48000) / n;
      if (hz < 250) low += m * m;
      else if (hz < 2500) mid += m * m;
      else hi += m * m;
      if (hz < 6000) flux += Math.max(0, m - this.previous[i]);
      this.previous[i] = m;
    }
    if (
      flux > Math.max(0.025, this.fluxMean * 1.65) &&
      time - this.lastBeat > 0.22 &&
      rms / n > 0.00002
    ) {
      this.beat = 1;
      this.lastBeat = time;
    }
    this.fluxMean += (flux - this.fluxMean) * (1 - Math.exp(-dt * 3));
    const smooth = (old, v) =>
      old + (Math.min(1, v) - old) * (1 - Math.exp(-dt * (v > old ? 24 : 5)));
    this.bass = smooth(this.bass, Math.sqrt(low) * 5);
    this.mid = smooth(this.mid, Math.sqrt(mid) * 5);
    this.high = smooth(this.high, Math.sqrt(hi) * 6);
    this.energy = smooth(this.energy, Math.sqrt(rms / n) * 4);
    for (let b = 0; b < 128; b++) {
      const start = Math.max(
          1,
          Math.floor((20 * Math.pow(1000, b / 128) * n) / 48000),
        ),
        end = Math.min(
          n / 2,
          Math.ceil((20 * Math.pow(1000, (b + 1) / 128) * n) / 48000),
        );
      let m = 0;
      for (let i = start; i < end; i++)
        m = Math.max(m, (2 * Math.hypot(re[i], im[i])) / n);
      this.spectrum[b] = smooth(this.spectrum[b], Math.log1p(m * 100) / 3);
    }
  }
}
