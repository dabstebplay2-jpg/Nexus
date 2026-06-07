const { ipcRenderer } = require('electron');

function sendMediaState(payload) {
  ipcRenderer.send('media:state', payload);
}

function readMediaSession() {
  const ms = navigator.mediaSession;
  const meta = ms?.metadata;
  const artwork = meta?.artwork?.[0]?.src || '';
  const audible = Boolean(
    document.querySelector('video:not([paused]), audio:not([paused])')
  );
  sendMediaState({
    title: meta?.title || document.title || '',
    artist: meta?.artist || '',
    album: meta?.album || '',
    artwork,
    playbackState: ms?.playbackState || (audible ? 'playing' : 'paused'),
    audible,
  });
}

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.send('password:request-autofill', window.location.origin);

  ipcRenderer.on('password:fill', (_event, { username, password }) => {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    passwordFields.forEach((passInput) => {
      passInput.value = password;
      const form = passInput.form;
      if (form) {
        const userInput = form.querySelector('input[type="text"], input[type="email"], input:not([type])');
        if (userInput) userInput.value = username;
      } else {
        let prev = passInput.previousElementSibling;
        while (prev) {
          if (prev.tagName === 'INPUT' && (prev.type === 'text' || prev.type === 'email')) {
            prev.value = username;
            break;
          }
          prev = prev.previousElementSibling;
        }
      }
    });
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form) return;
    const passwordInput = form.querySelector('input[type="password"]');
    if (!passwordInput || !passwordInput.value) return;

    const userInput = form.querySelector('input[type="text"], input[type="email"], input:not([type])');
    const username = userInput ? userInput.value : '';
    const password = passwordInput.value;

    if (username && password) {
      ipcRenderer.send('password:save-prompt', {
        origin: window.location.origin,
        username,
        password,
      });
    }
  });

  readMediaSession();
  if (navigator.mediaSession) {
    const props = ['metadata'];
    props.forEach((key) => {
      try {
        let current = navigator.mediaSession[key];
        Object.defineProperty(navigator.mediaSession, key, {
          configurable: true,
          get() {
            return current;
          },
          set(value) {
            current = value;
            readMediaSession();
          },
        });
      } catch {
        /* ignore */
      }
    });
  }

  document.addEventListener('play', () => readMediaSession(), true);
  document.addEventListener('pause', () => readMediaSession(), true);
  setInterval(readMediaSession, 4000);
});
