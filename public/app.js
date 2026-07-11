document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const detectedOsTag = document.getElementById('detected-os-tag');
  const btnToggleView = document.getElementById('btn-toggle-view');
  
  // Views
  const adminView = document.getElementById('admin-view');
  const clientView = document.getElementById('client-view');
  
  // Admin DOM
  const statTotalDevices = document.getElementById('stat-total-devices');
  const statPendingDevices = document.getElementById('stat-pending-devices');
  const statOverdueDevices = document.getElementById('stat-overdue-devices');
  const btnShowAddDevice = document.getElementById('btn-show-add-device');
  const addDeviceDrawer = document.getElementById('add-device-drawer');
  const newUserInfo = document.getElementById('new-user-name');
  const newPosition = document.getElementById('new-position');
  const newDeviceNumber = document.getElementById('new-device-number');
  const newAccessories = document.getElementById('new-accessories');
  const newDeviceType = document.getElementById('new-device-type');
  const btnSubmitDevice = document.getElementById('btn-submit-device');
  const devicesListTbody = document.getElementById('devices-list-tbody');
  const emptyDevicesMsg = document.getElementById('empty-devices-msg');
  const systemLogsList = document.getElementById('system-logs-list');
  
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
  let logs = [];
  let serverIpAddress = 'localhost';
  let currentActiveView = 'admin'; // 'admin' or 'client'
  let mapInstance = null;
  let mapMarkers = {}; // Store markers by deviceId
  
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
  btnShowAddDevice.addEventListener('click', () => {
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
      const res = await fetch('/api/devices');
      const data = await res.json();
      devices = data.devices || [];
      logs = data.logs || [];
      serverIpAddress = data.serverIp || 'localhost';
      
      updateAdminDashboard();
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

  function updateAdminMap() {
    initAdminMap();
    if (!mapInstance) return;

    // Track active marker coordinates to fit bounds
    const coordinates = [];

    devices.forEach(d => {
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

    // Remove markers of deleted devices
    const currentDeviceIds = devices.map(d => d.id);
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
    const pending = devices.filter(d => d.status === 'pending').length;
    const overdue = devices.filter(d => d.status === 'overdue').length;

    statTotalDevices.textContent = total;
    statPendingDevices.textContent = pending;
    statOverdueDevices.textContent = overdue;

    // Devices Table
    devicesListTbody.innerHTML = '';
    if (devices.length === 0) {
      emptyDevicesMsg.classList.remove('hidden');
    } else {
      emptyDevicesMsg.classList.add('hidden');
      devices.forEach(d => {
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
      btn.addEventListener('click', () => verifyDevice(btn.dataset.id));
    });

    document.querySelectorAll('.btn-delete-device').forEach(btn => {
      btn.addEventListener('click', () => deleteDevice(btn.dataset.id));
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
    updateAdminMap();
  }

  // --- Client View Logic ---
  function updateClientPortal() {
    let savedDeviceId = localStorage.getItem('ios_device_id');
    
    // Check if the current saved device exists in the devices list
    const currentDevice = devices.find(d => d.id === savedDeviceId);

    // Always hide the selector panel to keep client view clean as requested
    clientDeviceSelectorPanel.classList.add('hidden');

    if (currentDevice) {
      // Device is registered, show verification screen
      clientRegistrationSection.classList.add('hidden');
      clientVerificationSection.classList.remove('hidden');
      
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
    } else {
      // Device is not registered, show registration form
      localStorage.removeItem('ios_device_id');
      clientRegistrationSection.classList.remove('hidden');
      clientVerificationSection.classList.add('hidden');
      clientDeviceHeader.textContent = isIOS ? 'New iOS Device' : 'New Client Device';
    }
  }

  // Client registration is handled solely by the Admin on the dashboard.


  // Tap orb to verify client presence
  btnVerifyPresence.addEventListener('click', async () => {
    const deviceId = localStorage.getItem('ios_device_id');
    if (!deviceId) return;
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
          body: JSON.stringify({ deviceId, latitude: lat, longitude: lng })
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
  async function verifyDevice(deviceId) {
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
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
  async function deleteDevice(deviceId) {
    if (!confirm('Are you sure you want to remove this device from monitoring?')) return;
    try {
      const response = await fetch('/api/delete-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
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
          userAgent: type === 'ios' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : navigator.userAgent
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
        loadData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      showToast('Registration failed');
    }
  });

  // Helper to prevent HTML injections
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  // Load data immediately on page load
  loadData();
  // Poll every 1 second for near-instant synchronization across devices
  setInterval(loadData, 1000);
});
