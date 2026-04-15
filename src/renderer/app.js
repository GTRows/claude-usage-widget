// Application state
let credentials = null;
let updateInterval = null;
let countdownInterval = null;
let latestUsageData = null;
let isExpanded = false;
let isCompactMode = false;
let usageChart = null;
let graphVisible = false;
let graphWasVisible = false; // preserves graph state across compact mode toggle
let historyVisible = false;
let historyRangeMs = 24 * 60 * 60 * 1000;
let historyCustomFrom = null;
let historyCustomTo = null;
let historyCustomActive = false;
let historyPage = 1;
let historyPageSize = 50;
let historyLastEntries = [];
let graphRangeMs = 24 * 60 * 60 * 1000;
let graphCustomFrom = null;
let graphCustomTo = null;
let graphCustomActive = false;
let appInitializing = true;  // suppresses _saveViewState during startup restore
let isFetching = false;       // in-flight guard — prevents overlapping fetchUsageData calls
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Debug logging — only shows in DevTools (development mode).
// Regular users won't see verbose logs in production.
const DEBUG = (new URLSearchParams(window.location.search)).has('debug');
function debugLog(...args) {
  if (DEBUG) console.log('[Debug]', ...args);
}

// DOM elements
const elements = {
    loadingContainer: document.getElementById('loadingContainer'),
    loginContainer: document.getElementById('loginContainer'),
    noUsageContainer: document.getElementById('noUsageContainer'),
    mainContent: document.getElementById('mainContent'),
    loginStep1: document.getElementById('loginStep1'),
    loginStep2: document.getElementById('loginStep2'),
    autoDetectBtn: document.getElementById('autoDetectBtn'),
    autoDetectError: document.getElementById('autoDetectError'),
    openBrowserLink: document.getElementById('openBrowserLink'),
    nextStepBtn: document.getElementById('nextStepBtn'),
    backStepBtn: document.getElementById('backStepBtn'),
    sessionKeyInput: document.getElementById('sessionKeyInput'),
    connectBtn: document.getElementById('connectBtn'),
    sessionKeyError: document.getElementById('sessionKeyError'),
    refreshBtn: document.getElementById('refreshBtn'),
    graphBtn: document.getElementById('graphBtn'),
    pinBtn: document.getElementById('pinBtn'),
    storagePath: document.getElementById('storagePath'),
    storagePathOpen: document.getElementById('storagePathOpen'),
    storageUsageHint: document.getElementById('storageUsageHint'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    exportHistoryCsvBtn: document.getElementById('exportHistoryCsvBtn'),
    exportHistoryJsonBtn: document.getElementById('exportHistoryJsonBtn'),
    exportHistoryRange: document.getElementById('exportHistoryRange'),
    autoPruneToggle: document.getElementById('autoPruneToggle'),
    autoPruneDays: document.getElementById('autoPruneDays'),
    autoPruneDaysRow: document.getElementById('autoPruneDaysRow'),
    hideFromTaskbarToggle: document.getElementById('hideFromTaskbarToggle'),
    headlessModeToggle: document.getElementById('headlessModeToggle'),
    closeBtn: document.getElementById('closeBtn'),

    sessionPercentage: document.getElementById('sessionPercentage'),
    sessionProgress: document.getElementById('sessionProgress'),
    sessionTimer: document.getElementById('sessionTimer'),
    sessionTimeText: document.getElementById('sessionTimeText'),

    weeklyPercentage: document.getElementById('weeklyPercentage'),
    weeklyProgress: document.getElementById('weeklyProgress'),
    weeklyTimer: document.getElementById('weeklyTimer'),
    weeklyTimeText: document.getElementById('weeklyTimeText'),
    weeklyResetsAt: document.getElementById('weeklyResetsAt'),

    sessionResetsAt: document.getElementById('sessionResetsAt'),

    expandToggle: document.getElementById('expandToggle'),
    expandArrow: document.getElementById('expandArrow'),
    expandSection: document.getElementById('expandSection'),
    extraRows: document.getElementById('extraRows'),
    graphSection: document.getElementById('graphSection'),
    usageChart: document.getElementById('usageChart'),
    historyBtn: document.getElementById('historyBtn'),
    historySection: document.getElementById('historySection'),
    historyRangeTabs: document.getElementById('historyRangeTabs'),
    historyTableBody: document.getElementById('historyTableBody'),
    historyCount: document.getElementById('historyCount'),
    historyEmpty: document.getElementById('historyEmpty'),
    historyRangeCustom: document.getElementById('historyRangeCustom'),
    historyRangeFrom: document.getElementById('historyRangeFrom'),
    historyRangeTo: document.getElementById('historyRangeTo'),
    historyRangeApply: document.getElementById('historyRangeApply'),
    historyPagination: document.getElementById('historyPagination'),
    historyPagePrev: document.getElementById('historyPagePrev'),
    historyPageNext: document.getElementById('historyPageNext'),
    historyPageIndicator: document.getElementById('historyPageIndicator'),
    historyPageSize: document.getElementById('historyPageSize'),
    historyPageJump: document.getElementById('historyPageJump'),
    historyPageJumpBtn: document.getElementById('historyPageJumpBtn'),
    graphRangeTabs: document.getElementById('graphRangeTabs'),
    graphRangeCustom: document.getElementById('graphRangeCustom'),
    graphRangeFrom: document.getElementById('graphRangeFrom'),
    graphRangeTo: document.getElementById('graphRangeTo'),
    graphRangeApply: document.getElementById('graphRangeApply'),

    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    autoStartToggle: document.getElementById('autoStartToggle'),
    alwaysOnTopToggle: document.getElementById('alwaysOnTopToggle'),
    warnThreshold: document.getElementById('warnThreshold'),
    dangerThreshold: document.getElementById('dangerThreshold'),
    themeBtns: document.querySelectorAll('.theme-btn'),
    themeStyleBtns: document.querySelectorAll('.theme-style-btn'),
    trayStyleSelect: document.getElementById('trayStyleSelect'),
    trayShowLogoToggle: document.getElementById('trayShowLogoToggle'),
    trayMascotInterval: document.getElementById('trayMascotInterval'),
    trayMascotIntervalRow: document.getElementById('trayMascotIntervalRow'),
    timeFormat: document.getElementById('timeFormat'),
    weeklyDateFormat: document.getElementById('weeklyDateFormat'),
    refreshInterval: document.getElementById('refreshInterval'),

    updateBanner: document.getElementById('updateBanner'),
    updateBannerText: document.getElementById('updateBannerText'),
    updateBannerDismiss: document.getElementById('updateBannerDismiss'),
    settingsVersionLabel: document.getElementById('settingsVersionLabel'),
    settingsUpdateLink: document.getElementById('settingsUpdateLink'),
    usageAlertsToggle: document.getElementById('usageAlertsToggle'),
    compactModeToggle: document.getElementById('compactModeToggle'),
    compactModeToggleCompact: document.getElementById('compactModeToggleCompact'),
    compactContent: document.getElementById('compactContent'),
    compactCollapseBtn: document.getElementById('compactCollapseBtn'),
    compactExpandBtn: document.getElementById('compactExpandBtn'),
    compactSessionFill: document.getElementById('compactSessionFill'),
    compactSessionPct: document.getElementById('compactSessionPct'),
    compactWeeklyFill: document.getElementById('compactWeeklyFill'),
    compactWeeklyPct: document.getElementById('compactWeeklyPct'),
    compactSettingsOverlay: document.getElementById('compactSettingsOverlay'),
    closeCompactSettingsBtn: document.getElementById('closeCompactSettingsBtn')
};

// Initialize
async function init() {
    setupEventListeners();
    startContentObserver();
    credentials = await window.electronAPI.getCredentials();

    // Apply saved theme and load thresholds immediately
    const settings = await window.electronAPI.getSettings();
    window._cachedSettings = settings;
    applyTheme(settings.theme);
    applyThemeStyle(settings.themeStyle || 'classic');
    if (elements.pinBtn) elements.pinBtn.classList.toggle('active', settings.alwaysOnTop !== false);
    warnThreshold = settings.warnThreshold;
    dangerThreshold = settings.dangerThreshold;

    if (settings.trayShowLogo) {
        updateTrayIcon({});
    }

    // Restore compact mode from saved settings
    if (settings.compactMode) {
        applyCompactMode(true);
    } else {
        // Ensure compact overlay is hidden in normal mode
        if (elements.compactSettingsOverlay) elements.compactSettingsOverlay.style.display = 'none';
    }

    // Restore graph visibility
    if (settings.graphVisible) {
        if (!settings.compactMode) {
            // Normal mode — show graph immediately
            graphVisible = true;
            elements.graphBtn.classList.add('active');
            elements.graphSection.style.display = 'block';
        } else {
            // Compact mode — store so it restores when exiting compact
            graphWasVisible = true;
        }
    }

    // Restore expanded state
    if (settings.expandedOpen) {
        isExpanded = true;
        elements.expandArrow.classList.add('expanded');
        elements.expandSection.style.display = 'block';
    }

    // Restore history visibility (normal mode only)
    if (settings.historyVisible && !settings.compactMode && elements.historyBtn) {
        historyVisible = true;
        elements.historyBtn.classList.add('active');
        elements.historySection.style.display = 'block';
    }

    if (credentials.sessionKey && credentials.organizationId) {
        showMainContent();
        await fetchUsageData();
        startAutoUpdate();
    } else {
        showLoginRequired();
    }

    // Populate version label then check for updates after a short delay
    const version = await window.electronAPI.getAppVersion();
    if (elements.settingsVersionLabel) {
        elements.settingsVersionLabel.textContent = `Application Version: v${version}`;
    }
    setTimeout(checkForUpdate, 2000);
    // Also check once every 24 hours for users who never close the app
    setInterval(checkForUpdate, 24 * 60 * 60 * 1000);

    // Startup restore complete — allow _saveViewState to persist changes
    appInitializing = false;
}

// Event Listeners
function setupEventListeners() {
    // Step 1: Login via BrowserWindow
    elements.autoDetectBtn.addEventListener('click', handleAutoDetect);

    // Step navigation
    elements.nextStepBtn.addEventListener('click', () => {
        elements.loginStep1.style.display = 'none';
        elements.loginStep2.style.display = 'block';
        elements.sessionKeyInput.focus();
    });

    elements.backStepBtn.addEventListener('click', () => {
        elements.loginStep2.style.display = 'none';
        elements.loginStep1.style.display = 'flex';
        elements.sessionKeyError.textContent = '';
    });

    // Open browser link in step 2
    elements.openBrowserLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.electronAPI.openExternal('https://claude.ai');
    });

    // Step 2: Manual sessionKey connect
    elements.connectBtn.addEventListener('click', handleConnect);
    elements.sessionKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleConnect();
        elements.sessionKeyError.textContent = '';
    });

    elements.refreshBtn.addEventListener('click', async () => {
        debugLog('Refresh button clicked');
        elements.refreshBtn.classList.add('spinning');
        await fetchUsageData();
        elements.refreshBtn.classList.remove('spinning');
    });

    elements.graphBtn.addEventListener('click', async () => {
        graphVisible = !graphVisible;
        elements.graphBtn.classList.toggle('active', graphVisible);
        elements.graphSection.style.display = graphVisible ? 'block' : 'none';
        if (graphVisible) {
            await loadChart();
        }
        if (!isCompactMode) resizeWidget();
        _saveViewState();
    });

    if (elements.historyBtn) {
        elements.historyBtn.addEventListener('click', async () => {
            historyVisible = !historyVisible;
            elements.historyBtn.classList.toggle('active', historyVisible);
            elements.historySection.style.display = historyVisible ? 'block' : 'none';
            if (historyVisible) await loadHistoryTable();
            if (!isCompactMode) resizeWidget();
            _saveViewState();
        });
    }

    if (elements.historyRangeTabs) {
        elements.historyRangeTabs.addEventListener('click', async (e) => {
            const btn = e.target.closest('.range-btn');
            if (!btn) return;
            elements.historyRangeTabs.querySelectorAll('.range-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
            });
            if (btn.dataset.range === 'custom') {
                historyCustomActive = true;
                elements.historyRangeCustom.style.display = 'flex';
                elements.historySection.classList.add('custom-active');
                seedCustomInputs(elements.historyRangeFrom, elements.historyRangeTo, historyCustomFrom, historyCustomTo, historyRangeMs);
                if (!isCompactMode) resizeWidget();
                const seeded = parseCustomInputs(elements.historyRangeFrom, elements.historyRangeTo);
                if (seeded) {
                    historyCustomFrom = seeded.from;
                    historyCustomTo = seeded.to;
                    historyPage = 1;
                    await loadHistoryTable();
                }
                return;
            }
            historyCustomActive = false;
            historyCustomFrom = null;
            historyCustomTo = null;
            elements.historyRangeCustom.style.display = 'none';
            elements.historySection.classList.remove('custom-active');
            const range = parseInt(btn.dataset.range, 10);
            if (!Number.isFinite(range)) return;
            historyRangeMs = range;
            historyPage = 1;
            if (!isCompactMode) resizeWidget();
            await loadHistoryTable();
        });
    }

    if (elements.historyRangeApply) {
        elements.historyRangeApply.addEventListener('click', async () => {
            const parsed = parseCustomInputs(elements.historyRangeFrom, elements.historyRangeTo);
            if (!parsed) return;
            historyCustomFrom = parsed.from;
            historyCustomTo = parsed.to;
            historyPage = 1;
            await loadHistoryTable();
        });
    }

    if (elements.historyPageSize) {
        elements.historyPageSize.addEventListener('change', () => {
            const size = parseInt(elements.historyPageSize.value, 10);
            if (!Number.isFinite(size) || size <= 0) return;
            historyPageSize = size;
            historyPage = 1;
            renderHistoryPage();
        });
    }

    if (elements.historyPagePrev) {
        elements.historyPagePrev.addEventListener('click', () => {
            if (historyPage <= 1) return;
            historyPage -= 1;
            renderHistoryPage();
        });
    }

    if (elements.historyPageNext) {
        elements.historyPageNext.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(historyLastEntries.length / historyPageSize));
            if (historyPage >= totalPages) return;
            historyPage += 1;
            renderHistoryPage();
        });
    }

    const jumpToPage = () => {
        if (!elements.historyPageJump) return;
        const totalPages = Math.max(1, Math.ceil(historyLastEntries.length / historyPageSize));
        const target = parseInt(elements.historyPageJump.value, 10);
        if (!Number.isFinite(target)) return;
        historyPage = Math.min(Math.max(1, target), totalPages);
        renderHistoryPage();
        elements.historyPageJump.value = '';
    };
    if (elements.historyPageJumpBtn) {
        elements.historyPageJumpBtn.addEventListener('click', jumpToPage);
    }
    if (elements.historyPageJump) {
        elements.historyPageJump.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') jumpToPage();
        });
    }

    if (elements.graphRangeTabs) {
        elements.graphRangeTabs.addEventListener('click', async (e) => {
            const btn = e.target.closest('.range-btn');
            if (!btn) return;
            elements.graphRangeTabs.querySelectorAll('.range-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
            });
            if (btn.dataset.range === 'custom') {
                graphCustomActive = true;
                elements.graphRangeCustom.style.display = 'flex';
                elements.graphSection.classList.add('custom-active');
                seedCustomInputs(elements.graphRangeFrom, elements.graphRangeTo, graphCustomFrom, graphCustomTo, graphRangeMs);
                if (!isCompactMode) resizeWidget();
                return;
            }
            graphCustomActive = false;
            elements.graphRangeCustom.style.display = 'none';
            elements.graphSection.classList.remove('custom-active');
            const range = parseInt(btn.dataset.range, 10);
            if (!Number.isFinite(range)) return;
            graphRangeMs = range;
            if (!isCompactMode) resizeWidget();
            await loadChart();
        });
    }

    if (elements.graphRangeApply) {
        elements.graphRangeApply.addEventListener('click', async () => {
            const parsed = parseCustomInputs(elements.graphRangeFrom, elements.graphRangeTo);
            if (!parsed) return;
            graphCustomFrom = parsed.from;
            graphCustomTo = parsed.to;
            await loadChart();
        });
    }

    if (elements.storagePathOpen && window.electronAPI.openPath) {
        elements.storagePathOpen.addEventListener('click', () => {
            const target = elements.storagePath ? elements.storagePath.dataset.userData : '';
            if (target) window.electronAPI.openPath(target);
        });
    }

    if (elements.clearHistoryBtn && window.electronAPI.clearHistory) {
        elements.clearHistoryBtn.addEventListener('click', async () => {
            if (!confirm('Delete all stored usage history? This cannot be undone.')) return;
            await window.electronAPI.clearHistory();
            await refreshStorageUsage();
            if (historyVisible) loadHistoryTable();
            if (graphVisible) loadChart();
        });
    }

    if (elements.autoPruneToggle) {
        elements.autoPruneToggle.addEventListener('change', () => {
            if (elements.autoPruneDaysRow) {
                elements.autoPruneDaysRow.style.display = elements.autoPruneToggle.checked ? 'flex' : 'none';
            }
        });
    }

    const wireExportButton = (btn, format) => {
        if (!btn || !window.electronAPI || !window.electronAPI.exportHistory) return;
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                const days = elements.exportHistoryRange ? Number(elements.exportHistoryRange.value) : 0;
                const range = (Number.isFinite(days) && days > 0)
                    ? { fromMs: Date.now() - days * 24 * 60 * 60 * 1000 }
                    : null;
                const result = await window.electronAPI.exportHistory(format, range);
                if (result && !result.canceled && result.filePath) {
                    btn.textContent = `Saved`;
                    setTimeout(() => { btn.textContent = format.toUpperCase(); }, 1500);
                }
            } catch (err) {
                console.error('exportHistory failed', err);
            } finally {
                btn.disabled = false;
            }
        });
    };
    wireExportButton(elements.exportHistoryCsvBtn, 'csv');
    wireExportButton(elements.exportHistoryJsonBtn, 'json');

    if (window.electronAPI.getStorageInfo) {
        window.electronAPI.getStorageInfo().then((info) => {
            if (!info || !elements.storagePath) return;
            elements.storagePath.textContent = info.storeFile || info.userData;
            elements.storagePath.title = info.storeFile || info.userData;
            elements.storagePath.dataset.userData = info.userData || '';
        }).catch(() => {});
    }

    if (elements.pinBtn) {
        elements.pinBtn.addEventListener('click', async () => {
            const current = !!(window._cachedSettings && window._cachedSettings.alwaysOnTop);
            const next = !current;
            if (elements.alwaysOnTopToggle) elements.alwaysOnTopToggle.checked = next;
            elements.pinBtn.classList.toggle('active', next);
            window._cachedSettings = { ...(window._cachedSettings || {}), alwaysOnTop: next };
            await window.electronAPI.saveSettings({ ...window._cachedSettings });
        });
    }

    elements.closeBtn.addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

    // Expand/collapse toggle
    elements.expandToggle.addEventListener('click', () => {
        isExpanded = !isExpanded;
        elements.expandArrow.classList.toggle('expanded', isExpanded);
        elements.expandSection.style.display = isExpanded ? 'block' : 'none';
        if (graphVisible) {
            loadChart();
        }
        resizeWidget();
        _saveViewState();
    });

    // Settings close
    elements.closeSettingsBtn.addEventListener('click', async () => {
        await saveSettings();
        elements.settingsOverlay.style.display = 'none';
        _settingsOpen = false;
        _lastResizeHeight = 0;
        if (window.electronAPI.setSettingsWindow) {
            window.electronAPI.setSettingsWindow(false);
        }
        resizeWidget();
        startAutoUpdate();
    });

    // Live settings — save on every change inside the settings overlay
    if (elements.settingsOverlay) {
        let liveTimer = null;
        const scheduleLiveSave = () => {
            if (liveTimer) clearTimeout(liveTimer);
            liveTimer = setTimeout(() => { saveSettings(); }, 180);
        };
        elements.settingsOverlay.addEventListener('change', (e) => {
            if (e.target.closest('.settings-rows')) scheduleLiveSave();
        });
        elements.settingsOverlay.addEventListener('input', (e) => {
            if (e.target.matches('input[type="number"], input[type="text"]')) scheduleLiveSave();
        });
    }

    elements.logoutBtn.addEventListener('click', async () => {
        await window.electronAPI.deleteCredentials();
        credentials = { sessionKey: null, organizationId: null };
        elements.settingsOverlay.style.display = 'none';
        _settingsOpen = false;
        _lastResizeHeight = 0;
        showLoginRequired();
    });

    // Theme buttons
    elements.themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyTheme(btn.dataset.theme);
        });
    });

    // Theme style buttons
    elements.themeStyleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.themeStyleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyThemeStyle(btn.dataset.themeStyle);
        });
    });

    // Listen for refresh requests from tray
    window.electronAPI.onRefreshUsage(async () => {
        if (elements.refreshBtn) elements.refreshBtn.classList.add('spinning');
        await fetchUsageData();
        if (elements.refreshBtn) elements.refreshBtn.classList.remove('spinning');
    });

    // Listen for session expiration events (403 errors)
    window.electronAPI.onSessionExpired(() => {
        debugLog('Session expired event received');
        credentials = { sessionKey: null, organizationId: null };
        showLoginRequired();
    });

    // Update banner
    elements.updateBannerDismiss.addEventListener('click', () => {
        elements.updateBanner.style.display = 'none';
        resizeWidget();
    });
    elements.updateBannerText.addEventListener('click', () => {
        window.electronAPI.openExternal(`https://github.com/GTRows/claude-usage-widget/releases/latest`);
    });
    elements.settingsUpdateLink.addEventListener('click', () => {
        window.electronAPI.openExternal(`https://github.com/GTRows/claude-usage-widget/releases/latest`);
    });

    // Compact mode — collapse chevron (normal → compact)
    elements.compactCollapseBtn.addEventListener('click', async () => {
        applyCompactMode(true);
        await _saveCompactSetting(true);
    });

    // Compact mode — expand chevron (compact → normal)
    elements.compactExpandBtn.addEventListener('click', async () => {
        applyCompactMode(false);
        await _saveCompactSetting(false);
    });

    // Compact mode toggle in normal settings panel — deferred to Done click

    // Settings button — always opens full settings, temporarily upsizing window
    elements.settingsBtn.addEventListener('click', async () => {
        stopAutoUpdate();
        await loadSettings();
        elements.settingsOverlay.style.display = 'flex';
        _settingsOpen = true;
        _lastResizeHeight = SETTINGS_HEIGHT;
        if (window.electronAPI.setSettingsWindow) {
            window.electronAPI.setSettingsWindow(true);
        } else {
            window.electronAPI.resizeWindow(SETTINGS_HEIGHT);
        }
    });
}

