'use strict';

const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
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

  // Set Content-Security-Policy header
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "frame-src https://open.spotify.com; " +
          "img-src * blob: data:; " +
          "media-src * blob: data:; " +
          "connect-src 'self'; " +
          "font-src 'self' data: https://fonts.gstatic.com;"
        ]
      }
    });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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

// IPC: Show OS notification
ipcMain.handle('show-notification', async (event, title, body) => {
  try {
    if (Notification.isSupported()) {
      const notif = new Notification({ title, body });
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
