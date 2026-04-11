'use strict';

const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Fix Windows 10/11 toast notification sender name (shows "Frieren Chronomark" instead of "electron.app.Electron")
app.setName('Frieren Chronomark');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.frieren.chronomark');
}

let mainWindow;
let tray = null;
let runInBackground = false;  // controlled by renderer settings

function getOrCreateTray() {
  if (tray) return tray;
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip('Frieren Chronomark');
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => { runInBackground = false; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  } catch (e) {
    console.error('Tray creation error:', e);
  }
  return tray;
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    resizable: false,
    frame: false,
    // titleBarStyle is not applicable when frame is false (custom title bar is rendered in HTML)
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: false
    },
    backgroundColor: '#050510',
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Strip "Electron/..." from the User-Agent so YouTube and Spotify embeds work.
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const ua = details.requestHeaders['User-Agent'];
    if (ua) {
      details.requestHeaders['User-Agent'] = ua.replace(/\s*Electron\/[\d.]+/, '');
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // Set Content-Security-Policy header for the main app page only.
  // We intentionally skip non-file:// URLs so that embedded iframes
  // (Spotify, YouTube, etc.) receive their own CSP from their servers
  // and can load their scripts, styles and media without interference.
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith('file://')) {
      callback({});
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "frame-src https://www.youtube.com https://youtube.com https://open.spotify.com https://w.soundcloud.com https://soundcloud.com; " +
          "img-src * blob: data:; " +
          "media-src * blob: data:; " +
          "connect-src 'self' blob: https://open.spotify.com https://*.spotify.com https://*.scdn.co https://api.openai.com https://generativelanguage.googleapis.com https://api.groq.com; " +
          "font-src 'self' data: https://fonts.gstatic.com; " +
          "worker-src blob: 'self';"
        ]
      }
    });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Intercept close: minimize to tray if runInBackground is enabled
  mainWindow.on('close', (e) => {
    if (runInBackground) {
      e.preventDefault();
      mainWindow.hide();
      getOrCreateTray();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Read data from userData file
ipcMain.handle('store-read', async (event, key) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, `${key}.json`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return null;
  } catch (e) {
    console.error('store-read error:', e);
    return null;
  }
});

// IPC: Write data to userData file
ipcMain.handle('store-write', async (event, key, data) => {
  try {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    const filePath = path.join(userDataPath, `${key}.json`);
    fs.writeFileSync(filePath, data, 'utf8');
    return true;
  } catch (e) {
    console.error('store-write error:', e);
    return false;
  }
});

// IPC: Delete a userData file
ipcMain.handle('store-remove', async (event, key) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, `${key}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (e) {
    console.error('store-remove error:', e);
    return false;
  }
});

// IPC: Open Spotify login window (shares default session so cookies persist to iframe)
ipcMain.handle('open-spotify-window', async (event) => {
  const win = new BrowserWindow({
    width: 960,
    height: 700,
    parent: mainWindow,
    title: 'Spotify',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadURL('https://open.spotify.com');
  return true;
});

// IPC: Show OS notification
ipcMain.handle('show-notification', async (event, title, body) => {
  try {
    if (Notification.isSupported()) {
      const notif = new Notification({
        title,
        body,
        icon: path.join(__dirname, 'assets', 'icon.ico')
      });
      notif.show();
    }
  } catch (e) {
    console.error('show-notification error:', e);
  }
});

// IPC: Window controls
ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// IPC: Run in background (minimize to tray on close)
ipcMain.on('set-run-in-background', (event, enabled) => {
  runInBackground = !!enabled;
  if (enabled) {
    getOrCreateTray();
  } else {
    destroyTray();
  }
});

// IPC: Launch on startup
ipcMain.handle('set-launch-on-startup', async (event, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      name: 'Frieren Chronomark'
    });
    return true;
  } catch (e) {
    console.error('set-launch-on-startup error:', e);
    return false;
  }
});

ipcMain.handle('get-launch-on-startup', async () => {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch (e) {
    return false;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // If minimized to tray, don't quit
  if (runInBackground) return;
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