// Handle manual sessionKey connect
async function handleConnect() {
    const sessionKey = elements.sessionKeyInput.value.trim();
    if (!sessionKey) {
        elements.sessionKeyError.textContent = 'Please paste your session key';
        return;
    }

    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = '...';
    elements.sessionKeyError.textContent = '';

    try {
        const result = await window.electronAPI.validateSessionKey(sessionKey);
        if (result.success) {
            credentials = { sessionKey, organizationId: result.organizationId };
            await window.electronAPI.saveCredentials(credentials);
            elements.sessionKeyInput.value = '';
            showMainContent();
            await fetchUsageData();
            startAutoUpdate();
        } else {
            elements.sessionKeyError.textContent = result.error || 'Invalid session key';
        }
    } catch (error) {
        elements.sessionKeyError.textContent = 'Connection failed. Check your key.';
    } finally {
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = 'Connect';
    }
}

// Handle auto-detect from browser cookies
async function handleAutoDetect() {
    elements.autoDetectBtn.disabled = true;
    elements.autoDetectBtn.textContent = 'Waiting...';
    elements.autoDetectError.textContent = '';

    try {
        const result = await window.electronAPI.detectSessionKey();
        if (!result.success) {
            elements.autoDetectError.textContent = result.error || 'Login failed';
            return;
        }

        // Got sessionKey from login, now validate it
        elements.autoDetectBtn.textContent = 'Validating...';
        const validation = await window.electronAPI.validateSessionKey(result.sessionKey);

        if (validation.success) {
            credentials = {
                sessionKey: result.sessionKey,
                organizationId: validation.organizationId
            };
            await window.electronAPI.saveCredentials(credentials);
            showMainContent();
            await fetchUsageData();
            startAutoUpdate();
        } else {
            elements.autoDetectError.textContent =
                'Session invalid. Try again or use Manual →';
        }
    } catch (error) {
        elements.autoDetectError.textContent = error.message || 'Login failed';
    } finally {
        elements.autoDetectBtn.disabled = false;
        elements.autoDetectBtn.textContent = 'Log in';
    }
}

