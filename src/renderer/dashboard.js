// Dashboard page renderer script

// Global variables
let currentUser = null;
let currentSimrsLogId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Bootstrap components
  initializeBootstrap();

  // Load user data from localStorage
  loadUserData();

  // Set up navigation
  setupNavigation();

  // Set up event listeners
  setupEventListeners();

  // Load unit kerja data for profile form - moved after loadUserData to ensure currentUser is set
  await loadUnitKerjaData();

  // Load SIMRS history
  loadSimrsHistory();
});

// Initialize Bootstrap components
function initializeBootstrap() {
  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize dropdowns
  const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
  dropdownElementList.map(function (dropdownToggleEl) {
    return new bootstrap.Dropdown(dropdownToggleEl);
  });
}

// Load user data from localStorage
function loadUserData() {
  const userData = localStorage.getItem('currentUser');

  if (!userData) {
    // Redirect to login if no user data
    window.location.href = 'login.html';
    return;
  }

  try {
    currentUser = JSON.parse(userData);

    // Update UI with user data
    document.getElementById('username-display').textContent = currentUser.username;
    document.getElementById('fullname-display').textContent = currentUser.full_name;

    // Update unit kerja info
    const unitKerjaInfo = document.getElementById('unit-kerja-info');
    if (currentUser.UnitKerja) {
      unitKerjaInfo.innerHTML = `
        <p class="text-info"><i class="fas fa-info-circle"></i> Anda akan menjalankan SIMRS sebagai petugas unit <strong>${currentUser.UnitKerja.nama}</strong></p>
      `;
    } else {
      unitKerjaInfo.innerHTML = `
        <p class="text-warning"><i class="fas fa-exclamation-circle"></i> Anda belum memiliki unit kerja. Silakan update profil Anda.</p>
      `;
    }

    // Set profile photo in navbar and other places
    if (currentUser.photo) {
      // Determine photo URL based on whether it's a full URL or just a filename
      let photoUrl;
      if (currentUser.photo.startsWith('http')) {
        // Already a full URL
        photoUrl = currentUser.photo;
      } else if (currentUser.photo.startsWith('../')) {
        // Local relative path
        photoUrl = currentUser.photo;
      } else {
        // Just a filename - construct the portal URL
        photoUrl = `https://portal.rsudhabdulazizmarabahan.com/uploads/photos/${currentUser.photo}`;
      }

      // Set photo in navbar
      const navPhotoElement = document.getElementById('nav-profile-photo');
      const navPlaceholderElement = document.getElementById('nav-profile-placeholder');

      navPhotoElement.src = photoUrl;
      navPhotoElement.onload = function() {
        navPhotoElement.classList.remove('d-none');
        navPlaceholderElement.classList.add('d-none');
      };
      navPhotoElement.onerror = function() {
        // If portal URL fails, try local backup
        if (photoUrl.includes('portal.rsudhabdulazizmarabahan.com')) {
          navPhotoElement.src = `../assets/uploads/${currentUser.photo}`;
        } else {
          navPhotoElement.classList.add('d-none');
          navPlaceholderElement.classList.remove('d-none');
        }
      };

      // Set profile photo in dashboard header
      const dashboardPhotoElement = document.getElementById('dashboard-photo');
      const dashboardPlaceholderElement = document.getElementById('dashboard-photo-placeholder');

      dashboardPhotoElement.src = photoUrl;
      dashboardPhotoElement.onload = function() {
        dashboardPhotoElement.classList.remove('d-none');
        dashboardPlaceholderElement.classList.add('d-none');
      };
      dashboardPhotoElement.onerror = function() {
        // If portal URL fails, try local backup
        if (photoUrl.includes('portal.rsudhabdulazizmarabahan.com')) {
          dashboardPhotoElement.src = `../assets/uploads/${currentUser.photo}`;
        } else {
          dashboardPhotoElement.classList.add('d-none');
          dashboardPlaceholderElement.classList.remove('d-none');
        }
      };

      // Store the photo URL for later use
      currentUser.photoUrl = photoUrl;
    }

    // Fill profile form
    fillProfileForm();

    // Check for active SIMRS session
    checkActiveSimrsSession();
  } catch (error) {
    console.error('Error parsing user data:', error);
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  }
}

