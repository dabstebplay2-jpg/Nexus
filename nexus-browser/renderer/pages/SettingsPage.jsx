import { useState } from 'react';

const SECTIONS = [
  { id: 'account', label: 'Я и Nexus' },
  { id: 'homepage', label: 'Главная страница' },
  { id: 'search', label: 'Поисковая система' },
  { id: 'appearance', label: 'Внешний вид' },
  { id: 'tabs', label: 'Вкладки и окно' },
  { id: 'sync', label: 'Синхронизация' },
  { id: 'privacy', label: 'Конфиденциальность' },
  { id: 'downloads', label: 'Загрузки' },
  { id: 'about', label: 'О браузере' },
];

function newShortcutId() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function SettingsPage({
  settings,
  searchEngines,
  onUpdate,
  profile,
  authorized,
  syncStatus,
  onSignIn,
  onSignOut,
  onForceSync,
  remoteTabSession,
  onOpenRemoteTab,
  onRestoreRemoteSession,
  buildInfo,
  onClearHistory,
  onClearBrowsingData,
}) {
  const [section, setSection] = useState('search');
  const [filter, setFilter] = useState('');
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const visibleSections = SECTIONS.filter((s) =>
    !filter || s.label.toLowerCase().includes(filter.toLowerCase())
  );

  const shortcuts = settings.ntpShortcuts || [];

  const addShortcut = () => {
    const name = newName.trim();
    let url = newUrl.trim();
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    onUpdate({ ntpShortcuts: [...shortcuts, { id: newShortcutId(), name, url }] });
    setNewName('');
    setNewUrl('');
  };

  const syncLabel = () => {
    if (!authorized) return 'Войдите в аккаунт Nexus для синхронизации';
    if (syncStatus?.state === 'syncing') return 'Синхронизация…';
    if (syncStatus?.state === 'error') return syncStatus.error || 'Ошибка синхронизации';
    if (syncStatus?.state === 'disabled') return 'Синхронизация отключена';
    if (syncStatus?.lastSyncAt) {
      return `Последняя синхронизация: ${new Date(syncStatus.lastSyncAt).toLocaleString('ru-RU')}`;
    }
    return 'Данные синхронизируются при входе через Google';
  };

  return (
    <div className="settings-page">
      <aside className="settings-sidebar">
        <h2>Настройки</h2>
        <input
          className="settings-search"
          placeholder="Поиск настроек"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <nav>
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`settings-nav-item ${section === s.id ? 'active' : ''}`}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="settings-content">
        {section === 'account' && (
          <section>
            <h3>Я и Nexus</h3>
            <p className="settings-desc">Аккаунт Nexus нужен для ИИ-ассистента и синхронизации настроек между устройствами.</p>
            {authorized ? (
              <div className="settings-card">
                <p><strong>{profile?.name || profile?.email}</strong></p>
                <p className="muted">{profile?.email}</p>
                <button type="button" className="btn btn-sm" onClick={onSignOut}>Выйти</button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onSignIn}>Войти через Google</button>
            )}
          </section>
        )}

        {section === 'homepage' && (
          <section>
            <h3>Главная страница</h3>
            <p className="settings-desc">Ярлыки отображаются под поиском на новой вкладке. Лимита нет — добавляйте сколько угодно.</p>
            <div className="settings-shortcut-list">
              {shortcuts.map((s) => (
                <div key={s.id} className="settings-shortcut-row">
                  <input
                    className="settings-input"
                    value={s.name}
                    onChange={(e) => onUpdate({
                      ntpShortcuts: shortcuts.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)),
                    })}
                  />
                  <input
                    className="settings-input"
                    value={s.url}
                    onChange={(e) => onUpdate({
                      ntpShortcuts: shortcuts.map((x) => (x.id === s.id ? { ...x, url: e.target.value } : x)),
                    })}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onUpdate({ ntpShortcuts: shortcuts.filter((x) => x.id !== s.id) })}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
            <h4>Добавить ярлык</h4>
            <div className="settings-shortcut-row">
              <input className="settings-input" placeholder="Название" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input className="settings-input" placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <button type="button" className="btn btn-primary btn-sm" onClick={addShortcut}>Добавить</button>
            </div>
          </section>
        )}

        {section === 'search' && (
          <section>
            <h3>Поисковая система</h3>
            <p className="settings-desc">Выберите поисковик для адресной строки и новой вкладки.</p>
            <div className="settings-engine-list">
              {searchEngines.map((e) => (
                <label key={e.id} className={`settings-engine-option ${settings.searchEngine === e.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="searchEngine"
                    checked={settings.searchEngine === e.id}
                    onChange={() => onUpdate({ searchEngine: e.id })}
                  />
                  <span className="engine-icon">{e.icon}</span>
                  <span>{e.name}</span>
                </label>
              ))}
            </div>

            <h4>Режим omnibox</h4>
            <p className="settings-desc">Enter — открыть поисковик. Ctrl+Enter — ИИ-ответ (в гибридном режиме).</p>
            <select
              className="settings-select"
              value={settings.searchMode}
              onChange={(e) => onUpdate({ searchMode: e.target.value })}
            >
              <option value="classic">Классический — открывать страницу поисковика</option>
              <option value="ai">ИИ — ответ Nexus в оверлее</option>
              <option value="hybrid">Гибрид — Enter: поисковик, Ctrl+Enter: ИИ</option>
            </select>

            <h4>Домашняя страница</h4>
            <p className="settings-desc">Открывается по кнопке «Домой» в панели навигации.</p>
            <input
              className="settings-input"
              value={settings.homepage}
              onChange={(e) => onUpdate({ homepage: e.target.value })}
            />

            <h4>Новая вкладка</h4>
            <p className="settings-desc">Что показывать при открытии новой вкладки или при закрытии последней.</p>
            <select
              className="settings-select"
              value={settings.newTabPage}
              onChange={(e) => onUpdate({ newTabPage: e.target.value })}
            >
              <option value="newtab">Страница Nexus (новая вкладка)</option>
              <option value="homepage">Домашняя страница</option>
              <option value="blank">Пустая страница</option>
              <option value="custom">Свой URL</option>
            </select>
            {settings.newTabPage === 'custom' && (
              <input
                className="settings-input"
                placeholder="https://..."
                value={settings.newTabCustomUrl}
                onChange={(e) => onUpdate({ newTabCustomUrl: e.target.value })}
              />
            )}
          </section>
        )}

        {section === 'appearance' && (
          <section>
            <h3>Внешний вид</h3>
            <p className="settings-desc">Настройте тему и цвета интерфейса. По умолчанию — нейтральная чёрная или белая тема.</p>
            <label className="settings-row">
              <span>Тема</span>
              <select
                className="settings-select"
                value={settings.theme}
                onChange={(e) => onUpdate({ theme: e.target.value })}
              >
                <option value="dark">Тёмная (чёрная)</option>
                <option value="light">Светлая (белая)</option>
                <option value="system">Системная</option>
              </select>
            </label>
            <label className="settings-row">
              <span>Цвет акцента</span>
              <input
                type="color"
                value={settings.accentColor || '#3b82f6'}
                onChange={(e) => onUpdate({ accentColor: e.target.value })}
              />
            </label>
            <label className="settings-row">
              <span>Размер шрифта</span>
              <select
                className="settings-select"
                value={settings.fontSize || 'medium'}
                onChange={(e) => onUpdate({ fontSize: e.target.value })}
              >
                <option value="small">Мелкий</option>
                <option value="medium">Средний</option>
                <option value="large">Крупный</option>
              </select>
            </label>
            <label className="settings-row">
              <span>Ширина ИИ-панели (px)</span>
              <input
                type="number"
                className="settings-input settings-input-inline"
                min={280}
                max={600}
                value={settings.sidebarWidth || 380}
                onChange={(e) => onUpdate({ sidebarWidth: Number(e.target.value) || 380 })}
              />
            </label>
            <label className="settings-row">
              <span>ИИ-панель по умолчанию</span>
              <input
                type="checkbox"
                checked={settings.sidebarOpen}
                onChange={(e) => onUpdate({ sidebarOpen: e.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>Панель закладок</span>
              <input
                type="checkbox"
                checked={settings.showBookmarksBar}
                onChange={(e) => onUpdate({ showBookmarksBar: e.target.checked })}
              />
            </label>
          </section>
        )}

        {section === 'tabs' && (
          <section>
            <h3>Вкладки и окно</h3>
            <p className="settings-desc">При закрытии последней вкладки автоматически открывается новая (как в Chrome).</p>
            <label className="settings-row">
              <span>Масштаб по умолчанию</span>
              <select
                className="settings-select"
                value={String(settings.defaultZoom || 1)}
                onChange={(e) => onUpdate({ defaultZoom: Number(e.target.value) })}
              >
                <option value="0.75">75%</option>
                <option value="0.9">90%</option>
                <option value="1">100%</option>
                <option value="1.1">110%</option>
                <option value="1.25">125%</option>
              </select>
            </label>
          </section>
        )}

        {section === 'sync' && (
          <section>
            <h3>Синхронизация</h3>
            <p className="settings-desc">
              При входе через Google данные сохраняются в облаке Nexus и подтягиваются на других устройствах.
            </p>
            <p className="settings-desc">{syncLabel()}</p>
            <label className="settings-row">
              <span>Синхронизация включена</span>
              <input
                type="checkbox"
                checked={settings.syncEnabled !== false}
                onChange={(e) => onUpdate({ syncEnabled: e.target.checked })}
                disabled={!authorized}
              />
            </label>
            <label className="settings-row">
              <span>История посещений</span>
              <input
                type="checkbox"
                checked={settings.syncHistory !== false}
                onChange={(e) => onUpdate({ syncHistory: e.target.checked })}
                disabled={!authorized}
              />
            </label>
            <label className="settings-row">
              <span>ИИ-чаты по страницам</span>
              <input
                type="checkbox"
                checked={settings.syncChats !== false}
                onChange={(e) => onUpdate({ syncChats: e.target.checked })}
                disabled={!authorized}
              />
            </label>
            <label className="settings-row">
              <span>Вкладки (снимок сессии)</span>
              <input
                type="checkbox"
                checked={settings.syncTabs !== false}
                onChange={(e) => onUpdate({ syncTabs: e.target.checked })}
                disabled={!authorized}
              />
            </label>
            <label className="settings-row">
              <span>Восстанавливать вкладки при входе</span>
              <input
                type="checkbox"
                checked={settings.restoreSessionOnLogin !== false}
                onChange={(e) => onUpdate({ restoreSessionOnLogin: e.target.checked })}
                disabled={!authorized}
              />
            </label>
            <p className="settings-desc muted">
              Загрузки, путь сохранения и cookies остаются только на этом устройстве.
            </p>
            {authorized && (
              <button type="button" className="btn btn-primary" onClick={onForceSync}>
                Синхронизировать сейчас
              </button>
            )}
            {!authorized && (
              <button type="button" className="btn btn-primary" onClick={onSignIn}>Войти через Google</button>
            )}
            {authorized && remoteTabSession?.tabs?.length > 0 && (
              <div className="remote-tabs-section">
                <h4>Вкладки с {remoteTabSession.deviceLabel || 'другого устройства'}</h4>
                <p className="settings-desc muted">
                  {remoteTabSession.updatedAt
                    ? `Обновлено: ${new Date(remoteTabSession.updatedAt).toLocaleString('ru-RU')}`
                    : null}
                </p>
                <ul className="remote-tabs-list">
                  {remoteTabSession.tabs.map((t) => (
                    <li key={t.url}>
                      <button type="button" className="remote-tab-link" onClick={() => onOpenRemoteTab?.(t.url)}>
                        {t.title || t.url}
                      </button>
                    </li>
                  ))}
                </ul>
                {onRestoreRemoteSession && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onRestoreRemoteSession(remoteTabSession.tabs, remoteTabSession.activeIndex)}
                  >
                    Восстановить все вкладки
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {section === 'privacy' && (
          <section>
            <h3>Конфиденциальность</h3>
            <p className="settings-desc">Очистка истории удаляет список посещённых сайтов в браузере.</p>
            <button type="button" className="btn" onClick={onClearHistory}>Очистить историю</button>
            <p className="settings-desc" style={{ marginTop: 16 }}>Очистка cookies и кэша сбрасывает данные сайтов на этом устройстве.</p>
            <button type="button" className="btn" onClick={onClearBrowsingData}>
              Очистить cookies и кэш
            </button>
          </section>
        )}

        {section === 'downloads' && (
          <section>
            <h3>Загрузки</h3>
            <label className="settings-row">
              <span>Папка загрузок</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="settings-input" readOnly value={settings.downloadPath || 'Системная папка «Загрузки»'} />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={async () => {
                    const folder = await window.nexusBrowser.downloads.pickFolder();
                    if (folder) onUpdate({ downloadPath: folder });
                  }}
                >
                  Изменить
                </button>
              </div>
            </label>
            <label className="settings-row">
              <span>Спрашивать куда сохранять</span>
              <input
                type="checkbox"
                checked={settings.askDownloadLocation}
                onChange={(e) => onUpdate({ askDownloadLocation: e.target.checked })}
              />
            </label>
          </section>
        )}

        {section === 'about' && (
          <section>
            <h3>О браузере Nexus</h3>
            <p>Версия: <strong>{buildInfo?.version || __APP_VERSION__}</strong></p>
            {buildInfo?.buildStamp && <p className="muted">Сборка: {__BUILD_STAMP__}</p>}
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => window.nexusBrowser.shell.openExternal('https://github.com/dabstebplay2-jpg/Nexus')}
            >
              GitHub
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
