/* Infinity Fragrances Hub - desktop shell */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
const PKG = require('./package.json'), NAME = 'Infinity Fragrances Hub', http = require('http'), crypto = require('crypto');
/* Hub updates must carry a signature made with keystore/update-signing.pem; this is its public half. */
const UPD_URL = 'https://raw.githubusercontent.com/infinitytimetable/infinity-fragrances-updates/main/';
const UPD_PUB = '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEeYSbfdTjRzEzKBMT/bv2vSLiTKvt\nLfTL6LzBj4nAsR14ZeQFfnMB4axPHSUo3VXvVA4oFVnD8lUiF4TcE1cang==\n-----END PUBLIC KEY-----\n';
function updSigOk(html, b64) {
  try { const sig = Buffer.from(String(b64 || ''), 'base64'); if (sig.length !== 64) return false;
    return crypto.verify('sha256', Buffer.from(String(html), 'utf8'), { key: UPD_PUB, dsaEncoding: 'ieee-p1363' }, sig); } catch (e) { return false; }
}
async function officialSig() { const r = await fetch(UPD_URL + 'version.json?t=' + Date.now(), { cache: 'no-store' }); const m = await r.json(); return (m && m.desktop && m.desktop.sig) || ''; }
app.setName(NAME);
if (process.platform === 'win32') app.setAppUserModelId('zm.infinityfragrances.hub');
if (!app.requestSingleInstanceLock()) { app.quit(); }

const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
function getCfg() { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch (e) { return {}; } }
function setCfg(p) { const c = { ...getCfg(), ...p }; fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(c, null, 1)); return c; }
const dataDir = () => getCfg().dataDir || path.join(app.getPath('documents'), NAME);
const dataFile = () => path.join(dataDir(), 'data.json');
const baseFile = () => path.join(dataDir(), 'sync-base.json');
const backupDir = () => path.join(dataDir(), 'backups');
const pad = n => String(n).padStart(2, '0');
const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
function writeAtomic(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }
function listBackups() { try { return fs.readdirSync(backupDir()).filter(f => /^data-.*\.json$/.test(f)).sort(); } catch (e) { return []; } }
function backupNow(tag) {
  if (!fs.existsSync(dataFile())) return null;
  fs.mkdirSync(backupDir(), { recursive: true });
  const f = path.join(backupDir(), `data-${stamp()}${tag ? '-' + tag : ''}.json`); fs.copyFileSync(dataFile(), f);
  const all = listBackups(); all.slice(0, Math.max(0, all.length - 30)).forEach(x => { try { fs.unlinkSync(path.join(backupDir(), x)); } catch (e) {} });
  return f;
}
const today = () => stamp().slice(0, 10);
const info = () => ({ dataFile: dataFile(), dataDir: dataDir(), savedAt: fs.existsSync(dataFile()) ? fs.statSync(dataFile()).mtime.toISOString() : '', backups: listBackups().length, installed: isInstalled(), version: PKG.version });

