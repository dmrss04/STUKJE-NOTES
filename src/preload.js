const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stukje', {
  listNotes: () => ipcRenderer.invoke('notes:list'),
  loadNote: (id) => ipcRenderer.invoke('notes:load', id),
  saveNote: (data) => ipcRenderer.invoke('notes:save', data),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', id),
  export: (data) => ipcRenderer.invoke('notes:export', data),
  importTxt: () => ipcRenderer.invoke('notes:import-txt'),
  newId: () => ipcRenderer.invoke('notes:new-id'),
});
