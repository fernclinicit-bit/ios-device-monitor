document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const detectedOsTag = document.getElementById('detected-os-tag');
  const btnToggleView = document.getElementById('btn-toggle-view');
  
  // Views
  const adminView = document.getElementById('admin-view');
  const clientView = document.getElementById('client-view');
  
  // Admin DOM
  const statTotalDevices = document.getElementById('stat-total-devices');
  const statActiveDevices = document.getElementById('stat-active-devices');
  const statPendingDevices = document.getElementById('stat-pending-devices');
  const statUnverifiedDevices = document.getElementById('stat-unverified-devices');
  const statOverdueDevices = document.getElementById('stat-overdue-devices');
  const btnShowAddDevice = document.getElementById('btn-show-add-device');
  const addDeviceDrawer = document.getElementById('add-device-drawer');
  const newUserInfo = document.getElementById('new-user-name');
  const newPosition = document.getElementById('new-position');
  const newDeviceNumber = document.getElementById('new-device-number');
  const newAccessories = document.getElementById('new-accessories');
  const newDeviceType = document.getElementById('new-device-type');
  const btnSubmitDevice = document.getElementById('btn-submit-device');
  
  // Edit Device DOM
  const editDeviceDrawer = document.getElementById('edit-device-drawer');
  const editDeviceId = document.getElementById('edit-device-id');
  const editUserInfo = document.getElementById('edit-user-name');
  const editPosition = document.getElementById('edit-position');
  const editDeviceNumber = document.getElementById('edit-device-number');
  const editAccessories = document.getElementById('edit-accessories');
  const editDeviceType = document.getElementById('edit-device-type');
  const btnSaveEdit = document.getElementById('btn-save-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  const devicesListTbody = document.getElementById('devices-list-tbody');
  const emptyDevicesMsg = document.getElementById('empty-devices-msg');
  const systemLogsList = document.getElementById('system-logs-list');
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  
  // Asset Nav Tabs
  const navDevicesBtn = document.getElementById('nav-devices-btn');
  const navAssetsBtn = document.getElementById('nav-assets-btn');
  const navClientPortalBtn = document.getElementById('nav-client-portal-btn');
  const devicesSection = document.getElementById('devices-section-content');
  const assetsSection = document.getElementById('assets-section-content');

  // Asset DOM
  const statTotalAssets = document.getElementById('stat-total-assets');
  const statScannedAssets = document.getElementById('stat-scanned-assets');
  const assetsListTbody = document.getElementById('assets-list-tbody');
  const emptyAssetsMsg = document.getElementById('empty-assets-msg');
  const btnShowAddAsset = document.getElementById('btn-show-add-asset');
  
  const addAssetDrawer = document.getElementById('add-asset-drawer');
  const newAssetName = document.getElementById('new-asset-name');
  const newAssetCategory = document.getElementById('new-asset-category');
  const newAssetSn = document.getElementById('new-asset-sn');
  const newAssetLocation = document.getElementById('new-asset-location');
  
  // Admin Scanner Elements
  const btnShowScanAsset = document.getElementById('btn-show-scan-asset');
  const scanAssetDrawer = document.getElementById('scan-asset-drawer');
  const btnCloseScanAsset = document.getElementById('btn-close-scan-asset');
  const adminQrResults = document.getElementById('admin-qr-results');
  const btnSubmitAsset = document.getElementById('btn-submit-asset');

  const editAssetDrawer = document.getElementById('edit-asset-drawer');
  const editAssetId = document.getElementById('edit-asset-id');
  const editAssetName = document.getElementById('edit-asset-name');
  const editAssetCategory = document.getElementById('edit-asset-category');
  const editAssetSn = document.getElementById('edit-asset-sn');
  const editAssetLocation = document.getElementById('edit-asset-location');
  const btnSaveEditAsset = document.getElementById('btn-save-edit-asset');
  const btnCancelEditAsset = document.getElementById('btn-cancel-edit-asset');

  // QR Modal
  const qrModal = document.getElementById('qr-modal');
  const qrModalTitle = document.getElementById('qr-modal-title');
  const qrModalSn = document.getElementById('qr-modal-sn');
  const qrcodeContainer = document.getElementById('qrcode-container');
  const btnCloseQrModal = document.getElementById('btn-close-qr-modal');
  
  // Client DOM
  const clientDeviceHeader = document.getElementById('client-device-header');
  const clientRegistrationSection = document.getElementById('client-registration-section');
  const clientVerificationSection = document.getElementById('client-verification-section');
  const btnVerifyPresence = document.getElementById('btn-verify-presence');
  const clientStatusBadge = document.getElementById('client-status-badge');
  const clientPositionVal = document.getElementById('client-position-val');
  const clientDeviceNumberVal = document.getElementById('client-device-number-val');
  const clientAccessoriesVal = document.getElementById('client-accessories-val');
  const clientLastVerifiedVal = document.getElementById('client-last-verified-val');
  const clientNextDueVal = document.getElementById('client-next-due-val');
  const clientDeviceSelectorPanel = document.getElementById('client-device-selector-panel');
  const clientDeviceSelect = document.getElementById('client-device-select');
  
  // Toast
  const toastNotification = document.getElementById('toast-notification');

  // --- App State ---
  let devices = [];
  let assets = [];
  let logs = [];
  let currentFilteredDevices = [];
  let currentFilteredAssets = [];
  let serverIpAddress = 'localhost';
  let currentActiveView = 'admin'; // 'admin' or 'client'
  let mapInstance = null;
  let mapMarkers = {}; // Store markers by deviceId
  let addDevicePassword = null;
  let editDevicePassword = null;
  
  // Accurate iOS Detection (Including iPads on iOS 13+ which report as MacIntel)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Check for device ID in URL parameters (e.g. ?id=dev-xxxx)
  const urlParams = new URLSearchParams(window.location.search);
  const queryId = urlParams.get('id');
  if (queryId) {
    localStorage.setItem('ios_device_id', queryId);
    // Clean URL query parameter from address bar
    window.history.replaceState({}, document.title, window.location.pathname);
    currentActiveView = 'client';
  } else if (isIOS) {
    currentActiveView = 'client';
  }

  // Initialize OS detection display tag
  if (isIOS) {
    detectedOsTag.textContent = 'Detected OS: iOS Device 📱';
  } else {
    detectedOsTag.textContent = 'Detected OS: Desktop/Other 💻';
  }
  
  const viewSwitcherBar = document.querySelector('.view-switcher-bar');
  const desktopBackToAdmin = document.getElementById('desktop-back-to-admin');
  const btnBackToAdmin = document.getElementById('btn-back-to-admin');

  if (btnBackToAdmin) {
    btnBackToAdmin.addEventListener('click', () => {
      currentActiveView = 'admin';
      updateViewVisibility();
    });
  }

  updateViewVisibility();

  // Switch View handler
  btnToggleView.addEventListener('click', () => {
    currentActiveView = currentActiveView === 'admin' ? 'client' : 'admin';
    updateViewVisibility();
  });

  // Toggle Add Device drawer
  btnShowAddDevice.addEventListener('click', async () => {
    const password = await requestActionPassword('เพิ่มอุปกรณ์');
    if (!password) return;
    addDevicePassword = password;
    addDeviceDrawer.classList.toggle('hidden');
  });

  // Toast notifier helper
  function showToast(message) {
    toastNotification.textContent = message;
    toastNotification.classList.remove('hidden');
    setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 3000);
  }

  async function requestActionPassword(actionLabel) {
    const password = prompt(`กรุณาใส่รหัสผ่านเพื่อ${actionLabel}`);
    if (password === null) return null;
    try {
      const response = await fetch('/api/check-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'รหัสผ่านไม่ถูกต้อง');
        return null;
      }
      return password;
    } catch (err) {
      console.error(err);
      showToast('ไม่สามารถตรวจสอบรหัสผ่านได้');
      return null;
    }
  }

  function updateViewVisibility() {
    if (currentActiveView === 'admin') {
      adminView.classList.remove('hidden');
      clientView.classList.add('hidden');
      viewSwitcherBar.classList.remove('hidden');
      if (desktopBackToAdmin) desktopBackToAdmin.classList.add('hidden');
      
      // Fix Leaflet dimensions when container becomes visible
      setTimeout(() => {
        if (mapInstance) mapInstance.invalidateSize();
      }, 50);
    } else {
      adminView.classList.add('hidden');
      clientView.classList.remove('hidden');
      viewSwitcherBar.classList.add('hidden');
      if (desktopBackToAdmin) {
        if (!isIOS) {
          desktopBackToAdmin.classList.remove('hidden');
        } else {
          desktopBackToAdmin.classList.add('hidden');
        }
      }
    }
  }

  // --- Data Fetching & Sync ---
  async function loadData() {
    try {
      const [devicesRes, assetsRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/assets')
      ]);
      const devicesData = await devicesRes.json();
      const assetsData = await assetsRes.json();
      
      devices = devicesData.devices || [];
      logs = devicesData.logs || [];
      serverIpAddress = devicesData.serverIp || 'localhost';
      
      assets = assetsData.assets || [];
      
      updateAdminDashboard();
      updateAssetsDashboard();
      updateClientPortal();
    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Network error: server unreachable');
    }
  }

  // --- Admin Map Logic ---
  function initAdminMap() {
    if (mapInstance) return; // Already initialized

    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    // Default view to Thailand
    mapInstance = L.map('map-container').setView([13.736717, 100.523186], 6);

    // Dark-mode Map Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstance);
    
    // Fix Leaflet sizing bug when rendering inside hidden tab
    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 100);
  }

  function updateAdminMap(filteredDevicesList) {
    initAdminMap();
    if (!mapInstance) return;

    // Track active marker coordinates to fit bounds
    const coordinates = [];
    const activeList = filteredDevicesList || devices;

    activeList.forEach(d => {
      const hasGps = d.latitude !== undefined && d.latitude !== null && d.longitude !== undefined && d.longitude !== null;
      if (hasGps) {
        const latLng = [d.latitude, d.longitude];
        coordinates.push(latLng);

        // Details content for popup
        const statusBadgeMarkup = d.status === 'active' 
          ? '<span style="background: #10b981; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">Active</span>'
          : d.status === 'pending'
          ? '<span style="background: #f59e0b; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">Pending Verify</span>'
          : d.status === 'unverified'
          ? '<span style="background: rgba(255,255,255,0.15); color: #ccc; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">Unverified</span>'
          : '<span style="background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">Overdue</span>';

        const lastCheckTime = d.lastVerifiedAt ? new Date(d.lastVerifiedAt).toLocaleString() : 'Never';

        const addressMarkup = d.address ? `
          <div style="font-size: 0.75rem; color: #a78bfa; margin-top: 6px; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 6px; word-break: break-word;">
            📍 ที่อยู่: ${escapeHtml(d.address)}
          </div>
        ` : '';

        const popupContent = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; color: #fff; max-width: 220px;">
            <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
              <span>${escapeHtml(d.userName || d.name)}</span>
              ${statusBadgeMarkup}
            </div>
            <div style="font-size: 0.75rem; color: #ccc; margin-bottom: 3px;">💼 Position: ${escapeHtml(d.position || '-')}</div>
            <div style="font-size: 0.75rem; color: #ccc; margin-bottom: 3px;">🔢 S/N: ${escapeHtml(d.deviceNumber || '-')}</div>
            <div style="font-size: 0.75rem; color: #ccc; margin-bottom: 4px;">🔌 Accessories: ${escapeHtml(d.accessories || '-')}</div>
            ${addressMarkup}
            <div style="font-size: 0.7rem; color: #888; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; margin-top: 6px;">Confirmed: ${lastCheckTime}</div>
          </div>
        `;

        if (mapMarkers[d.id]) {
          // Update existing marker position and popup content
          mapMarkers[d.id].setLatLng(latLng);
          mapMarkers[d.id].getPopup().setContent(popupContent);
        } else {
          // Create new marker
          const marker = L.marker(latLng).addTo(mapInstance);
          marker.bindPopup(popupContent);
          mapMarkers[d.id] = marker;
        }
      } else {
        // Device doesn't have GPS, remove its marker if it exists
        if (mapMarkers[d.id]) {
          mapInstance.removeLayer(mapMarkers[d.id]);
          delete mapMarkers[d.id];
        }
      }
    });

    // Remove markers of deleted or filtered out devices
    const currentDeviceIds = activeList.map(d => d.id);
    Object.keys(mapMarkers).forEach(id => {
      if (!currentDeviceIds.includes(id)) {
        mapInstance.removeLayer(mapMarkers[id]);
        delete mapMarkers[id];
      }
    });

    // Fit map bounds if there are markers, with safety check
    if (coordinates.length > 0) {
      try {
        // Only fit bounds if we have coordinates and the map is visible
        if (currentActiveView === 'admin') {
          mapInstance.fitBounds(coordinates, { maxZoom: 14, padding: [40, 40] });
        }
      } catch (e) {
        console.warn('fitBounds failed:', e);
      }
    }
  }

  // Helper to focus on a specific device
  function focusDeviceOnMap(deviceId) {
    const marker = mapMarkers[deviceId];
    if (marker && mapInstance) {
      mapInstance.setView(marker.getLatLng(), 16);
      marker.openPopup();
      // Scroll to map container smoothly
      document.getElementById('map-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      showToast('No location coordinates available for this device.');
    }
  }

  // --- Admin Dashboard Logic ---
  function updateAdminDashboard() {
    // Stat Counters
    const total = devices.length;
    const active = devices.filter(d => d.status === 'active').length;
    const pending = devices.filter(d => d.status === 'pending').length;
    const unverified = devices.filter(d => d.status === 'unverified').length;
    const overdue = devices.filter(d => d.status === 'overdue').length;

    statTotalDevices.textContent = total;
    statActiveDevices.textContent = active;
    statPendingDevices.textContent = pending;
    statUnverifiedDevices.textContent = unverified;
    statOverdueDevices.textContent = overdue;

    // Filter devices based on Search Query and Status
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusVal = statusFilter ? statusFilter.value : 'all';

    let filteredDevices = devices;

    // Apply Search Filter
    if (query !== '') {
      filteredDevices = filteredDevices.filter(d => {
        const nameMatch = (d.userName || d.name || '').toLowerCase().includes(query);
        const positionMatch = (d.position || '').toLowerCase().includes(query);
        const snMatch = (d.deviceNumber || '').toLowerCase().includes(query);
        const accMatch = (d.accessories || '').toLowerCase().includes(query);
        const addrMatch = (d.address || '').toLowerCase().includes(query);
        return nameMatch || positionMatch || snMatch || accMatch || addrMatch;
      });
    }

    // Apply Status Filter
    if (statusVal !== 'all') {
      filteredDevices = filteredDevices.filter(d => d.status === statusVal);
    }

    currentFilteredDevices = filteredDevices;

    // Devices Table
    devicesListTbody.innerHTML = '';
    if (filteredDevices.length === 0) {
      emptyDevicesMsg.classList.remove('hidden');
    } else {
      emptyDevicesMsg.classList.add('hidden');
      filteredDevices.forEach(d => {
        const tr = document.createElement('tr');
        
        // Status Badge Style
        let badgeClass = 'badge-active';
        if (d.status === 'pending') badgeClass = 'badge-pending';
        if (d.status === 'overdue') badgeClass = 'badge-overdue';
        if (d.status === 'unverified') badgeClass = 'badge-unverified';

        const lastVerifiedFormatted = d.lastVerifiedAt ? new Date(d.lastVerifiedAt).toLocaleString() : 'Never';
        const nextDueFormatted = d.nextDueAt ? new Date(d.nextDueAt).toLocaleDateString() : 'Pending Active';
        const daysRemainingText = d.status === 'unverified' ? 'Waiting check-in' : d.daysRemaining > 0 ? `${d.daysRemaining} days left` : 'Expired';
        let verifyUrl = '';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          verifyUrl = 'http://' + serverIpAddress + ':3000/?id=' + d.id;
        } else {
          verifyUrl = window.location.origin + '/?id=' + d.id;
        }
        
        const addressRow = d.address ? `
          <div style="font-size: 0.75rem; color: var(--accent-indigo); margin-top: 0.15rem; word-break: break-word;">
            📍 ที่อยู่: ${escapeHtml(d.address)}
          </div>
        ` : '';

        tr.innerHTML = `
          <td>
            <div style="font-weight: 700; font-size: 0.95rem; color: #fff;">${escapeHtml(d.userName || d.name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
              💼 Position: ${escapeHtml(d.position || '-')}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">
              🔢 S/N: ${escapeHtml(d.deviceNumber || '-')} | 🔌 Acc: ${escapeHtml(d.accessories || '-')}
            </div>
            ${addressRow}
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.15rem;">
              ${d.isIOS ? '📱 iOS Device' : '💻 Other'}
            </div>
          </td>
          <td>${lastVerifiedFormatted}</td>
          <td>
            <div>${nextDueFormatted}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              ${daysRemainingText}
            </div>
          </td>
          <td><span class="badge ${badgeClass}">${d.status === 'active' ? 'Active' : d.status === 'pending' ? 'Pending' : d.status === 'unverified' ? 'Unverified' : 'Overdue'}</span></td>
          <td>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="text" readonly value="${verifyUrl}" id="link-input-${d.id}" style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); color: var(--text-secondary); border-radius: 8px; padding: 0.4rem 0.6rem; font-size: 0.75rem; width: 150px; outline: none;">
              <button class="btn btn-secondary btn-copy-link" data-id="${d.id}" data-link="${verifyUrl}" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; border-radius: 8px;">
                Copy
              </button>
            </div>
          </td>
          <td>
            <div style="display: flex; gap: 0.5rem;">
              ${d.latitude !== undefined && d.latitude !== null ? `
                <button class="btn btn-secondary btn-show-map" data-id="${d.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; background: var(--accent-indigo); color: #fff; border-color: var(--accent-indigo);">
                  📍 Map
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-verify-manual" data-id="${d.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">
                Verify
              </button>
              <button class="btn btn-secondary btn-edit-device" data-id="${d.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; background: var(--accent-purple); color: #fff; border-color: var(--accent-purple);">
                Edit
              </button>
              <button class="btn-danger-sm btn-delete-device" data-id="${d.id}">
                Delete
              </button>
            </div>
          </td>
        `;
        devicesListTbody.appendChild(tr);
      });
    }

    // Activity Logs List
    systemLogsList.innerHTML = '';
    logs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'log-item';
      
      const timeStr = new Date(log.timestamp).toLocaleTimeString();
      const dateStr = new Date(log.timestamp).toLocaleDateString();
      
      li.innerHTML = `
        <span>
          <strong>${escapeHtml(log.deviceName)}</strong>: ${escapeHtml(log.action)}
        </span>
        <span class="log-time">${dateStr} ${timeStr}</span>
      `;
      systemLogsList.appendChild(li);
    });

    // Setup action button listeners
    document.querySelectorAll('.btn-show-map').forEach(btn => {
      btn.addEventListener('click', () => focusDeviceOnMap(btn.dataset.id));
    });

    document.querySelectorAll('.btn-verify-manual').forEach(btn => {
      btn.addEventListener('click', async () => {
        const password = await requestActionPassword('ยืนยันอุปกรณ์');
        if (password) verifyDevice(btn.dataset.id, password);
      });
    });

    document.querySelectorAll('.btn-edit-device').forEach(btn => {
      btn.addEventListener('click', async () => {
        const password = await requestActionPassword('แก้ไขอุปกรณ์');
        if (!password) return;
        editDevicePassword = password;
        const d = devices.find(x => x.id === btn.dataset.id);
        if (d) {
          editDeviceId.value = d.id;
          editUserInfo.value = d.userName || d.name || '';
          editPosition.value = d.position || '';
          editDeviceNumber.value = d.deviceNumber || '';
          editAccessories.value = d.accessories || '';
          editDeviceType.value = d.isIOS ? 'ios' : 'other';
          
          editDeviceDrawer.classList.remove('hidden');
          // Hide add drawer if open
          const addDeviceDrawer = document.getElementById('add-device-drawer');
          if (addDeviceDrawer) addDeviceDrawer.classList.add('hidden');
          
          editDeviceDrawer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    document.querySelectorAll('.btn-delete-device').forEach(btn => {
      btn.addEventListener('click', async () => {
        const password = await requestActionPassword('ลบอุปกรณ์');
        if (password) deleteDevice(btn.dataset.id, password);
      });
    });

    document.querySelectorAll('.btn-copy-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const link = btn.dataset.link;
        navigator.clipboard.writeText(link).then(() => {
          showToast('Verification link copied!');
        }).catch(err => {
          console.error('Copy failed:', err);
          const input = document.getElementById(`link-input-${btn.dataset.id}`);
          if (input) {
            input.select();
            document.execCommand('copy');
            showToast('Verification link copied!');
          }
        });
      });
    });

    // Update map view with current device markers
    updateAdminMap(filteredDevices);
  }

  // --- Asset Dashboard Logic ---
  function updateAssetsDashboard() {
    statTotalAssets.textContent = assets.length;
    
    // Calculate recently scanned (within last 7 days)
    const now = new Date();
    const recent = assets.filter(a => {
      if (!a.lastScannedAt) return false;
      const diffTime = Math.abs(now - new Date(a.lastScannedAt));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays <= 7;
    }).length;
    statScannedAssets.textContent = recent;

    assetsListTbody.innerHTML = '';
    if (assets.length === 0) {
      emptyAssetsMsg.classList.remove('hidden');
    } else {
      emptyAssetsMsg.classList.add('hidden');
      assets.forEach(a => {
        const tr = document.createElement('tr');
        
        const lastScannedFormatted = a.lastScannedAt ? new Date(a.lastScannedAt).toLocaleString() : 'Never';
        
        // QR URL for printing/scanning (we'll implement scanner.html later)
        let qrUrl = '';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          qrUrl = 'http://' + serverIpAddress + ':3000/scanner.html?id=' + a.id;
        } else {
          qrUrl = window.location.origin + '/scanner.html?id=' + a.id;
        }

        const snDisplay = a.sn || a.serialNumber || '-';
        const imgHtml = a.image 
          ? `<div style="width: 90px; height: 120px; padding: 6px 6px 16px 6px; background: #fff; border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.4); display: inline-block; transform: rotate(-2deg);">
               <img src="${a.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 2px;">
             </div>` 
          : `<div style="width: 90px; height: 120px; background: rgba(0,0,0,0.2); border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; color: #6b7280; font-size: 0.8rem; border: 1px dashed rgba(255,255,255,0.1);">No Image</div>`;

        tr.innerHTML = `
          <td>
            <div style="font-weight: 600; font-size: 1.15rem; color: #fff; margin-bottom: 0.25rem;">${escapeHtml(a.name)}</div>
            <div style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 0.75rem; line-height: 1.4;">
              <strong>Category:</strong> ${escapeHtml(a.category || '-')}<br>
              <strong>S/N:</strong> ${escapeHtml(snDisplay)}<br>
              <strong>Location:</strong> ${escapeHtml(a.location || '-')}
            </div>
            <div style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 0.5rem;">
              ${imgHtml}
              <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <div id="inline-qr-${a.id}" style="width: 120px; height: 120px; background: white; padding: 10px; border-radius: 8px;"></div>
                <span style="font-size: 0.75rem; color: #6b7280;">ID: ${a.id.substring(4)}</span>
              </div>
            </div>
          </td>
          <td style="vertical-align: top; padding-top: 1rem;">
            <div class="status-cell">
              <span class="status-indicator ${a.lastScannedAt ? 'active' : 'unverified'}"></span>
              ${lastScannedFormatted}
            </div>
          </td>
          <td style="vertical-align: top; padding-top: 1rem;">
            <div class="action-buttons">
              <button class="btn-action edit" onclick="openEditAssetModal('${a.id}')" title="Edit">✏️</button>
              <button class="btn-action delete" onclick="confirmDeleteAsset('${a.id}')" title="Delete">🗑️</button>
            </div>
          </td>
        `;
        assetsListTbody.appendChild(tr);

        // Render QR Code inline after appending
        setTimeout(() => {
          const qrContainer = document.getElementById(`inline-qr-${a.id}`);
          if (qrContainer) {
            new QRCode(qrContainer, {
              text: qrUrl,
              width: 100,
              height: 100,
              colorDark : "#000000",
              colorLight : "#ffffff",
              correctLevel : QRCode.CorrectLevel.L
            });
          }
        }, 50);
      });
    }

    window.confirmDeleteAsset = async (id) => {
      const password = await requestActionPassword('ลบอุปกรณ์ทรัพย์สิน');
      if (password) deleteAsset(id, password);
    };
    window.openEditAssetModal = (id) => {
      const asset = assets.find(a => a.id === id);
      if (asset) {
        document.getElementById('edit-asset-id').value = asset.id;
        document.getElementById('edit-asset-name').value = asset.name;
        document.getElementById('edit-asset-category').value = asset.category || '';
        document.getElementById('edit-asset-sn').value = asset.sn || asset.serialNumber || '';
        document.getElementById('edit-asset-location').value = asset.location || '';
        document.getElementById('edit-asset-image').value = ''; // Reset file input
        editAssetDrawer.classList.remove('hidden');
        if (addAssetDrawer) addAssetDrawer.classList.add('hidden');
        if (scanAssetDrawer) scanAssetDrawer.classList.add('hidden');
      }
    };
  }

  // --- Utility: Image Compression ---
  function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.6) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = event => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height *= maxWidth / width));
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width *= maxHeight / height));
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Get compressed base64 string
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = error => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  }

  // --- Client View Logic ---
  function updateClientPortal() {
    let savedDeviceId = localStorage.getItem('ios_device_id');
    
    // Check if the current saved device exists in the devices list
    const currentDevice = devices.find(d => d.id === savedDeviceId);

    // Always hide the selector panel to keep client view clean as requested
    if (typeof clientDeviceSelectorPanel !== 'undefined' && clientDeviceSelectorPanel) {
      clientDeviceSelectorPanel.classList.add('hidden');
    }

    if (currentDevice || window.adminTestMode) {
      // Device is registered (or we are in Admin Test Mode), show verification screen
      clientRegistrationSection.classList.add('hidden');
      clientVerificationSection.classList.remove('hidden');
      
      if (window.adminTestMode) {
        clientDeviceHeader.textContent = 'หน้าทดสอบระบบ (Admin Test Mode)';
        clientPositionVal.textContent = 'N/A';
        clientDeviceNumberVal.textContent = 'TEST-001';
        clientAccessoriesVal.textContent = 'None';
        clientLastVerifiedVal.textContent = 'Never';
        clientNextDueVal.textContent = 'Ready to test';
        clientStatusBadge.className = 'badge badge-pending';
        clientStatusBadge.textContent = 'Ready to test';
      } else {
        clientDeviceHeader.textContent = currentDevice.userName || currentDevice.name;
        clientPositionVal.textContent = currentDevice.position || '-';
        clientDeviceNumberVal.textContent = currentDevice.deviceNumber || '-';
        clientAccessoriesVal.textContent = currentDevice.accessories || '-';
        clientLastVerifiedVal.textContent = currentDevice.lastVerifiedAt ? new Date(currentDevice.lastVerifiedAt).toLocaleString() : 'Never';
        clientNextDueVal.textContent = currentDevice.nextDueAt ? new Date(currentDevice.nextDueAt).toLocaleDateString() : 'Pending Active';
        
        // Update badge
        clientStatusBadge.className = 'badge';
        if (currentDevice.status === 'active') {
          clientStatusBadge.classList.add('badge-active');
          clientStatusBadge.textContent = 'Active';
        } else if (currentDevice.status === 'pending') {
          clientStatusBadge.classList.add('badge-pending');
          clientStatusBadge.textContent = 'Pending Verify';
        } else if (currentDevice.status === 'unverified') {
          clientStatusBadge.classList.add('badge-unverified');
          clientStatusBadge.textContent = 'Unverified';
        } else {
          clientStatusBadge.classList.add('badge-overdue');
          clientStatusBadge.textContent = 'Overdue Check';
        }
      }
    } else {
      // Device is not registered, show registration form/QR scanner
      localStorage.removeItem('ios_device_id');
      clientRegistrationSection.classList.remove('hidden');
      clientVerificationSection.classList.add('hidden');
      clientDeviceHeader.textContent = 'ระบบสแกนตรวจสอบทรัพย์สิน';
      
      // Initialize QR Scanner if not already running
      if (typeof Html5QrcodeScanner !== 'undefined') {
        initQrScanner();
      }
    }
  }

  // --- HTML5 QR Scanner Logic ---
  let html5QrcodeScanner = null;

  function initQrScanner() {
    if (html5QrcodeScanner) return; // Already initialized
    
    const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", qrConfig, false);
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
  }

  async function onScanSuccess(decodedText, decodedResult) {
    const resultDiv = document.getElementById('qr-reader-results');
    if (!resultDiv) return;
    
    let assetId = decodedText;
    
    // Extract ID if it's a URL (e.g. http://.../scanner.html?id=ast-xxx)
    try {
      const url = new URL(decodedText);
      const idParam = url.searchParams.get('id');
      if (idParam) {
        assetId = idParam;
      }
    } catch (e) {
      // It's not a URL, use raw decoded text
    }

    if (assetId && assetId.startsWith('ast-')) {
      // Pause scanner while processing
      if (html5QrcodeScanner) html5QrcodeScanner.pause();
      resultDiv.innerHTML = `<span style="color: #6366f1;">กำลังเช็คอินทรัพย์สิน...</span>`;
      
      try {
        const res = await fetch('/api/scan-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId })
        });
        const data = await res.json();
        
        if (data.error) {
          resultDiv.innerHTML = `<span style="color: #ef4444;">❌ ล้มเหลว: ${data.error}</span>`;
        } else {
          resultDiv.innerHTML = `<span style="color: #10b981;">✅ เช็คอินสำเร็จ: ${data.asset.name}</span>`;
          loadData(); // Refresh UI silently
        }
      } catch (err) {
        console.error(err);
        resultDiv.innerHTML = `<span style="color: #ef4444;">❌ เกิดข้อผิดพลาดด้านเครือข่าย</span>`;
      }
      
      // Resume scanning after 3 seconds
      setTimeout(() => {
        if (html5QrcodeScanner) {
          html5QrcodeScanner.resume();
        }
        resultDiv.innerHTML = '';
      }, 3000);
    } else {
      // It might be an iOS ID or something else not handled by the Asset Scanner
      resultDiv.innerHTML = `<span style="color: #f59e0b;">⚠️ QR Code ไม่รองรับ (${assetId})</span>`;
    }
  }

  function onScanFailure(error) {
    // Ignore continuous scanning failures
  }

  // Handle cleanup when leaving client view to Admin view
  if (btnBackToAdmin) {
    btnBackToAdmin.addEventListener('click', () => {
      clientView.classList.add('hidden');
      adminView.classList.remove('hidden');
      window.adminTestMode = false;
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(err => console.error("Failed to clear scanner", err));
        html5QrcodeScanner = null;
      }
    });
  }  // Tap orb to verify client presence
  btnVerifyPresence.addEventListener('click', async () => {
    if (window.adminTestMode) {
      showToast('Test Mode: Location check successful!');
      const btn = btnVerifyPresence;
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<span class="orb-content"><svg class="orb-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>Success!</span>`;
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      clientStatusBadge.className = 'badge badge-active';
      clientStatusBadge.textContent = 'Active (Test)';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
      }, 3000);
      return;
    }

    const deviceId = localStorage.getItem('ios_device_id');
    if (!deviceId) return;
    const password = await requestActionPassword('ยืนยันอุปกรณ์');
    if (!password) return;
    // Immediate visual feedback
    btnVerifyPresence.style.transform = 'scale(0.95)';
    btnVerifyPresence.disabled = true;
    
    // Save original HTML content
    const originalContent = btnVerifyPresence.innerHTML;
    
    // Change to loading state
    btnVerifyPresence.innerHTML = `
      <span class="orb-content">
        <svg class="orb-icon spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle>
        </svg>
        Obtaining GPS...
      </span>
    `;

    const sendVerification = async (lat, lng) => {
      try {
        btnVerifyPresence.innerHTML = `
          <span class="orb-content">
            <svg class="orb-icon spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
              <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle>
            </svg>
            Verifying...
          </span>
        `;
        const response = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, latitude: lat, longitude: lng, password })
        });
        const data = await response.json();
        
        if (response.ok) {
          // Show success state on button
          btnVerifyPresence.innerHTML = `
            <span class="orb-content">
              <svg class="orb-icon" style="color: #10b981;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Success!
            </span>
          `;
          showToast('Verification Confirmed Successfully! ✓');
          loadData();
        } else {
          alert(data.error);
          btnVerifyPresence.innerHTML = originalContent;
        }
      } catch (err) {
        console.error(err);
        showToast('Verification submission failed');
        btnVerifyPresence.innerHTML = originalContent;
      } finally {
        setTimeout(() => {
          btnVerifyPresence.disabled = false;
          btnVerifyPresence.style.transform = '';
          // If it was success, loadData() already updated UI, but let's restore original html just in case
          if (btnVerifyPresence.innerHTML.includes('Success!') || btnVerifyPresence.innerHTML.includes('Verifying') || btnVerifyPresence.innerHTML.includes('GPS')) {
            btnVerifyPresence.innerHTML = originalContent;
          }
        }, 1500);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sendVerification(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('Geolocation failed or denied:', error);
          sendVerification(null, null);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      sendVerification(null, null);
    }
  });

  // Debug device selector handler
  clientDeviceSelect.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      localStorage.setItem('ios_device_id', selectedId);
    } else {
      localStorage.removeItem('ios_device_id');
    }
    updateClientPortal();
  });

  // --- API Action Triggers ---
  
  // Submit presence verification
  async function verifyDevice(deviceId, password) {
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, password })
      });
      const data = await response.json();
      if (response.ok) {
        showToast('Verification Confirmed Successfully! ✓');
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      showToast('Verification submission failed');
    }
  }

  // Delete device from dashboard
  async function deleteDevice(deviceId, password) {
    if (!confirm('Are you sure you want to remove this device from monitoring?')) return;
    try {
      const response = await fetch('/api/delete-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, password })
      });
      const data = await response.json();
      if (response.ok) {
        showToast('Device removed from system');
        // If the deleted device was the client simulated or stored locally, clean it
        if (localStorage.getItem('ios_device_id') === deviceId) {
          localStorage.removeItem('ios_device_id');
        }
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      showToast('Delete operation failed');
    }
  }

  // Submit device from Admin drawer
  btnSubmitDevice.addEventListener('click', async () => {
    if (addDevicePassword === null) {
      addDevicePassword = await requestActionPassword('เพิ่มอุปกรณ์');
      if (!addDevicePassword) return;
    }
    const name = newUserInfo.value.trim();
    const position = newPosition.value.trim();
    const deviceNumber = newDeviceNumber.value.trim();
    const accessories = newAccessories.value.trim();
    const type = newDeviceType.value;
    
    if (!name) {
      alert('โปรดกรอกข้อมูลผู้ใช้งาน');
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          position: position,
          deviceNumber: deviceNumber,
          accessories: accessories,
          isIOS: type === 'ios',
          userAgent: type === 'ios' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : navigator.userAgent,
          password: addDevicePassword
        })
      });
      const data = await response.json();
      if (response.ok) {
        showToast('Device added successfully!');
        // Clear all inputs
        newUserInfo.value = '';
        newPosition.value = '';
        newDeviceNumber.value = '';
        newAccessories.value = '';
        addDeviceDrawer.classList.add('hidden');
        addDevicePassword = null;
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      showToast('Registration failed');
    }
  });

  // Cancel Edit
  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', () => {
      editDeviceDrawer.classList.add('hidden');
      editDevicePassword = null;
    });
  }

  // Save Edit
  if (btnSaveEdit) {
    btnSaveEdit.addEventListener('click', async () => {
      if (editDevicePassword === null) {
        editDevicePassword = await requestActionPassword('แก้ไขอุปกรณ์');
        if (!editDevicePassword) return;
      }
      const deviceId = editDeviceId.value;
      const name = editUserInfo.value.trim();
      const position = editPosition.value.trim();
      const deviceNumber = editDeviceNumber.value.trim();
      const accessories = editAccessories.value.trim();
      const type = editDeviceType.value;
      
      if (!name) {
        alert('โปรดกรอกข้อมูลผู้ใช้งาน');
        return;
      }

      try {
        const response = await fetch('/api/edit-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: deviceId,
            name: name,
            position: position,
            deviceNumber: deviceNumber,
            accessories: accessories,
            isIOS: type === 'ios',
            password: editDevicePassword
          })
        });
        const data = await response.json();
        if (response.ok) {
          showToast('Device updated successfully!');
          editDeviceDrawer.classList.add('hidden');
          editDevicePassword = null;
          loadData();
        } else {
          alert(data.error);
        }
      } catch (err) {
        console.error(err);
        showToast('Update failed');
      }
    });
  }

  // Helper to prevent HTML injections
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  // Search & Filter input event listeners
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      updateAdminDashboard();
    });
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      updateAdminDashboard();
    });
  }

  // PDF Report Export function using html2pdf.js
  function exportToPdf() {
    if (!currentFilteredDevices || currentFilteredDevices.length === 0) {
      showToast('ไม่มีข้อมูลสำหรับส่งออก PDF');
      return;
    }

    // Create a temporary container for PDF styling
    const element = document.createElement('div');
    element.className = 'pdf-report';
    
    const now = new Date().toLocaleString();
    const statusVal = statusFilter ? statusFilter.options[statusFilter.selectedIndex].text : 'ทั้งหมด';
    const searchVal = searchInput ? searchInput.value.trim() : '';
    
    // Construct HTML content
    let tableRows = '';
    currentFilteredDevices.forEach((d, idx) => {
      let statusText = 'Unverified';
      let statusColor = '#4b5563'; // Gray
      if (d.status === 'active') {
        statusText = 'Active';
        statusColor = '#047857'; // Green
      } else if (d.status === 'pending') {
        statusText = 'Pending Verify';
        statusColor = '#b45309'; // Orange
      } else if (d.status === 'overdue') {
        statusText = 'Overdue Check';
        statusColor = '#b91c1c'; // Red
      }

      const lastChecked = d.lastVerifiedAt ? new Date(d.lastVerifiedAt).toLocaleString() : 'Never';
      const nextDue = d.nextDueAt ? new Date(d.nextDueAt).toLocaleDateString() : 'Pending Active';

      tableRows += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>
            <strong style="color: #111827; font-size: 11px;">${escapeHtml(d.userName || d.name)}</strong>
          </td>
          <td>${escapeHtml(d.position || '-')}</td>
          <td>${escapeHtml(d.deviceNumber || '-')}</td>
          <td>${escapeHtml(d.accessories || '-')}</td>
          <td><strong style="color: ${statusColor};">${statusText}</strong></td>
          <td>${lastChecked}</td>
          <td>${escapeHtml(d.address || '-')}</td>
        </tr>
      `;
    });

    element.innerHTML = `
      <style>
        .pdf-report {
          font-family: 'Plus Jakarta Sans', Arial, sans-serif;
          color: #1f2937;
          padding: 15px;
          background: #fff;
        }
        .pdf-header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 12px;
          margin-bottom: 15px;
        }
        .pdf-title {
          font-size: 20px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 6px 0;
        }
        .pdf-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-size: 10px;
          color: #4b5563;
        }
        .pdf-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5px;
          margin-top: 10px;
        }
        .pdf-table th {
          background-color: #f3f4f6;
          color: #111827;
          font-weight: 700;
          text-align: left;
          padding: 8px;
          border: 1px solid #e5e7eb;
        }
        .pdf-table td {
          padding: 8px;
          border: 1px solid #e5e7eb;
          color: #374151;
          vertical-align: top;
        }
        .pdf-table tr:nth-child(even) {
          background-color: #f9fafb;
        }
      </style>
      <div class="pdf-header">
        <h1 class="pdf-title">📋 รายงานสถานะเครื่องปลายทาง (iOS Device Status Report)</h1>
        <div class="pdf-meta-grid">
          <div>
            <strong>วันที่ออกรายงาน:</strong> ${now}<br>
            <strong>ฟิลเตอร์สถานะ:</strong> ${statusVal}
          </div>
          <div style="text-align: right;">
            <strong>คำค้นหา:</strong> ${searchVal ? `"${searchVal}"` : 'ทั้งหมด'}<br>
            <strong>รวมทั้งหมด:</strong> ${currentFilteredDevices.length} รายการ
          </div>
        </div>
      </div>
      <table class="pdf-table">
        <thead>
          <tr>
            <th style="width: 4%; text-align: center;">ลำดับ</th>
            <th style="width: 15%;">ชื่อผู้ใช้งาน (User Name)</th>
            <th style="width: 10%;">ตำแหน่ง (Position)</th>
            <th style="width: 12%;">หมายเลขเครื่อง (S/N)</th>
            <th style="width: 15%;">อุปกรณ์เสริม (Accessories)</th>
            <th style="width: 11%;">สถานะ (Status)</th>
            <th style="width: 14%;">เช็คอินล่าสุด (Last Check)</th>
            <th style="width: 19%;">ที่อยู่ล่าสุด (Address)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     `Device_Monitor_Report_${new Date().toISOString().slice(0,10)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
    };

    showToast('กำลังสร้างไฟล์ PDF... กรุณารอสักครู่');
    html2pdf().set(opt).from(element).save();
  }

  // Bind Export PDF Click Listener
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', exportToPdf);
  }

  // --- Asset Management Event Listeners ---
  
  // Tab Switching
  const btnBackToDashboard = document.getElementById('btn-back-to-dashboard');

  if (navDevicesBtn && navAssetsBtn) {
    navDevicesBtn.addEventListener('click', () => {
      navDevicesBtn.classList.replace('btn-secondary', 'btn-primary');
      navAssetsBtn.classList.replace('btn-primary', 'btn-secondary');
      devicesSection.classList.remove('hidden');
      assetsSection.classList.add('hidden');
      if (btnShowScanAsset) btnShowScanAsset.classList.add('hidden');
      
      navDevicesBtn.style.display = 'block';
      if (btnBackToDashboard) btnBackToDashboard.classList.add('hidden');
    });
    navAssetsBtn.addEventListener('click', () => {
      navAssetsBtn.classList.replace('btn-secondary', 'btn-primary');
      navDevicesBtn.classList.replace('btn-primary', 'btn-secondary');
      assetsSection.classList.remove('hidden');
      devicesSection.classList.add('hidden');
      if (btnShowScanAsset) btnShowScanAsset.classList.remove('hidden');
      
      navDevicesBtn.style.display = 'none';
      if (btnBackToDashboard) btnBackToDashboard.classList.remove('hidden');
    });

    if (btnBackToDashboard) {
      btnBackToDashboard.addEventListener('click', () => {
        navDevicesBtn.click();
      });
    }
  }

  // Drawers
  if (btnShowAddAsset) {
    btnShowAddAsset.addEventListener('click', () => {
      addAssetDrawer.classList.toggle('hidden');
      if (editAssetDrawer) editAssetDrawer.classList.add('hidden');
      if (scanAssetDrawer) scanAssetDrawer.classList.add('hidden');
      if (adminHtml5QrcodeScanner) {
        adminHtml5QrcodeScanner.clear().catch(e => console.error(e));
        adminHtml5QrcodeScanner = null;
      }
    });
  }

  // --- Admin QR Scanner Logic ---
  let adminHtml5QrcodeScanner = null;

  function initAdminQrScanner() {
    if (adminHtml5QrcodeScanner) return; // Already initialized
    adminHtml5QrcodeScanner = new Html5QrcodeScanner(
      "admin-qr-reader", 
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, 
      false
    );
    adminHtml5QrcodeScanner.render(onAdminScanSuccess, () => {});
  }

  async function onAdminScanSuccess(decodedText) {
    let assetId = decodedText;
    if (assetId.includes('/?id=')) {
      const urlParams = new URLSearchParams(assetId.split('?')[1]);
      assetId = urlParams.get('id') || decodedText;
    } else if (assetId.includes('/scanner.html?id=')) {
      const urlParams = new URLSearchParams(assetId.split('?')[1]);
      assetId = urlParams.get('id') || decodedText;
    }

    if (!assetId.startsWith('ast-')) {
      adminQrResults.textContent = "QR Code นี้ไม่ใช่ของทรัพย์สินที่รองรับ";
      return;
    }

    adminHtml5QrcodeScanner.pause();
    adminQrResults.textContent = `Processing Scan... (${assetId})`;

    try {
      const res = await fetch('/api/scan-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assetId })
      });
      const data = await res.json();
      
      if (res.ok) {
        adminQrResults.innerHTML = `<span style="color: #10b981;">✅ Check-in Success!</span><br>${data.asset.name} updated.`;
        loadData(); // reload dashboard data
      } else {
        adminQrResults.innerHTML = `<span style="color: #ef4444;">❌ Error: ${data.error}</span>`;
      }
    } catch (err) {
      adminQrResults.innerHTML = `<span style="color: #ef4444;">❌ Request Failed</span>`;
    }
    
    setTimeout(() => {
      adminQrResults.textContent = "";
      if (adminHtml5QrcodeScanner) {
        adminHtml5QrcodeScanner.resume();
      }
    }, 3000);
  }

  if (btnShowScanAsset) {
    btnShowScanAsset.addEventListener('click', () => {
      // Toggle logic
      if (scanAssetDrawer.classList.contains('hidden')) {
        scanAssetDrawer.classList.remove('hidden');
        if (addAssetDrawer) addAssetDrawer.classList.add('hidden');
        if (editAssetDrawer) editAssetDrawer.classList.add('hidden');
        if (typeof Html5QrcodeScanner !== 'undefined') {
          initAdminQrScanner();
        }
      } else {
        scanAssetDrawer.classList.add('hidden');
        if (adminHtml5QrcodeScanner) {
          adminHtml5QrcodeScanner.clear().catch(e => console.error(e));
          adminHtml5QrcodeScanner = null;
        }
      }
    });
  }

  if (btnCloseScanAsset) {
    btnCloseScanAsset.addEventListener('click', () => {
      scanAssetDrawer.classList.add('hidden');
      if (adminHtml5QrcodeScanner) {
        adminHtml5QrcodeScanner.clear().catch(e => console.error(e));
        adminHtml5QrcodeScanner = null;
      }
    });
  }

  if (btnCancelEditAsset) {
    btnCancelEditAsset.addEventListener('click', () => {
      editAssetDrawer.classList.add('hidden');
    });
  }

  if (btnCloseQrModal) {
    btnCloseQrModal.addEventListener('click', () => {
      qrModal.classList.add('hidden');
    });
  }

  // Add Asset API
  if (btnSubmitAsset) {
    btnSubmitAsset.addEventListener('click', async () => {
      const name = newAssetName.value.trim();
      if (!name) {
        showToast('Please enter an Asset Name');
        return;
      }
      let base64Image = null;
      const imageFile = document.getElementById('new-asset-image').files[0];
      if (imageFile) {
        try {
          btnSubmitAsset.textContent = 'Processing Image...';
          base64Image = await compressImage(imageFile);
        } catch (e) {
          console.error("Image compression failed", e);
        }
      }
      
      btnSubmitAsset.textContent = 'Saving...';
      btnSubmitAsset.disabled = true;

      const payload = {
        name,
        category: newAssetCategory.value.trim(),
        serialNumber: newAssetSn.value.trim(),
        location: newAssetLocation.value.trim(),
        type: 'office',
        image: base64Image
      };

      try {
        const res = await fetch('/api/register-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Asset added successfully!');
          newAssetName.value = '';
          newAssetCategory.value = '';
          newAssetSn.value = '';
          newAssetLocation.value = '';
          document.getElementById('new-asset-image').value = '';
          const fname = document.getElementById('new-asset-image-filename');
          if (fname) fname.textContent = 'ยังไม่ได้เลือกรูปภาพ';
          
          addAssetDrawer.classList.add('hidden');
          loadData();
        } else {
          showToast('Error adding asset.');
        }
      } catch (err) {
        console.error(err);
        showToast('Network error.');
      } finally {
        btnSubmitAsset.textContent = 'Save Asset';
        btnSubmitAsset.disabled = false;
      }
    });
  }

  // Edit Asset API
  if (btnSaveEditAsset) {
    btnSaveEditAsset.addEventListener('click', async () => {
      const assetId = editAssetId.value;
      const name = editAssetName.value.trim();
      
      if (!name) {
        showToast('Please enter an Asset Name');
        return;
      }
      let base64Image = undefined;
      const imageFile = document.getElementById('edit-asset-image').files[0];
      if (imageFile) {
        try {
          btnSaveEditAsset.textContent = 'Processing Image...';
          base64Image = await compressImage(imageFile);
        } catch (e) {
          console.error("Image compression failed", e);
        }
      }

      btnSaveEditAsset.textContent = 'Saving...';
      btnSaveEditAsset.disabled = true;

      const payload = {
        assetId,
        name,
        category: editAssetCategory.value.trim(),
        serialNumber: editAssetSn.value.trim(),
        location: editAssetLocation.value.trim(),
        image: base64Image
      };

      try {
        const res = await fetch('/api/edit-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Asset updated successfully!');
          btnSaveEditAsset.textContent = 'Update Asset';
          btnSaveEditAsset.disabled = false;
          editAssetDrawer.classList.add('hidden');
          loadData();
        } else {
          showToast('Error updating asset.');
        }
      } catch (err) {
        console.error(err);
        showToast('Network error.');
        btnSaveEditAsset.textContent = 'Update Asset';
        btnSaveEditAsset.disabled = false;
      }
    });
  }

  // Delete Asset API
  async function deleteAsset(assetId, password) {
    
    try {
      const res = await fetch('/api/delete-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId })
      });
      if (res.ok) {
        showToast('Asset deleted successfully!');
        loadData();
      } else {
        showToast('Failed to delete asset.');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error deleting asset.');
    }
  }

  // Load data immediately on page load
  loadData();
  // Poll every 1 second for near-instant synchronization across devices
  setInterval(loadData, 1000);
  // --- Image Preview Logic ---
  function setupImagePreview(inputId, previewImgId, previewContainerId) {
    const input = document.getElementById(inputId);
    const img = document.getElementById(previewImgId);
    const container = document.getElementById(previewContainerId);
    const filenameLabel = document.getElementById(inputId + '-filename');
    
    if (input && img && container) {
      input.addEventListener('change', function() {
        if (this.files && this.files[0]) {
          if (filenameLabel) filenameLabel.textContent = this.files[0].name;
          const reader = new FileReader();
          reader.onload = function(e) {
            img.src = e.target.result;
            container.classList.remove('hidden');
          }
          reader.readAsDataURL(this.files[0]);
        } else {
          if (filenameLabel) filenameLabel.textContent = 'ยังไม่ได้เลือกรูปภาพ';
          img.src = '';
          container.classList.add('hidden');
        }
      });
    }
  }

  setupImagePreview('new-asset-image', 'new-asset-image-preview', 'new-asset-image-preview-container');
  setupImagePreview('edit-asset-image', 'edit-asset-image-preview', 'edit-asset-image-preview-container');

  // Override window.openEditAssetModal to clear image preview
  const originalOpenEditAssetModal = window.openEditAssetModal;
  window.openEditAssetModal = (id) => {
    originalOpenEditAssetModal(id);
    document.getElementById('edit-asset-image-preview').src = '';
    document.getElementById('edit-asset-image-preview-container').classList.add('hidden');
    const fname = document.getElementById('edit-asset-image-filename');
    if (fname) fname.textContent = 'ยังไม่ได้เลือกรูปภาพ';
  };

  // --- Location Picker Map Logic ---
  const locationPickerModal = document.getElementById('location-picker-modal');
  const btnClosePicker = document.getElementById('btn-close-location-picker');
  const btnConfirmPicker = document.getElementById('btn-confirm-location-picker');
  const pickerAddressPreview = document.getElementById('picker-address-preview');
  
  let pickerMap = null;
  let pickerMarker = null;
  let currentTargetInputId = null;
  let currentPickedAddress = '';

  async function reverseGeocodeNominatim(lat, lng) {
    try {
      pickerAddressPreview.textContent = 'กำลังค้นหาที่อยู่...';
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th`);
      const data = await res.json();
      if (data && data.display_name) {
        currentPickedAddress = data.display_name;
        pickerAddressPreview.textContent = currentPickedAddress;
        return currentPickedAddress;
      }
    } catch (e) {
      console.error(e);
    }
    currentPickedAddress = `${lat}, ${lng}`;
    pickerAddressPreview.textContent = currentPickedAddress;
    return currentPickedAddress;
  }

  function openLocationPicker(targetInputId) {
    currentTargetInputId = targetInputId;
    currentPickedAddress = '';
    pickerAddressPreview.textContent = 'คลิกบนแผนที่เพื่อปักหมุดตำแหน่ง';
    locationPickerModal.classList.remove('hidden');
    
    if (!pickerMap) {
      pickerMap = L.map('picker-map-container').setView([13.736717, 100.523186], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 20
      }).addTo(pickerMap);
      
      pickerMap.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        if (!pickerMarker) {
          pickerMarker = L.marker([lat, lng]).addTo(pickerMap);
        } else {
          pickerMarker.setLatLng([lat, lng]);
        }
        await reverseGeocodeNominatim(lat, lng);
      });
    }

    setTimeout(() => {
      pickerMap.invalidateSize();
      if (!pickerMarker && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          pickerMap.setView([lat, lng], 16);
          pickerMarker = L.marker([lat, lng]).addTo(pickerMap);
          await reverseGeocodeNominatim(lat, lng);
        }, () => {});
      }
    }, 100);
  }

  const btnPickLocationNew = document.getElementById('btn-pick-location-new');
  if (btnPickLocationNew) {
    btnPickLocationNew.addEventListener('click', () => openLocationPicker('new-asset-location'));
  }

  const btnPickLocationEdit = document.getElementById('btn-pick-location-edit');
  if (btnPickLocationEdit) {
    btnPickLocationEdit.addEventListener('click', () => openLocationPicker('edit-asset-location'));
  }

  if (btnClosePicker) {
    btnClosePicker.addEventListener('click', () => {
      locationPickerModal.classList.add('hidden');
    });
  }

  if (btnConfirmPicker) {
    btnConfirmPicker.addEventListener('click', () => {
      if (currentTargetInputId && currentPickedAddress) {
        const targetInput = document.getElementById(currentTargetInputId);
        if (targetInput) {
          targetInput.value = currentPickedAddress;
        }
      }
      locationPickerModal.classList.add('hidden');
    });
  }

});