/* ---------- install / uninstall (Windows) ---------- */
const installDir = () => path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'Programs', NAME);
const exeDir = () => path.dirname(process.execPath);
const isInstalled = () => process.platform === 'win32' && exeDir().toLowerCase() === installDir().toLowerCase();
const installedVersion = () => { try { const exe = path.join(installDir(), path.basename(process.execPath)); if (!fs.existsSync(exe)) return ''; try { return JSON.parse(fs.readFileSync(path.join(installDir(), 'resources', 'app', 'package.json'), 'utf8')).version || '0.0.0'; } catch (e) { return '0.0.0'; } } catch (e) { return ''; } };
const shortcutPaths = () => [path.join(app.getPath('desktop'), NAME + '.lnk'), path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', NAME + '.lnk')];
function makeShortcuts(exe) {
  const icon = path.join(path.dirname(exe), 'resources', 'app', 'icon.ico');
  for (const p of shortcutPaths()) { try { fs.mkdirSync(path.dirname(p), { recursive: true }); shell.writeShortcutLink(p, 'create', { target: exe, cwd: path.dirname(exe), icon, iconIndex: 0, description: NAME, appUserModelId: 'zm.infinityfragrances.hub' }); } catch (e) {} }
}
async function install() {
  if (process.platform !== 'win32') { dialog.showMessageBox({ message: 'Installing is only needed on Windows.' }); return false; }
  if (isInstalled()) { makeShortcuts(process.execPath); return true; }
  try {
    const target = installDir(); fs.mkdirSync(target, { recursive: true });
    fs.cpSync(exeDir(), target, { recursive: true, force: true });
    const exe = path.join(target, path.basename(process.execPath)); makeShortcuts(exe);
    setCfg({ installedAt: new Date().toISOString() });
    await dialog.showMessageBox({ type: 'info', title: NAME, message: 'Infinity Fragrances Hub is installed.', detail: 'You will find it on your desktop and in the Start menu. It will now open from there. You can delete the folder you downloaded.' });
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref(); app.quit(); return true;
  } catch (e) { dialog.showErrorBox(NAME, 'Could not install: ' + e.message); return false; }
}
function uninstall() {
  shortcutPaths().forEach(p => { try { fs.unlinkSync(p); } catch (e) {} });
  if (isInstalled()) spawn('cmd.exe', ['/c', `timeout /t 3 /nobreak > nul & rmdir /s /q "${installDir()}"`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  dialog.showMessageBoxSync({ type: 'info', message: 'Infinity Fragrances Hub has been removed.', detail: `Your records are still in ${dataDir()}.` });
  app.quit();
}

/* ---------- which screen to load (bundled or an installed update) ---------- */
const verOf = html => (String(html).match(/const APP_VERSION = '([\d.]+)'/) || [])[1] || '0';
const cmpVer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
function uiFile() {
  const upd = path.join(app.getPath('userData'), 'ui', 'index.html'), bundled = path.join(__dirname, 'index.html');
  try { if (fs.existsSync(upd) && cmpVer(verOf(fs.readFileSync(upd, 'utf8')), verOf(fs.readFileSync(bundled, 'utf8'))) > 0) return upd; } catch (e) {}
  return bundled;
}

/* ---------- local web server (gives the page a proper web address so online accounts work) ---------- */
let BASE_URL = '';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let u = decodeURIComponent((req.url || '/').split('?')[0]);
      if (u === '/projector.html') { const d = PROJ ? PROJ.page() : ''; if (!d) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }); return res.end(d); }
      if (u === '/' || u === '/index.html') { res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }); return fs.createReadStream(uiFile()).pipe(res); }
      const f = path.join(__dirname, path.normalize(u).replace(/^([\\/])+/, ''));
      if (!f.startsWith(__dirname) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    });
    const go = port => srv.listen(port, '127.0.0.1', () => { BASE_URL = `http://127.0.0.1:${srv.address().port}/`; resolve(); });
    srv.on('error', () => { srv.removeAllListeners('error'); go(0); });
    go(47831);
  });
}

