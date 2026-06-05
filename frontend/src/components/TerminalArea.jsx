import React, { useState, useEffect, useRef } from 'react';
import { IS_VERCEL_HOST } from '../lib/api';

const TerminalArea = ({ workspacePath = 'C:\\nexus-ide' }) => {
  const [history, setHistory] = useState('');
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (IS_VERCEL_HOST) {
      setHistory(
        'Терминал недоступен в Web Lite на Vercel.\r\nСкачайте Nexus IDE Desktop или запустите backend локально (:8000).\r\n'
      );
      return undefined;
    }
    const cwd = encodeURIComponent(workspacePath || '.');
    const apiOrigin = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, '');
    const wsOrigin = apiOrigin.replace(/^http/, 'ws');
    const url = `${wsOrigin}/api/ws/terminal?cwd=${cwd}`;
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setConnected(true);
      setHistory((prev) => prev + `Nexus Terminal — ${workspacePath}\r\n`);
    };

    ws.current.onmessage = (event) => {
      setHistory((prev) => prev + event.data);
    };

    ws.current.onclose = () => {
      setConnected(false);
      setHistory((prev) => prev + '\r\n[Session ended]\r\n');
    };

    ws.current.onerror = () => {
      setConnected(false);
      setHistory(
        (prev) =>
          prev +
          '\r\n[Connection Error] Убедитесь, что backend запущен на :8000\r\n'
      );
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [workspacePath]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    if (trimmedInput.toLowerCase() === 'clear' || trimmedInput.toLowerCase() === 'cls') {
      setHistory('');
      setInput('');
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(input + '\n');
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc] font-mono text-[12px]">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto whitespace-pre-wrap select-text px-3 py-2 custom-scrollbar"
      >
        {history || (connected ? '' : 'Connecting to shell...')}
      </div>
      <form
        onSubmit={handleCommandSubmit}
        className="flex items-center gap-2 border-t border-[#3c3c3c] px-3 py-1.5 shrink-0"
      >
        <span className="text-[#4ec9b0] shrink-0">PS&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-[#cccccc]"
          placeholder=""
          spellCheck={false}
        />
      </form>
    </div>
  );
};

export default TerminalArea;
