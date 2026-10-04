const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Notes storage directory
const NOTES_DIR = path.join(os.homedir(), 'StukjeNotes');

function ensureNotesDir() {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
  }
}

function createWindow() {
  ensureNotesDir();

  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0a0a',
    show: false,
    icon: path.join(__dirname, '..', 'stukjeIcon.png'),
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });

  // Remove default menu
  Menu.setApplicationMenu(null);
}

// IPC Handlers

ipcMain.handle('notes:list', () => {
  ensureNotesDir();
  try {
    const files = fs.readdirSync(NOTES_DIR)
      .filter(f => f.endsWith('.stukje'))
      .map(f => {
        const filePath = path.join(NOTES_DIR, f);
        const stat = fs.statSync(filePath);
        const raw = fs.readFileSync(filePath, 'utf-8');
        let title = f.replace('.stukje', '');
        let content = raw;
        // Try to parse JSON format
        try {
          const parsed = JSON.parse(raw);
          title = parsed.title || title;
          content = parsed.content || '';
        } catch {}
        return {
          id: f.replace('.stukje', ''),
          title,
          preview: content.slice(0, 100).replace(/\n/g, ' '),
          modified: stat.mtime.toISOString(),
          filename: f,
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    return { ok: true, notes: files };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('notes:load', (_, id) => {
  ensureNotesDir();
  try {
    const filePath = path.join(NOTES_DIR, `${id}.stukje`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      const parsed = JSON.parse(raw);
      return { ok: true, title: parsed.title || id, content: parsed.content || '' };
    } catch {
      return { ok: true, title: id, content: raw };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('notes:save', (_, { id, title, content }) => {
  ensureNotesDir();
  try {
    // Sanitize filename
    const safeId = id || `note_${Date.now()}`;
    const filePath = path.join(NOTES_DIR, `${safeId}.stukje`);
    const data = JSON.stringify({ title, content, saved: new Date().toISOString() }, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    return { ok: true, id: safeId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('notes:delete', (_, id) => {
  ensureNotesDir();
  try {
    const filePath = path.join(NOTES_DIR, `${id}.stukje`);
    fs.unlinkSync(filePath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('notes:export', async (_, { title, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Note',
    defaultPath: `${title || 'note'}.txt`,
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    const output = `${title}\n${'─'.repeat(Math.min(title.length, 60))}\n\n${content}`;
    fs.writeFileSync(filePath, output, 'utf-8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('notes:import-txt', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import TXT File',
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return { ok: false, canceled: true };
  try {
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    const title = path.basename(filePath, '.txt');
    return { ok: true, title, content };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('notes:new-id', () => {
  return `note_${Date.now()}`;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
