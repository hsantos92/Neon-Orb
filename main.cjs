const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const { execFile, spawn } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
let win, capture;
let captureVersion = 0;
let mode = process.argv.includes("--transparent") ? "transparent" : "normal";
const page = pathToFileURL(path.join(__dirname, "index.html")).href;
function command(args) {
  return new Promise((resolve, reject) =>
    execFile(
      "pactl",
      args,
      { timeout: 5000, maxBuffer: 1024 * 1024 },
      (err, out) =>
        err
          ? reject(
              new Error(
                "PipeWire unavailable: install libpulse and enable pipewire-pulse. " +
                  err.message,
              ),
            )
          : resolve(out),
    ),
  );
}
async function sources() {
  return JSON.parse(await command(["--format=json", "list", "sources"])).map(
    (s) => ({
      name: s.name,
      label: s.description || s.name,
      monitor:
        s.name.endsWith(".monitor") ||
        s.properties?.["device.class"] === "monitor",
    }),
  );
}
function stop() {
  captureVersion++;
  if (capture) {
    capture.kill();
    capture = null;
  }
}
function create(bounds) {
  win = new BrowserWindow({
    width: 1000,
    height: 850,
    minWidth: 320,
    minHeight: 320,
    ...bounds,
    frame: mode === "normal",
    transparent: mode === "transparent",
    backgroundColor: mode === "transparent" ? "#00000000" : "#070911",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile("index.html", { query: { mode } });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("closed", stop);
  if (process.argv.includes("--smoke-test")) {
    let shaderErrors = 0;
    win.webContents.on("console-message", (event) => {
      console.log("renderer:", event.message);
      if (
        /Shader Error|VALIDATE_STATUS|Error creating WebGL/.test(event.message)
      )
        shaderErrors++;
    });
    win.webContents.once("did-finish-load", () =>
      setTimeout(async () => {
        try {
          const report = await win.webContents.executeJavaScript(
            `JSON.stringify({status:document.getElementById('status').textContent,stats:document.getElementById('stats').textContent,inputs:document.getElementById('input').options.length})`,
          );
          console.log(report);
          console.log(JSON.stringify(app.getGPUFeatureStatus()));
          const image = await win.webContents.capturePage();
          require("node:fs").writeFileSync(
            path.join(__dirname, "smoke.png"),
            image.toPNG(),
          );
          app.exit(
            JSON.parse(report).stats.includes("FPS") && !shaderErrors ? 0 : 1,
          );
        } catch (err) {
          console.error(err);
          app.exit(1);
        }
      }, 6000),
    );
  }
}
function trusted(e) {
  if (e.sender !== win?.webContents || e.senderFrame.url.split("?")[0] !== page)
    throw Error("Untrusted caller");
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  create();
  ipcMain.handle("sources", async (e) => {
    trusted(e);
    return sources();
  });
  ipcMain.handle("stop", (e) => {
    trusted(e);
    stop();
  });
  ipcMain.handle("capture", async (e, name) => {
    trusted(e);
    stop();
    const version = captureVersion;
    if (!(await sources()).some((s) => s.name === name))
      throw Error("Audio device disappeared. Refresh inputs.");
    if (version !== captureVersion) throw Error("Capture request cancelled");
    const child = spawn(
      "parec",
      [
        "--device=" + name,
        "--format=float32le",
        "--rate=48000",
        "--channels=1",
        "--latency-msec=30",
        "--raw",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    capture = child;
    let tail = Buffer.alloc(0),
      stderr = "";
    child.stdout.on("data", (data) => {
      if (capture !== child) return;
      tail = Buffer.concat([tail, data]);
      while (tail.length >= 4096) {
        win?.webContents.send("pcm", tail.subarray(0, 4096));
        tail = tail.subarray(4096);
      }
    });
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
    child.on("error", (err) => {
      if (capture === child) {
        capture = null;
        win?.webContents.send("audio-error", err.message);
      }
    });
    child.on("close", (code) => {
      if (capture === child) {
        capture = null;
        win?.webContents.send(
          "audio-error",
          stderr || "Capture ended (" + code + ").",
        );
      }
    });
    return true;
  });
  ipcMain.handle("window-mode", (e, next) => {
    trusted(e);
    if (!["normal", "borderless", "transparent"].includes(next)) return;
    mode = next;
    const bounds = win.getBounds();
    stop();
    const old = win;
    create(bounds);
    old.destroy();
  });
  ipcMain.handle("close", (e) => {
    trusted(e);
    win.close();
  });
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", stop);
