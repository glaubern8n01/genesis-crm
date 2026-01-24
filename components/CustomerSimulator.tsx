
import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Play, ArrowLeft, MoreVertical, Video, Phone, CheckCheck } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { whatsappApi } from '../services/whatsappApi';
import { FunnelStage, ChatStatus } from '../types';
import { ASSETS, NEXT_STAGE_MAP, RAFAEL_IDENTITY } from '../constants';

const gemini = new GeminiService();

const CustomerSimulator: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([
    { sender: 'bot', type: 'audio', content: 'boas_vindas.mp3', timestamp: new Date() } // Placeholder content name, logic handles URL
  ]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<FunnelStage>(FunnelStage.STAGE_0_WELCOME);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamic Assets State
  const [currentAssets, setCurrentAssets] = useState(ASSETS);

  useEffect(() => {
    // Load assets from Supabase on mount
    import('../constants').then(({ loadAssets }) => {
      loadAssets().then(loaded => setCurrentAssets(loaded));
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || stage === FunnelStage.HANDOFF) return;

    const userMsg = { sender: 'customer', type: 'text', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // 1. IA classifica a intenção sem responder texto
    const analysis = await gemini.classifyIntent(userMsg.content, stage);

    setTimeout(async () => {
      setIsTyping(false);

      // 2. Lógica de decisão baseada na classificação
      if (analysis.intent === 'handoff' || analysis.intent === 'payment_difficulty') {
        setStage(FunnelStage.HANDOFF);

        // Disparo de áudio via API simulada
        await whatsappApi.sendAudio('customer-phone', currentAssets.audios[FunnelStage.HANDOFF]);
        await whatsappApi.markConversationAsHuman('chat-id-123');

        setMessages(prev => [...prev, {
          sender: 'bot',
          type: 'audio',
          content: 'transicaoassistente.mp3',
          timestamp: new Date()
        }]);
      } else {
        const nextStage = NEXT_STAGE_MAP[stage];
        setStage(nextStage);

        // Envio do áudio correspondente ao próximo estágio do funil
        const audioUrl = currentAssets.audios[nextStage];
        if (audioUrl) {
          await whatsappApi.sendAudio('customer-phone', audioUrl);
        }

        setMessages(prev => [...prev, {
          sender: 'bot',
          type: 'audio',
          content: `${nextStage}.mp3`,
          timestamp: new Date()
        }]);

        // Regra de Vídeo Prova Social (Estado 3)
        if (nextStage === FunnelStage.STAGE_3_EXPLANATION) {
          await whatsappApi.sendVideo('customer-phone', currentAssets.videos[0]);
          setMessages(prev => [...prev, {
            sender: 'bot',
            type: 'video',
            content: 'provasocial1.mp4',
            timestamp: new Date()
          }]);
        }
      }
    }, 1800);
  };

  return (
    <div className="flex flex-col h-full bg-[#efe7de] border-l border-slate-200">
      <div className="bg-[#075e54] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowLeft className="w-5 h-5" />
          <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
            <img src="https://picsum.photos/seed/rafael/200" alt="Rafael" className="w-full h-full object-cover" />
          </div>
          <div>
            <h4 className="font-bold text-sm">{RAFAEL_IDENTITY.name}</h4>
            <span className="text-[10px] opacity-80">online</span>
          </div>
        </div>
        <div className="flex gap-4">
          <Video className="w-5 h-5" />
          <Phone className="w-5 h-5" />
          <MoreVertical className="w-5 h-5" />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-2 rounded-lg shadow-sm relative ${m.sender === 'customer' ? 'bg-[#dcf8c6]' : 'bg-white'}`}>
              {m.type === 'audio' ? (
                <div className="flex items-center gap-2 pr-8 min-w-[180px]">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Play className="w-4 h-4" fill="currentColor" />
                  </div>
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-emerald-500"></div>
                  </div>
                </div>
              ) : m.type === 'video' ? (
                <div className="bg-black/5 rounded-md p-1">
                  <div className="aspect-video bg-slate-800 rounded flex items-center justify-center">
                    <Play className="w-10 h-10 text-white opacity-50" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Prova Social #1</p>
                </div>
              ) : (
                <p className="text-sm text-slate-800 pr-8">{m.content}</p>
              )}
              <div className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[9px] text-slate-400">
                12:00 <CheckCheck className="w-3 h-3 text-sky-500" />
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-2 rounded-full text-xs text-slate-400 animate-pulse italic flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
              Rafael está gravando áudio...
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#f0f0f0] p-3 flex items-center gap-2">
        <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center shadow-sm">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Mensagem"
            className="flex-1 bg-transparent border-none outline-none text-sm"
          />
        </div>
        <button
          onClick={handleSend}
          className="w-12 h-12 bg-[#075e54] text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform"
        >
          {input ? <Send className="w-5 h-5 ml-1" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>

      <div className="bg-white p-2 border-t border-slate-200">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage === FunnelStage.HANDOFF ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></div>
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
            Status Funil: {stage.replace('STAGE_', '').replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CustomerSimulator;