// Check for active SIMRS session
async function checkActiveSimrsSession() {
  if (!currentUser) return;

  try {
    const history = await window.api.getSimrsHistory(currentUser.id);

    // Check if there's an active session
    const activeSession = history.find(item => item.status === 'active');

    if (activeSession) {
      // Set current log ID
      currentSimrsLogId = activeSession.id;

      // Show status
      document.getElementById('simrs-status').classList.remove('d-none');
      document.getElementById('status-message').textContent = 'SIMRS sedang berjalan...';

      // Set up auto-refresh for SIMRS history
      const historyRefreshInterval = setInterval(() => {
        loadSimrsHistory();
      }, 10000); // Refresh every 10 seconds

      // Store the interval ID
      window.simrsHistoryRefreshInterval = historyRefreshInterval;
    }
  } catch (error) {
    console.error('Error checking active SIMRS session:', error);
  }
}

// Set up navigation
function setupNavigation() {
  // Dashboard nav
  document.getElementById('nav-dashboard').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('dashboard');
  });

  // Profile nav
  document.getElementById('nav-profile').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('profile');
  });

  document.getElementById('nav-profile-dropdown').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('profile');
  });

  // Logout buttons
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  document.getElementById('logout-nav-btn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
}

// Show specific section and hide others
function showSection(sectionName) {
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(section => {
    section.classList.add('d-none');
  });

  document.getElementById(`${sectionName}-content`).classList.remove('d-none');

  // Update active nav
  const navItems = document.querySelectorAll('.nav-link');
  navItems.forEach(item => {
    item.classList.remove('active');
  });

  document.getElementById(`nav-${sectionName}`).classList.add('active');
}

// Set up event listeners
function setupEventListeners() {
  // Run SIMRS button
  document.getElementById('run-simrs-btn').addEventListener('click', runSimrs);

  // Close SIMRS session button
  document.getElementById('close-simrs-btn').addEventListener('click', closeSimrsSession);

  // Profile form submission
  document.getElementById('profile-form').addEventListener('submit', updateProfile);

  // Browse SIMRS path button
  document.getElementById('browse-simrs-path').addEventListener('click', browseSimrsPath);

  // Photo upload button
  document.getElementById('photo-upload').addEventListener('change', handlePhotoUpload);

  // Refresh history button
  if (document.getElementById('refresh-history')) {
    document.getElementById('refresh-history').addEventListener('click', () => {
      loadSimrsHistory();
    });
  }
}

// Run SIMRS application
async function runSimrs(e) {
  e.preventDefault();

  if (!currentUser) {
    showSimrsAlert('danger', 'Anda harus login terlebih dahulu.');
    return;
  }

  try {
    showSimrsAlert('info', 'Menjalankan SIMRS...');

    const result = await window.api.runSimrs(currentUser.id);

    if (result.success) {
      currentSimrsLogId = result.log_id;
      showSimrsAlert('success', result.message);

      // Show status
      document.getElementById('simrs-status').classList.remove('d-none');
      document.getElementById('status-message').textContent = 'SIMRS sedang berjalan...';

      // We no longer close SIMRS sessions when window is closed
      // Sessions should only be closed when user explicitly logs out

      // Reload SIMRS history
      setTimeout(() => {
        loadSimrsHistory();
      }, 1000);

      // Set up auto-refresh for SIMRS history to keep status updated
      const historyRefreshInterval = setInterval(() => {
        loadSimrsHistory();
      }, 10000); // Refresh every 10 seconds

      // Store the interval ID to clear it later if needed
      window.simrsHistoryRefreshInterval = historyRefreshInterval;
    } else {
      showSimrsAlert('danger', result.message);
    }
  } catch (error) {
    console.error('Error running SIMRS:', error);
    showSimrsAlert('danger', 'Terjadi kesalahan saat menjalankan SIMRS.');
  }
}

