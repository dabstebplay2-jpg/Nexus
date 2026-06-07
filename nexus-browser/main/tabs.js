const { BrowserView } = require('electron');
const { extractPageContext } = require('./pageContext');
const { addHistory, getSettings } = require('./storage');
const { buildSearchUrl } = require('./searchEngines');
const { resolveNavigationTarget, resolveNewTabUrl, NEXUS_NEWTAB, NEXUS_SETTINGS } = require('./navUtils');

const BANKING_BLOCK = /(bank|sberbank|tinkoff|paypal|stripe\.com\/checkout)/i;
const CHROME_BLOCK = /^chrome:|^devtools:/i;

class TabManager {
  constructor(win, bounds) {
    this.win = win;
    this.bounds = bounds;
    this.tabs = [];
    this.activeId = null;
    this.nextId = 1;
    this.onInternalNavigate = null;
  }

  setChromeBounds(bounds) {
    this.bounds = bounds;
    this._layoutActive();
  }

  createTab(url) {
    return this._createTabRaw(url, { activate: true });
  }

  duplicateTab(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return null;
    return this.createTab(tab.url);
  }

  reorderTab(fromId, toIndex) {
    const fromIdx = this.tabs.findIndex((t) => t.id === fromId);
    if (fromIdx < 0) return;
    const [tab] = this.tabs.splice(fromIdx, 1);
    const pinnedCount = this.tabs.filter((t) => t.pinned).length;
    const insertAt = Math.max(pinnedCount, Math.min(toIndex, this.tabs.length));
    this.tabs.splice(insertAt, 0, tab);
    this._emitTabs();
  }

