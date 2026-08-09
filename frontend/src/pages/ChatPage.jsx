import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, RefreshCw, Sparkles } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import NexusComposer from '../components/layout/NexusComposer';
import ChatMessage from '../components/chat/ChatMessage';
import CodeArtifactPanel from '../components/chat/CodeArtifactPanel';
import { useChatCodePanel } from '../hooks/useChatCodePanel';
import DailyLimitBar from '../components/DailyLimitBar';
import {
  loadChatState,
  saveChatState,
  clearChatState,
  getDefaultChatState,
  purgeLegacyAccountChatCache,
  uid,
} from '../lib/chatStore';
import { useCloudChatSync } from '../hooks/useCloudChatSync';
import {
  fetchModels,
  pickDefaultModel,
  pickDefaultFromCatalog,
  findModelById,
  formatModelShortName,
} from '../lib/chatApi';
import { findModelByAnyId, usesReasoningApiForThinking } from '../lib/modelSelection';
import { pickDefaultMediaModel } from '../lib/modelCatalogHelpers';
import {
  processAttachmentFiles,
  modelAcceptsPhotos,
  isImageGenModel,
  detectImageGenIntent,
} from '../lib/attachments';
import { useAuth } from '../context/AuthContext';
import { usePricingCatalog, tierByIdFromList, tierHasAiFromList } from '../hooks/usePricingCatalog';
import { useNexusChat } from '../hooks/useNexusChat';
import { pushRecentModel } from '../lib/modelRecents';
import { useArtifacts } from '../context/ArtifactContext';
import { hydrateConversationImages } from '../lib/chatSyncAttachments';
import SupportPanel from '../components/support/SupportPanel';
import { readWebSearchEnabled, writeWebSearchEnabled } from '../lib/webSearchPreference';
import { detectExplicitWebSearchIntent } from '../lib/webSearchIntent';
import ConnectorChips from '../features/connectors/ConnectorChips';
import { fetchConnectorsSummary } from '../features/connectors/connectorsApi';
import ChatComposerBanners from '../components/chat/ChatComposerBanners';
import { warmApiHealthOnce } from '../lib/warmApiHealth';
import NoCodePresetBar from '../features/noCode/NoCodePresetBar';
import {
  buildNoCodeSystemPrompt,
  detectNoCodePreset,
  getNoCodePreset,
  getNoCodeSuggestions,
} from '../features/noCode/noCodeConfig';

function getConversationExperience(conversation) {
  if (!conversation) return 'chat';
  if (conversation.experience === 'nocode') return 'nocode';
  return detectNoCodePreset(conversation.messages || []) ? 'nocode' : 'chat';
}

