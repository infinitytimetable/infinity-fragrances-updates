const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
const IS_PROJ = process.argv.includes('--if-proj');   // the TV window only gets the small IFProj bridge, never the hub's full one
if (!IS_PROJ) contextBridge.exposeInMainWorld('IFDesktop', {
  platform: process.platform,
  load: () => call('load'),
  save: text => call('save', text),
  saveSync: text => ipcRenderer.sendSync('save-sync', text),
  saveBase: text => call('save-base', text),
  backup: () => call('backup'),
  backupTo: () => call('backup-to'),
  pickBackup: () => call('pick-backup'),
  openFolder: () => call('open-folder'),
  moveFolder: () => call('move-folder'),
  saveAs: (name, payload) => call('save-as', name, payload),
  printHTML: html => call('print-html', html),
  getConfig: () => call('get-config'),
  setConfig: patch => call('set-config', patch),
  installUpdate: () => call('install-update'),
  relaunch: () => call('relaunch'),
  installUpdateText: (html, sig) => call('install-update-text', html, sig),
  shellVersion: () => call('shell-version'),
  install: () => call('install'),
  uninstall: () => call('uninstall'),
  /* Shop screen projector window (second screen) */
  projDisplays: () => call('proj-displays'),
  projOpen: o => call('proj-open', o),
  projSend: m => ipcRenderer.send('proj-send', m),
  projClose: () => call('proj-close'),
  projState: () => call('proj-state'),
  onProj: cb => { ipcRenderer.removeAllListeners('proj-event'); ipcRenderer.on('proj-event', (e, m) => cb(m)); }
});
/* used only by the projector window itself */
if (IS_PROJ) contextBridge.exposeInMainWorld('IFProj', {
  on: cb => { ipcRenderer.removeAllListeners('proj-msg'); ipcRenderer.on('proj-msg', (e, m) => cb(m)); },
  ctl: c => ipcRenderer.send('proj-ctl', c)
});
