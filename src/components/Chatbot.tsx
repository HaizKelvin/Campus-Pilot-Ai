import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Loader2, Mic, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { chatWithAI } from '../lib/gemini';
import { ChatMessage } from '../types';

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    setIsRecording(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
  };

  const handleSend = async (customInput?: string) => {
    const textToSend = customInput || input;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customInput) setInput('');
    setIsTyping(true);

    const response = await chatWithAI(messages.concat(userMsg).map(m => ({ role: m.role, content: m.content })));
    
    const botMsg: ChatMessage = {
      role: 'model',
      content: response || "System error. Contact administrator.",
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
    speak(botMsg.content);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl text-white hover:scale-110 transition-transform active:scale-95 z-[110] border border-white/20"
      >
        <MessageSquare size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Background overlay for mobile */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[115] md:hidden"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-0 md:bottom-24 right-0 left-0 md:left-auto md:right-6 md:w-[450px] h-[70vh] md:h-[600px] glass z-[120] flex flex-col shadow-2xl overflow-hidden rounded-t-[2.5rem] md:rounded-[2.5rem]"
            >

              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-purple-600/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <Bot className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">Terminal Assistant</h3>
                    <p className="text-[10px] text-blue-400 font-mono flex items-center gap-2">
                       <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
                       REALTIME_CORE_INTEL
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => speak(messages[messages.length-1]?.content || "")}
                    className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
                    title="Read last message"
                  >
                    <Volume2 size={18} />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
              >
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-50">
                    <Bot size={64} className="text-slate-800" />
                    <div>
                      <p className="text-sm font-bold uppercase tracking-widest text-slate-300 mb-2">Unit Initialized</p>
                      <p className="text-xs text-slate-500 leading-relaxed">How can I assist your academic trajectory today?</p>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "flex flex-col gap-1.5 max-w-[90%]",
                      msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className={cn(
                      "p-4 rounded-2xl text-xs md:text-sm leading-relaxed shadow-xl",
                      msg.role === 'user' 
                        ? "bg-blue-600 text-white rounded-br-none" 
                        : "bg-white/5 text-slate-200 border border-white/10 rounded-bl-none backdrop-blur-xl"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">
                      {msg.role === 'user' ? 'OPERATOR' : 'UNIT_CORE'} | {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-3 text-blue-400 animate-pulse">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-[10px] font-mono tracking-widest uppercase">Synthesizing Response...</span>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/10 glass-dark">
                <div className="flex gap-3 items-center">
                  <div className="flex-1 relative group">
                    <input 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Input query stream..."
                      className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-4 pr-12 py-3.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600 transition-all"
                    />
                    <button 
                      onClick={startSpeechRecognition}
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all",
                        isRecording ? "bg-red-500 text-white animate-pulse" : "text-slate-500 hover:text-blue-400"
                      )}
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isTyping}
                    className="p-3.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 disabled:translate-y-0 active:translate-y-0.5"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

