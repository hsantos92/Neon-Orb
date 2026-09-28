import * as T from "../node_modules/three/build/three.module.js";
import { AudioAnalysis } from "./audio.mjs";
const $ = (id) => document.getElementById(id),
  status = (s) => ($("status").textContent = s);
const transparent =
  new URLSearchParams(location.search).get("mode") === "transparent";
$("mode").value = new URLSearchParams(location.search).get("mode") || "normal";
let audio = new AudioAnalysis(),
  active = false,
  paused = false,
  gain = 1.5,
  count = 131072,
  renderScale = 1;
window.orb.onPCM((bytes) => {
  if (!active) return;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    samples = new Float32Array(bytes.byteLength / 4);
  for (let i = 0; i < samples.length; i++)
    samples[i] = data.getFloat32(i * 4, true);
  audio.push(samples);
});
window.orb.onError((message) => {
  active = false;
  audio = new AudioAnalysis();
  status(message);
});
async function refresh() {
  try {
    const current = $("input").value;
    const list = await window.orb.sources();
    $("input").replaceChildren(new Option("Select audio input", ""));
    for (const s of list)
      $("input").add(
        new Option(
          (s.monitor ? "SYSTEM · " : "MIC / SOURCE · ") + s.label,
          s.name,
        ),
      );
    $("input").value = current;
    if (!list.length) status("No audio sources found. Check PipeWire.");
  } catch (e) {
    status(e.message);
  }
}
$("refresh").onclick = refresh;
$("listen").onclick = async () => {
  if (!$("input").value) return status("Choose an audio input first.");
  active = false;
  audio = new AudioAnalysis();
  try {
    await window.orb.capture($("input").value);
    active = true;
    status("Listening · " + $("input").selectedOptions[0].text);
  } catch (e) {
    status(e.message);
  }
};
$("stop").onclick = async () => {
  active = false;
  await window.orb.stop();
  audio = new AudioAnalysis();
  status("Audio capture off · idle animation");
};
$("mode").onchange = () => window.orb.mode($("mode").value);
$("close").onclick = () => window.orb.close();
$("hide").onclick = () => document.body.classList.toggle("hidden");
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,button")) return;
  if (e.key.toLowerCase() === "h") document.body.classList.toggle("hidden");
  if (e.key === "Escape") document.body.classList.remove("hidden");
  if (e.code === "Space") {
    paused = !paused;
    e.preventDefault();
  }
});
$("gain").oninput = () => (gain = +$("gain").value);
refresh();
try {
  init();
} catch (e) {
  status("GPU initialization failed: " + e.message);
  console.error(e);
}
function init() {
  const renderer = new T.WebGLRenderer({
    canvas: $("scene"),
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
  });
  renderer.setClearColor(0, 0);
  renderer.debug.checkShaderErrors = true;
  const gl = renderer.getContext();
  if (!gl.getExtension("EXT_color_buffer_float"))
    throw Error(
      "Floating-point render targets unavailable. Check NVIDIA hardware acceleration.",
    );
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.z = 5.8;
  const fftData = new Float32Array(128),
    fft = new T.DataTexture(fftData, 128, 1, T.RedFormat, T.FloatType);
  fft.needsUpdate = true;
  const uniforms = {
    time: { value: 0 },
    bass: { value: 0 },
    mids: { value: 0 },
    high: { value: 0 },
    energy: { value: 0 },
    beat: { value: 0 },
    fft: { value: fft },
    pixel: { value: 1 },
  };
  const deform = `uniform float time,bass,mids,high,energy,beat;uniform sampler2D fft;
vec3 deform(vec3 p){float radius=length(p);vec3 n=normalize(p);float f=texture2D(fft,vec2(clamp((n.y+1.)*.5,0.,1.),.5)).r;
float wave=sin(n.y*15.+time*1.4+n.x*4.)*cos(n.z*11.-time)*(.022+bass*.11);
p=n*(radius*(1.+bass*.20)+wave+f*.16+beat*.045*sin(radius*13.-time*8.));
float a=time*.075+(radius-1.)*.3;mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));p.xz=rot*p.xz;p.xy=mat2(cos(.2*sin(time*.13)),-sin(.2*sin(time*.13)),sin(.2*sin(time*.13)),cos(.2*sin(time*.13)))*p.xy;return p;}`;
  const material = new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    vertexShader:
      deform +
      `attribute float seed;uniform float pixel;varying vec3 color;varying float alpha;
void main(){vec3 p=deform(position);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.2+pow(seed,8.)*3.+high*1.6)*pixel*4./-mv.z,1.,9.);color=mix(vec3(.16,.65,1.),vec3(1.,.14,.59),.5+.5*sin(position.y*2.+seed*2.+time*.12));alpha=(.14+seed*.38+energy*.20)*(1.+beat*.3);}`,
    fragmentShader: `varying vec3 color;varying float alpha;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(color,alpha*pow(1.-d,1.6));}`,
  });
  function geometry(n) {
    const p = new Float32Array(n * 3),
      s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n,
        a = i * 2.3999632297,
        r = Math.sqrt(1 - y * y),
        shell = 1.25 + 0.28 * Math.sin(i * 73.156) * Math.sin(i * 9.37);
      p.set(
        [r * Math.cos(a) * shell, y * shell, r * Math.sin(a) * shell],
        i * 3,
      );
      s[i] = ((Math.sin(i * 17.23) * 43758.54) % 1) + 0.5;
      s[i] = Math.abs(s[i]) % 1;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(p, 3));
    g.setAttribute("seed", new T.BufferAttribute(s, 1));
    return g;
  }
  const points = new T.Points(geometry(count), material);
  points.frustumCulled = false;
  scene.add(points);
  // Bounded latitude/longitude graph. Both endpoints use the same GPU deformation.
  const lines = [];
  const node = (i, j) => {
    const lat = (Math.PI * (i + 0.5)) / 32,
      lon = (j * 2 * Math.PI) / 64;
    return [
      1.52 * Math.sin(lat) * Math.cos(lon),
      1.52 * Math.cos(lat),
      1.52 * Math.sin(lat) * Math.sin(lon),
    ];
  };
  for (let i = 0; i < 31; i++)
    for (let j = 0; j < 64; j++) {
      lines.push(...node(i, j), ...node(i, j + 1));
      if ((i + j) % 2 === 0) lines.push(...node(i, j), ...node(i + 1, j + 1));
    }
  const lg = new T.BufferGeometry();
  lg.setAttribute("position", new T.Float32BufferAttribute(lines, 3));
  scene.add(
    new T.LineSegments(
      lg,
      new T.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        vertexShader:
          deform +
          `varying float v;void main(){v=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(deform(position),1.);}`,
        fragmentShader: `uniform float mids,beat,time;varying float v;void main(){gl_FragColor=vec4(mix(vec3(.12,.5,1.),vec3(.9,.2,.7),.5+.5*sin(v*3.+time)),.025+mids*.14+beat*.025);}`,
      }),
    ),
  );
  $("count").onchange = () => {
    count = +$("count").value;
    points.geometry.dispose();
    points.geometry = geometry(count);
  };
  // Half-float linear render targets; separable bloom and ping-pong temporal history.
  const target = () =>
    new T.WebGLRenderTarget(1, 1, {
      type: T.HalfFloatType,
      depthBuffer: false,
    });
  const raw = target(),
    blurA = target(),
    blurB = target();
  let history = target(),
    next = target();
  const postScene = new T.Scene(),
    postCamera = new T.Camera(),
    quad = new T.Mesh(new T.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  postScene.add(quad);
  const vertex = `varying vec2 uvv;void main(){uvv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
  const blur = new T.ShaderMaterial({
    uniforms: { source: { value: null }, stepSize: { value: new T.Vector2() } },
    vertexShader: vertex,
    fragmentShader: `uniform sampler2D source;uniform vec2 stepSize;varying vec2 uvv;void main(){vec4 c=texture2D(source,uvv)*.227027;c+=(texture2D(source,uvv+stepSize*1.384615)+texture2D(source,uvv-stepSize*1.384615))*.316216;c+=(texture2D(source,uvv+stepSize*3.230769)+texture2D(source,uvv-stepSize*3.230769))*.070270;gl_FragColor=c;}`,
  });
  const combine = new T.ShaderMaterial({
    uniforms: {
      source: { value: raw.texture },
      bloom: { value: blurB.texture },
      history: { value: null },
      glow: { value: 0.9 },
      decay: { value: 0.78 },
    },
    vertexShader: vertex,
    fragmentShader: `uniform sampler2D source,bloom,history;uniform float glow,decay;varying vec2 uvv;void main(){vec3 current=texture2D(source,uvv).rgb+texture2D(bloom,uvv).rgb*glow*2.;vec3 old=texture2D(history,uvv).rgb;gl_FragColor=vec4(max(current,old*decay),1.);}`,
  });
  const output = new T.ShaderMaterial({
    uniforms: {
      source: { value: null },
      transparent: { value: transparent ? 1 : 0 },
    },
    vertexShader: vertex,
    fragmentShader: `uniform sampler2D source;uniform float transparent;varying vec2 uvv;void main(){vec3 c=1.-exp(-texture2D(source,uvv).rgb*1.3);c=pow(c,vec3(1./2.2));float a=clamp(max(c.r,max(c.g,c.b))*1.5,0.,1.);if(transparent>.5){gl_FragColor=vec4(c/max(a,.001),a);}else{vec3 bg=vec3(.018,.024,.046)*(1.-length(uvv-.5)*.65);gl_FragColor=vec4(c+bg,1.);}}`,
  });
  function pass(mat, out) {
    quad.material = mat;
    renderer.setRenderTarget(out);
    renderer.render(postScene, postCamera);
  }
  function resize() {
    const w = innerWidth,
      h = innerHeight;
    const ratio = Math.min(devicePixelRatio, 1.5) * renderScale;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.pixel.value = ratio;
    raw.setSize(Math.ceil(w * ratio), Math.ceil(h * ratio));
    for (const rt of [history, next]) {
      rt.setSize(raw.width, raw.height);
      renderer.setRenderTarget(rt);
      renderer.clear();
    }
    for (const rt of [blurA, blurB])
      rt.setSize(
        Math.max(1, Math.ceil(raw.width / 2)),
        Math.max(1, Math.ceil(raw.height / 2)),
      );
    renderer.setRenderTarget(null);
  }
  window.addEventListener("resize", resize);
  $("scale").onchange = () => {
    renderScale = +$("scale").value;
    resize();
  };
  resize();
  let last = performance.now(),
    time = 0,
    frames = 0,
    elapsed = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const wallDt = (now - last) / 1000;
    const dt = Math.min(0.05, wallDt);
    last = now;
    if (paused) return;
    time += dt;
    audio.update(dt, time);
    uniforms.time.value = time;
    for (const [key, value] of Object.entries({
      bass: audio.bass,
      mids: audio.mid,
      high: audio.high,
      energy: audio.energy,
      beat: audio.beat,
    }))
      uniforms[key].value = Math.min(2, value * gain);
    for (let i = 0; i < 128; i++) fftData[i] = audio.spectrum[i] * gain;
    fft.needsUpdate = true;
    renderer.setRenderTarget(raw);
    renderer.render(scene, camera);
    blur.uniforms.source.value = raw.texture;
    blur.uniforms.stepSize.value.set(1 / blurA.width, 0);
    pass(blur, blurA);
    blur.uniforms.source.value = blurA.texture;
    blur.uniforms.stepSize.value.set(0, 1 / blurA.height);
    pass(blur, blurB);
    combine.uniforms.history.value = history.texture;
    combine.uniforms.glow.value = +$("glow").value;
    combine.uniforms.decay.value = Math.pow(+$("trail").value, dt * 60);
    pass(combine, next);
    [history, next] = [next, history];
    output.uniforms.source.value = history.texture;
    pass(output, null);
    $("beat").style.opacity = 0.2 + audio.beat * 0.8;
    frames++;
    elapsed += wallDt;
    if (elapsed > 1) {
      $("stats").textContent =
        `${Math.round(frames / elapsed)} FPS · ${count.toLocaleString()} particles · WebGL2 · ${raw.width}×${raw.height}`;
      frames = 0;
      elapsed = 0;
    }
  }
  requestAnimationFrame(frame);
}
