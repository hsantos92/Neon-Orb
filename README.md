# Neon Orb

A standalone Electron + Three.js/WebGL2 audio-reactive particle orb for Arch Linux GNOME Wayland and NVIDIA GPUs. Audio stays on your computer. Nothing is uploaded or saved. Capture begins only when you click **Listen**, and stops with **Stop**, window-mode changes, or exit.

## Install and run

From the project directory:

```bash
sudo pacman -S --needed nodejs npm libpulse pipewire pipewire-pulse wireplumber gtk3 nss alsa-lib
npm ci
npm run setup
npm run start:wayland
```

Node 22.12 or newer is required by Electron's installer. `npm run setup` downloads the pinned Electron binary (Electron 44 uses an explicit installer). Three.js and Electron are pinned and the lockfile is included. No build step, web server, browser tab, API key, or cloud service is needed after installation.

On an existing PipeWire desktop, do not replace your working sound setup. If services are missing, enable them:

```bash
systemctl --user enable --now pipewire.socket pipewire-pulse.socket wireplumber.service
```

Use the NVIDIA driver appropriate to your installed kernel, with matching `nvidia-utils`; do not replace an existing working driver just for this app. Verify `nvidia-smi` works. Optional `pavucontrol` or `qpwgraph` helps inspect routing.

Other launch commands:

```bash
npm start                         # Electron's default display backend
npm run start:transparent         # Transparent, borderless window
npm run start:wayland -- --transparent
npm run start:x11                 # XWayland fallback if needed
npm test
npm run check
npm run smoke -- --ozone-platform=wayland
```

The smoke run opens a real window for six seconds, reports graphics status and frame rate, writes `smoke.png`, and exits. It does not enable audio capture. Do not run Electron as root or disable its sandbox.

## Audio

1. Select a **SYSTEM** input whose description matches the output playing your music (headphones, HDMI, speakers, etc.). This captures the corresponding output monitor through `parec` and PipeWire's PulseAudio server. It works with other applications, not just a browser tab.
2. Select a **MIC / SOURCE** input for a microphone or other recording source.
3. Click **Listen**. Select another source and click **Listen** to switch at runtime. **Refresh** discovers newly connected devices. Disconnects produce a visible error; refresh and select a replacement.
4. Use **Response** to adjust sensitivity. The app does not play captured audio back, preventing a feedback loop.

Only the chosen sink's monitor is captured, not every output simultaneously. For per-application audio, route that application to a dedicated sink with your normal PipeWire routing tools. No microphone permission dialog is expected: this is a native desktop client using the current user's sound server. An entirely silent source produces no audio modulation; the orb continues its idle rotation.

Useful diagnostics:

```bash
pactl info
pactl list short sources
systemctl --user status pipewire pipewire-pulse wireplumber
```

On Arch, both `parec` and `pactl` belong to **libpulse**, not Debian's `pulseaudio-utils`. Do not install the PulseAudio daemon over `pipewire-pulse`.

## Window controls

Normal, borderless, and transparent modes are selectable in the panel. Switching recreates the native window and resets visual settings and audio capture. Drag the top strip; resize using the window edges. GNOME's Super + left-drag also moves a window. H hides/shows the controls, Escape restores them, and Space pauses animation. Hover near the top to reveal the hidden toolbar. Close via × or Alt+F4.

Wayland deliberately gives GNOME control of placement: the app cannot promise exact programmatic coordinates, persistence of position when recreating a window, or always-on-top behavior. You can manually place it anywhere GNOME allows. Transparent mode is experimental and compositor/driver-dependent; transparent pixels are not click-through. Normal mode is the reliable fallback, with XWayland available for comparison. If transparent resizing fails, resize in normal mode before changing mode.

## Rendering and performance

- 65,536 / 131,072 / 262,144 / 524,288 particles in a single points draw call. Positions are generated once; spherical-shell motion, frequency displacement, waves, color, and point glow run in vertex/fragment shaders.
- A bounded ~3,000-edge connection lattice uses the same deformation shader. This avoids quadratic all-pairs neighbor searches. Connections form a structured shell rather than tracking every particle pair.
- Half-float render targets, half-resolution separable bloom, and ping-pong temporal trails with frame-rate-independent decay. Transparent output derives alpha from the final glow so bloom is retained.
- Mono 48 kHz float PCM, 2,048-sample Hann-window FFT, 128 logarithmic frequency bands, attack/release smoothing, spectral-flux beat detection with adaptive threshold and cooldown.
- Audio blocks are about 21 ms; FFT window is about 43 ms. Actual latency also depends on the audio server and device.

Start at 131k particles / 1× scale. Try 262k or 524k on the RTX 4090. At large/4K window sizes, transparent overdraw, bloom and render resolution can matter more than particle count. Lower render scale or particle count if the displayed FPS falls. Pixel ratio is capped at 1.5 before the selected scale. Smoothness depends on compositor, driver, window size, and refresh rate; the app does not promise a fixed FPS. Space pauses rendering but capture continues until Stop; no audio is stored beyond the short analysis buffer.

## Why Electron

Electron ships a consistent Chromium/WebGL2 implementation and supports a small, isolated native audio bridge without compiling Rust or C++. Tauri would reduce the shell's disk and memory footprint, but Linux rendering would depend on the installed WebKitGTK stack. Electron is the practical choice here for predictable Three.js behavior and NVIDIA/Wayland testing. The renderer is sandboxed, has no Node access, loads only local assets, blocks navigation/popups, and exposes only a narrow validated bridge. There is no remote content.

## Files

- `main.cjs`: native window, device enumeration, bounded PCM chunks, capture process lifecycle.
- `preload.cjs`: isolated bridge.
- `index.html`, `style.css`: responsive controls and transparent shell.
- `src/app.js`: GPU particles, connections, bloom, trails, window/audio controls.
- `src/audio.mjs`: FFT and beat analysis.
- `test/audio.test.cjs`: signal-analysis regression checks.
- `package.json`, `package-lock.json`: reproducible dependencies and runnable commands.

## Upstream references

- Electron window/Wayland restrictions: https://www.electronjs.org/docs/latest/api/browser-window
- Transparent/frameless windows: https://www.electronjs.org/docs/latest/tutorial/custom-window-styles
- Electron desktop capture (Linux system loopback is not the Windows loopback API): https://www.electronjs.org/docs/latest/api/desktop-capturer
- Arch PipeWire setup: https://wiki.archlinux.org/title/PipeWire
- Three.js: https://threejs.org/docs/

## Desktop launcher

After dependency setup, run `python3 install-desktop.py` once from this checkout. Search for **Neon Orb** in the GNOME application menu. The launcher also provides a **Launch Transparent** action. Keep this checkout in place; rerun the installer after moving it. Launch directly with `./launch.sh` or `./launch.sh --transparent`.
