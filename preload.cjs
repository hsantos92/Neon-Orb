const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("orb", {
  sources: () => ipcRenderer.invoke("sources"),
  capture: (name) => ipcRenderer.invoke("capture", name),
  stop: () => ipcRenderer.invoke("stop"),
  mode: (value) => ipcRenderer.invoke("window-mode", value),
  close: () => ipcRenderer.invoke("close"),
  onPCM: (fn) => ipcRenderer.on("pcm", (_, data) => fn(data)),
  onError: (fn) => ipcRenderer.on("audio-error", (_, message) => fn(message)),
});
