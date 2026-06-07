const os = require('os');
const auth = require('./auth');
const {
  getSettings,
  getSyncPayload,
  applySyncPayload,
  buildMergedPayload,
  getSyncUpdatedAt,
  setLocalTabSession,
  getRemoteTabSession,
} = require('./storage');

const PACKAGE_VERSION = require('../package.json').version;

let pushTimer = null;
let tabSessionTimer = null;
let pullInterval = null;
let lastStatus = { state: 'idle', lastSyncAt: null, error: null };
let notifyStatus = null;
let notifyDataChanged = null;
let pendingSessionRestore = null;

function setStatusNotify(fn) {
  notifyStatus = fn;
}

function setDataChangedNotify(fn) {
  notifyDataChanged = fn;
}

function emitStatus(patch) {
  lastStatus = { ...lastStatus, ...patch };
  notifyStatus?.(getStatus());
}

function emitDataChanged() {
  notifyDataChanged?.();
}

function getStatus() {
  return {
    ...lastStatus,
    localUpdatedAt: getSyncUpdatedAt(),
    remoteTabSession: getRemoteTabSession(),
    pendingSessionRestore,
  };
}

function clearPendingSessionRestore() {
  pendingSessionRestore = null;
}

async function fetchRemote() {
  const res = await auth.cloudFetch('/v1/user/browser-sync');
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function pushRemote(payload) {
  const res = await auth.cloudFetch('/v1/user/browser-sync', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload,
      client_updated_at: getSyncUpdatedAt(),
      client_version: PACKAGE_VERSION,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

function checkPendingSessionRestore(merged) {
  const settings = getSettings();
  if (settings.restoreSessionOnLogin === false) return;
  const remoteTab = merged?.remoteTabSession || merged?.tabSession;
  if (!remoteTab?.tabs?.length) return;
  pendingSessionRestore = {
    tabs: remoteTab.tabs.filter((t) => t.url && !t.url.startsWith('nexus://')).slice(0, 30),
    activeIndex: remoteTab.activeIndex || 0,
    deviceLabel: remoteTab.deviceLabel || 'другого устройства',
    updatedAt: remoteTab.updatedAt || 0,
  };
}

async function applyMergedAndMaybePush(merged, { pushAfter = true } = {}) {
  const { remoteTabSession, tabSession, ...rest } = merged;
  applySyncPayload({
    ...rest,
    remoteTabSession: remoteTabSession || getRemoteTabSession(),
  });
  checkPendingSessionRestore(merged);
  emitDataChanged();

  if (!pushAfter) return null;

  const localPayload = getSyncPayload();
  if (tabSession) localPayload.tabSession = tabSession;
  localPayload.updatedAt = Date.now();
  return pushRemote({ payload: localPayload });
}

async function fullSync() {
  if (!auth.getAccessToken()) {
    emitStatus({ state: 'offline', error: null });
    return getStatus();
  }
  const settings = getSettings();
  if (settings.syncEnabled === false) {
    emitStatus({ state: 'disabled' });
    return getStatus();
  }

  emitStatus({ state: 'syncing', error: null });
  try {
    const remote = await fetchRemote();
    const localAt = getSyncUpdatedAt();
    const remoteAt = remote?.updated_at ? new Date(remote.updated_at).getTime() : 0;

    if (!remote || !remote.payload) {
      const localPayload = getSyncPayload();
      localPayload.updatedAt = Date.now();
      const saved = await pushRemote({ payload: localPayload });
      const savedAt = saved.updated_at ? new Date(saved.updated_at).getTime() : Date.now();
      applySyncPayload({ ...localPayload, updatedAt: savedAt });
      emitStatus({ state: 'synced', lastSyncAt: Date.now(), error: null });
      return getStatus();
    }

    const merged = buildMergedPayload(remote.payload, remoteAt);
    const saved = await applyMergedAndMaybePush(merged, { pushAfter: true });
    const savedAt = saved?.updated_at ? new Date(saved.updated_at).getTime() : Date.now();
    if (savedAt) {
      applySyncPayload({ ...getSyncPayload(), updatedAt: savedAt });
    }

    emitStatus({ state: 'synced', lastSyncAt: Date.now(), error: null });
    return getStatus();
  } catch (e) {
    emitStatus({ state: 'error', error: e.message || 'Ошибка синхронизации' });
    return getStatus();
  }
}

async function pullSync() {
  if (!auth.getAccessToken()) {
    emitStatus({ state: 'offline', error: null });
    return getStatus();
  }
  const settings = getSettings();
  if (settings.syncEnabled === false) {
    emitStatus({ state: 'disabled' });
    return getStatus();
  }

  emitStatus({ state: 'syncing', error: null });
  try {
    const remote = await fetchRemote();
    const remoteAt = remote?.updated_at ? new Date(remote.updated_at).getTime() : 0;

    if (!remote?.payload) {
      emitStatus({ state: 'synced', lastSyncAt: lastStatus.lastSyncAt, error: null });
      return getStatus();
    }

    const merged = buildMergedPayload(remote.payload, remoteAt);
    await applyMergedAndMaybePush(merged, { pushAfter: false });

    emitStatus({ state: 'synced', lastSyncAt: Date.now(), error: null });
    return getStatus();
  } catch (e) {
    emitStatus({ state: 'error', error: e.message || 'Ошибка синхронизации' });
    return getStatus();
  }
}

async function pushSync() {
  if (!auth.getAccessToken()) return getStatus();
  const settings = getSettings();
  if (settings.syncEnabled === false) return getStatus();

  emitStatus({ state: 'syncing', error: null });
  try {
    const localPayload = getSyncPayload();
    localPayload.updatedAt = Date.now();
    const saved = await pushRemote({ payload: localPayload });
    const remoteAt = saved.updated_at ? new Date(saved.updated_at).getTime() : Date.now();
    applySyncPayload({ ...localPayload, updatedAt: remoteAt });
    emitStatus({ state: 'synced', lastSyncAt: Date.now(), error: null });
    return getStatus();
  } catch (e) {
    emitStatus({ state: 'error', error: e.message || 'Ошибка синхронизации' });
    return getStatus();
  }
}

function schedulePush() {
  if (!auth.getAccessToken()) return;
  const settings = getSettings();
  if (settings.syncEnabled === false) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushSync().catch(() => {});
  }, 2500);
}

function onTabsChanged(tabs) {
  const settings = getSettings();
  if (settings.syncTabs === false) return;
  if (tabSessionTimer) clearTimeout(tabSessionTimer);
  tabSessionTimer = setTimeout(() => {
    tabSessionTimer = null;
    const snapshot = {
      tabs: (tabs || [])
        .filter((t) => t.url && !t.isInternal)
        .slice(0, 30)
        .map((t) => ({ url: t.url, title: t.title || t.url, pinned: Boolean(t.pinned) })),
      activeIndex: Math.max(0, (tabs || []).findIndex((t) => t.active)),
      deviceLabel: os.hostname(),
      updatedAt: Date.now(),
    };
    setLocalTabSession(snapshot);
    schedulePush();
  }, 3000);
}

function onSettingsChanged() {
  schedulePush();
}

function onBookmarksChanged() {
  schedulePush();
}

function onHistoryChanged() {
  schedulePush();
}

function onChatChanged() {
  schedulePush();
}

function startPeriodicSync(getMainWindow) {
  if (pullInterval) clearInterval(pullInterval);
  pullInterval = setInterval(() => {
    if (auth.getAccessToken()) pullSync().catch(() => {});
  }, 5 * 60 * 1000);

  const win = getMainWindow?.();
  if (win && !win._syncFocusHook) {
    win._syncFocusHook = true;
    win.on('focus', () => {
      if (auth.getAccessToken()) pullSync().catch(() => {});
    });
  }
}

module.exports = {
  setStatusNotify,
  setDataChangedNotify,
  getStatus,
  fullSync,
  pullSync,
  pushSync,
  schedulePush,
  onSettingsChanged,
  onBookmarksChanged,
  onHistoryChanged,
  onChatChanged,
  onTabsChanged,
  startPeriodicSync,
  clearPendingSessionRestore,
};
