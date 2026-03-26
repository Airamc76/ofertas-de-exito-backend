import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trash2, Send, MessageSquare, Lightbulb, Zap, Command, Cpu, Edit3, Check, X, ArrowLeft } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, MeshWobbleMaterial } from '@react-three/drei';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import gsap from 'gsap';
import { api } from './services/api';

const RotatingOrb = () => {
  return (
    <Float speed={2} rotationIntensity={0.8} floatIntensity={1.5}>
      <Sphere args={[1.4, 64, 64]} position={[4, 2, -4]}>
        <MeshDistortMaterial
          color="#6366f1"
          distort={0.4}
          speed={1.5}
          roughness={0}
          metalness={1}
          transparent
          opacity={0.2}
        />
      </Sphere>
      <Sphere args={[0.8, 64, 64]} position={[-4, -2, -5]}>
        <MeshWobbleMaterial
          color="#a855f7"
          factor={0.6}
          speed={2}
          transparent
          opacity={0.15}
        />
      </Sphere>
    </Float>
  );
};

const App = () => {
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  
  const viewportRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const sendingRef = useRef(false);

  const scrollToBottom = () => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const data = await api.listConversations();
      setConversations(data.data || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    gsap.to(".app-shell", { opacity: 1, duration: 1 });
  }, []);

  const startNewChat = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const data = await api.createConversation();
      if (data.data) {
        setCurrentConvId(data.data.id);
        setMessages([{ role: 'assistant', content: '### ¡Hola! Soy **Alma** ✨\nTu IA experta en ofertas de ventas y copywriting.\n\n¿En qué puedo ayudarte a vender hoy? 🚀' }]);
        loadConversations();
      }
    } catch (err) {
      console.error('Error starting chat:', err);
    } finally {
      setIsBusy(false);
    }
  };

  const selectConversation = async (id) => {
    if (isBusy || id === currentConvId) return;
    setIsBusy(true);
    setCurrentConvId(id);
    try {
      const data = await api.getHistory(id);
      setMessages(data.data || []);
      loadConversations();
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isBusy || sendingRef.current) return;
    sendingRef.current = true;
    setIsBusy(true);

    let convId = currentConvId;
    if (!convId) {
      const data = await api.createConversation();
      convId = data.data.id;
      setCurrentConvId(convId);
    }

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const data = await api.sendMessage(convId, userMsg);
      if (data.data) {
        setMessages(prev => [...prev, data.data]);
        loadConversations();
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '**Vaya...** parece que hay un problema con la respuesta. ¿Reintentamos? 🔄' }]);
    } finally {
      setIsTyping(false);
      setIsBusy(false);
      sendingRef.current = false;
    }
  };

  const handleRename = async (id) => {
    if (!editTitle.trim()) return;
    try {
      await api.updateTitle(id, editTitle);
      setEditingId(null);
      loadConversations();
    } catch (err) {
      console.error('Error renaming:', err);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('¿Seguro que quieres eliminar esta conversación?')) return;
    try {
      await api.deleteConversation(id);
      if (currentConvId === id) {
        setCurrentConvId(null);
        setMessages([]);
      }
      loadConversations();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: '### ¡Hecho! 🧹\nHe limpiado el chat. ¿Qué vamos a crear ahora? 💡' }]);
  };

  return (
    <div className="app-shell opacity-0 h-[100dvh] max-h-[100dvh] bg-[#05060b] flex flex-col p-4 md:p-6 gap-6 overflow-hidden relative font-['Inter'] selection:bg-indigo-500/30">
      {/* Background Lighting */}
      <div className="fixed inset-0 z-0 opacity-80 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
          <ambientLight intensity={1} />
          <pointLight position={[10, 10, 10]} intensity={2} color="#6366f1" />
          <Suspense fallback={null}>
            <RotatingOrb />
          </Suspense>
        </Canvas>
      </div>

      {/* Header */}
      <header className="header-shell relative z-20 h-20 shrink-0 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] px-8 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-['Oswald'] font-bold text-2xl tracking-tight text-white uppercase italic leading-none">
              Alma <span className="text-indigo-400">Assistant</span>
            </h1>
            <span className="text-[10px] text-white/40 font-black tracking-[0.3em] uppercase mt-1">Elite Copywriting v2.0</span>
          </div>
        </div>
        <div className="flex gap-4">
          <a
            href="https://portal-ia.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 text-white/60 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all border border-white/5"
          >
            <ArrowLeft size={14} />
            Portal de IAs
          </a>
          <button onClick={startNewChat} className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-indigo-500/20">Nueva</button>
          <button onClick={clearChat} className="px-6 py-2.5 bg-white/5 text-white/60 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all">Limpiar</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 overflow-hidden">
        <aside className="hidden lg:flex flex-col gap-6 p-8 bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-[40px] shadow-xl overflow-hidden relative">
          <section>
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4 border-l-2 border-indigo-500 pl-4">Sobre Alma</h3>
            <p className="text-[14px] text-white/60 leading-relaxed font-medium">Transforma tus ideas en ofertas <span className="text-white italic">irresistibles</span> con nuestra IA experta.</p>
          </section>
          
          <div className="h-px bg-white/5" />

          <section className="flex-1 flex flex-col gap-4 overflow-hidden">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2 border-l-2 border-indigo-500 pl-4">Historial</h3>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2 custom-scroll">
              {conversations.length === 0 && <p className="text-[12px] text-white/20 italic text-center mt-4">Sin historial</p>}
              {conversations.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => selectConversation(c.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all text-left cursor-pointer group relative ${c.id === currentConvId ? 'bg-indigo-500/20 border border-indigo-500/30 text-white' : 'hover:bg-white/5 text-white/40 hover:text-white/70'}`}
                >
                  <MessageSquare size={16} className={c.id === currentConvId ? 'text-indigo-400' : ''} />
                  
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                      <input 
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleRename(c.id)}
                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[12px] w-full text-white outline-none focus:border-indigo-500"
                      />
                      <button onClick={() => handleRename(c.id)}><Check size={14} className="text-emerald-400" /></button>
                      <button onClick={() => setEditingId(null)}><X size={14} className="text-rose-400" /></button>
                    </div>
                  ) : (
                    <span className="truncate font-bold text-[13px] flex-1">{c.title || 'Nueva Estrategia'}</span>
                  )}

                  {!editingId && (
                    <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setEditTitle(c.title); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, c.id)}
                        className="p-1.5 hover:bg-rose-500/20 rounded-lg text-white/40 hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="mt-auto p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-3xl flex gap-4">
            <Lightbulb className="text-indigo-400 shrink-0" size={20} />
            <p className="text-[12px] text-indigo-100/60 leading-tight">Tip: Se específico con tu audiencia para mejores copys.</p>
          </div>
        </aside>

        <main className="flex flex-col bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-[40px] overflow-hidden relative shadow-2xl h-full">
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none z-20" />
          <div ref={viewportRef} className="flex-1 overflow-y-auto p-10 lg:p-14 flex flex-col gap-10 custom-scroll scroll-smooth">
            <AnimatePresence initial={false}>
              {messages.length === 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center gap-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full animate-pulse" />
                    <div className="relative p-10 bg-white/5 rounded-full border border-white/10 shadow-xl">
                      <Zap size={60} className="text-white opacity-80" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <h2 className="font-['Oswald'] text-6xl font-black text-white italic uppercase tracking-tighter">ALMA <span className="text-indigo-500">IA</span></h2>
                    <p className="text-lg text-white/30 font-bold max-w-lg mx-auto leading-relaxed">¿Empezamos tu próxima gran oferta?</p>
                  </div>
                </motion.div>
              )}
              {messages.map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`max-w-[85%] p-6 md:p-8 rounded-[32px] text-[16px] relative ${m.role === 'user' ? 'self-end bg-indigo-600/90 text-white rounded-br-none shadow-xl border border-white/10' : 'self-start bg-white/5 border border-white/10 text-white/90 rounded-bl-none shadow-lg'}`}
                >
                  <div className={m.role === 'assistant' ? 'markdown-content' : ''}>
                    {m.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    ) : (
                      <p className="font-medium whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                  {m.role === 'assistant' && (
                    <div className="absolute -left-3 -bottom-3 p-1.5 bg-indigo-500 rounded-lg shadow-lg">
                      <Cpu size={12} className="text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 p-6">
                {[1, 2, 3].map(i => (
                  <span key={i} className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.2}s` }}></span>
                ))}
              </motion.div>
            )}
            <div ref={scrollAnchorRef} className="h-4 w-full shrink-0" />
          </div>

          <div className="p-10 lg:p-14 bg-gradient-to-t from-black/40 to-transparent pointer-events-none sticky bottom-0">
            <div className="max-w-4xl mx-auto w-full pointer-events-auto">
              <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-3 flex items-center transition-all focus-within:border-indigo-500/40 focus-within:bg-white/10">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Describe tu visión estratégica..."
                  className="flex-1 bg-transparent border-none outline-none text-white px-6 py-4 placeholder-white/20 resize-none max-h-40 font-bold text-lg"
                  rows={1}
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isBusy}
                  className="w-14 h-14 flex items-center justify-center bg-white text-black rounded-2xl transition-all hover:bg-indigo-500 hover:text-white active:scale-95 disabled:opacity-10"
                >
                  <Send size={24} />
                </button>
              </div>
              <p className="mt-6 text-center text-[9px] text-white/20 font-black uppercase tracking-[0.4em]">Propulsado por Alma IA — Elite v2.0</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
