const { test } = require("node:test");
const assert = require("node:assert/strict");
test("FFT distinguishes bass, mids and treble", async () => {
  const { AudioAnalysis } = await import("../src/audio.mjs");
  for (const [hz, band] of [
    [93.75, "bass"],
    [1007.8125, "mid"],
    [6000, "high"],
  ]) {
    const a = new AudioAnalysis();
    for (let t = 0; t < 30; t++) {
      a.push(
        Float32Array.from(
          { length: 2048 },
          (_, i) => 0.1 * Math.sin((2 * Math.PI * hz * i) / 48000),
        ),
      );
      a.update(1 / 60, t / 60);
    }
    assert(a[band] > 0.2, `${band}: ${a[band]}`);
    for (const other of ["bass", "mid", "high"].filter((x) => x !== band))
      assert(a[band] > a[other] * 5);
  }
});
test("silence is finite and produces no beat; transient triggers then decays", async () => {
  const { AudioAnalysis } = await import("../src/audio.mjs");
  const a = new AudioAnalysis();
  a.push(new Float32Array(2048));
  a.update(0.016, 0);
  assert.equal(a.beat, 0);
  assert(a.spectrum.every(Number.isFinite));
  a.push(
    Float32Array.from(
      { length: 2048 },
      (_, i) => 0.4 * Math.sin((i * 2 * Math.PI * 100) / 48000),
    ),
  );
  a.update(0.016, 1);
  assert.equal(a.beat, 1);
  a.update(0.1, 1.1);
  assert(a.beat < 1);
});