/* ---------- window ---------- */
let win;
const PROJ = require('./projector')({ getMain: () => win, getBase: () => BASE_URL });
function createWindow() {
  const wsFile = path.join(app.getPath('userData'), 'window.json'); let ws = {}; try { ws = JSON.parse(fs.readFileSync(wsFile, 'utf8')); } catch (e) {}
  const { screen } = require('electron'); const wa = screen.getPrimaryDisplay().workAreaSize;
  const okBounds = ws.width && ws.height && ws.width <= wa.width + 50 && ws.height <= wa.height + 50;
  win = new BrowserWindow({ width: okBounds ? ws.width : Math.min(1366, wa.width), height: okBounds ? ws.height : Math.min(860, wa.height), ...(okBounds && ws.x != null ? { x: ws.x, y: ws.y } : {}), minWidth: 380, minHeight: 520, title: `${NAME} ${PKG.version}`, icon: path.join(__dirname, 'icon.png'), backgroundColor: '#f6f3ec', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false } });
  win.once('ready-to-show', () => { if (!okBounds || ws.maximized !== false) win.maximize(); win.show(); });
  const saveWs = () => { try { const b = win.isMaximized() ? win.getNormalBounds() : win.getBounds(); fs.writeFileSync(wsFile, JSON.stringify({ ...b, maximized: win.isMaximized() })); } catch (e) {} };
  win.on('close', saveWs);
  win.on('closed', () => { try { PROJ.close(); } catch (e) {} });
  win.webContents.on('did-start-loading', () => { try { PROJ.close(); } catch (e) {} });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto|tel|whatsapp):/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(BASE_URL)) { e.preventDefault(); shell.openExternal(url); } });
  win.on('page-title-updated', e => e.preventDefault());
  win.loadURL(BASE_URL + 'index.html');
}
function menu() {
  const tpl = [
    { label: 'File', submenu: [
      { label: 'Back up now', click: () => { const f = backupNow('manual'); dialog.showMessageBox(win, { message: f ? 'Backup saved.' : 'Nothing to back up yet.', detail: f || '' }); } },
      { label: 'Open records folder', click: () => shell.openPath(dataDir()) },
      { type: 'separator' }, { role: 'quit', label: 'Exit' } ] },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'togglefullscreen' }, ...(process.env.IF_DEV ? [{ role: 'toggleDevTools' }] : [])] },
    { label: 'Help', submenu: [{ label: `About ${NAME}`, click: () => dialog.showMessageBox(win, { title: NAME, message: `${NAME} ${PKG.version}`, detail: `Records folder:\n${dataDir()}\n\nSmell good. Live infinitely.` }) }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------- IPC ---------- */
ipcMain.handle('load', () => ({ data: fs.existsSync(dataFile()) ? fs.readFileSync(dataFile(), 'utf8') : null, base: fs.existsSync(baseFile()) ? fs.readFileSync(baseFile(), 'utf8') : null, info: info() }));
ipcMain.handle('save', (e, text) => {
  writeAtomic(dataFile(), text);
  const c = getCfg(); if (c.lastAutoBackup !== today()) { backupNow('auto'); setCfg({ lastAutoBackup: today() }); }
  return info();
});
ipcMain.on('save-sync', (e, text) => { try { writeAtomic(dataFile(), text); e.returnValue = true; } catch (x) { e.returnValue = false; } });
ipcMain.handle('save-base', (e, text) => { writeAtomic(baseFile(), text); return true; });
ipcMain.handle('backup', () => { backupNow('manual'); return info(); });
ipcMain.handle('backup-to', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose your flash drive or a folder', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0] || !fs.existsSync(dataFile())) return null;
  const f = path.join(r.filePaths[0], `Infinity-Fragrances-backup-${stamp()}.json`); fs.copyFileSync(dataFile(), f); return f;
});
ipcMain.handle('pick-backup', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a backup', defaultPath: backupDir(), filters: [{ name: 'Backups', extensions: ['json'] }], properties: ['openFile'] });
  return r.canceled || !r.filePaths[0] ? null : fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('open-folder', () => { fs.mkdirSync(dataDir(), { recursive: true }); return shell.openPath(dataDir()); });
ipcMain.handle('move-folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose where to keep your records', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return false;
  const to = r.filePaths[0], from = dataDir(); if (path.resolve(to) === path.resolve(from)) return false;
  if (fs.existsSync(path.join(to, 'data.json'))) {
    const a = await dialog.showMessageBox(win, { type: 'question', buttons: ['Use the records in that folder', 'Cancel'], message: 'That folder already has records.', detail: 'Open the records found there instead of the current ones? The current folder is not deleted.' });
    if (a.response !== 0) return false;
  } else { for (const f of ['data.json', 'sync-base.json']) if (fs.existsSync(path.join(from, f))) fs.copyFileSync(path.join(from, f), path.join(to, f)); if (fs.existsSync(backupDir())) fs.cpSync(backupDir(), path.join(to, 'backups'), { recursive: true }); }
  setCfg({ dataDir: to }); return true;
});
ipcMain.handle('save-as', async (e, name, payload) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), name) });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, payload.b64 != null ? Buffer.from(payload.b64, 'base64') : payload.text); return r.filePath;
});
ipcMain.handle('print-html', async (e, html) => {
  const f = path.join(os.tmpdir(), `if-print-${Date.now()}.html`); fs.writeFileSync(f, html);
  const p = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await p.loadFile(f); await new Promise(r => setTimeout(r, 400));
  return new Promise(res => p.webContents.print({ printBackground: true }, (ok, why) => { p.destroy(); try { fs.unlinkSync(f); } catch (x) {} res(ok || why); }));
});
ipcMain.handle('get-config', () => getCfg());
ipcMain.handle('set-config', (e, p) => setCfg(p));
ipcMain.handle('install-update', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose the update file', filters: [{ name: 'Hub update', extensions: ['html', 'ifupdate'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const html = fs.readFileSync(r.filePaths[0], 'utf8'), v = verOf(html);
  if (v === '0' || !html.includes('IFDesktop')) { dialog.showErrorBox(NAME, 'That is not an Infinity Fragrances Hub update file.'); return null; }
  let sig = ''; try { sig = await officialSig(); } catch (e) { dialog.showErrorBox(NAME, 'Connect to the internet so the update file can be checked, then try again.'); return null; }
  if (!updSigOk(html, sig)) { dialog.showErrorBox(NAME, 'This file did not pass its security check, so it was not installed. Use Check for updates instead.'); return null; }
  const cur = verOf(fs.readFileSync(uiFile(), 'utf8'));
  if (cmpVer(v, cur) <= 0) { dialog.showMessageBox(win, { message: `You already have version ${cur}.`, detail: `The file is version ${v}.` }); return null; }
  backupNow('before-update'); writeAtomic(path.join(app.getPath('userData'), 'ui', 'index.html'), html); return v;
});
ipcMain.handle('install-update-text', (e, html, sig) => {
  try { const v = verOf(html); if (v === '0' || !String(html).includes('IFDesktop')) return { error: 'That is not an Infinity Fragrances Hub update.' };
    if (!updSigOk(html, sig)) return { error: 'The update did not pass its security check, so it was not installed.' };
    const cur = verOf(fs.readFileSync(uiFile(), 'utf8')); if (cmpVer(v, cur) <= 0) return { error: `You already have version ${cur}.` };
    backupNow('before-update'); writeAtomic(path.join(app.getPath('userData'), 'ui', 'index.html'), html); return { version: v }; } catch (x) { return { error: String(x.message || x) }; }
});
ipcMain.handle('shell-version', () => PKG.version);
ipcMain.handle('relaunch', () => { app.relaunch(); app.exit(0); });
ipcMain.handle('install', () => install());
ipcMain.handle('uninstall', () => uninstall());

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(async () => {
  const c = getCfg(); if (!c.firstRun) setCfg({ firstRun: today() });
  menu();
  if (process.platform === 'win32' && !isInstalled() && !process.env.IF_NO_INSTALL) {
    const iv = installedVersion(), newer = iv && cmpVer(PKG.version, iv) > 0;
    if (!c.askedInstall || newer) {
      setCfg({ askedInstall: true });
      const a = await dialog.showMessageBox(newer
        ? { type: 'question', title: NAME, buttons: ['Update', 'Just open it'], defaultId: 0, message: `Update Infinity Fragrances Hub from ${iv} to ${PKG.version}?`, detail: 'Your records are kept. This replaces the old program and puts the icons on your desktop and Start menu again. If the hub is open in another window, close it first.' }
        : { type: 'question', title: NAME, buttons: ['Install', 'Just open it'], defaultId: 0, message: 'Install Infinity Fragrances Hub on this computer?', detail: 'This adds an icon to your desktop and Start menu. Your records are kept in Documents\\Infinity Fragrances Hub.' });
      if (a.response === 0 && await install()) return;
    }
  }
  await startServer();
  createWindow();
});
app.on('before-quit', () => { try { backupNow('close'); } catch (e) {} });
app.on('window-all-closed', () => app.quit());
