/* Shop screen projector: a second window for the TV. The hub (main window) sends it the page and the slides;
   this file only opens, places and closes the window. Nothing here reads or writes business records. */
const { BrowserWindow, ipcMain, screen, powerSaveBlocker } = require('electron');
const path = require('path');

module.exports = function setupProjector({ getMain, getBase }) {
  let pw = null, doc = '', last = null, psb = -1, label = '';
  const alive = w => !!w && !w.isDestroyed();
  const fromMain = e => { const m = getMain(); return alive(m) && e.sender === m.webContents; };
  const fromProj = e => alive(pw) && e.sender === pw.webContents;
  const nameOf = (d, i, prim) => `Screen ${i + 1}: ${d.size.width}×${d.size.height}${d.id === prim ? ' (main screen)' : ''}`;

  function displays() {
    const prim = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, i) => ({ id: String(d.id), label: nameOf(d, i, prim), primary: d.id === prim, w: d.size.width, h: d.size.height }));
  }
  function close() {
    last = null;
    if (alive(pw)) { const w = pw; pw = null; w.__quiet = true; try { w.close(); } catch (e) {} }
    if (psb >= 0) { try { powerSaveBlocker.stop(psb); } catch (e) {} psb = -1; }
  }
  function open(o) {
    close();
    doc = String((o && o.html) || ''); if (!doc) return { ok: false, error: 'No page to show.' };
    const all = screen.getAllDisplays(), prim = screen.getPrimaryDisplay(), want = o && o.displayId;
    let d = null;
    if (want === 'window') d = null;
    else if (want && want !== 'auto') d = all.find(x => String(x.id) === String(want)) || null;
    else d = all.find(x => x.id !== prim.id) || null;               // automatic: the first screen that is not your main one
    const opts = { show: false, backgroundColor: '#000000', autoHideMenuBar: true, title: 'Shop screen', icon: path.join(__dirname, 'icon.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false, additionalArguments: ['--if-proj'] } };
    let mode = 'window';
    if (d) { Object.assign(opts, { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height, frame: false }); mode = 'fullscreen'; }
    else Object.assign(opts, { width: 1280, height: 720, useContentSize: true });
    const w = pw = new BrowserWindow(opts);
    label = d ? nameOf(d, all.indexOf(d), prim.id) : 'a window on this computer';
    w.removeMenu(); w.setMenuBarVisibility(false);
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.webContents.on('will-navigate', e => e.preventDefault());
    w.webContents.on('did-finish-load', () => { if (alive(w) && last) w.webContents.send('proj-msg', last); });
    w.once('ready-to-show', () => { if (!alive(w)) return; w.show(); if (mode === 'fullscreen') w.setFullScreen(true); });
    w.on('closed', () => {
      if (pw === w) pw = null;
      if (psb >= 0) { try { powerSaveBlocker.stop(psb); } catch (e) {} psb = -1; }
      if (w.__quiet) return;                                   // closed by the hub itself, so the hub already knows
      const m = getMain(); if (alive(m)) m.webContents.send('proj-event', { type: 'closed' });
    });
    try { psb = powerSaveBlocker.start('prevent-display-sleep'); } catch (e) {}
    w.loadURL(getBase() + 'projector.html?t=' + Date.now());
    return { ok: true, mode, label };
  }

  ipcMain.handle('proj-displays', e => (fromMain(e) ? displays() : []));
  ipcMain.handle('proj-open', (e, o) => (fromMain(e) ? open(o) : { ok: false, error: 'Not allowed.' }));
  ipcMain.handle('proj-close', e => { if (fromMain(e)) close(); return true; });
  ipcMain.handle('proj-state', e => (fromMain(e) ? { open: alive(pw), label: alive(pw) ? label : '' } : { open: false }));
  ipcMain.on('proj-send', (e, m) => { if (!fromMain(e) || !m) return; if (m.type === 'data') last = m; if (alive(pw)) pw.webContents.send('proj-msg', m); });
  ipcMain.on('proj-ctl', (e, c) => {
    if (!fromProj(e)) return;
    if (c === 'fs') pw.setFullScreen(!pw.isFullScreen());
    else if (c === 'close') pw.close();
  });
  return { page: () => doc, close, isOpen: () => alive(pw) };
};
