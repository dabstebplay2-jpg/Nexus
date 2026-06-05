import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Lock } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import NexusComposer from '../components/layout/NexusComposer';
import ChatMessage from '../components/chat/ChatMessage';
import CodeArtifactPanel from '../components/chat/CodeArtifactPanel';
import { useChatCodePanel } from '../hooks/useChatCodePanel';
import DailyLimitBar from '../components/DailyLimitBar';
import {
  loadSpaceState,
  saveSpaceState,
  uid,
  conversationsForWorkspace,
} from '../lib/spaceStore';
import {
  fetchModels,
  pickDefaultModel,
  findModelById,
  formatModelShortName,
} from '../lib/chatApi';
import { pickDefaultMediaModel } from '../lib/modelCatalogHelpers';
import { useAuth } from '../context/AuthContext';
import { usePricingCatalog, tierHasAiFromList } from '../hooks/usePricingCatalog';
import { useNexusChat } from '../hooks/useNexusChat';
import { readWebSearchEnabled, writeWebSearchEnabled } from '../lib/webSearchPreference';
import { findModelByAnyId } from '../lib/modelSelection';
import { isImageGenModel, detectImageGenIntent } from '../lib/attachments';

export default function SpacesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authStatus, fetchProfile, openAuthModal, openSettingsModal } = useAuth();
  const { tiers } = usePricingCatalog();
  const [state, setState] = useState(loadSpaceState);
  const [input, setInput] = useState('');
  const [models, setModels] = useState([]);
  const [researchModels, setResearchModels] = useState([]);
  const [mediaModels, setMediaModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedAgent] = useState('quick');
  const [mode, setMode] = useState('chat');
  const [search, setSearch] = useState('');
  const [webSearch, setWebSearch] = useState(readWebSearchEnabled);
  const messagesEndRef = useRef(null);

  const allModels = useMemo(
    () => [...models, ...researchModels, ...mediaModels],
    [models, researchModels, mediaModels]
  );
  const selectedModelMeta = useMemo(
    () => findModelByAnyId(allModels, selectedModel),
    [allModels, selectedModel]
  );
  const isMediaModelSelected = isImageGenModel(selectedModelMeta);

  const handleWebSearchChange = useCallback((next) => {
    setWebSearch(next);
    writeWebSearchEnabled(next);
  }, []);

  useEffect(() => {
    const settings = searchParams.get('settings');
    if (settings) {
      openSettingsModal(settings);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, openSettingsModal]);

  const wsConvs = conversationsForWorkspace(state.conversations, state.activeWorkspaceId);
  const activeConv = state.conversations.find((c) => c.id === state.activeConversationId);
  const activeWs = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
  const inChat =
    Boolean(state.activeConversationId) &&
    activeConv?.workspaceId === state.activeWorkspaceId;

  useEffect(() => saveSpaceState(state), [state]);

  const loadCatalog = useCallback(async () => {
    if (!authStatus.authorized) return;
    try {
      const mData = await fetchModels();
      setModels(mData.models || []);
      setResearchModels(mData.research_models || mData.researchModels || []);
      setMediaModels(mData.media_models || mData.mediaModels || []);
      setSelectedModel((prev) => pickDefaultModel(mData.models, prev));
    } catch {
      /* ignore */
    }
  }, [authStatus.authorized]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  const patchConv = useCallback((convId, updater) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === convId ? updater(c) : c)),
    }));
  }, []);

  const ensureConversation = useCallback(() => {
    if (state.activeConversationId) {
      const c = state.conversations.find((x) => x.id === state.activeConversationId);
      if (c?.workspaceId === state.activeWorkspaceId) return c.id;
    }
    const id = uid();
    const conv = {
      id,
      workspaceId: state.activeWorkspaceId,
      title: 'Новый диалог',
      messages: [],
      model: selectedModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setState((s) => ({
      ...s,
      conversations: [conv, ...s.conversations],
      activeConversationId: id,
    }));
    return id;
  }, [state, selectedModel]);

  const { loading, sendMessage } = useNexusChat({
    authStatus,
    fetchProfile,
    tierHasAi: (id) => tierHasAiFromList(tiers, id),
    onNeedAuth: () => openAuthModal(),
    onNeedPricing: () => {
      if (authStatus.authorized) navigate('/pricing#topup');
      else openAuthModal();
    },
  });

  const { codePanel, openFromMessage, closePanel, selectFile } = useChatCodePanel(
    activeConv?.messages,
    { autoOpenWhileStreaming: true, streaming: loading }
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    let finalModel = selectedModel;
    let finalIsMediaModel = isMediaModelSelected;

    if (detectImageGenIntent(text) && !isMediaModelSelected) {
      const defaultMediaId =
        pickDefaultMediaModel(mediaModels, localStorage.getItem('nexus_default_media_model')) ||
        'flux-klein';
      finalModel = defaultMediaId;
      finalIsMediaModel = true;
    }

    await sendMessage({
      text,
      mode,
      selectedModel: finalModel,
      selectedAgent,
      isMediaModel: finalIsMediaModel,
      conversation: activeConv,
      patchConv,
      ensureConversation,
      useContextTrim: true,
      contextLimit: 24,
      webSearchEnabled: webSearch && mode === 'chat',
    });
  };

  const modelPool = mode === 'research' ? researchModels : models;

  const filteredWorkspaces = state.workspaces.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  const openPricing = () => navigate('/pricing');

  return (
    <>
      <AppShell
        hideHistory
        onOpenPricing={openPricing}
        onOpenSettings={(tab) => {
          if (tab === 'auth' || !tab) openAuthModal();
          else openSettingsModal(tab);
        }}
        headerRight={
          authStatus.authorized && (
            <div className="flex items-center gap-3 text-xs">
              <DailyLimitBar profile={authStatus.profile} compact className="w-36 hidden md:block" />
            </div>
          )
        }
      >
        {!inChat ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <h1 className="text-2xl sm:text-3xl font-semibold">Пространства</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl border border-[var(--nx-border)] bg-[var(--nx-surface)] flex-1 sm:flex-none min-w-0">
                    <Search size={16} className="text-[var(--nx-muted)]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Поиск…"
                      className="bg-transparent text-sm outline-none w-full min-w-0 sm:w-32"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt('Название пространства');
                      if (!name?.trim()) return;
                      const id = uid();
                      setState((s) => ({
                        ...s,
                        workspaces: [
                          ...s.workspaces,
                          { id, name: name.trim(), emoji: '📁', createdAt: Date.now() },
                        ],
                        activeWorkspaceId: id,
                      }));
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--nx-text)] text-[var(--nx-bg)] text-sm font-medium"
                  >
                    <Plus size={18} />
                    Новое пространство
                  </button>
                </div>
              </div>

              <p className="text-xs font-semibold uppercase text-[var(--nx-muted)] mb-3 flex items-center gap-1">
                ▾ Ваши пространства
              </p>
              <ul className="space-y-1">
                {filteredWorkspaces.map((w, i) => {
                  const convCount = state.conversations.filter((c) => c.workspaceId === w.id).length;
                  return (
                    <motion.li
                      key={w.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            activeWorkspaceId: w.id,
                            activeConversationId: null,
                          }))
                        }
                        className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-[var(--nx-surface-hover)] text-left group"
                      >
                        <span className="text-2xl">{w.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{w.name}</p>
                          <p className="text-xs text-[var(--nx-muted)] flex items-center gap-1 mt-0.5">
                            <Lock size={12} /> Приватный · {convCount} диалогов
                          </p>
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>

              {activeWs && (
                <div className="mt-10">
                  <p className="text-sm text-[var(--nx-muted)] mb-4">
                    Открыто: <strong className="text-[var(--nx-text)]">{activeWs.name}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const id = uid();
                      setState((s) => ({
                        ...s,
                        conversations: [
                          {
                            id,
                            workspaceId: s.activeWorkspaceId,
                            title: 'Новый диалог',
                            messages: [],
                            model: selectedModel,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                          },
                          ...s.conversations,
                        ],
                        activeConversationId: id,
                      }));
                    }}
                    className="text-teal-500 text-sm hover:underline"
                  >
                    + Новый диалог в пространстве
                  </button>
                  <ul className="mt-4 space-y-1">
                    {wsConvs.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setState((s) => ({ ...s, activeConversationId: c.id }))}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-[var(--nx-surface-hover)] text-sm"
                      >
                        {c.title}
                      </button>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <main className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="px-4 py-2 border-b border-[var(--nx-border)] text-xs text-[var(--nx-muted)] shrink-0">
              {activeWs?.emoji} {activeWs?.name} · контекст ~24 сообщений + глобальная память из настроек
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, activeConversationId: null }))}
                className="ml-3 text-teal-500 hover:underline"
              >
                ← К списку
              </button>
            </div>
            <div className="flex flex-1 min-h-0 min-w-0 flex-col lg:flex-row">
              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {activeConv?.messages?.map((m, i) => {
                    const modelMeta =
                      m.role === 'assistant' && m.model
                        ? findModelById(modelPool, m.model)
                        : null;
                    const assistantLabel =
                      m.role === 'assistant'
                        ? formatModelShortName(modelMeta) || 'Nexus'
                        : undefined;
                    return (
                      <ChatMessage
                        key={m.id || i}
                        message={m}
                        isStreaming={loading}
                        assistantLabel={assistantLabel}
                        onOpenCodeFile={openFromMessage}
                        activeCodeFileId={codePanel.activeFileId}
                        codePanelOpen={codePanel.open}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <NexusComposer
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  loading={loading}
                  mode={mode}
                  onModeChange={setMode}
                  models={modelPool}
                  mediaModels={mediaModels}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                  modelVariant={mode === 'research' ? 'research' : 'chat'}
                  disabled={!authStatus.authorized}
                  placeholder="Сообщение в пространстве…"
                  webSearch={webSearch}
                  onWebSearchChange={handleWebSearchChange}
                />
              </div>
              {codePanel.open && codePanel.files.length > 0 && (
                <CodeArtifactPanel
                  files={codePanel.files}
                  activeFileId={codePanel.activeFileId}
                  onSelectFile={selectFile}
                  onClose={closePanel}
                  streaming={loading}
                />
              )}
            </div>
          </main>
        )}
      </AppShell>
    </>
  );
}
