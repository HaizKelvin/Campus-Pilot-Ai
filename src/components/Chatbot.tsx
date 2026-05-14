import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { chatWithAI } from '../lib/gemini';
import { ChatMessage } from '../types';

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const response = await chatWithAI(messages.concat(userMsg).map(m => ({ role: m.role, content: m.content })));
    
    const botMsg: ChatMessage = {
      role: 'model',
      content: response || "System error. Contact administrator.",
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl text-white hover:scale-110 transition-transform active:scale-95 z-50 border border-white/20"
      >
        <MessageSquare size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-96 h-[500px] glass z-50 flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-purple-600/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <Bot className="text-blue-400" size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200">Terminal Assistant</h3>
                  <p className="text-[10px] text-blue-400 font-mono">ENCRYPTED STREAM</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-50">
                   <Bot size={48} className="text-slate-700" />
                   <p className="text-xs text-slate-500">Initialization complete. How can I assist your academic trajectory today?</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div 
                  key={i}
                  className={cn(
                    "flex flex-col gap-1 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl text-xs leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-blue-600 text-white rounded-br-none shadow-lg" 
                      : "bg-white/5 text-slate-200 border border-white/10 rounded-bl-none"
                  )}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {msg.role === 'user' ? 'USER' : 'SYSTEM'} | {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {isTyping && (
                 <div className="flex items-center gap-2 text-blue-400 animate-pulse">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-[10px] font-mono">CALCULATING RESPONSE...</span>
                 </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Inquire system..."
                  className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="p-2 bg-blue-600 rounded-xl text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
