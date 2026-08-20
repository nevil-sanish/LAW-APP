import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  Gavel,
  BrainCircuit,
  Send,
  Copy,
  Library,
  Plus,
  Trash2,
  MessageSquare,
  Clock,
  Scale,
  AlertTriangle,
} from 'lucide-react';
import { sendChatMessage } from '../gemini';
import { retrieveContext, preloadEmbedder } from '../rag';
import {
  saveChatSession,
  deleteChatSession,
  deleteAllChatSessions,
  subscribeToChatSessions,
} from '../firebase';
import type { Message, UserProfile, ChatSession } from '../types';

interface ChatViewProps {
  user: UserProfile | null;
}

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.slice(0, 60).trim();
  return cleaned.length < firstMessage.trim().length
    ? cleaned + '...'
    : cleaned;
}

export const ChatView: React.FC<ChatViewProps> = ({ user }) => {
  // Chat sessions
  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = React.useState(true);

  // Current chat
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  // Delete all confirmation
  const [showDeleteAll, setShowDeleteAll] = React.useState(false);
  const [deletingAll, setDeletingAll] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Start downloading/warming the local embedding model as soon as the chat
  // screen mounts, so it's ready by the time the user finishes typing their
  // first question instead of adding its load time to the first response.
  React.useEffect(() => {
    preloadEmbedder();
  }, []);

  // Subscribe to chat sessions in real-time (persists across logout/login)
  React.useEffect(() => {
    if (!user?.uid) {
      setSessions([]);
      setLoadingSessions(false);
      return;
    }

    setLoadingSessions(true);

    const unsubscribe = subscribeToChatSessions(
      user.uid,
      (chatSessions) => {
        setSessions(chatSessions);
        setLoadingSessions(false);
      },
      (error) => {
        console.error('Failed to subscribe to chat history:', error);
        setLoadingSessions(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Save immediately (no debounce — ensures persistence)
  const saveSession = React.useCallback(
    async (sessionId: string, msgs: Message[], title: string) => {
      if (!user?.uid || msgs.length === 0) return;
      try {
        await saveChatSession(user.uid, {
          id: sessionId,
          title,
          messages: msgs,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (err) {
        console.error('Save failed:', err);
      }
    },
    [user?.uid],
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start new chat
  const startNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    setShowHistory(false);
  };

  // Load an existing session
  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setActiveSessionId(session.id);
    setShowHistory(false);
  };

  // Delete a single session
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!user?.uid) return;
    try {
      await deleteChatSession(user.uid, sessionId);
      // Real-time listener will update sessions automatically
      if (activeSessionId === sessionId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Delete session failed:', err);
    }
  };

  // Delete ALL chat history
  const handleDeleteAllHistory = async () => {
    if (!user?.uid) return;
    setDeletingAll(true);
    try {
      await deleteAllChatSessions(user.uid);
      startNewChat();
      setShowDeleteAll(false);
    } catch (err) {
      console.error('Delete all sessions failed:', err);
    } finally {
      setDeletingAll(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Create session if needed
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      setActiveSessionId(sessionId);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Generate title from first user message
    const title = generateTitle(
      updatedMessages.find((m) => m.role === 'user')?.content || 'Legal Consultation',
    );

    // Save user message immediately so it persists even if AI call fails
    await saveSession(sessionId, updatedMessages, title);

    try {
      // Retrieve the most relevant chunks from the verified law repository
      // before calling the LLM, and ground the answer in them (RAG).
      const context = await retrieveContext(text, 5);
      const response = await sendChatMessage(updatedMessages, text, context);

      // Real citations from what was actually retrieved and handed to the
      // model — not a regex guess over its free-text answer.
      const sources = Array.from(
        new Set(context.map((c) => `${c.lawTitle} — ${c.section}`)),
      ).slice(0, 8);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        sources,
        timestamp: new Date(),
      };

      const allMessages = [...updatedMessages, aiMsg];
      setMessages(allMessages);

      // Save with AI response immediately
      await saveSession(sessionId, allMessages, title);
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errText = error.message || 'Something went wrong. Please try again in a moment.';
      const isQuotaError = errText.includes('quota') || errText.includes('429') || errText.includes('rate_limit') || errText.includes('busy');
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isQuotaError
          ? `⚠️ **API Rate Limit Reached**\n\nThe Groq API rate limit has been hit. Please wait a moment and try again.\n\nYou can check your usage at [Groq Console](https://console.groq.com).`
          : `⚠️ **I apologize for the interruption.** ${errText}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const suggestedQuestions = [
    'My landlord is refusing to return my security deposit. What can I do?',
    'Someone filed a false FIR against me. What are my rights?',
    'I had an accident and the other driver fled. What legal steps should I take?',
    'My employer hasn\'t paid my salary for 3 months. How do I file a complaint?',
  ];

  return (
    <div className="flex h-full bg-surface">
      {/* Chat History Panel (Desktop) */}
      <div className="hidden lg:flex w-[260px] flex-col border-r border-slate-200 bg-white shrink-0">
        <div className="p-4 border-b border-slate-100">
          <button
            onClick={startNewChat}
            className="w-full bg-black text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Consultation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Chat History
            </p>
            {sessions.length > 0 && (
              <button
                onClick={() => setShowDeleteAll(true)}
                className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                title="Delete all chat history"
              >
                <Trash2 className="w-3 h-3" /> Clear All
              </button>
            )}
          </div>
          {loadingSessions ? (
            <div className="px-3 py-4 text-sm text-slate-400">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-400">No past consultations</div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => loadSession(session)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-start gap-2 group mb-0.5 ${
                  activeSessionId === session.id
                    ? 'bg-slate-100 text-black font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="truncate flex-1">{session.title}</span>
                <button
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all shrink-0"
                  title="Delete this chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))
          )}
        </div>

        {/* Session count */}
        {sessions.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {sessions.length} saved {sessions.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
        )}
      </div>

      {/* Mobile History Toggle */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 lg:hidden"
              onClick={() => setShowHistory(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-[min(88vw,320px)] bg-white z-[60] flex flex-col shadow-xl lg:hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-sm">Chat History</h3>
                <button
                  onClick={startNewChat}
                  className="bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  New
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {sessions.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-400">No past consultations</div>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-start gap-2 mb-0.5 group ${
                        activeSessionId === session.id
                          ? 'bg-slate-100 text-black font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="truncate flex-1">{session.title}</span>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all shrink-0"
                        title="Delete this chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))
                )}
              </div>
              {sessions.length > 0 && (
                <div className="p-3 border-t border-slate-100">
                  <button
                    onClick={() => { setShowHistory(false); setShowDeleteAll(true); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete All History
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete All Confirmation Modal */}
      <AnimatePresence>
        {showDeleteAll && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[200]"
              onClick={() => !deletingAll && setShowDeleteAll(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 max-h-[90dvh] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-white rounded-2xl shadow-2xl z-[201] p-5 md:p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">Delete All Chat History?</h3>
                  <p className="text-sm text-on-surface-variant">
                    This will permanently delete all {sessions.length} {sessions.length === 1 ? 'conversation' : 'conversations'}. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteAll(false)}
                  disabled={deletingAll}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold border border-outline-variant rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllHistory}
                  disabled={deletingAll}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deletingAll ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete All
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Mobile history button */}
        <button
          onClick={() => setShowHistory(true)}
          className="lg:hidden absolute top-3 left-3 z-30 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"
        >
          <Clock className="w-4 h-4 text-slate-500" />
        </button>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-10 py-5 md:py-6 pb-52 md:pb-48 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Welcome */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-8 md:py-12 text-center"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-black flex items-center justify-center mb-5 md:mb-6 shadow-xl">
                  <Scale className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">
                  Advocate LegalAssist
                </h2>
                <p className="max-w-lg text-on-surface-variant text-sm md:text-base mb-6 md:mb-8">
                  I'm your AI legal advocate specializing in Indian law. Describe your situation or ask a legal question — I'll guide you as your advocate would, citing specific laws, sections, and landmark cases.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        textareaRef.current?.focus();
                      }}
                      className="text-left p-4 bg-white border border-outline-variant rounded-xl text-sm text-on-surface-variant hover:bg-surface-container hover:border-black/20 transition-all shadow-sm leading-snug"
                    >
                      <Gavel className="w-4 h-4 text-slate-400 mb-2" />
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Messages */}
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 md:gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 mt-1 shadow-md">
                      <Scale className="w-5 h-5 text-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-[86%] sm:max-w-[90%] md:max-w-[80%] rounded-2xl p-4 md:p-6 shadow-sm border relative group ${
                      msg.role === 'user'
                        ? 'bg-surface-container-highest border-outline-variant rounded-tr-none'
                        : 'bg-white border-outline-variant rounded-tl-none'
                    }`}
                  >
                    {/* Copy button */}
                    {msg.role === 'assistant' && (
                      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="p-1.5 text-slate-400 hover:text-black bg-white/80 rounded-lg border border-slate-100"
                          title="Copy response"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {copiedId === msg.id && (
                      <span className="absolute right-3 top-3 text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">
                        Copied!
                      </span>
                    )}

                    {/* Advocate label */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-3">
                        <BrainCircuit className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Advocate LegalAssist
                        </span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="prose-legal leading-relaxed text-sm md:text-base">
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {msg.sources.map((s, i) => (
                          <span
                            key={`${s}-${i}`}
                            className="px-2 py-0.5 bg-surface-container rounded-full text-[10px] font-bold text-on-surface-variant border border-outline-variant flex items-center gap-1"
                          >
                            <Library className="w-2.5 h-2.5" /> {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1 border border-slate-200">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="Me" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                          {user?.displayName?.[0] || '?'}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 md:gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 mt-1 shadow-md">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-none p-5 shadow-sm border border-outline-variant">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Advocate is analyzing...
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full typing-dot" />
                    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full typing-dot" />
                    <div className="w-2.5 h-2.5 bg-slate-400 rounded-full typing-dot" />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-6 bg-gradient-to-t from-surface via-surface to-transparent">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-outline-variant p-2 focus-within:ring-2 focus-within:ring-black/5 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none resize-none px-4 py-3 min-h-[52px] max-h-[200px] text-on-surface placeholder-slate-400 focus:ring-0 focus:outline-none text-sm md:text-base"
                placeholder="Describe your legal situation or ask a question... I'll advise you as your advocate."
                rows={1}
                disabled={loading}
              />
              <div className="flex justify-between items-center px-2 pb-1.5">
                <span className="text-[10px] text-slate-400 hidden sm:block">
                  Press Enter to send • Shift+Enter for new line
                </span>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="bg-black text-white p-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-md disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-center text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-outline mt-2 px-2">
              Advocate LegalAssist provides informational guidance only. Consult a licensed advocate for formal advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
