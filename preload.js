'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aureole', {
  storeRead: (key) => ipcRenderer.invoke('store-read', key),
  storeWrite: (key, data) => ipcRenderer.invoke('store-write', key, data),
  storeRemove: (key) => ipcRenderer.invoke('store-remove', key),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window')
});
