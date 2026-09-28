# Validation record

Validated on the user's Arch Linux GNOME Wayland session, September 9, 2026.

- Dependency installation completed; npm audit reported zero vulnerabilities at install time.
- Syntax checks passed for main, preload, and renderer scripts.
- Both automated audio tests passed: frequency band separation; silence/finite values and transient beat decay.
- Native PipeWire enumeration found four sources, including two output monitors.
- A bounded system-monitor capture returned a 4,096-byte PCM block and was terminated. No recording was saved.
- Electron normal and transparent window smoke runs completed successfully using software WebGL (SwiftShader), rendering 131,072 particles. No shader compilation errors were reported. The normal-window screenshot was visually inspected. Transparent output was also captured in smoke.png.
- Hardware rendering was attempted but the restricted execution environment could not expose DRM GPU devices to Electron. RTX 4090 performance and hardware-composited transparency are therefore NOT verified. Software FPS is not representative of the GPU.
- Manual GNOME move/resize gestures and audible/music end-to-end tuning remain user checks; no desktop input automation was available.

## Desktop validation and installation

The user subsequently confirmed 59–60 FPS at 262,144 particles in a transparent window. A diagnostic run from the desktop reported ANGLE with NVIDIA GeForce RTX 4090 / OpenGL ES 3.2 and software=false, confirming hardware rendering.

On September 28, 2026, the GNOME desktop launcher was installed, syntax and audio tests passed again, and the project was prepared for GitHub.
