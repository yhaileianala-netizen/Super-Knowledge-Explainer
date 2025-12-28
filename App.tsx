
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, History, Plus, Image as ImageIcon, Send, 
  Cpu, BookOpen, Lightbulb, Microscope, GraduationCap,
  ChevronRight, Save, RotateCcw, Download, X, Search, Globe
} from 'lucide-react';
import { 
  LearningMode, Message, SessionContext, ConversationSession, 
  PromptConfig 
} from './types';
import { DEFAULT_MODELS, DEFAULT_PROMPTS, EXPERT_DOMAINS } from './constants';
import { sendMessageToGemini } from './services/gemini';
import ReactMarkdown from 'react-markdown';

const App: React.FC = () => {
  // --- State ---
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string, PromptConfig>>(DEFAULT_PROMPTS);
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(LearningMode.INTUITION);
  
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Derived State ---
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // --- Effects ---
  useEffect(() => {
    // Initial session setup
    if (sessions.length === 0) {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.history]);

  // --- Actions ---
  const createNewSession = () => {
    const newSession: ConversationSession = {
      id: Date.now().toString(),
      title: `新会话 ${new Date().toLocaleTimeString()}`,
      context: {
        instructorName: '',
        researchField: '',
        institution: '',
        courseName: '',
        theoreticalFramework: '',
        thinkingBudget: 8192
      },
      history: [],
      currentMode: LearningMode.INTUITION,
      lastActive: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const updateSessionContext = (updates: Partial<SessionContext>) => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId 
        ? { ...s, context: { ...s.context, ...updates } } 
        : s
    ));
  };

  const setLearningMode = (mode: LearningMode) => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId ? { ...s, currentMode: mode } : s
    ));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Fix: Explicitly cast Array.from(files) to File[] to avoid 'unknown' type errors during iteration
    (Array.from(files) as File[]).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages(prev => [...prev, reader.result as string]);
      };
      // Correctly passing the File object (which is a Blob) to readAsDataURL
      reader.readAsDataURL(file);
    });
  };

  const handleSend = async () => {
    if (!currentSession || (!input.trim() && uploadedImages.length === 0)) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      mode: currentSession.currentMode,
      timestamp: Date.now(),
      type: uploadedImages.length > 0 ? 'image' : 'text',
      imageUrls: uploadedImages.length > 0 ? [...uploadedImages] : undefined
    };

    const updatedHistory = [...currentSession.history, userMessage];
    
    // Optimistic update
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId ? { ...s, history: updatedHistory } : s
    ));
    setInput('');
    setUploadedImages([]);
    setIsSending(true);

    try {
      const promptConfig = prompts[currentSession.currentMode];
      const result = await sendMessageToGemini(
        promptConfig.model,
        promptConfig.prompt,
        userMessage.content,
        currentSession.history,
        currentSession.context,
        currentSession.context.thinkingBudget,
        userMessage.imageUrls
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.text,
        mode: currentSession.currentMode,
        timestamp: Date.now(),
        type: 'text',
        groundingLinks: result.groundingChunks.map((c: any) => ({
          uri: c.web?.uri || c.maps?.uri || '',
          title: c.web?.title || c.maps?.title || 'Grounding Source'
        })).filter((l: any) => l.uri)
      };

      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, history: [...updatedHistory, assistantMessage] } : s
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  // --- Sub-components ---
  const SidebarExpertDomains = () => (
    <div className="hidden lg:flex flex-col w-64 border-r border-slate-200 p-4 bg-white overflow-y-auto">
      <div className="flex items-center gap-2 mb-6 px-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">K</div>
        <span className="font-bold text-slate-800">领域专家团</span>
      </div>
      <div className="space-y-1">
        {EXPERT_DOMAINS.map(domain => (
          <button 
            key={domain.id} 
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <span className="text-lg">{domain.icon}</span>
            <span>{domain.name}</span>
          </button>
        ))}
      </div>
      
      <div className="mt-auto pt-6 border-t border-slate-100">
        <div className="px-3 py-4 bg-blue-50 rounded-2xl">
          <p className="text-xs text-blue-700 font-bold mb-2 uppercase tracking-wider">当前专家状态</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-blue-900">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>🧭 知识解构导师</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-800 opacity-70">
              <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
              <span>📊 战略管理教授</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <SidebarExpertDomains />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg text-slate-800">🎓 知识解构导师</h1>
            <div className="hidden md:flex bg-slate-100 px-3 py-1 rounded-full text-xs font-medium text-slate-500 border border-slate-200">
              v3.0 旗舰版
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPromptPanelOpen(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="提示词配置"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="会话历史"
            >
              <History size={20} />
            </button>
            <button 
              onClick={createNewSession}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              <span>新会话</span>
            </button>
          </div>
        </header>

        {/* Current Session Stats Bar */}
        <div className="bg-white border-b border-slate-100 px-6 py-3 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">📚 课程:</span>
            <input 
              value={currentSession?.context.courseName || ''} 
              onChange={(e) => updateSessionContext({ courseName: e.target.value })}
              placeholder="输入课程名称..."
              className="border-none bg-slate-50 px-2 py-1 rounded focus:ring-1 focus:ring-blue-500 outline-none w-32 md:w-48 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">👨‍🏫 讲师:</span>
            <input 
              value={currentSession?.context.instructorName || ''} 
              onChange={(e) => updateSessionContext({ instructorName: e.target.value })}
              placeholder="讲师姓名..."
              className="border-none bg-slate-50 px-2 py-1 rounded focus:ring-1 focus:ring-blue-500 outline-none w-24 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
             <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
              <Cpu size={14} />
              <span>{prompts[currentSession?.currentMode || LearningMode.INTUITION].model}</span>
             </div>
             {currentSession?.context.thinkingBudget && (
                <span className="text-slate-400 border-l border-slate-200 pl-4">
                  💭 思考预算: {currentSession.context.thinkingBudget}
                </span>
             )}
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white px-6 py-4 flex items-center gap-4 border-b border-slate-100">
           <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide py-1">
              {[
                { mode: LearningMode.INTUITION, label: '直觉层', icon: <Lightbulb size={16}/> },
                { mode: LearningMode.PRINCIPLE, label: '原理层', icon: <Microscope size={16}/> },
                { mode: LearningMode.ACADEMIC, label: '学术层', icon: <GraduationCap size={16}/> }
              ].map((step, idx, arr) => (
                <React.Fragment key={step.mode}>
                   <button 
                    onClick={() => setLearningMode(step.mode)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm transition-all whitespace-nowrap ${
                      currentSession?.currentMode === step.mode 
                      ? 'bg-blue-600 text-white font-bold shadow-md' 
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                   >
                     {step.icon}
                     <span>{step.label}</span>
                   </button>
                   {idx < arr.length - 1 && <ChevronRight size={14} className="text-slate-300" />}
                </React.Fragment>
              ))}
           </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth scrollbar-hide">
          {currentSession?.history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6">
              <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600 mb-2">
                <BookOpen size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">准备好开始解构知识了吗？</h2>
              <p className="text-slate-500 leading-relaxed">
                上传课件截图、粘贴学术文本或直接提出你的问题。我会根据你选择的模式（直觉、原理、学术）为你层层剖析核心本质。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {[
                  { title: '🌱 建立直觉', desc: '生活化类比，带你秒懂复杂概念' },
                  { title: '🔬 深入原理', desc: '因果逻辑推导，掌握底层逻辑' },
                  { title: '📚 学术进阶', desc: '批判性思维，学术范式掌握' },
                  { title: '📝 论文辅助', desc: '从思路梳理到学术化润色' }
                ].map((card, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 text-left hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer">
                    <h4 className="font-bold text-slate-700 mb-1">{card.title}</h4>
                    <p className="text-xs text-slate-400">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            currentSession?.history.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-3xl p-5 ${
                  msg.role === 'user' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-white border border-slate-100 shadow-sm'
                }`}>
                  {msg.imageUrls && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {msg.imageUrls.map((url, i) => (
                        <img key={i} src={url} alt="Uploaded" className="max-w-[200px] rounded-xl border border-white/20" />
                      ))}
                    </div>
                  )}
                  <div className={`markdown-content ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1 uppercase">
                        <Globe size={12} /> 知识增强来源
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingLinks.map((link, i) => (
                          <a 
                            key={i} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs bg-slate-50 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-1.5 transition-colors"
                          >
                            <Search size={10} />
                            {link.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={`mt-2 text-[10px] ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString()} · {msg.mode ? prompts[msg.mode]?.name : '对话'}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-slate-200 relative">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
              {[
                { id: LearningMode.INTUITION, label: '🌱 直觉', color: 'green' },
                { id: LearningMode.PRINCIPLE, label: '🔬 原理', color: 'blue' },
                { id: LearningMode.ACADEMIC, label: '📚 学术', color: 'indigo' },
                { id: LearningMode.PAPER, label: '📝 论文', color: 'purple' },
                { id: LearningMode.LITERATURE, label: '📖 文献', color: 'orange' },
                { id: LearningMode.IMAGE_EXTRACTION, label: '📷 识别', color: 'rose' }
              ].map(mode => (
                <button 
                  key={mode.id}
                  onClick={() => setLearningMode(mode.id as LearningMode)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                    currentSession?.currentMode === mode.id 
                    ? `bg-${mode.color}-100 text-${mode.color}-700 border-${mode.color}-200` 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                {uploadedImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img} className="w-16 h-16 object-cover rounded-xl" alt="Preview" />
                    <button 
                      onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 hover:text-slate-400 hover:border-slate-300 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
            )}

            <div className="relative flex items-end gap-3 bg-slate-100 rounded-[28px] p-3 border border-transparent focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-xl transition-all">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-blue-600 transition-colors bg-white rounded-2xl shadow-sm"
              >
                <ImageIcon size={22} />
              </button>
              <textarea 
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`在「${prompts[currentSession?.currentMode || LearningMode.INTUITION].name}」模式下提问...`}
                className="flex-1 bg-transparent border-none outline-none py-3 px-1 text-slate-800 placeholder-slate-400 resize-none min-h-[48px] max-h-48 scrollbar-hide"
              />
              <button 
                onClick={handleSend}
                disabled={isSending || (!input.trim() && uploadedImages.length === 0)}
                className={`p-3 rounded-2xl transition-all shadow-md ${
                  isSending || (!input.trim() && uploadedImages.length === 0)
                  ? 'bg-slate-300 text-slate-50 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
                }`}
              >
                {isSending ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Send size={22} />
                )}
              </button>
            </div>
            
            <div className="flex justify-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                深度解构专家模式 · 由 Gemini 3 系列驱动
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Overlays: Prompt Config Panel */}
      {isPromptPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <Settings size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">提示词配置中心</h2>
                  <p className="text-xs text-slate-400">基于“提示词工程专家团”方法论的场景化配置</p>
                </div>
              </div>
              <button onClick={() => setIsPromptPanelOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* Scene List */}
              <div className="w-64 border-r border-slate-100 overflow-y-auto p-4 space-y-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-4">核心应用场景</h3>
                {/* Fix: Explicitly cast to PromptConfig[] to ensure 'p' is not 'unknown' */}
                {(Object.values(prompts) as PromptConfig[]).map((p: PromptConfig) => (
                  <button 
                    key={p.id}
                    onClick={() => setSelectedPromptId(p.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl text-sm transition-all flex items-center justify-between ${
                      selectedPromptId === p.id 
                      ? 'bg-blue-50 text-blue-700 font-bold' 
                      : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{p.name}</span>
                    {selectedPromptId === p.id && <ChevronRight size={14} />}
                  </button>
                ))}
              </div>
              
              {/* Editor */}
              <div className="flex-1 flex flex-col p-8 overflow-hidden bg-slate-50/50">
                <div className="mb-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-800">{prompts[selectedPromptId].name}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>版本: {prompts[selectedPromptId].version}</span>
                      <span>·</span>
                      <span>更新: {prompts[selectedPromptId].lastModified}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">使用模型</span>
                      <select 
                        value={prompts[selectedPromptId].model}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPrompts(prev => ({
                            ...prev,
                            [selectedPromptId]: { ...prev[selectedPromptId], model: val }
                          }));
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                      >
                        {DEFAULT_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                
                <textarea 
                  value={prompts[selectedPromptId].prompt}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPrompts(prev => ({
                      ...prev,
                      [selectedPromptId]: { ...prev[selectedPromptId], prompt: val, lastModified: new Date().toLocaleDateString() }
                    }));
                  }}
                  className="flex-1 w-full bg-white border border-slate-200 rounded-3xl p-6 font-mono text-sm leading-relaxed text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner"
                />
                
                <div className="mt-6 flex items-center justify-between">
                  <button 
                    onClick={() => {
                      setPrompts(prev => ({ ...prev, [selectedPromptId]: DEFAULT_PROMPTS[selectedPromptId] }));
                    }}
                    className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors text-sm font-medium"
                  >
                    <RotateCcw size={16} />
                    <span>恢复默认</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-6 py-2 rounded-xl text-slate-500 hover:bg-slate-200 transition-colors text-sm font-bold">
                      <Download size={18} />
                      <span>导出 JSON</span>
                    </button>
                    <button 
                      onClick={() => setIsPromptPanelOpen(false)}
                      className="flex items-center gap-2 px-8 py-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-bold"
                    >
                      <Save size={18} />
                      <span>保存修改</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlays: History Sidebar */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" 
            onClick={() => setIsHistoryOpen(false)}
          ></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">会话历史</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sessions.map(s => (
                <button 
                  key={s.id}
                  onClick={() => {
                    setCurrentSessionId(s.id);
                    setIsHistoryOpen(false);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    currentSessionId === s.id 
                    ? 'bg-blue-50 border-blue-100 shadow-sm' 
                    : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      currentSessionId === s.id ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {s.history.length} 轮对话
                    </span>
                    <span className="text-[10px] text-slate-400">{new Date(s.lastActive).toLocaleDateString()}</span>
                  </div>
                  <h4 className={`font-bold text-sm mb-1 ${currentSessionId === s.id ? 'text-blue-800' : 'text-slate-700'}`}>
                    {s.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate">
                    {s.history[s.history.length - 1]?.content || '无消息记录'}
                  </p>
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-slate-100">
               <button 
                onClick={() => {
                  setSessions([]);
                  createNewSession();
                  setIsHistoryOpen(false);
                }}
                className="w-full py-3 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-50 rounded-xl transition-colors"
              >
                 清空所有历史
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
