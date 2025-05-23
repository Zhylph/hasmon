const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const log = require('electron-log');
const { Op } = require('sequelize');

// Configure logging
log.transports.file.level = 'info';
log.info('Application starting...');

// Database models
const db = require('./src/models');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icons/win/icon.ico')
  });

  // Load the index.html file
  mainWindow.loadFile('src/views/login.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(async () => {
  try {
    // Initialize database connection
    await db.sequelize.sync();
    log.info('Database connected successfully');

    createWindow();
  } catch (error) {
    log.error('Failed to connect to database:', error);
    dialog.showErrorBox(
      'Database Connection Error',
      'Failed to connect to the database. Please make sure MySQL is running.'
    );
  }
});

// Handle app before quit - we no longer close active SIMRS sessions automatically
// Sessions should only be closed when user explicitly logs out
app.on('before-quit', async () => {
  try {
    // Log that the application is closing but don't change session status
    log.info('Application closing - active SIMRS sessions remain active');
  } catch (error) {
    log.error('Error during application quit:', error);
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for authentication
ipcMain.handle('login', async (_, credentials) => {
  try {
    const { username, password } = credentials;
    const user = await db.User.findOne({
      where: { username },
      include: [{ model: db.UnitKerja }]
    });

    if (!user) {
      return { success: false, message: 'Username atau password salah' };
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      // Log failed login attempt
      await db.LoginAttempt.create({
        user_id: user.id,
        ip_address: '127.0.0.1', // Local app
        success: false
      });

      return { success: false, message: 'Username atau password salah' };
    }

    // Log successful login
    await db.LoginAttempt.create({
      user_id: user.id,
      ip_address: '127.0.0.1', // Local app
      success: true
    });

    // Return user data (excluding password)
    const userData = user.toJSON();
    delete userData.password;

    return {
      success: true,
      user: userData
    };
  } catch (error) {
    log.error('Login error:', error);
    return { success: false, message: 'Terjadi kesalahan saat login' };
  }
});

// IPC handler for running SIMRS
ipcMain.handle('run-simrs', async (_, userId) => {
  try {
    // Get user with SIMRS path
    const user = await db.User.findByPk(userId);
    if (!user || !user.simrs_path) {
      return {
        success: false,
        message: 'Path SIMRS tidak ditemukan. Silakan update profil Anda dengan path SIMRS yang benar.'
      };
    }

    // We no longer close active sessions when starting a new one
    // This ensures sessions remain active until explicit logout
    log.info(`Starting new SIMRS session for user ${userId} without closing existing sessions`);

    // Log new SIMRS usage
    const logEntry = await db.SimrsUsage.create({
      user_id: userId,
      unit_kerja_id: user.unit_kerja_id,
      ip_address: '127.0.0.1',
      start_time: new Date(),
      status: 'active'
    });

    // Run the SIMRS application
    const simrsPath = user.simrs_path;

    // Check if file exists
    if (!fs.existsSync(simrsPath)) {
      // Update the log entry to closed since SIMRS couldn't be launched
      await logEntry.update({
        status: 'closed',
        end_time: new Date(),
        notes: `File tidak ditemukan: ${simrsPath}`
      });

      return {
        success: false,
        message: `File SIMRS tidak ditemukan di lokasi: ${simrsPath}`
      };
    }

    // Get directory and filename
    const simrsDir = path.dirname(simrsPath);
    const simrsFile = path.basename(simrsPath);

    // Create command to run SIMRS with visible CMD window
    const command = `start cmd.exe /K "cd /d "${simrsDir}" && "${simrsFile}""`;

    // Execute command
    exec(command, (error) => {
      if (error) {
        // Update the log entry to closed since there was an error
        logEntry.update({
          status: 'closed',
          end_time: new Date(),
          notes: `Error: ${error.message}`
        });

        log.error('Error running SIMRS:', error);
        return { success: false, message: `Error running SIMRS: ${error.message}` };
      }
    });

    return {
      success: true,
      message: 'SIMRS berhasil dijalankan',
      log_id: logEntry.id
    };
  } catch (error) {
    log.error('Error running SIMRS:', error);
    return { success: false, message: 'Terjadi kesalahan saat menjalankan SIMRS' };
  }
});

// IPC handler for closing SIMRS session
ipcMain.handle('close-simrs', async (_, logId) => {
  try {
    const usage = await db.SimrsUsage.findByPk(logId);
    if (!usage) {
      return {
        success: false,
        message: 'Sesi SIMRS tidak ditemukan'
      };
    }

    if (usage.status === 'closed') {
      return {
        success: true,
        message: 'Sesi SIMRS sudah ditutup sebelumnya'
      };
    }

    usage.end_time = new Date();
    usage.status = 'closed';
    await usage.save();

    return {
      success: true,
      message: 'Sesi SIMRS berhasil ditutup',
      usage: {
        id: usage.id,
        status: usage.status,
        end_time: usage.end_time
      }
    };
  } catch (error) {
    log.error('Error closing SIMRS session:', error);
    return { success: false, message: 'Terjadi kesalahan saat menutup sesi SIMRS' };
  }
});

// IPC handler for updating user profile
ipcMain.handle('update-profile', async (_, userData) => {
  try {
    const user = await db.User.findByPk(userData.id);
    if (!user) {
      return { success: false, message: 'User tidak ditemukan' };
    }

    await user.update(userData);

    // Return updated user data (excluding password)
    const updatedUser = user.toJSON();
    delete updatedUser.password;

    return {
      success: true,
      message: 'Profil berhasil diperbarui',
      user: updatedUser
    };
  } catch (error) {
    log.error('Error updating profile:', error);
    return { success: false, message: 'Terjadi kesalahan saat memperbarui profil' };
  }
});

// IPC handler for registering new user
ipcMain.handle('register', async (_, userData) => {
  try {
    // Check if username already exists
    const existingUsername = await db.User.findOne({ where: { username: userData.username } });
    if (existingUsername) {
      return { success: false, message: 'Username sudah digunakan' };
    }

    // Check if email already exists
    const existingEmail = await db.User.findOne({ where: { email: userData.email } });
    if (existingEmail) {
      return { success: false, message: 'Email sudah digunakan' };
    }

    // Create new user
    const newUser = await db.User.create(userData);

    // Return user data (excluding password)
    const createdUser = newUser.toJSON();
    delete createdUser.password;

    return {
      success: true,
      message: 'Registrasi berhasil',
      user: createdUser
    };
  } catch (error) {
    log.error('Registration error:', error);
    return { success: false, message: 'Terjadi kesalahan saat registrasi' };
  }
});

// IPC handler for getting all unit kerja
ipcMain.handle('get-all-unit-kerja', async () => {
  try {
    const unitKerjaList = await db.UnitKerja.findAll({
      order: [['nama', 'ASC']]
    });
    return unitKerjaList;
  } catch (error) {
    log.error('Error getting unit kerja:', error);
    return [];
  }
});

// IPC handler for getting SIMRS statistics
ipcMain.handle('get-simrs-statistics', async () => {
  try {
    // Total usage
    const totalUsage = await db.SimrsUsage.count();

    // Today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsage = await db.SimrsUsage.count({
      where: {
        start_time: {
          [Op.gte]: today
        }
      }
    });

    // Active usage
    const activeUsage = await db.SimrsUsage.count({
      where: {
        status: 'active'
      }
    });

    return {
      total: totalUsage,
      today: todayUsage,
      active: activeUsage
    };
  } catch (error) {
    log.error('Error getting SIMRS statistics:', error);
    return {
      total: 0,
      today: 0,
      active: 0
    };
  }
});

// IPC handler for getting SIMRS usage history
ipcMain.handle('get-simrs-history', async (_, userId) => {
  try {
    const history = await db.SimrsUsage.findAll({
      where: {
        user_id: userId
      },
      include: [
        { model: db.UnitKerja }
      ],
      order: [['start_time', 'DESC']],
      limit: 10
    });

    return history;
  } catch (error) {
    log.error('Error getting SIMRS history:', error);
    return [];
  }
});

// IPC handler for selecting SIMRS path
ipcMain.handle('select-simrs-path', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Executable Files', extensions: ['exe', 'bat', 'cmd', 'jar'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Pilih Aplikasi SIMRS'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return {
        success: true,
        filePath: result.filePaths[0]
      };
    }

    return { success: false };
  } catch (error) {
    log.error('Error selecting SIMRS path:', error);
    return { success: false, message: 'Terjadi kesalahan saat memilih file' };
  }
});