// Fetch usage data from Claude API
async function fetchUsageData() {
    debugLog('fetchUsageData called');

    if (isFetching) {
        debugLog('Fetch already in flight — skipping');
        return;
    }

    if (!credentials.sessionKey || !credentials.organizationId) {
        debugLog('Missing credentials, showing login');
        showLoginRequired();
        return;
    }

    isFetching = true;
    try {
        debugLog('Calling electronAPI.fetchUsageData...');
        const data = await window.electronAPI.fetchUsageData();
        debugLog('Received usage data:', data);
        updateUI(data);
    } catch (error) {
        console.error('Error fetching usage data:', error);
        if (error.message.includes('SessionExpired') || error.message.includes('Unauthorized')) {
            credentials = { sessionKey: null, organizationId: null };
            showLoginRequired();
        } else {
            debugLog('Failed to fetch usage data');
        }
    } finally {
        isFetching = false;
    }
}


// Update UI with usage data
// Format a cent-based amount with the correct currency symbol.
// Known unambiguous symbols are used; everything else falls back to the
// ISO 4217 code as a suffix so the display is always correct.
function formatCurrency(amountCents, currencyCode) {
  const amount = (amountCents / 100).toFixed(0);
  const symbols = { USD: '$', EUR: '€', GBP: '£' };
  const sym = symbols[currencyCode];
  return sym ? `${sym}${amount}` : `${amount} ${currencyCode || 'USD'}`;
}

// Extra row label mapping for API fields
const EXTRA_ROW_CONFIG = {
    seven_day_sonnet: { label: 'Sonnet (7d)', color: 'weekly' },
    seven_day_opus: { label: 'Opus (7d)', color: 'opus' },
    seven_day_cowork: { label: 'Cowork (7d)', color: 'weekly' },
    seven_day_oauth_apps: { label: 'OAuth Apps (7d)', color: 'weekly' },
    extra_usage: { label: 'Extra Usage', color: 'extra' },
};

function buildExtraRows(data) {
    elements.extraRows.innerHTML = '';
    let count = 0;

    for (const [key, config] of Object.entries(EXTRA_ROW_CONFIG)) {
        const value = data[key];
        // extra_usage is valid with utilization OR balance_cents (prepaid only)
        const hasUtilization = value && value.utilization !== undefined;
        const hasBalance = key === 'extra_usage' && value && value.balance_cents != null;
        if (!hasUtilization && !hasBalance) continue;

        const utilization = value.utilization || 0;
        const resetsAt = value.resets_at;
        const colorClass = config.color;

        const row = document.createElement('div');
        row.className = 'usage-section';

        // Build row using DOM methods (no innerHTML)
        const label = document.createElement('span');
        label.className = 'usage-label';
        
        if (key === 'extra_usage') {
            // Extra usage: ON/OFF indicator goes next to label
            if (value.is_enabled === true) {
                const statusTag = document.createElement('span');
                statusTag.className = 'extra-status on';
                statusTag.textContent = 'ON';
                label.appendChild(statusTag);
            } else if (value.is_enabled === false) {
                const statusTag = document.createElement('span');
                statusTag.className = 'extra-status off';
                statusTag.textContent = 'OFF';
                label.appendChild(statusTag);
            }
            label.appendChild(document.createTextNode(' Extra Usage'));
        } else {
            label.textContent = config.label;
        }
        row.appendChild(label);

        if (key === 'extra_usage') {
            // Extra usage: bar col shows $used/$limit, elapsed col empty, timer col shows account credits
            const barGroup = document.createElement('div');
            barGroup.className = 'usage-bar-group';
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            const progressFill = document.createElement('div');
            progressFill.className = `progress-fill ${colorClass}`;
            progressFill.style.width = `${Math.min(utilization, 100)}%`;
            
            // Apply warning/danger thresholds to extra usage bar
            if (utilization >= dangerThreshold) {
                progressFill.classList.add('danger');
            } else if (utilization >= warnThreshold) {
                progressFill.classList.add('warning');
            }
            
            progressBar.appendChild(progressFill);
            barGroup.appendChild(progressBar);

            const percentage = document.createElement('span');
            if (value.used_cents != null && value.limit_cents != null) {
                percentage.className = 'usage-percentage extra-spending';
                percentage.textContent = `${formatCurrency(value.used_cents, value.currency)}/${formatCurrency(value.limit_cents, value.currency)}`;
            } else {
                percentage.className = 'usage-percentage';
                percentage.textContent = `${Math.round(utilization)}%`;
            }
            barGroup.appendChild(percentage);
            row.appendChild(barGroup);

            const elapsedGroup = document.createElement('div');
            elapsedGroup.className = 'usage-elapsed-group';
            row.appendChild(elapsedGroup);

            const timerText = document.createElement('span');
            timerText.className = 'timer-text extra-balance-label';
            timerText.textContent = 'Account Credits:';
            row.appendChild(timerText);

            const resetsText = document.createElement('span');
            resetsText.className = 'resets-at-text extra-balance-amount';
            if (value.balance_cents != null) {
                resetsText.textContent = formatCurrency(value.balance_cents, value.currency);
            }
            row.appendChild(resetsText);
        } else {
            const totalMinutes = key.includes('seven_day') ? 7 * 24 * 60 : 5 * 60;

            const barGroup = document.createElement('div');
            barGroup.className = 'usage-bar-group';
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            const progressFill = document.createElement('div');
            progressFill.className = `progress-fill ${colorClass}`;
            progressFill.style.width = `${Math.min(utilization, 100)}%`;
            progressBar.appendChild(progressFill);
            barGroup.appendChild(progressBar);

            const percentage = document.createElement('span');
            percentage.className = 'usage-percentage';
            percentage.textContent = `${Math.round(utilization)}%`;
            barGroup.appendChild(percentage);
            row.appendChild(barGroup);

            const elapsedGroup = document.createElement('div');
            elapsedGroup.className = 'usage-elapsed-group';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'mini-timer');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.setAttribute('viewBox', '0 0 24 24');
            const circleBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circleBg.setAttribute('class', 'timer-bg');
            circleBg.setAttribute('cx', '12');
            circleBg.setAttribute('cy', '12');
            circleBg.setAttribute('r', '10');
            svg.appendChild(circleBg);
            const circleProgress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circleProgress.setAttribute('class', `timer-progress ${colorClass}`);
            circleProgress.setAttribute('cx', '12');
            circleProgress.setAttribute('cy', '12');
            circleProgress.setAttribute('r', '10');
            circleProgress.style.strokeDasharray = '63';
            circleProgress.style.strokeDashoffset = '63';
            svg.appendChild(circleProgress);
            elapsedGroup.appendChild(svg);
            row.appendChild(elapsedGroup);

            const timerText = document.createElement('div');
            timerText.className = 'timer-text';
            timerText.dataset.resets = resetsAt || '';
            timerText.dataset.total = totalMinutes;
            timerText.textContent = '--:--';
            row.appendChild(timerText);

            const resetsText = document.createElement('span');
            resetsText.className = 'resets-at-text';
            row.appendChild(resetsText);
        }

        elements.extraRows.appendChild(row);
        count++;
    }

    // Hide toggle if no extra rows
    elements.expandToggle.style.display = count > 0 ? 'flex' : 'none';
    if (count === 0 && isExpanded) {
        isExpanded = false;
        elements.expandArrow.classList.remove('expanded');
        elements.expandSection.style.display = 'none';
    }

    return count;
}

