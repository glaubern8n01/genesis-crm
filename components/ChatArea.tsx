import React, { useState, useRef, useEffect } from 'react';
import { Phone, Video, MoreVertical, Send, Mic, Paperclip, Smile, Bot, User, CheckCircle2, AlertCircle, MessageSquare, MonitorPlay } from 'lucide-react';
import { Contact, Message, ChatStatus, MessageType, FunnelStage } from '../types';
import { RAFAEL_IDENTITY } from '../constants';

interface ChatAreaProps {
  contact: Contact;
  onUpdate: (contact: Contact) => void;
  onSimulateIncoming?: () => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ contact, onUpdate, onSimulateIncoming }) => {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const showSimulator = import.meta.env.DEV || import.meta.env.VITE_ENABLE_SIMULATOR === 'true';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [contact.messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'agent',
      type: MessageType.TEXT,
      content: inputValue,
      timestamp: new Date()
    };

    onUpdate({
      ...contact,
      messages: [...contact.messages, newMessage],
      lastMessageAt: new Date()
    });
    setInputValue('');
  };

  const toggleStatus = () => {
    const newStatus = contact.status === ChatStatus.BOT ? ChatStatus.HUMAN : ChatStatus.BOT;
    onUpdate({ ...contact, status: newStatus });
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] relative border-l border-slate-100">
      {/* Chat Header */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm leading-tight">{contact.name}</h3>
            <span className="text-[11px] font-medium text-slate-400">{contact.phone}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showSimulator && onSimulateIncoming && (
            <button
              onClick={onSimulateIncoming}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-colors mr-2"
              title="Simular Webhook"
            >
              <MonitorPlay className="w-3 h-3" />
              Simular
            </button>
          )}

          <div
            onClick={toggleStatus}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm whitespace-nowrap ${contact.status === ChatStatus.HUMAN ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}
          >
            {contact.status === ChatStatus.HUMAN ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
            {contact.status === ChatStatus.HUMAN ? 'Humano' : 'Bot (Rafael)'}
          </div>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><Phone className="w-5 h-5" /></button>
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-fixed opacity-95"
      >
        <div className="flex justify-center mb-8">
          <span className="bg-white px-4 py-1.5 rounded-full text-[10px] text-slate-400 shadow-sm border border-slate-100 uppercase tracking-widest font-black">
            Hoje
          </span>
        </div>

        {contact.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}
          >
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm relative ${msg.sender === 'customer' ? 'bg-white text-slate-800 rounded-tl-none' : 'bg-emerald-600 text-white rounded-tr-none'}`}>
              {msg.type === MessageType.AUDIO ? (
                <div className="flex items-center gap-3 min-w-[200px] py-1">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-emerald-600">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="flex-1 h-1 bg-current/20 rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-current rounded-full"></div>
                  </div>
                  <span className="text-[10px] opacity-70">0:12</span>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{msg.content}</p>
              )}
              <div className={`flex items-center justify-end gap-1 mt-1 opacity-50 text-[9px]`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.sender !== 'customer' && <CheckCircle2 className="w-3 h-3" />}
              </div>
            </div>
          </div>
        ))}

        {contact.funnelStage === FunnelStage.HANDOFF && contact.status === ChatStatus.BOT && (
          <div className="flex justify-center my-6">
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-6 py-3 rounded-2xl text-xs font-bold flex items-center gap-3 animate-pulse shadow-sm">
              <AlertCircle className="w-5 h-5" />
              SOLICITAÇÃO DE HANDOFF: O cliente deseja falar com um humano.
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white p-4 border-t border-slate-100 flex items-center gap-3 shrink-0">
        <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><Smile className="w-6 h-6" /></button>
        <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><Paperclip className="w-6 h-6" /></button>
        <div className="flex-1 bg-slate-50 rounded-2xl flex items-center px-5 py-3 border border-slate-100 focus-within:border-emerald-500/50 focus-within:bg-white transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Digite sua resposta..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800"
          />
        </div>
        <button
          onClick={handleSendMessage}
          className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
        >
          {inputValue.trim() ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Context Toggle (Simulated) */}
      <div className="absolute right-0 top-16 bottom-0 w-80 bg-white border-l border-slate-100 hidden xl:flex flex-col p-6 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
        <div className="mb-8">
          <h4 className="font-black text-slate-900 mb-6 flex items-center gap-2 text-xs uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            Contexto do Funil
          </h4>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fase Atual</label>
              <div className="text-sm font-bold text-emerald-600 uppercase">
                {contact.funnelStage.replace('_', ' ')}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Consultor Ativo</label>
              <p className="text-sm font-bold text-slate-800 leading-tight">{RAFAEL_IDENTITY.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{RAFAEL_IDENTITY.role}</p>
            </div>
            <div className={`p-4 rounded-2xl border ${contact.status === ChatStatus.BOT ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
              <label className="text-[10px] font-black opacity-60 uppercase tracking-widest block mb-1">Resumo da IA</label>
              <p className="text-xs font-medium leading-relaxed italic">
                {contact.status === ChatStatus.BOT ?
                  "Agente autônomo monitorando intenções e disparando áudios do funil." :
                  "IA pausada. O cliente demonstrou necessidade de ajuda humana específica."}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-auto pt-6 border-t border-slate-100">
          <button
            onClick={toggleStatus}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${contact.status === ChatStatus.BOT ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'}`}
          >
            {contact.status === ChatStatus.BOT ? 'Assumir Chat' : 'Devolver ao Bot'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