export default function ChatPage({ experience = 'chat' }) {
  const isNoCodeExperience = experience === 'nocode';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authStatus, fetchProfile, openAuthModal, openSettingsModal, loading: authLoading } = useAuth();

  const [chatState, setChatState] = useState(getDefaultChatState);
  const [input, setInput] = useState('');
  const [models, setModels] = useState([]);
  const [researchModels, setResearchModels] = useState([]);
  const [mediaModels, setMediaModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedAgent] = useState('quick');
  const [mode, setMode] = useState('chat');
  const [noCodePreset, setNoCodePreset] = useState('auto');
  const [modelsError, setModelsError] = useState('');
  const [streamingId, setStreamingId] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [visionGuide, setVisionGuide] = useState(null);
  const [attachToast, setAttachToast] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(readWebSearchEnabled);
  const [webSearchHighlight, setWebSearchHighlight] = useState(false);
  const handleWebSearchChange = useCallback((next) => {
    setWebSearch(next);
    writeWebSearchEnabled(next);
  }, []);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const [connectorsForChat, setConnectorsForChat] = useState([]);
  const wasAuthorizedRef = useRef(false);
  const skipGuestSaveOnceRef = useRef(false);
  const allowGuestLocalSaveRef = useRef(false);
  const guestHydratedRef = useRef(false);
  const experienceKey = isNoCodeExperience ? 'nocode' : 'chat';
  const activeConvCandidate = chatState.conversations.find(
    (c) => c.id === chatState.activeConversationId
  );
  const activeConv =
    activeConvCandidate && getConversationExperience(activeConvCandidate) === experienceKey
      ? activeConvCandidate
      : null;
  const hasMessages = Boolean(activeConv?.messages?.some((message) => message.role !== 'system'));
  const noCodePresetMeta = useMemo(() => getNoCodePreset(noCodePreset), [noCodePreset]);

  useEffect(() => {
    if (chatState.activeConversationId && activeConvCandidate && !activeConv) {
      setChatState((state) => ({ ...state, activeConversationId: null }));
    }
  }, [experienceKey, chatState.activeConversationId, activeConvCandidate, activeConv]);

  useEffect(() => {
    if (!isNoCodeExperience || !activeConv?.messages?.length) return;
    const detected = detectNoCodePreset(activeConv.messages);
    if (detected && detected !== noCodePreset) {
      setNoCodePreset(detected);
    }
  }, [isNoCodeExperience, activeConv?.id, activeConv?.messages, noCodePreset]);

  const { tiers } = usePricingCatalog();
  const tier = tierByIdFromList(tiers, authStatus.profile?.subscription_tier || 'FREE');
  const allModels = useMemo(
    () => [...models, ...researchModels, ...mediaModels],
    [models, researchModels, mediaModels]
  );
  const selectedModelMeta = useMemo(
    () => findModelByAnyId(allModels, selectedModel),
    [allModels, selectedModel]
  );
  const isMediaModelSelected = isImageGenModel(selectedModelMeta);

  const {
    cloudReady,
    cloudError,
    persistConversation,
    persistConversationNow,
    deleteConversation,
    isCloudMode,
  } = useCloudChatSync({
      authorized: authStatus.authorized,
      userEmail: authStatus.profile?.email,
      chatState,
      setChatState,
    });

  const { artifacts, artifactsReady } = useArtifacts();
  const chatsLoading = authStatus.authorized && !cloudReady && !authLoading;

  useEffect(() => {
    if (authLoading) return;
    if (authStatus.authorized) {
      wasAuthorizedRef.current = true;
      allowGuestLocalSaveRef.current = false;
      guestHydratedRef.current = true;
      purgeLegacyAccountChatCache();
      return;
    }

    purgeLegacyAccountChatCache();

    if (wasAuthorizedRef.current) {
      const empty = clearChatState();
      skipGuestSaveOnceRef.current = true;
      allowGuestLocalSaveRef.current = true;
      guestHydratedRef.current = true;
      setChatState(empty);
      wasAuthorizedRef.current = false;
      return;
    }

    if (!guestHydratedRef.current) {
      guestHydratedRef.current = true;
      setChatState(loadChatState());
    }
    if (!allowGuestLocalSaveRef.current) {
      allowGuestLocalSaveRef.current = true;
    }
  }, [authStatus.authorized, authLoading]);

  useEffect(() => {
    if (authStatus.authorized || authLoading) return;
    if (skipGuestSaveOnceRef.current) {
      skipGuestSaveOnceRef.current = false;
      return;
    }
    if (!allowGuestLocalSaveRef.current) return;
    saveChatState(chatState);
  }, [chatState, authStatus.authorized, authLoading]);

  const handleModelChange = useCallback((id) => {
    if (id) pushRecentModel(id);
    setSelectedModel(id);
  }, []);

  const openAuth = useCallback(() => {
    openAuthModal();
  }, [openAuthModal]);

  useEffect(() => {
    const panel = searchParams.get('panel');
    const settings = searchParams.get('settings');
    if (settings) {
      openSettingsModal(settings);
      setSearchParams({}, { replace: true });
    } else if (panel === 'auth') {
      openAuthModal();
      setSearchParams({}, { replace: true });
    } else if (panel === 'pricing') {
      openSettingsModal('subscription');
      setSearchParams({}, { replace: true });
    } else if (panel === 'about') {
      openSettingsModal('help');
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('support') === '1') {
      setSupportOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, openAuthModal, openSettingsModal]);

  useEffect(() => {
    const onSupport = () => setSupportOpen(true);
    window.addEventListener('nexus-open-support', onSupport);
    return () => window.removeEventListener('nexus-open-support', onSupport);
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!authStatus.authorized) return;
    setModelsError('');
    try {
      const mData = await fetchModels();
      setModels(mData.models || []);
      setResearchModels(mData.research_models || mData.researchModels || []);
      setMediaModels(mData.media_models || mData.mediaModels || []);
      setVisionGuide(mData.visionGuide || mData.vision_guide || null);
      setSelectedModel((prev) => pickDefaultFromCatalog(mData, prev));
    } catch (e) {
      setModelsError(e.message);
    }
  }, [authStatus.authorized]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!authStatus.authorized) {
      setConnectorsForChat([]);
      return;
    }
    warmApiHealthOnce();
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchConnectorsSummary();
        if (!cancelled) {
          setConnectorsForChat(
            (data.connected || [])
              .filter((c) => c.enabled_for_chat)
              .map((c) => c.id)
              .filter(Boolean)
          );
        }
      } catch {
        if (!cancelled) setConnectorsForChat([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus.authorized]);

  // Синхронизация только при смене каталога/режима — не при каждом выборе модели (иначе медиа сбрасывается).
  useEffect(() => {
    if (!authStatus.authorized) return;
    const all = [...models, ...researchModels, ...mediaModels];
    if (!all.length) return;

    setSelectedModel((current) => {
      if (!current) {
        return models.length
          ? pickDefaultModel(models, '')
          : mediaModels[0]
            ? pickDefaultFromCatalog({ models, media_models: mediaModels }, '')
            : '';
      }
      if (findModelByAnyId(all, current)) return current;
      if (mode === 'research' && researchModels.length) {
        return pickDefaultModel(researchModels, current);
      }
      return models.length ? pickDefaultModel(models, '') : current;
    });
  }, [mode, researchModels, models, mediaModels, authStatus.authorized]);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 96;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (!cloudReady || !artifactsReady) return;
    setChatState((s) => {
      if (!Array.isArray(s.conversations)) return s;
      let changed = false;
      const conversations = s.conversations.map((c) => {
        const messages = hydrateConversationImages(c.messages, artifacts);
        if (messages !== c.messages) changed = true;
        return messages !== c.messages ? { ...c, messages } : c;
      });
      return changed ? { ...s, conversations } : s;
    });
  }, [cloudReady, artifactsReady, artifacts]);

  const patchConv = useCallback(
    (convId, updater) => {
      if (typeof updater !== 'function') {
        console.error('[chat] patchConv: updater must be a function');
        return;
      }
      setChatState((s) => {
        const list = Array.isArray(s.conversations) ? s.conversations : [];
        const conversations = list.map((c) => (c.id === convId ? updater(c) : c));
        const updated = conversations.find((c) => c.id === convId);
        if (updated && isCloudMode) persistConversation(updated);
        return { ...s, conversations };
      });
    },
    [isCloudMode, persistConversation]
  );

  const ensureConversation = useCallback(() => {
    if (chatState.activeConversationId) {
      const c = chatState.conversations.find((x) => x.id === chatState.activeConversationId);
      if (c && getConversationExperience(c) === experienceKey) return c.id;
    }
    const id = uid();
    const conv = {
      id,
      title: isNoCodeExperience ? 'Новый проект' : 'Новый чат',
      experience: experienceKey,
      messages: [],
      model: selectedModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChatState((s) => ({
      ...s,
      conversations: [conv, ...s.conversations],
      activeConversationId: id,
    }));
    if (isCloudMode) persistConversation(conv);
    return id;
  }, [
    chatState.activeConversationId,
    chatState.conversations,
    selectedModel,
    isCloudMode,
    persistConversation,
    experienceKey,
    isNoCodeExperience,
  ]);

  const { loading, sendMessage, stopGeneration } = useNexusChat({
    authStatus,
    fetchProfile,
    tierHasAi: (id) => tierHasAiFromList(tiers, id),
    onNeedAuth: () => openAuthModal(),
    onNeedPricing: () => {
      if (authStatus.authorized) navigate('/pricing#topup');
      else openAuthModal();
    },
    persistConversationNow: isCloudMode ? persistConversationNow : undefined,
  });

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' });
  }, [activeConv?.messages, loading]);

  const { codePanel, openFromMessage, closePanel, selectFile } = useChatCodePanel(
    activeConv?.messages,
    { autoOpenWhileStreaming: true, streaming: loading }
  );

  const handlePickFiles = useCallback(
    async (fileList) => {
      if (!fileList?.length) return;
      setAttachToast('');
      const hasImage = Array.from(fileList).some(
        (f) => (f.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)
      );
      if (hasImage && !isMediaModelSelected && !modelAcceptsPhotos(selectedModelMeta)) {
        setAttachToast(
          'Эта модель не принимает фото. Выберите Gemini 3.5 Flash, GPT-5.4, Claude Sonnet 4.6 или другую с пометкой «Фото».'
        );
        return;
      }
      try {
        const added = await processAttachmentFiles(fileList, attachments.length);
        setAttachments((prev) => [...prev, ...added]);
        if (hasImage && !localStorage.getItem('nexus-attach-hint')) {
          localStorage.setItem('nexus-attach-hint', '1');
          setAttachToast('Фото отправляется в vision-модель. Для генерации картинок откройте вкладку «Медиа» в выборе модели.');
        }
      } catch (e) {
        setAttachToast(e.message || 'Не удалось прикрепить файл');
      }
    },
    [attachments.length, isMediaModelSelected, selectedModelMeta]
  );

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !attachments.length) || loading) return;
    const sentAttachments = attachments;
    setInput('');
    setAttachments([]);
    const assistantId = uid();
    setStreamingId(assistantId);

    let finalModel = selectedModel;
    let finalIsMediaModel = isMediaModelSelected;
    let finalModelMeta = selectedModelMeta;

    if (detectImageGenIntent(text) && !isMediaModelSelected) {
      const defaultMediaId =
        pickDefaultMediaModel(mediaModels, localStorage.getItem('nexus_default_media_model')) ||
        'flux-klein';
      finalModel = defaultMediaId;
      finalIsMediaModel = true;
      finalModelMeta = findModelByAnyId(allModels, finalModel);
    }

    if (!webSearch && mode === 'chat' && detectExplicitWebSearchIntent(text)) {
      setWebSearchHighlight(true);
      window.setTimeout(() => setWebSearchHighlight(false), 2200);
    }

    await sendMessage({
      text,
      attachments: sentAttachments,
      mode,
      selectedModel: finalModel,
      selectedAgent,
      isMediaModel: finalIsMediaModel,
      assistantId,
      conversation: activeConv,
      patchConv,
      ensureConversation,
      useContextTrim: false,
      webSearchEnabled: webSearch && mode === 'chat',
      enableThinking: Boolean(
        finalModelMeta && usesReasoningApiForThinking(finalModelMeta)
      ),
      systemPrompt: isNoCodeExperience ? buildNoCodeSystemPrompt(noCodePreset) : '',
    });
    setStreamingId(null);
  };

  const modelPool = mode === 'research' ? researchModels : models;
  const historyItems = authStatus.authorized
    ? [...chatState.conversations]
        .filter((conversation) => getConversationExperience(conversation) === experienceKey)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 40)
        .map((c) => ({ id: c.id, title: c.title }))
    : [];

  const suggested = isNoCodeExperience
    ? getNoCodeSuggestions(noCodePreset)
    : [
        'Объясни квантовые компьютеры простыми словами',
        'Новости ИИ за эту неделю',
        'Сравни GPT-5.5 и Claude Opus 4.8',
        'План MVP SaaS за 2 недели',
      ];

  const openPricing = () => navigate('/pricing');

  return (
    <>
      <AppShell
        ambientFocus="composer"
        onNewChat={() => setChatState((s) => ({ ...s, activeConversationId: null }))}
        historyItems={historyItems}
        activeHistoryId={chatState.activeConversationId}
        onSelectHistory={(id) => setChatState((s) => ({ ...s, activeConversationId: id }))}
        onDeleteHistory={(id) => {
          deleteConversation(id);
          setChatState((s) => ({
            ...s,
            conversations: s.conversations.filter((c) => c.id !== id),
            activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
          }));
        }}
        onOpenPricing={openPricing}
        onOpenSettings={(tab) => {
          if (tab === 'auth' || !tab) openAuthModal();
          else if (tab === 'pricing') openSettingsModal('subscription');
          else openSettingsModal(tab);
        }}
        headerLeft={
          <div className="nx-chat-context">
            <span className={`nx-chat-context__mark ${isNoCodeExperience ? 'is-studio' : ''}`}>
              {isNoCodeExperience ? <Sparkles size={14} /> : <span className="nx-chat-context__dot" />}
            </span>
            <span className="nx-chat-context__title">
              {isNoCodeExperience ? 'No-Code Studio' : 'Nexus AI'}
            </span>
            <span className="nx-chat-context__meta">
              {isNoCodeExperience ? noCodePresetMeta.title : `${tier.name} · Chat`}
            </span>
          </div>
        }
        headerRight={
          <div className="flex items-center gap-3">
            {modelsError && (
              <button
                type="button"
                onClick={loadCatalog}
                className="text-amber-500 text-xs flex items-center gap-1 max-w-[140px] truncate"
                title={modelsError}
              >
                <RefreshCw size={14} className="shrink-0" />
                <span className="hidden sm:inline truncate">Модели</span>
              </button>
            )}
            {authStatus.authorized &&
              (authStatus.profile?.monthly_cap_usd > 0 || authStatus.profile?.daily_cap_usd > 0) && (
              <DailyLimitBar profile={authStatus.profile} compact className="w-28 sm:w-36 shrink-0" />
            )}
          </div>
        }
      >
        <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {chatsLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[var(--nx-muted)]">
              Загрузка истории чатов…
            </div>
          ) : !hasMessages ? (
            <div className="nx-scroll-region w-full custom-scrollbar">
              <div className="nx-chat-home">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="nx-chat-home__intro"
                >
                  <div className={`nx-chat-home__eyebrow ${isNoCodeExperience ? 'is-studio' : ''}`}>
                    {isNoCodeExperience ? <Sparkles size={14} /> : <span className="nx-chat-context__dot" />}
                    {isNoCodeExperience ? 'Nexus Studio' : 'Nexus AI'}
                  </div>
                  <h1 className="nx-chat-home__title">
                    {isNoCodeExperience ? 'Соберём digital-продукт' : 'Чем помочь сегодня?'}
                  </h1>
                  <p className="nx-chat-home__subtitle">
                    {isNoCodeExperience
                      ? 'Опиши идею обычными словами. Nexus подготовит структуру, UX, тексты и понятный план реализации.'
                      : 'Чат, Research, файлы и инструменты — в одном спокойном рабочем пространстве.'}
                  </p>
                </motion.div>

                {isNoCodeExperience ? (
                  <NoCodePresetBar value={noCodePreset} onChange={setNoCodePreset} />
                ) : null}

                <div className="nx-chat-home__composer">
                  <ChatComposerBanners
                    profile={authStatus.profile}
                    modelsError={modelsError}
                    onRetryModels={loadCatalog}
                    connectorsForChat={connectorsForChat}
                    selectedModelMeta={selectedModelMeta}
                    onOpenSettingsConnectors={() => openSettingsModal('connectors')}
                  />
                  <NexusComposer
                    centered
                    value={input}
                    onChange={setInput}
                    onSend={handleSend}
                    onStop={stopGeneration}
                    loading={loading}
                    disabled={!authStatus.authorized}
                    guest={!authStatus.authorized}
                    onGuestRegister={openAuth}
                    mode={mode}
                    onModeChange={setMode}
                    models={modelPool}
                    mediaModels={mediaModels}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    modelVariant={mode === 'research' ? 'research' : 'chat'}
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    onPickFiles={handlePickFiles}
                    selectedModelMeta={selectedModelMeta}
                    visionGuide={visionGuide}
                    onOpenSupport={() => setSupportOpen(true)}
                    webSearch={webSearch}
                    onWebSearchChange={handleWebSearchChange}
                    webSearchHighlight={webSearchHighlight}
                  />
                </div>

                {attachToast ? <p className="nx-chat-home__notice">{attachToast}</p> : null}

                <div className="nx-prompt-grid">
                  {suggested.map((prompt, index) => (
                    <motion.button
                      key={prompt}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.035 * index, duration: 0.2 }}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="nx-prompt-card"
                    >
                      <span>{prompt}</span>
                      <ArrowUpRight size={15} />
                    </motion.button>
                  ))}
                </div>

                {!authStatus.authorized ? (
                  <div className="nx-guest-hint">
                    <span>Для отправки сообщений нужен аккаунт.</span>
                    <button type="button" onClick={openAuth}>Войти</button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 min-w-0 flex-col lg:flex-row">
              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <div
                  ref={scrollContainerRef}
                  onScroll={handleMessagesScroll}
                  className="nx-scroll-region custom-scrollbar"
                >
                  {activeConv.messages.filter((m) => m.role !== 'system').map((m, i) => {
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
                        isStreaming={loading && m.id === streamingId}
                        assistantLabel={assistantLabel}
                        onOpenCodeFile={openFromMessage}
                        activeCodeFileId={codePanel.activeFileId}
                        codePanelOpen={codePanel.open}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="shrink-0 sticky bottom-0 z-20 bg-gradient-to-t from-[var(--nx-bg)] via-[var(--nx-bg)] to-transparent pt-2">
                  {isNoCodeExperience && (
                    <div className="px-4 sm:px-6 pb-2">
                      <NoCodePresetBar
                        value={noCodePreset}
                        onChange={setNoCodePreset}
                        compact
                      />
                    </div>
                  )}
                  <ChatComposerBanners
                    profile={authStatus.profile}
                    modelsError={modelsError}
                    onRetryModels={loadCatalog}
                    connectorsForChat={connectorsForChat}
                    selectedModelMeta={selectedModelMeta}
                    onOpenSettingsConnectors={() => openSettingsModal('connectors')}
                  />
                  <div className="px-4 sm:px-6">
                  <ConnectorChips
                    authorized={authStatus.authorized}
                    onOpenSettings={() => openSettingsModal('connectors')}
                  />
                  <NexusComposer
                    value={input}
                    onChange={setInput}
                    onSend={handleSend}
                    onStop={stopGeneration}
                    loading={loading}
                    mode={mode}
                    onModeChange={setMode}
                    models={modelPool}
                    mediaModels={mediaModels}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    modelVariant={mode === 'research' ? 'research' : 'chat'}
                    disabled={!authStatus.authorized}
                    guest={!authStatus.authorized}
                    onGuestRegister={openAuth}
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    onPickFiles={handlePickFiles}
                    selectedModelMeta={selectedModelMeta}
                    visionGuide={visionGuide}
                    onOpenSupport={() => setSupportOpen(true)}
                    webSearch={webSearch}
                    onWebSearchChange={handleWebSearchChange}
                    webSearchHighlight={webSearchHighlight}
                  />
                  </div>
                </div>
                {attachToast && (
                  <p className="text-xs text-amber-400/90 px-4 pb-2 text-center">{attachToast}</p>
                )}
              </div>
              {codePanel.open && codePanel.files.length > 0 && (
                <motion.div
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.1}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 500) closePanel();
                  }}
                  className="fixed inset-0 z-[60] flex flex-col bg-[var(--nx-bg)] lg:static lg:z-auto lg:flex lg:flex-1 lg:min-w-0 lg:max-w-[min(480px,45%)] border-l border-[var(--nx-border)]"
                >
                  <div className="lg:hidden flex justify-center py-2 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-white/20" aria-hidden />
                  </div>
                  <CodeArtifactPanel
                    files={codePanel.files}
                    activeFileId={codePanel.activeFileId}
                    onSelectFile={selectFile}
                    onClose={closePanel}
                    streaming={loading && codePanel.messageId === streamingId}
                  />
                </motion.div>
              )}
            </div>
          )}
          {cloudError && authStatus.authorized && (
            <p className="absolute bottom-20 left-0 right-0 text-center text-xs text-amber-500 px-4">
              {cloudError} — чат сохраняется только в этом браузере до восстановления связи.
            </p>
          )}
        </main>
      </AppShell>
      <SupportPanel
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        onNeedAuth={!authStatus.authorized ? openAuth : undefined}
      />
    </>
  );
}