// Import axios for HTTP requests
const axios = require('axios');
const FormData = require('form-data');

// Helper function to check server connectivity
async function checkServerConnectivity(url = 'https://portal.rsudhabdulazizmarabahan.com/api/ping') {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    log.warn(`Server connectivity check failed: ${error.message}`);
    return false;
  }
}

// IPC handler for uploading profile photo
ipcMain.handle('upload-profile-photo', async (_, userId, photoData) => {
  try {
    // Check if user exists
    const user = await db.User.findByPk(userId);
    if (!user) {
      return { success: false, message: 'User tidak ditemukan' };
    }

    // Create assets/uploads directory if it doesn't exist (for local backup)
    const uploadsDir = path.join(__dirname, 'src', 'assets', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      log.info(`Created uploads directory: ${uploadsDir}`);
    }

    // Generate unique filename
    const fileName = `user_${userId}_${Date.now()}.jpg`;
    const filePath = path.join(uploadsDir, fileName);

    // Save the image locally as backup
    const base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, imageBuffer);
    log.info(`Saved profile photo locally to: ${filePath}`);

    // Upload to web server
    let uploadSuccess = false;

    // First check if server is reachable
    const isServerReachable = await checkServerConnectivity();

    if (isServerReachable) {
      try {
        // Create form data for file upload
        const formData = new FormData();
        formData.append('file', imageBuffer, {
          filename: fileName,
          contentType: 'image/jpeg',
        });

        // Upload to server
        const response = await axios.post(
          'https://portal.rsudhabdulazizmarabahan.com/api/upload_photo',
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              'Content-Type': 'multipart/form-data',
            },
            timeout: 10000, // 10 seconds timeout
          }
        );

        if (response.data && response.data.success) {
          uploadSuccess = true;
          log.info(`Uploaded profile photo to server: ${fileName}`);
        } else {
          log.warn(`Server upload failed but will continue with local file: ${response.data?.message || 'Unknown error'}`);
        }
      } catch (uploadError) {
        log.warn(`Error uploading to server, will continue with local file: ${uploadError.message}`);
      }
    } else {
      log.warn(`Server is not reachable, will use local file only`);
    }

    // Update user record with just the filename (not the full path)
    await user.update({ photo: fileName });
    log.info(`Updated user ${userId} with photo filename: ${fileName}`);

    // Construct the full URL for the photo
    const photoUrl = uploadSuccess
      ? `https://portal.rsudhabdulazizmarabahan.com/uploads/photos/${fileName}`
      : `../assets/uploads/${fileName}`;

    return {
      success: true,
      message: uploadSuccess
        ? 'Foto profil berhasil diupload ke server'
        : 'Foto profil disimpan secara lokal (gagal upload ke server)',
      photoPath: photoUrl,
      fileName: fileName
    };
  } catch (error) {
    log.error('Error uploading profile photo:', error);
    return { success: false, message: 'Terjadi kesalahan saat mengupload foto profil' };
  }
});