function refreshExtraTimers() {
    const timerTexts = elements.extraRows.querySelectorAll('.timer-text');
    const timerCircles = elements.extraRows.querySelectorAll('.timer-progress');

    timerTexts.forEach((textEl, i) => {
        const resetsAt = textEl.dataset.resets;
        const totalMinutes = parseInt(textEl.dataset.total);
        const circleEl = timerCircles[i];
        if (resetsAt && circleEl) {
            updateTimer(circleEl, textEl, resetsAt, totalMinutes);
        }
    });
}

let _lastResizeHeight = 0;
let _settingsOpen = false;
const SETTINGS_HEIGHT = 640;
function measureAndResize() {
    if (_settingsOpen) return;
    const container = document.getElementById('widgetContainer');
    if (!container) return;
    let total = 0;
    for (const child of container.children) {
        const style = getComputedStyle(child);
        if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed') continue;
        const mt = parseFloat(style.marginTop) || 0;
        const mb = parseFloat(style.marginBottom) || 0;
        total += child.offsetHeight + mt + mb;
    }
    const padding = 12;
    const height = Math.max(Math.ceil(total) + padding, 120);
    if (height === _lastResizeHeight) return;
    _lastResizeHeight = height;
    window.electronAPI.resizeWindow(height);
}

function resizeWidget() {
    requestAnimationFrame(() => {
        requestAnimationFrame(measureAndResize);
    });
}

let _contentObserver = null;
function startContentObserver() {
    if (_contentObserver) return;
    const container = document.getElementById('widgetContainer');
    if (!container || typeof ResizeObserver === 'undefined') return;
    let pending = false;
    _contentObserver = new ResizeObserver(() => {
        if (isCompactMode) return;
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            measureAndResize();
        });
    });
    for (const child of container.children) {
        _contentObserver.observe(child);
    }
}

function updateUI(data) {
    latestUsageData = data;

    showMainContent();
    updateTrayIcon(data);
    buildExtraRows(data);
    refreshTimers();
    if (isExpanded) refreshExtraTimers();
    if (!isCompactMode) resizeWidget();
    startCountdown();
    if (graphVisible) {
        loadChart();
    }
    if (historyVisible) {
        loadHistoryTable();
    }

    // Update compact bars in parallel if compact mode is active
    if (isCompactMode) updateCompactBars(data);

    // On first load, seed alert flags so we don't fire for thresholds
    // the user can already see when the app starts
    if (isFirstDataLoad) {
        isFirstDataLoad = false;
        seedAlertFlags(data);
    }

    checkUsageAlerts(data);
}

// Fire OS desktop notifications when usage crosses warn/danger thresholds.
// Only fires once per threshold crossing per session window — not on every refresh.
function checkUsageAlerts(data) {
    const settings = window._cachedSettings || {};
    if (!settings.usageAlerts) return;

    const sessionPct = data.five_hour?.utilization || 0;
    const weeklyPct = data.seven_day?.utilization || 0;

    // Reset alert flags when a session window resets (utilization drops back low)
    if (sessionPct < warnThreshold) {
        alertFired.session_warn = false;
        alertFired.session_danger = false;
    }
    if (weeklyPct < warnThreshold) {
        alertFired.weekly_warn = false;
        alertFired.weekly_danger = false;
    }

    // Current Session — danger threshold (check first, higher priority)
    if (sessionPct >= dangerThreshold && !alertFired.session_danger) {
        alertFired.session_danger = true;
        alertFired.session_warn = true; // suppress warn if we jumped straight to danger
        window.electronAPI.showNotification(
            'Claude Widget (GTRows)',
            `Current Session usage is at ${Math.round(sessionPct)}% — running low`
        );
    // Current Session — warn threshold
    } else if (sessionPct >= warnThreshold && !alertFired.session_warn) {
        alertFired.session_warn = true;
        window.electronAPI.showNotification(
            'Claude Widget (GTRows)',
            `Current Session usage has reached ${Math.round(sessionPct)}%`
        );
    }

    // Weekly Limit — danger threshold
    if (weeklyPct >= dangerThreshold && !alertFired.weekly_danger) {
        alertFired.weekly_danger = true;
        alertFired.weekly_warn = true;
        window.electronAPI.showNotification(
            'Claude Widget (GTRows)',
            `Weekly Limit usage is at ${Math.round(weeklyPct)}% — running low`
        );
    // Weekly Limit — warn threshold
    } else if (weeklyPct >= warnThreshold && !alertFired.weekly_warn) {
        alertFired.weekly_warn = true;
        window.electronAPI.showNotification(
            'Claude Widget (GTRows)',
            `Weekly Limit usage has reached ${Math.round(weeklyPct)}%`
        );
    }
}

// Apply or remove compact mode — switches view, resizes window, syncs all toggles
function applyCompactMode(compact) {
    isCompactMode = compact;

    // Show/hide the correct content view
    elements.mainContent.style.display = compact ? 'none' : 'block';
    elements.compactContent.style.display = compact ? 'flex' : 'none';

    // Collapse extra rows when entering compact — prevents stale isExpanded state
    if (compact && isExpanded) {
        isExpanded = false;
        elements.expandArrow.classList.remove('expanded');
        elements.expandSection.style.display = 'none';
    }

    if (compact && graphVisible) {
        graphWasVisible = true;
        graphVisible = false;
        elements.graphBtn.classList.remove('active');
        elements.graphSection.style.display = 'none';
    } else if (!compact && graphWasVisible) {
        graphWasVisible = false;
        graphVisible = true;
        elements.graphBtn.classList.add('active');
        elements.graphSection.style.display = 'block';
        loadChart();
    }

    if (compact && historyVisible) {
        historyVisible = false;
        if (elements.historyBtn) elements.historyBtn.classList.remove('active');
        if (elements.historySection) elements.historySection.style.display = 'none';
    }

    // Show/hide the collapse chevron (only visible in normal mode with data)
    if (elements.compactCollapseBtn) {
        elements.compactCollapseBtn.style.display = compact ? 'none' : 'flex';
    }

    // Keep refresh button visible in compact mode so users can see when data updates
    // Hide graph button in compact mode (not applicable)
    if (elements.graphBtn) {
        elements.graphBtn.style.display = compact ? 'none' : '';
    }
    if (elements.historyBtn) {
        elements.historyBtn.style.display = compact ? 'none' : '';
    }

    // Tell main process to resize the window width
    window.electronAPI.setCompactMode(compact);

    // Sync both settings toggles
    if (elements.compactModeToggle) elements.compactModeToggle.checked = compact;
    if (elements.compactModeToggleCompact) elements.compactModeToggleCompact.checked = compact;

    // Update compact bars if we have data
    if (compact && latestUsageData) updateCompactBars(latestUsageData);
    _lastResizeHeight = 0;
    resizeWidget();

    // Persist graph/expanded state changes caused by compact mode toggle
    _saveViewState();
}

// Update the compact mode progress bars
function updateCompactBars(data) {
    const sessionPct = Math.min(Math.max(data.five_hour?.utilization || 0, 0), 100);
    const weeklyPct = Math.min(Math.max(data.seven_day?.utilization || 0, 0), 100);

    elements.compactSessionFill.style.width = `${sessionPct}%`;
    elements.compactSessionPct.textContent = `${Math.round(sessionPct)}%`;
    elements.compactWeeklyFill.style.width = `${weeklyPct}%`;
    elements.compactWeeklyPct.textContent = `${Math.round(weeklyPct)}%`;

    // Apply warning/danger classes to compact bars
    elements.compactSessionFill.className = 'compact-bar-fill';
    if (sessionPct >= dangerThreshold) elements.compactSessionFill.classList.add('danger');
    else if (sessionPct >= warnThreshold) elements.compactSessionFill.classList.add('warning');

    elements.compactWeeklyFill.className = 'compact-bar-fill weekly';
    if (weeklyPct >= dangerThreshold) elements.compactWeeklyFill.classList.add('danger');
    else if (weeklyPct >= warnThreshold) elements.compactWeeklyFill.classList.add('warning');
}
// Persist compact mode setting without touching the rest of settings — debounced
let _saveCompactTimer = null;
async function _saveCompactSetting(compact) {
    if (_saveCompactTimer) clearTimeout(_saveCompactTimer);
    _saveCompactTimer = setTimeout(async () => {
        const settings = window._cachedSettings || await window.electronAPI.getSettings();
        settings.compactMode = compact;
        window._cachedSettings = settings;
        await window.electronAPI.saveSettings(settings);
    }, 300);
}