// Show SIMRS alert
function showSimrsAlert(type, message) {
  const alertContainer = document.getElementById('simrs-alert-container');
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

// Show profile alert
function showProfileAlert(type, message) {
  const alertContainer = document.getElementById('profile-alert-container');
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

// Fill profile form with user data
function fillProfileForm() {
  if (!currentUser) return;

  // Set form values
  document.getElementById('profile-username').value = currentUser.username;
  document.getElementById('profile-email').value = currentUser.email;
  document.getElementById('profile-fullname').value = currentUser.full_name;
  document.getElementById('profile-contact').value = currentUser.contact || '';
  document.getElementById('profile-simrs-path').value = currentUser.simrs_path || '';

  // Set profile header
  document.getElementById('profile-header-name').textContent = currentUser.full_name || currentUser.username;

  // Set profile photo if available
  if (currentUser.photo) {
    const photoElement = document.getElementById('profile-photo');
    const placeholderElement = document.getElementById('profile-photo-placeholder');

    // Determine photo URL based on whether it's a full URL or just a filename
    let photoUrl;
    if (currentUser.photoUrl) {
      // Use cached URL if available
      photoUrl = currentUser.photoUrl;
    } else if (currentUser.photo.startsWith('http')) {
      // Already a full URL
      photoUrl = currentUser.photo;
    } else if (currentUser.photo.startsWith('../')) {
      // Local relative path
      photoUrl = currentUser.photo;
    } else {
      // Just a filename - construct the portal URL
      photoUrl = `https://portal.rsudhabdulazizmarabahan.com/uploads/photos/${currentUser.photo}`;
    }

    photoElement.src = photoUrl;
    photoElement.onload = function() {
      photoElement.classList.remove('d-none');
      placeholderElement.classList.add('d-none');
    };
    photoElement.onerror = function() {
      // If portal URL fails, try local backup
      if (photoUrl.includes('portal.rsudhabdulazizmarabahan.com')) {
        photoElement.src = `../assets/uploads/${currentUser.photo}`;
      } else {
        photoElement.classList.add('d-none');
        placeholderElement.classList.remove('d-none');
        console.error('Failed to load profile photo:', photoUrl);
      }
    };
  }

  // Unit kerja will be set when data is loaded
  // We'll update the profile-header-unit in loadUnitKerjaData
}

// Load unit kerja data for profile form
async function loadUnitKerjaData() {
  try {
    // Make sure currentUser is loaded before proceeding
    if (!currentUser) {
      console.log('Waiting for currentUser to be loaded...');
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!currentUser) {
        console.warn('currentUser still not loaded, proceeding with caution');
      }
    }

    console.log('Loading unit kerja data...');
    const unitKerjaList = await window.api.getAllUnitKerja();
    console.log('Unit kerja data loaded:', unitKerjaList);

    // Set unit kerja hidden input value
    const unitInput = document.getElementById('profile-unit');
    if (!unitInput) {
      console.error('Unit kerja hidden input element not found');
      return;
    }

    // Set unit kerja display field
    const unitDisplayField = document.getElementById('profile-unit-display');
    if (!unitDisplayField) {
      console.error('Unit kerja display field not found');
      return;
    }

    // Find and display unit kerja name
    if (currentUser && currentUser.unit_kerja_id) {
      console.log('Setting unit kerja display:', currentUser.unit_kerja_id);
      unitInput.value = currentUser.unit_kerja_id;

      // Find the unit kerja name
      let unitName = 'Tidak bisa diubah';
      if (Array.isArray(unitKerjaList)) {
        const unitKerja = unitKerjaList.find(unit => unit.id == currentUser.unit_kerja_id);
        if (unitKerja) {
          unitName = unitKerja.nama;
        }
      }

      console.log('Unit kerja name:', unitName);
      unitDisplayField.value = unitName;

      // Update profile header unit
      if (document.getElementById('profile-header-unit')) {
        document.getElementById('profile-header-unit').textContent = unitName;
      }
    } else {
      console.log('No unit kerja selected or currentUser not loaded');
      unitDisplayField.value = 'Belum dipilih';

      // Update profile header unit when no unit is selected
      if (document.getElementById('profile-header-unit')) {
        document.getElementById('profile-header-unit').textContent = 'Unit Kerja: Belum dipilih';
      }
    }
  } catch (error) {
    console.error('Error loading unit kerja data:', error);
    // Show error in profile alert
    if (document.getElementById('profile-alert-container')) {
      showProfileAlert('warning', 'Gagal memuat data unit kerja. Silakan refresh halaman.');
    }
  }
}

// Update profile
async function updateProfile(e) {
  e.preventDefault();

  if (!currentUser) {
    showProfileAlert('danger', 'Anda harus login terlebih dahulu.');
    return;
  }

  const password = document.getElementById('profile-password').value;
  const confirmPassword = document.getElementById('profile-password-confirm').value;

  // Check if passwords match
  if (password && password !== confirmPassword) {
    showProfileAlert('danger', 'Password dan konfirmasi password tidak cocok.');
    return;
  }

  try {
    showProfileAlert('info', 'Menyimpan perubahan...');

    const formData = {
      id: currentUser.id,
      email: document.getElementById('profile-email').value,
      full_name: document.getElementById('profile-fullname').value,
      contact: document.getElementById('profile-contact').value,
      // Gunakan unit_kerja_id yang sudah ada, tidak bisa diubah
      unit_kerja_id: currentUser.unit_kerja_id,
      simrs_path: document.getElementById('profile-simrs-path').value
    };

    // Add password if provided
    if (password) {
      formData.password = password;
    }

    const result = await window.api.updateProfile(formData);

    if (result.success) {
      // Update current user data
      currentUser = result.user;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      // Update UI
      document.getElementById('username-display').textContent = currentUser.username;
      document.getElementById('fullname-display').textContent = currentUser.full_name;
      document.getElementById('profile-header-name').textContent = currentUser.full_name || currentUser.username;

      // Unit kerja tidak berubah, jadi tidak perlu memperbarui tampilan unit kerja

      // Clear password fields
      document.getElementById('profile-password').value = '';
      document.getElementById('profile-password-confirm').value = '';

      showProfileAlert('success', result.message);
    } else {
      showProfileAlert('danger', result.message);
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    showProfileAlert('danger', 'Terjadi kesalahan saat memperbarui profil.');
  }
}

// Browse for SIMRS path
async function browseSimrsPath() {
  try {
    const result = await window.api.selectSimrsPath();
    if (result && result.filePath) {
      document.getElementById('profile-simrs-path').value = result.filePath;
    }
  } catch (error) {
    console.error('Error browsing for SIMRS path:', error);
  }
}

// Handle profile photo upload
async function handlePhotoUpload(event) {
  if (!currentUser) {
    showProfileAlert('danger', 'Anda harus login terlebih dahulu.');
    return;
  }

  const file = event.target.files[0];
  if (!file) return;

  // Check file type
  if (!file.type.match('image.*')) {
    showProfileAlert('danger', 'File harus berupa gambar (JPG, PNG, GIF).');
    return;
  }

  // Check file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showProfileAlert('danger', 'Ukuran file terlalu besar. Maksimal 2MB.');
    return;
  }

  try {
    showProfileAlert('info', 'Mengupload foto profil...');

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = async (e) => {
      const photoData = e.target.result;

      // Upload to server
      const result = await window.api.uploadProfilePhoto(currentUser.id, photoData);

      if (result.success) {
        // Update current user data with just the filename
        currentUser.photo = result.fileName;
        // Store the full photo URL for immediate use
        currentUser.photoUrl = result.photoPath;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Update UI - Profile photo
        const photoElement = document.getElementById('profile-photo');
        const placeholderElement = document.getElementById('profile-photo-placeholder');

        photoElement.src = result.photoPath;
        photoElement.onload = function() {
          photoElement.classList.remove('d-none');
          placeholderElement.classList.add('d-none');
        };
        photoElement.onerror = function() {
          // If portal URL fails, try local backup
          if (result.photoPath.includes('portal.rsudhabdulazizmarabahan.com')) {
            photoElement.src = `../assets/uploads/${result.fileName}`;
          } else {
            photoElement.classList.add('d-none');
            placeholderElement.classList.remove('d-none');
          }
        };

        // Update UI - Navbar photo
        const navPhotoElement = document.getElementById('nav-profile-photo');
        const navPlaceholderElement = document.getElementById('nav-profile-placeholder');

        navPhotoElement.src = result.photoPath;
        navPhotoElement.onload = function() {
          navPhotoElement.classList.remove('d-none');
          navPlaceholderElement.classList.add('d-none');
        };
        navPhotoElement.onerror = function() {
          // If portal URL fails, try local backup
          if (result.photoPath.includes('portal.rsudhabdulazizmarabahan.com')) {
            navPhotoElement.src = `../assets/uploads/${result.fileName}`;
          } else {
            navPhotoElement.classList.add('d-none');
            navPlaceholderElement.classList.remove('d-none');
          }
        };

        // Update UI - Dashboard header photo
        const dashboardPhotoElement = document.getElementById('dashboard-photo');
        const dashboardPlaceholderElement = document.getElementById('dashboard-photo-placeholder');

        dashboardPhotoElement.src = result.photoPath;
        dashboardPhotoElement.onload = function() {
          dashboardPhotoElement.classList.remove('d-none');
          dashboardPlaceholderElement.classList.add('d-none');
        };
        dashboardPhotoElement.onerror = function() {
          // If portal URL fails, try local backup
          if (result.photoPath.includes('portal.rsudhabdulazizmarabahan.com')) {
            dashboardPhotoElement.src = `../assets/uploads/${result.fileName}`;
          } else {
            dashboardPhotoElement.classList.add('d-none');
            dashboardPlaceholderElement.classList.remove('d-none');
          }
        };

        showProfileAlert('success', 'Foto profil berhasil diupload.');
      } else {
        showProfileAlert('danger', result.message || 'Gagal mengupload foto profil.');
      }
    };

    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    showProfileAlert('danger', 'Terjadi kesalahan saat mengupload foto profil.');
  }
}

// Load SIMRS usage history
async function loadSimrsHistory() {
  if (!currentUser) return;

  try {
    const history = await window.api.getSimrsHistory(currentUser.id);
    const historyContainer = document.getElementById('simrs-history-container');

    if (history.length === 0) {
      historyContainer.innerHTML = '<p class="text-center">Belum ada riwayat penggunaan SIMRS.</p>';
      return;
    }

    let html = `
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead>
            <tr>
              <th>Tanggal & Waktu</th>
              <th>Unit Kerja</th>
              <th>Status</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
    `;

    history.forEach(item => {
      const startTime = new Date(item.start_time).toLocaleString();
      const unitKerja = item.UnitKerja ? item.UnitKerja.nama : 'Tidak Ada Unit';
      const status = item.status === 'active' ?
        '<span class="badge bg-success">Aktif</span>' :
        '<span class="badge bg-secondary">Selesai</span>';

      html += `
        <tr>
          <td>${startTime}</td>
          <td>${unitKerja}</td>
          <td>${status}</td>
          <td>${item.ip_address}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    historyContainer.innerHTML = html;
  } catch (error) {
    console.error('Error loading SIMRS history:', error);
    const historyContainer = document.getElementById('simrs-history-container');
    historyContainer.innerHTML = '<p class="text-center text-danger">Gagal memuat riwayat penggunaan SIMRS.</p>';
  }
}

// Close SIMRS session
async function closeSimrsSession() {
  if (!currentSimrsLogId) {
    showSimrsAlert('warning', 'Tidak ada sesi SIMRS aktif yang perlu ditutup.');
    return;
  }

  try {
    showSimrsAlert('info', 'Menutup sesi SIMRS...');

    const result = await window.api.closeSimrs(currentSimrsLogId);

    if (result.success) {
      // Clear current log ID
      currentSimrsLogId = null;

      // Hide status
      document.getElementById('simrs-status').classList.add('d-none');

      // Clear refresh interval if exists
      if (window.simrsHistoryRefreshInterval) {
        clearInterval(window.simrsHistoryRefreshInterval);
        window.simrsHistoryRefreshInterval = null;
      }

      showSimrsAlert('success', 'Sesi SIMRS berhasil ditutup.');

      // Reload SIMRS history
      loadSimrsHistory();
    } else {
      showSimrsAlert('danger', result.message || 'Gagal menutup sesi SIMRS.');
    }
  } catch (error) {
    console.error('Error closing SIMRS session:', error);
    showSimrsAlert('danger', 'Terjadi kesalahan saat menutup sesi SIMRS.');
  }
}

// Logout function
function logout() {
  // Close any active SIMRS session before logout
  if (currentSimrsLogId) {
    window.api.closeSimrs(currentSimrsLogId)
      .catch(error => console.error('Error closing SIMRS session during logout:', error));
  }

  // Clear refresh interval if exists
  if (window.simrsHistoryRefreshInterval) {
    clearInterval(window.simrsHistoryRefreshInterval);
  }

  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}
