const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('IFDesktop', {
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
  uninstall: () => call('uninstall')
});