// Persist graph/expanded visibility state — debounced to avoid hammering disk on rapid toggles
let _saveViewStateTimer = null;
async function _saveViewState() {
    if (appInitializing) return;
    if (_saveViewStateTimer) clearTimeout(_saveViewStateTimer);
    _saveViewStateTimer = setTimeout(async () => {
        const settings = window._cachedSettings || await window.electronAPI.getSettings();
        settings.graphVisible = graphVisible;
        settings.expandedOpen = isExpanded;
        settings.historyVisible = historyVisible;
        window._cachedSettings = settings;
        await window.electronAPI.saveSettings(settings);
    }, 300);
}

let sessionResetTriggered = false;
let weeklyResetTriggered = false;
let isFirstDataLoad = true; // used to seed alert flags on startup

// Track which usage alert thresholds have already fired this window
// Prevents repeat notifications on every refresh cycle
// Keys: 'session_warn', 'session_danger', 'weekly_warn', 'weekly_danger'
// Seeded on startup so thresholds already exceeded at launch don't fire immediately
const alertFired = {
    session_warn: false,
    session_danger: false,
    weekly_warn: false,
    weekly_danger: false
};

// Seed alertFired flags based on current utilization at startup.
// Any threshold already exceeded when the app launches is treated as already fired,
// so the user doesn't get a notification for something they can already see.
function seedAlertFlags(data) {
    const sessionPct = data.five_hour?.utilization || 0;
    const weeklyPct = data.seven_day?.utilization || 0;

    if (sessionPct >= dangerThreshold) {
        alertFired.session_danger = true;
        alertFired.session_warn = true;
    } else if (sessionPct >= warnThreshold) {
        alertFired.session_warn = true;
    }

    if (weeklyPct >= dangerThreshold) {
        alertFired.weekly_danger = true;
        alertFired.weekly_warn = true;
    } else if (weeklyPct >= warnThreshold) {
        alertFired.weekly_warn = true;
    }
}

function refreshTimers() {
    if (!latestUsageData) return;

    const settings = window._cachedSettings || {};
    const timeFormat = settings.timeFormat || '12h';
    const weeklyDateFormat = settings.weeklyDateFormat || 'date';

    // Session data
    const sessionUtilization = latestUsageData.five_hour?.utilization || 0;
    const sessionResetsAt = latestUsageData.five_hour?.resets_at;

    // Check if session timer has expired and we need to refresh
    if (sessionResetsAt) {
        const sessionDiff = new Date(sessionResetsAt) - new Date();
        if (sessionDiff <= 0 && !sessionResetTriggered) {
            sessionResetTriggered = true;
            debugLog('Session timer expired, triggering refresh...');
            // Wait a few seconds for the server to update, then refresh
            setTimeout(() => {
                fetchUsageData();
                checkForUpdate();
            }, 3000);
        } else if (sessionDiff > 0) {
            sessionResetTriggered = false; // Reset flag when timer is active again
        }
    }

    updateProgressBar(
        elements.sessionProgress,
        elements.sessionPercentage,
        sessionUtilization
    );

    updateTimer(
        elements.sessionTimer,
        elements.sessionTimeText,
        sessionResetsAt,
        5 * 60 // 5 hours in minutes
    );
    elements.sessionResetsAt.textContent = formatResetsAt(sessionResetsAt, false, timeFormat, weeklyDateFormat);
    elements.sessionResetsAt.style.opacity = sessionResetsAt ? '1' : '0.4';

    // Weekly data
    const weeklyUtilization = latestUsageData.seven_day?.utilization || 0;
    const weeklyResetsAt = latestUsageData.seven_day?.resets_at;

    // Check if weekly timer has expired and we need to refresh
    if (weeklyResetsAt) {
        const weeklyDiff = new Date(weeklyResetsAt) - new Date();
        if (weeklyDiff <= 0 && !weeklyResetTriggered) {
            weeklyResetTriggered = true;
            debugLog('Weekly timer expired, triggering refresh...');
            setTimeout(() => {
                fetchUsageData();
            }, 3000);
        } else if (weeklyDiff > 0) {
            weeklyResetTriggered = false;
        }
    }

    updateProgressBar(
        elements.weeklyProgress,
        elements.weeklyPercentage,
        weeklyUtilization,
        true
    );

    updateTimer(
        elements.weeklyTimer,
        elements.weeklyTimeText,
        weeklyResetsAt,
        7 * 24 * 60 // 7 days in minutes
    );
    elements.weeklyResetsAt.textContent = formatResetsAt(weeklyResetsAt, true, timeFormat, weeklyDateFormat);
    elements.weeklyResetsAt.style.opacity = weeklyResetsAt ? '1' : '0.4';
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        refreshTimers();
        if (isExpanded) refreshExtraTimers();
    }, 1000);
}

// Build a pre-rendered tray icon frame for a single metric.
// Layout is controlled by the user's "Tray style" setting.
function buildTrayFrame(label, percent) {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const pct = Math.max(0, Math.min(100, percent));
    const rounded = Math.round(pct);
    let color = '#10b981';
    if (pct >= dangerThreshold) color = '#ef4444';
    else if (pct >= warnThreshold) color = '#f59e0b';

    const style = (window._cachedSettings && window._cachedSettings.trayStyle) || 'bigNumber';

    if (style === 'ring') {
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        const start = -Math.PI / 2;
        const end = start + (pct / 100) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, start, end);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rounded >= 100 ? '100' : `${rounded}`, size / 2, size / 2 + 1);
    } else if (style === 'bar') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(2, size - 7, size - 4, 5);
        ctx.fillStyle = color;
        ctx.fillRect(2, size - 7, Math.round((size - 4) * pct / 100), 5);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rounded >= 100 ? '100' : `${rounded}`, size / 2, (size - 8) / 2 + 1);
    } else if (style === 'dot') {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rounded >= 100 ? '99' : `${rounded}`, size / 2, size / 2 + 1);
    } else {
        // bigNumber (default) — fills the tray edge-to-edge for maximum readability
        ctx.fillStyle = color;
        const text = rounded >= 100 ? '100' : `${rounded}`;
        const maxW = size;
        const maxH = size;
        let fontSize = 64;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const family = text.length >= 3
            ? '"Arial Narrow", "Segoe UI Semibold", system-ui, sans-serif'
            : '"Segoe UI", system-ui, sans-serif';
        while (fontSize > 8) {
            ctx.font = `900 ${fontSize}px ${family}`;
            const m = ctx.measureText(text);
            const h = (m.actualBoundingBoxAscent || fontSize * 0.78) + (m.actualBoundingBoxDescent || fontSize * 0.22);
            if (m.width <= maxW && h <= maxH) break;
            fontSize -= 1;
        }
        ctx.fillText(text, size / 2, size / 2 + 1);
    }

    return {
        dataURL: canvas.toDataURL('image/png'),
        tooltip: `${label}: ${rounded}%`,
        title: ` ${rounded}%`,
        duration: 2600
    };
}

// Parametric mascot painter — draws Claude's star with a given expression and
// per-frame modifiers (scale pulse, rotation, jitter). All mascot animations
// are generated by sweeping a time parameter through this function.
function _drawMascot(ctx, size, opts) {
    const {
        color = '#d97757',
        eye = 'open',     // 'open' | 'closed' | 'x' | 'happy' | 'wide' | 'dots'
        mouth = 'smile',  // 'smile' | 'flat' | 'tongue' | 'ohh' | 'none'
        scale = 1,
        rotate = 0,
        jitterX = 0,
        jitterY = 0,
        eyeOffsetX = 0,
        accent = '#1f1203'
    } = opts;

    const cx = size / 2 + jitterX;
    const cy = size / 2 + jitterY;
    const outer = (size / 2 - 1) * scale;
    const inner = outer * 0.40;
    const spokes = 10;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotate);

    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < spokes * 2; i += 1) {
        const r = i % 2 === 0 ? outer : inner;
        const angle = (Math.PI / spokes) * i - Math.PI / 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Face (drawn in fixed frame so expressions stay readable through rotation)
    const eyeY = cy - 2;
    const eyeLX = cx - 4 + eyeOffsetX;
    const eyeRX = cx + 4 + eyeOffsetX;

    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';

    if (eye === 'open' || eye === 'dots') {
        ctx.beginPath();
        ctx.arc(eyeLX, eyeY, 1.4, 0, Math.PI * 2);
        ctx.arc(eyeRX, eyeY, 1.4, 0, Math.PI * 2);
        ctx.fill();
    } else if (eye === 'wide') {
        ctx.beginPath();
        ctx.arc(eyeLX, eyeY, 2.2, 0, Math.PI * 2);
        ctx.arc(eyeRX, eyeY, 2.2, 0, Math.PI * 2);
        ctx.fill();
    } else if (eye === 'closed') {
        ctx.beginPath();
        ctx.moveTo(eyeLX - 2, eyeY);
        ctx.lineTo(eyeLX + 2, eyeY);
        ctx.moveTo(eyeRX - 2, eyeY);
        ctx.lineTo(eyeRX + 2, eyeY);
        ctx.stroke();
    } else if (eye === 'happy') {
        ctx.beginPath();
        ctx.arc(eyeLX, eyeY, 2, Math.PI, 0, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(eyeRX, eyeY, 2, Math.PI, 0, true);
        ctx.stroke();
    } else if (eye === 'x') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        const drawX = (ex, ey, r) => {
            ctx.beginPath();
            ctx.moveTo(ex - r, ey - r);
            ctx.lineTo(ex + r, ey + r);
            ctx.moveTo(ex + r, ey - r);
            ctx.lineTo(ex - r, ey + r);
            ctx.stroke();
        };
        drawX(eyeLX, eyeY, 2.4);
        drawX(eyeRX, eyeY, 2.4);
    }

    const mouthY = cy + 5;
    ctx.strokeStyle = eye === 'x' ? '#ffffff' : accent;
    ctx.lineWidth = 1.8;
    if (mouth === 'smile') {
        ctx.beginPath();
        ctx.arc(cx, mouthY - 1, 3, 0, Math.PI, false);
        ctx.stroke();
    } else if (mouth === 'flat') {
        ctx.beginPath();
        ctx.moveTo(cx - 3, mouthY);
        ctx.lineTo(cx + 3, mouthY);
        ctx.stroke();
    } else if (mouth === 'ohh') {
        ctx.beginPath();
        ctx.arc(cx, mouthY, 1.8, 0, Math.PI * 2);
        ctx.stroke();
    } else if (mouth === 'tongue') {
        ctx.beginPath();
        ctx.moveTo(cx - 4, mouthY - 1);
        ctx.lineTo(cx - 2, mouthY + 1);
        ctx.lineTo(cx, mouthY - 1);
        ctx.lineTo(cx + 2, mouthY + 1);
        ctx.lineTo(cx + 4, mouthY - 1);
        ctx.stroke();
    }
}