  pinTab(id, pinned) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.pinned = Boolean(pinned);
    this.tabs.sort((a, b) => {
      if (a.pinned === b.pinned) return 0;
      return a.pinned ? -1 : 1;
    });
    this._emitTabs();
  }

  muteTab(id, muted) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.muted = muted !== undefined ? Boolean(muted) : !tab.muted;
    tab.view.webContents.setAudioMuted(tab.muted);
    this._emitTabs();
  }

  closeOtherTabs(id) {
    const keep = this.tabs.find((t) => t.id === id);
    if (!keep) return;
    [...this.tabs].forEach((t) => {
      if (t.id !== id) this.closeTab(t.id);
    });
  }

  closeTabsToRight(id) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    [...this.tabs.slice(idx + 1)].forEach((t) => this.closeTab(t.id));
  }

  _wireTab(tab) {
    const { view } = tab;
    view.webContents.on('did-start-loading', () => {
      tab.loading = true;
      this._emitTabs();
    });
    view.webContents.on('did-stop-loading', async () => {
      tab.loading = false;
      tab.url = view.webContents.getURL();
      tab.title = view.webContents.getTitle() || tab.url;
      this._emitTabs();
      if (tab.id === this.activeId && tab.url.startsWith('http')) {
        addHistory({ url: tab.url, title: tab.title });
      }
    });
    view.webContents.on('did-navigate', () => {
      tab.url = view.webContents.getURL();
      this._emitTabs();
    });
    view.webContents.on('did-navigate-in-page', () => {
      tab.url = view.webContents.getURL();
      this._emitTabs();
    });
    view.webContents.on('page-title-updated', (_e, title) => {
      tab.title = title;
      this._emitTabs();
    });
    view.webContents.on('found-in-page', (event, result) => {
      this.win.webContents.send('tabs:found-in-page', {
        tabId: tab.id,
        activeMatchOrdinal: result.activeMatchOrdinal,
        numberOfMatches: result.numberOfMatches,
      });
    });
    view.webContents.on('media-started-playing', () => {
      this._emitTabs();
    });
    view.webContents.setWindowOpenHandler(({ url }) => {
      this.createTab(url);
      return { action: 'deny' };
    });
    if (tab.zoom && tab.zoom !== 1) {
      view.webContents.setZoomFactor(tab.zoom);
    }
  }

  _layoutActive() {
    const tab = this.tabs.find((t) => t.id === this.activeId);
    if (!tab || !this.bounds) return;
    const isInternal = tab.url === NEXUS_NEWTAB || tab.url === NEXUS_SETTINGS;
    if (isInternal) {
      this.win.setBrowserView(null);
      return;
    }
    this.win.setBrowserView(tab.view);
    tab.view.setBounds(this.bounds);
    tab.view.setAutoResize({ width: true, height: true });
  }

  activateTab(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    this.activeId = id;
    this._layoutActive();
    this._emitTabs();
  }

  _createTabRaw(url, { activate = true } = {}) {
    const settings = getSettings();
    const target = url || resolveNewTabUrl(settings);
    const id = String(this.nextId++);
    const view = new BrowserView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const tab = {
      id,
      view,
      url: target,
      title: 'Новая вкладка',
      loading: false,
      zoom: settings.defaultZoom || 1,
      pinned: false,
      muted: false,
    };
    this.tabs.push(tab);
    this._wireTab(tab);
    this.navigate(id, target);
    if (activate) this.activateTab(id);
    return id;
  }

  restoreSession(tabDefs, activeIndex = 0) {
    const defs = (tabDefs || [])
      .filter((t) => t?.url && t.url !== NEXUS_NEWTAB && t.url !== NEXUS_SETTINGS)
      .slice(0, 30);
    if (!defs.length) return;

    this._skipAutoNewTab = true;
    [...this.tabs].forEach((t) => this.closeTab(t.id));
    this._skipAutoNewTab = false;

    const created = defs.map((def) => this._createTabRaw(def.url, { activate: false }));
    created.forEach((id, i) => {
      if (defs[i].pinned) this.pinTab(id, true);
    });

    const targetIdx = Math.min(Math.max(0, activeIndex), created.length - 1);
    if (created[targetIdx]) this.activateTab(created[targetIdx]);
    else if (created[0]) this.activateTab(created[0]);
    this._emitTabs();
  }

  closeTab(id) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [tab] = this.tabs.splice(idx, 1);
    if (!tab.view.webContents.isDestroyed()) {
      tab.view.webContents.destroy();
    }
    this.win.removeBrowserView(tab.view);
    if (this.activeId === id) {
      const next = this.tabs[Math.max(0, idx - 1)];
      if (next) this.activateTab(next.id);
      else if (this.tabs.length === 0 && !this._skipAutoNewTab) {
        const settings = getSettings();
        this.createTab(resolveNewTabUrl(settings));
      } else {
        this.activeId = null;
      }
    }
    this._emitTabs();
  }

  _loadExternalUrl(tab, url, title) {
    tab.url = url;
    tab.title = title || url;
    this._layoutActive();
    this._emitTabs();
    tab.view.webContents.loadURL(url);
  }

  navigate(id, input, options = {}) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    const settings = getSettings();
    const resolved = resolveNavigationTarget(input);

    if (resolved.type === 'empty') return {};
    if (resolved.type === 'internal') {
      tab.url = resolved.url;
      tab.title = resolved.url === NEXUS_SETTINGS ? 'Настройки' : 'Новая вкладка';
      this._layoutActive();
      this._emitTabs();
      if (this.onInternalNavigate) this.onInternalNavigate(resolved.url);
      return { internal: resolved.url };
    }
    if (resolved.type === 'search') {
      const mode = options.searchMode || settings.searchMode;
      const useAi = mode === 'ai' || (mode === 'hybrid' && options.aiSearch);
      if (useAi) return { searchQuery: resolved.query };
      const serpUrl = buildSearchUrl(settings.searchEngine, resolved.query);
      this._loadExternalUrl(tab, serpUrl, resolved.query);
      return { url: serpUrl };
    }
    this._loadExternalUrl(tab, resolved.url);
    return { url: resolved.url };
  }

  getActiveWebContents() {
    const tab = this.tabs.find((t) => t.id === this.activeId);
    if (!tab || tab.url === NEXUS_NEWTAB || tab.url === NEXUS_SETTINGS) return null;
    return tab?.view?.webContents || null;
  }

  async getActivePageContext() {
    const wc = this.getActiveWebContents();
    if (!wc) return { url: '', title: '', excerpt: '', selection: '', tab_id: this.activeId };
    const ctx = await extractPageContext(wc);
    return { ...ctx, tab_id: this.activeId };
  }

  goBack(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab && tab.view.webContents.canGoBack()) tab.view.webContents.goBack();
  }

  goForward(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab && tab.view.webContents.canGoForward()) tab.view.webContents.goForward();
  }

  reload(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) tab.view.webContents.reload();
  }

  print(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) tab.view.webContents.print({});
  }

  setZoom(id, factor) {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) {
      tab.view.webContents.setZoomFactor(factor);
      tab.zoom = factor;
      this._emitTabs();
    }
  }

  getZoom(id) {
    const tab = this.tabs.find((t) => t.id === id);
    return tab ? tab.view.webContents.getZoomFactor() : 1;
  }

  toggleDevTools(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    const wc = tab.view.webContents;
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools({ mode: 'detach' });
  }

  findInPage(id, text, options = {}) {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab && text) tab.view.webContents.findInPage(text, options);
  }

  stopFindInPage(id, action = 'clearSelection') {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) tab.view.webContents.stopFindInPage(action);
  }

  listTabs() {
    return this.tabs.map((t) => {
      let canGoBack = false;
      let canGoForward = false;
      let isPlaying = false;
      try {
        canGoBack = t.view ? t.view.webContents.canGoBack() : false;
        canGoForward = t.view ? t.view.webContents.canGoForward() : false;
        isPlaying = t.view ? t.view.webContents.isCurrentlyAudible() : false;
      } catch {
        /* ignore */
      }
      return {
        id: t.id,
        url: t.url,
        title: t.title,
        active: t.id === this.activeId,
        loading: t.loading,
        zoom: t.zoom || 1,
        pinned: Boolean(t.pinned),
        muted: Boolean(t.muted),
        isPlaying,
        canGoBack,
        canGoForward,
        isInternal: t.url === NEXUS_NEWTAB || t.url === NEXUS_SETTINGS,
      };
    });
  }

  _emitTabs() {
    if (this.onTabsChanged) this.onTabsChanged(this.listTabs());
  }

  isAgentUrlAllowed(url) {
    const u = (url || '').toLowerCase();
    if (CHROME_BLOCK.test(u)) return false;
    if (BANKING_BLOCK.test(u)) return false;
    return u.startsWith('http://') || u.startsWith('https://');
  }
}

module.exports = { TabManager, NEXUS_NEWTAB, NEXUS_SETTINGS };
