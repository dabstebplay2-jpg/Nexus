import { useCallback, useEffect, useState } from 'react';
import {
  connectDiscordWebhook,
  disconnectConnector,
  fetchConnectors,
  patchConnector,
  startConnectorOAuth,
} from './connectorsApi';

export function useConnectors({ enabled = true } = {}) {
  const [data, setData] = useState({ categories: [], connectors: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    try {
      const json = await fetchConnectors();
      setData(json);
    } catch (e) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError('');
      setData({ categories: [], connectors: [] });
      return;
    }
    reload();
  }, [enabled, reload]);

  const connect = useCallback(
    async (connectorId) => {
      setBusyId(connectorId);
      setError('');
      try {
        if (connectorId === 'discord') {
          const url = window.prompt(
            'URL вебхука Discord (Настройки канала → Интеграции → Вебхуки):',
            'https://discord.com/api/webhooks/'
          );
          if (!url?.trim()) return;
          const label = window.prompt('Название канала (необязательно):', '#signal') || undefined;
          await connectDiscordWebhook(url.trim(), label);
          await reload();
          return;
        }
        const res = await startConnectorOAuth(connectorId, window.location.origin);
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setBusyId('');
      }
    },
    [reload]
  );

  const disconnect = useCallback(
    async (connectorId) => {
      setBusyId(connectorId);
      try {
        await disconnectConnector(connectorId);
        await reload();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusyId('');
      }
    },
    [reload]
  );

  const toggleChat = useCallback(
    async (connectorId, enabled) => {
      try {
        await patchConnector(connectorId, enabled);
        await reload();
      } catch (e) {
        setError(e.message);
      }
    },
    [reload]
  );

  return {
    categories: data.categories || [],
    connectors: data.connectors || [],
    loading,
    error,
    busyId,
    reload,
    connect,
    disconnect,
    toggleChat,
  };
}