function _frameFromMascot(opts, overlay) {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    _drawMascot(ctx, size, opts);
    if (typeof overlay === 'function') overlay(ctx, size);
    return canvas.toDataURL('image/png');
}

// Build a full animation sequence for a given status. Each returned frame
// carries its own `duration` in ms so main.js can pace the cycle non-uniformly.
// Frame durations are scaled so the full cycle matches settings.trayMascotInterval
// (seconds), letting users speed up or slow down the mascot.
function buildMascotAnimation(status) {
    const frames = [];
    const push = (dataURL, duration, tooltip, title) => frames.push({ dataURL, duration, tooltip: tooltip || '', title: title || '' });

    if (status === 'zero') {
        // Sleepy idle — gentle breathing, closed eyes, z's drifting.
        const breath = [0.94, 0.98, 1.02, 1.00];
        for (let i = 0; i < 4; i += 1) {
            const s = breath[i];
            const zPos = i; // drift frame
            const dataURL = _frameFromMascot(
                { color: '#6b7280', eye: 'closed', mouth: 'flat', scale: s, accent: '#e5e7eb' },
                (ctx) => {
                    ctx.fillStyle = '#e5e7eb';
                    ctx.font = `bold ${9 + zPos}px "Segoe UI", system-ui, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.globalAlpha = 0.4 + zPos * 0.15;
                    ctx.fillText('z', 25 + zPos, 8 - zPos);
                    ctx.globalAlpha = 1;
                }
            );
            push(dataURL, 420, 'Claude Usage — idle');
        }
    } else if (status === 'dead') {
        // Limit reached — dead face shakes, tongue wiggles.
        const jitter = [[0, 0], [1, 0], [-1, 0], [0, 1]];
        const mouths = ['tongue', 'tongue', 'flat', 'tongue'];
        for (let i = 0; i < 4; i += 1) {
            const [jx, jy] = jitter[i];
            const dataURL = _frameFromMascot({
                color: '#b91c1c',
                eye: 'x',
                mouth: mouths[i],
                jitterX: jx,
                jitterY: jy
            });
            push(dataURL, 220, 'Claude Usage — limit reached', ' 100%');
        }
    } else if (status === 'danger') {
        // Near-limit panic — amber star flashing red, wide darting eyes.
        for (let i = 0; i < 4; i += 1) {
            const pulse = i % 2 === 0 ? '#dc2626' : '#f59e0b';
            const offset = i % 2 === 0 ? -1 : 1;
            const dataURL = _frameFromMascot({
                color: pulse,
                eye: 'wide',
                mouth: 'ohh',
                eyeOffsetX: offset,
                scale: 0.98 + (i % 2) * 0.04
            });
            push(dataURL, 180, 'Claude Usage — critical');
        }
    } else if (status === 'warn') {
        // Watchful — amber star, wary eyes scan side-to-side, flat mouth.
        const offsets = [-1.2, 0, 1.2, 0];
        for (let i = 0; i < 4; i += 1) {
            const dataURL = _frameFromMascot({
                color: '#f59e0b',
                eye: 'wide',
                mouth: 'flat',
                eyeOffsetX: offsets[i]
            });
            push(dataURL, 260, 'Claude Usage — high');
        }
    } else {
        // Content — low/normal usage. Happy mascot blinks and breathes.
        const seq = [
            { eye: 'happy', mouth: 'smile', scale: 1.00 },
            { eye: 'happy', mouth: 'smile', scale: 1.03 },
            { eye: 'closed', mouth: 'smile', scale: 1.00 }, // blink
            { eye: 'happy', mouth: 'smile', scale: 0.98 }
        ];
        seq.forEach((cfg, i) => {
            const dataURL = _frameFromMascot({ color: '#d97757', ...cfg });
            push(dataURL, i === 2 ? 140 : 340, 'Claude Usage');
        });
    }

    const settings = window._cachedSettings || {};
    const targetSec = Math.max(1, Math.min(60, Number(settings.trayMascotInterval) || 2));
    const totalMs = frames.reduce((sum, f) => sum + (f.duration || 0), 0);
    if (frames.length > 0 && totalMs > 0) {
        const scale = (targetSec * 1000) / totalMs;
        for (const f of frames) {
            f.duration = Math.max(80, Math.min(10000, Math.round(f.duration * scale)));
        }
    }

    return frames;
}

function updateTrayIcon(data) {
    try {
        const frames = [];
        const session = data && data.five_hour ? data.five_hour.utilization : undefined;
        const settings = window._cachedSettings || {};
        const animateMascot = !!settings.trayShowLogo;

        let status = 'low';
        let rounded = null;
        if (typeof session === 'number') {
            rounded = Math.round(Math.max(0, Math.min(100, session)));
            if (rounded >= 100) status = 'dead';
            else if (rounded === 0) status = 'zero';
            else if (rounded >= dangerThreshold) status = 'danger';
            else if (rounded >= warnThreshold) status = 'warn';
        }

        if (animateMascot) {
            const mascotFrames = buildMascotAnimation(status);
            const label = rounded != null ? `Claude Usage — ${rounded}%` : 'Claude Usage';
            for (const f of mascotFrames) {
                frames.push({ ...f, tooltip: label, title: rounded != null ? ` ${rounded}%` : '' });
            }
        } else if (status === 'dead' || status === 'zero') {
            frames.push(...buildMascotAnimation(status));
        } else if (typeof session === 'number') {
            frames.push(buildTrayFrame('Session', session));
        }

        if (window.electronAPI.setTrayFrames) {
            window.electronAPI.setTrayFrames(frames);
        }
    } catch (err) {
        debugLog('Failed to update tray icon:', err);
    }
}

// Update progress bar
function updateProgressBar(progressElement, percentageElement, value, isWeekly = false) {
    const percentage = Math.min(Math.max(value, 0), 100);

    progressElement.style.width = `${percentage}%`;
    percentageElement.textContent = `${Math.round(percentage)}%`;

    progressElement.classList.remove('warning', 'danger');
    if (percentage >= dangerThreshold) {
        progressElement.classList.add('danger');
    } else if (percentage >= warnThreshold) {
        progressElement.classList.add('warning');
    }
}

// Format reset date for the "Resets At" column
// Session: shows time like "3:59 PM" or "15:59"
// Weekly: shows date like "Mar 13", "Fri Mar 13", or "Fri Mar 13 3:59 PM"
function formatResetsAt(resetsAt, isWeekly, timeFormat, weeklyDateFormat) {
    if (!resetsAt) return '—';
    const date = new Date(resetsAt);
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const formatTime = (d) => {
        if (timeFormat === '24h') {
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        } else {
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${minutes} ${ampm}`;
        }
    };

    if (isWeekly) {
        const dayStr = days[date.getDay()];
        const monthStr = months[date.getMonth()];
        const dayNum = date.getDate();
        const fmt = weeklyDateFormat || 'date';
        if (fmt === 'date-day') return `${dayStr} ${monthStr} ${dayNum}`;
        if (fmt === 'date-day-time') return `${dayStr} ${monthStr} ${dayNum} ${formatTime(date)}`;
        return `${monthStr} ${dayNum}`; // default: 'date'
    } else {
        return formatTime(date);
    }
}

// Update circular timer
function updateTimer(timerElement, textElement, resetsAt, totalMinutes) {
    if (!resetsAt) {
        textElement.textContent = 'Not started';
        textElement.style.opacity = '0.4';
        textElement.style.fontSize = '10px';
        textElement.title = 'Starts when a message is sent';
        timerElement.style.strokeDashoffset = 63;
        return;
    }

    // Clear the greyed out styling when timer is active
    textElement.style.opacity = '1';
    textElement.style.fontSize = '';
    textElement.title = '';

    const resetDate = new Date(resetsAt);
    const now = new Date();
    const diff = resetDate - now;

    if (diff <= 0) {
        textElement.textContent = 'Resetting...';
        timerElement.style.strokeDashoffset = 0;
        return;
    }

    // Calculate remaining time
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    // const seconds = Math.floor((diff % (1000 * 60)) / 1000); // Optional seconds

    // Format time display
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        textElement.textContent = `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
        textElement.textContent = `${hours}h ${minutes}m`;
    } else {
        textElement.textContent = `${minutes}m`;
    }

    // Calculate progress (elapsed percentage)
    const totalMs = totalMinutes * 60 * 1000;
    const elapsedMs = totalMs - diff;
    const elapsedPercentage = (elapsedMs / totalMs) * 100;

    // Update circle (63 is ~2*pi*10)
    const circumference = 63;
    const offset = circumference - (elapsedPercentage / 100) * circumference;
    timerElement.style.strokeDashoffset = offset;

    // Update color based on remaining time
    timerElement.classList.remove('warning', 'danger');
    if (elapsedPercentage >= 90) {
        timerElement.classList.add('danger');
    } else if (elapsedPercentage >= 75) {
        timerElement.classList.add('warning');
    }
}

// UI State Management
function showLoginRequired() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'flex';
    elements.noUsageContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
    // Reset to step 1
    elements.loginStep1.style.display = 'flex';
    elements.loginStep2.style.display = 'none';
    elements.sessionKeyError.textContent = '';
    elements.sessionKeyInput.value = '';
    // Close any open overlays
    elements.settingsOverlay.style.display = 'none';
    elements.compactSettingsOverlay.style.display = 'none';
    // Hide header buttons during login
    elements.settingsBtn.style.display = 'none';
    elements.refreshBtn.style.display = 'none';
    elements.graphBtn.style.display = 'none';
    stopAutoUpdate();
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    // Reset fetch guard so it can't get permanently stuck across login/logout
    isFetching = false;
    // Reset alert state so a new session doesn't inherit suppressed alerts
    isFirstDataLoad = true;
    alertFired.session_warn = false;
    alertFired.session_danger = false;
    alertFired.weekly_warn = false;
    alertFired.weekly_danger = false;
}

function showMainContent() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    // Respect compact mode — don't force mainContent visible if we're in compact
    if (!isCompactMode) {
        elements.mainContent.style.display = 'block';
    }
    elements.compactContent.style.display = isCompactMode ? 'flex' : 'none';
    // Always show collapse chevron here — applyCompactMode hides it when needed
    if (elements.compactCollapseBtn) {
        elements.compactCollapseBtn.style.display = isCompactMode ? 'none' : 'flex';
    }
    // Restore header buttons after login
    elements.settingsBtn.style.display = 'flex';
    elements.refreshBtn.style.display = 'flex';
    elements.graphBtn.style.display = 'flex';
}

// Auto-update management
function startAutoUpdate() {
    stopAutoUpdate();
    const settings = window._cachedSettings || {};
    const rawInterval = parseInt(settings.refreshInterval);
    const intervalSecs = Number.isFinite(rawInterval) && rawInterval >= 15 ? rawInterval : 300;
    updateInterval = setInterval(async () => {
        if (elements.refreshBtn) elements.refreshBtn.classList.add('spinning');
        await fetchUsageData();
        if (elements.refreshBtn) elements.refreshBtn.classList.remove('spinning');
    }, intervalSecs * 1000);
}

function stopAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

async function loadChart() {
    const history = await fetchGraphHistory();
    if (!history.length) {
        if (usageChart) { usageChart.destroy(); usageChart = null; }
        return;
    }
    renderChart(history);
}

async function fetchGraphHistory() {
    if (graphCustomActive && (graphCustomFrom != null || graphCustomTo != null)) {
        if (window.electronAPI.getUsageHistoryWindow) {
            return window.electronAPI.getUsageHistoryWindow(graphCustomFrom, graphCustomTo);
        }
    }
    if (!graphCustomActive && Number.isFinite(graphRangeMs) && window.electronAPI.getUsageHistoryRange) {
        return window.electronAPI.getUsageHistoryRange(graphRangeMs);
    }
    return window.electronAPI.getUsageHistory();
}

async function fetchHistoryTableData() {
    if (historyCustomActive && (historyCustomFrom != null || historyCustomTo != null)) {
        if (window.electronAPI.getUsageHistoryWindow) {
            return window.electronAPI.getUsageHistoryWindow(historyCustomFrom, historyCustomTo);
        }
    }
    if (!historyCustomActive && window.electronAPI.getUsageHistoryRange) {
        return window.electronAPI.getUsageHistoryRange(historyRangeMs);
    }
    return window.electronAPI.getUsageHistory();
}

async function loadHistoryTable() {
    if (!elements.historyTableBody) return;
    const history = await fetchHistoryTableData();
    historyLastEntries = [...history].sort((a, b) => b.timestamp - a.timestamp);
    renderHistoryPage();
}

function renderHistoryPage() {
    if (!elements.historyTableBody) return;
    const total = historyLastEntries.length;
    const totalPages = Math.max(1, Math.ceil(total / historyPageSize));
    if (historyPage > totalPages) historyPage = totalPages;
    if (historyPage < 1) historyPage = 1;

    if (elements.historyCount) {
        elements.historyCount.textContent = `${total} sample${total === 1 ? '' : 's'}`;
    }
    if (elements.historyPageIndicator) {
        elements.historyPageIndicator.textContent = `Page ${historyPage} of ${totalPages}`;
    }
    if (elements.historyPageJump) {
        elements.historyPageJump.max = totalPages;
        elements.historyPageJump.placeholder = `${historyPage}`;
    }
    if (elements.historyPagePrev) elements.historyPagePrev.disabled = historyPage <= 1;
    if (elements.historyPageNext) elements.historyPageNext.disabled = historyPage >= totalPages;

    elements.historyTableBody.innerHTML = '';
    if (!total) {
        elements.historyEmpty.style.display = 'block';
        return;
    }
    elements.historyEmpty.style.display = 'none';

    const start = (historyPage - 1) * historyPageSize;
    const pageEntries = historyLastEntries.slice(start, start + historyPageSize);

    const settings = window._cachedSettings || {};
    const timeFormat = settings.timeFormat || '12h';
    const hour12 = timeFormat !== '24h';
    const spanMs = historyCustomActive
        ? estimateSpanMs(historyLastEntries)
        : historyRangeMs;
    const showDate = !spanMs || spanMs === 0 || spanMs > 24 * 60 * 60 * 1000;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < pageEntries.length; i++) {
        const entry = pageEntries[i];
        const next = pageEntries[i + 1] || historyLastEntries[start + i + 1];
        const tr = document.createElement('tr');

        const timeCell = document.createElement('td');
        timeCell.className = 'col-time';
        const date = new Date(entry.timestamp);
        if (showDate) {
            timeCell.textContent = date.toLocaleString([], {
                month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12
            });
        } else {
            timeCell.textContent = date.toLocaleTimeString([], {
                hour: 'numeric', minute: '2-digit', hour12
            });
        }
        timeCell.title = date.toLocaleString();
        tr.appendChild(timeCell);

        tr.appendChild(makePctCell(entry.session));
        tr.appendChild(makePctCell(entry.weekly));
        tr.appendChild(makePctCell(entry.sonnet));
        tr.appendChild(makePctCell(entry.opus));
        tr.appendChild(makePctCell(entry.extraUsage));
        tr.appendChild(makeDeltaCell(entry.session, next?.session));
        tr.appendChild(makeDeltaCell(entry.weekly, next?.weekly));

        frag.appendChild(tr);
    }
    elements.historyTableBody.appendChild(frag);
}

function estimateSpanMs(entries) {
    if (!entries || entries.length < 2) return 0;
    const first = entries[0].timestamp;
    const last = entries[entries.length - 1].timestamp;
    return Math.abs(first - last);
}

// datetime-local inputs use the user's local clock and emit strings in
// the form "YYYY-MM-DDTHH:MM". Treat the value as local time.
function parseLocalDateTime(value) {
    if (!value) return null;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
}

function toLocalDateTimeInputValue(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function seedCustomInputs(fromEl, toEl, currentFrom, currentTo, fallbackRangeMs) {
    const now = Date.now();
    const from = currentFrom ?? (fallbackRangeMs > 0 ? now - fallbackRangeMs : now - 24 * 60 * 60 * 1000);
    const to = currentTo ?? now;
    if (fromEl && !fromEl.value) fromEl.value = toLocalDateTimeInputValue(from);
    if (toEl && !toEl.value) toEl.value = toLocalDateTimeInputValue(to);
}

function parseCustomInputs(fromEl, toEl) {
    const from = parseLocalDateTime(fromEl?.value);
    const to = parseLocalDateTime(toEl?.value);
    if (from == null && to == null) return null;
    if (from != null && to != null && from > to) {
        return { from: to, to: from };
    }
    return { from, to };
}

function makePctCell(value) {
    const td = document.createElement('td');
    td.className = 'col-pct';
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        td.textContent = '—';
        td.classList.add('col-muted');
        return td;
    }
    const pct = Math.max(0, value);
    td.textContent = `${Math.round(pct)}%`;
    if (pct >= dangerThreshold) td.classList.add('col-danger');
    else if (pct >= warnThreshold) td.classList.add('col-warning');
    else if (pct === 0) td.classList.add('col-muted');
    return td;
}

function makeDeltaCell(current, previous) {
    const td = document.createElement('td');
    td.className = 'col-pct';
    if (typeof current !== 'number' || typeof previous !== 'number') {
        td.textContent = '—';
        td.classList.add('col-muted');
        return td;
    }
    const diff = current - previous;
    if (Math.abs(diff) < 0.05) {
        td.textContent = '0%';
        td.classList.add('col-muted');
        return td;
    }
    const rounded = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    td.textContent = rounded;
    td.classList.add(diff > 0 ? 'col-delta-up' : 'col-delta-down');
    return td;
}

function renderChart(history) {
    if (usageChart) usageChart.destroy();

    const showSonnet = isExpanded && !!latestUsageData?.seven_day_sonnet;
    const showExtraUsage = isExpanded && !!latestUsageData?.extra_usage;
    const allValues = history.flatMap((entry) => {
        const values = [entry.session, entry.weekly];
        if (showSonnet) values.push(entry.sonnet || 0);
        if (showExtraUsage) values.push(entry.extraUsage || 0);
        return values;
    });
    const yMax = Math.max(10, Math.ceil(Math.max(...allValues) / 10) * 10);

    const styles = getComputedStyle(document.documentElement);
    const cssVar = (name, fallback) => {
        const v = styles.getPropertyValue(name).trim();
        return v || fallback;
    };
    const sessionColor = cssVar('--session-color', '#e79a4d');
    const weeklyColor = cssVar('--weekly-color', '#7aa8c4');
    const sonnetColor = cssVar('--sonnet-color', '#7ab685');
    const extraColor = cssVar('--extra-color', '#d8b068');

    const datasets = [
        {
            label: 'Session',
            data: history.map((entry) => entry.session),
            borderColor: sessionColor,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            stepped: true,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHitRadius: 10
        },
        {
            label: 'Weekly',
            data: history.map((entry) => entry.weekly),
            borderColor: weeklyColor,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            stepped: true,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHitRadius: 10
        }
    ];

    if (showSonnet) {
        const sonnetData = history.map((entry) => entry.sonnet || 0);
        if (sonnetData.some((value) => value > 0)) {
            datasets.push({
            label: 'Sonnet',
            data: sonnetData,
            borderColor: sonnetColor,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            stepped: true,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHitRadius: 10
            });
        }
    }

    if (showExtraUsage) {
        const extraUsageData = history.map((entry) => entry.extraUsage || 0);
        if (extraUsageData.some((value) => value > 0)) {
            datasets.push({
            label: 'Extra Usage',
            data: extraUsageData,
            borderColor: extraColor,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            stepped: true,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHitRadius: 10
            });
        }
    }

    usageChart = new Chart(elements.usageChart.getContext('2d'), {
        type: 'line',
        data: {
            labels: history.map((entry) => entry.timestamp),
            datasets
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            scales: {
                x: {
                    offset: true,
                    ticks: {
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0,
                        color: cssVar('--ink-mute', '#8a8070'),
                        font: {
                            family: cssVar('--font-mono', 'monospace'),
                            size: 9
                        },
                        callback(value, index) {
                            const tf = (window._cachedSettings || {}).timeFormat || '12h';
                            return formatXAxisTick(history, index, tf);
                        }
                    },
                    grid: {
                        display: false
                    },
                    border: {
                        color: cssVar('--hairline-strong', 'rgba(236,214,170,0.18)')
                    }
                },
                y: {
                    min: 0,
                    max: yMax,
                    ticks: {
                        color: cssVar('--ink-mute', '#8a8070'),
                        font: {
                            family: cssVar('--font-mono', 'monospace'),
                            size: 9
                        },
                        callback: (value) => `${value}%`
                    },
                    grid: {
                        color: cssVar('--hairline', 'rgba(236,214,170,0.09)'),
                        drawTicks: false
                    },
                    border: {
                        color: cssVar('--hairline-strong', 'rgba(236,214,170,0.18)')
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title(items) {
                            const point = history[items[0].dataIndex];
                            return new Date(point.timestamp).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                            });
                        },
                        label(item) {
                            return `${item.dataset.label}: ${Math.round(item.parsed.y)}%`;
                        }
                    }
                }
            }
        }
    });
}

function formatXAxisTick(history, index, timeFormat) {
    const tickIndexes = getXAxisTickIndexes(history.length);
    if (!tickIndexes.has(index)) {
        return '';
    }

    const timestamp = history[index]?.timestamp;
    if (!timestamp) {
        return '';
    }

    const spanMs = Math.max(0, history[history.length - 1].timestamp - history[0].timestamp);
    const date = new Date(timestamp);
    const hour12 = (timeFormat || '12h') !== '24h';

    if (spanMs < 12 * 60 * 60 * 1000) {
        return date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12
        });
    }

    if (spanMs < 48 * 60 * 60 * 1000) {
        return date.toLocaleString([], {
            weekday: 'short',
            hour: 'numeric',
            hour12
        });
    }

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    });
}

function getXAxisTickIndexes(length) {
    const indexes = new Set();
    if (length <= 0) {
        return indexes;
    }

    indexes.add(0);
    if (length === 1) {
        return indexes;
    }

    const targetTickCount = Math.min(5, length);
    const lastIndex = length - 1;
    indexes.add(lastIndex);

    if (targetTickCount <= 2) {
        return indexes;
    }

    const interval = lastIndex / (targetTickCount - 1);
    for (let i = 1; i < targetTickCount - 1; i += 1) {
        indexes.add(Math.round(interval * i));
    }

    return indexes;
}

// Add spinning animation for refresh button
const style = document.createElement('style');
style.textContent = `
    @keyframes spin-refresh {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .refresh-btn.spinning svg {
        animation: spin-refresh 1s linear infinite;
    }
`;
document.head.appendChild(style);

// Settings management
let warnThreshold = 75;
let dangerThreshold = 90;

async function loadSettings() {
    const settings = await window.electronAPI.getSettings();

    elements.autoStartToggle.checked = settings.autoStart;
    elements.alwaysOnTopToggle.checked = settings.alwaysOnTop;
    elements.warnThreshold.value = settings.warnThreshold;
    elements.dangerThreshold.value = settings.dangerThreshold;
    elements.timeFormat.value = settings.timeFormat || '12h';
    elements.weeklyDateFormat.value = settings.weeklyDateFormat || 'date';
    if (elements.refreshInterval) {
        const raw = parseInt(settings.refreshInterval);
        elements.refreshInterval.value = Number.isFinite(raw) && raw >= 15 ? String(raw) : '300';
    }
    elements.usageAlertsToggle.checked = settings.usageAlerts !== false;
    if (elements.compactModeToggle) elements.compactModeToggle.checked = !!settings.compactMode;
    if (elements.pinBtn) elements.pinBtn.classList.toggle('active', settings.alwaysOnTop !== false);
    if (elements.trayStyleSelect) elements.trayStyleSelect.value = settings.trayStyle || 'bigNumber';
    if (elements.trayShowLogoToggle) elements.trayShowLogoToggle.checked = !!settings.trayShowLogo;
    if (elements.trayMascotInterval) {
        const raw = parseInt(settings.trayMascotInterval);
        elements.trayMascotInterval.value = Number.isFinite(raw) && raw >= 1 ? String(Math.min(60, raw)) : '2';
    }

    warnThreshold = settings.warnThreshold;
    dangerThreshold = settings.dangerThreshold;

    elements.themeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });

    const currentStyle = settings.themeStyle || 'classic';
    elements.themeStyleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeStyle === currentStyle);
    });

    if (elements.autoPruneToggle) elements.autoPruneToggle.checked = !!settings.autoPrune;
    if (elements.autoPruneDays) elements.autoPruneDays.value = Number.isFinite(settings.autoPruneDays) ? settings.autoPruneDays : 30;
    if (elements.autoPruneDaysRow) elements.autoPruneDaysRow.style.display = settings.autoPrune ? 'flex' : 'none';
    if (elements.hideFromTaskbarToggle) elements.hideFromTaskbarToggle.checked = !!settings.hideFromTaskbar;
    if (elements.headlessModeToggle) elements.headlessModeToggle.checked = !!settings.headlessMode;

    applyTheme(settings.theme);
    applyThemeStyle(currentStyle);
    refreshStorageUsage();
}

async function refreshStorageUsage() {
    if (!elements.storageUsageHint || !window.electronAPI.getStorageInfo) return;
    try {
        const info = await window.electronAPI.getStorageInfo();
        if (!info) return;
        const fmt = (bytes) => {
            if (!Number.isFinite(bytes)) return '—';
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        };
        const total = (info.storeBytes || 0);
        const samples = info.historyCount || 0;
        elements.storageUsageHint.textContent = `${fmt(total)} on disk — ${samples.toLocaleString()} history ${samples === 1 ? 'sample' : 'samples'}`;
    } catch {}
}

async function saveSettings() {
    const activeThemeBtn = document.querySelector('.theme-btn.active');
    const activeThemeStyleBtn = document.querySelector('.theme-style-btn.active');
    const warn = parseInt(elements.warnThreshold.value) || 75;
    const danger = parseInt(elements.dangerThreshold.value) || 90;

    warnThreshold = warn;
    dangerThreshold = danger;

    // Apply compact mode change first, then include in saved settings
    const compactToggleValue = elements.compactModeToggle.checked;
    if (compactToggleValue !== isCompactMode) {
        applyCompactMode(compactToggleValue);
    }

    const settings = {
        autoStart: elements.autoStartToggle.checked,
        alwaysOnTop: elements.alwaysOnTopToggle.checked,
        theme: activeThemeBtn ? activeThemeBtn.dataset.theme : 'dark',
        themeStyle: activeThemeStyleBtn ? activeThemeStyleBtn.dataset.themeStyle : 'classic',
        warnThreshold: warn,
        dangerThreshold: danger,
        timeFormat: elements.timeFormat.value || '12h',
        weeklyDateFormat: elements.weeklyDateFormat.value || 'date',
        refreshInterval: elements.refreshInterval ? String(Math.max(15, parseInt(elements.refreshInterval.value) || 300)) : '300',
        usageAlerts: elements.usageAlertsToggle.checked,
        compactMode: isCompactMode,
        graphVisible: graphVisible,
        expandedOpen: isExpanded,
        trayStyle: elements.trayStyleSelect ? elements.trayStyleSelect.value : 'bigNumber',
        trayShowLogo: elements.trayShowLogoToggle ? elements.trayShowLogoToggle.checked : false,
        trayMascotInterval: elements.trayMascotInterval ? Math.max(1, Math.min(60, parseInt(elements.trayMascotInterval.value) || 2)) : 2,
        historyVisible: historyVisible,
        autoPrune: elements.autoPruneToggle ? !!elements.autoPruneToggle.checked : false,
        autoPruneDays: elements.autoPruneDays ? Math.max(1, parseInt(elements.autoPruneDays.value, 10) || 30) : 30,
        hideFromTaskbar: elements.hideFromTaskbarToggle ? !!elements.hideFromTaskbarToggle.checked : false,
        headlessMode: elements.headlessModeToggle ? !!elements.headlessModeToggle.checked : false
    };
    if (elements.autoPruneDaysRow) {
        elements.autoPruneDaysRow.style.display = settings.autoPrune ? 'flex' : 'none';
    }
    await window.electronAPI.saveSettings(settings);
    window._cachedSettings = settings;
    applyTheme(settings.theme);
    applyThemeStyle(settings.themeStyle);
    if (elements.pinBtn) elements.pinBtn.classList.toggle('active', settings.alwaysOnTop !== false);

    // Re-render resets-at values immediately with new format
    if (latestUsageData) {
        refreshTimers();
        // Rebuild extra rows to apply new threshold colors
        if (isExpanded) {
            buildExtraRows(latestUsageData);
            refreshExtraTimers();
        }
        updateTrayIcon(latestUsageData);
    } else {
        updateTrayIcon({});
    }
    // Restart auto-update with new interval if it changed
    startAutoUpdate();
    refreshStorageUsage();
}

function applyTheme(theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.body.classList.toggle('theme-light', !useDark);
}

function applyThemeStyle(style) {
    const allowed = new Set(['classic', 'plate', 'nord', 'sunset', 'mono']);
    const value = allowed.has(style) ? style : 'classic';
    document.body.setAttribute('data-theme-style', value);
}

// Update check
async function checkForUpdate() {
    try {
        const result = await window.electronAPI.checkForUpdate();
        if (!result.hasUpdate) return;

        const version = result.version;

        // Show banner and expand window to compensate
        elements.updateBannerText.textContent = `▲  Version ${version} available — click to download`;
        elements.updateBanner.style.display = 'flex';
        resizeWidget(true);

        // Populate settings panel link if already visible
        if (elements.settingsUpdateLink) {
            elements.settingsUpdateLink.textContent = `→ v${version} available`;
            elements.settingsUpdateLink.style.display = 'inline';
        }

        debugLog(`Update available: v${version}`);
    } catch (e) {
        debugLog('Update check failed silently', e);
    }
}

// Start the application
init();
window.addEventListener('beforeunload', () => {
    stopAutoUpdate();
    if (countdownInterval) clearInterval(countdownInterval);
});
