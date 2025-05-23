const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Authentication
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    register: (userData) => ipcRenderer.invoke('register', userData),

    // User profile
    updateProfile: (userData) => ipcRenderer.invoke('update-profile', userData),

    // SIMRS operations
    runSimrs: (userId) => ipcRenderer.invoke('run-simrs', userId),
    closeSimrs: (logId) => ipcRenderer.invoke('close-simrs', logId),

    // Statistics
    getSimrsStatistics: () => ipcRenderer.invoke('get-simrs-statistics'),
    getSimrsHistory: (userId) => ipcRenderer.invoke('get-simrs-history', userId),

    // Unit Kerja
    getAllUnitKerja: () => ipcRenderer.invoke('get-all-unit-kerja'),

    // File operations
    selectSimrsPath: () => ipcRenderer.invoke('select-simrs-path'),

    // Profile photo
    uploadProfilePhoto: (userId, photoData) => ipcRenderer.invoke('upload-profile-photo', userId, photoData)
  }
);
