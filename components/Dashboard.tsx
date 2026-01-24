
import React, { useState } from 'react';
import { Users, MessageSquare, PieChart, Info, Settings, Search, Bot, User, ShieldAlert, MonitorPlay } from 'lucide-react';
import ChatArea from './ChatArea';
import StatsView from './StatsView';
import AdminPanel from './AdminPanel';
import { webhookHandler } from '../services/webhookHandler';
import { Contact, FunnelStage, ChatStatus } from '../types';

interface DashboardProps {
  activeTab: string;
}

const Dashboard: React.FC<DashboardProps> = ({ activeTab }) => {
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: '1',
      name: 'Maria de Lourdes',
      phone: '5511988887777',
      funnelStage: FunnelStage.HANDOFF,
      status: ChatStatus.HUMAN,
      lastMessageAt: new Date(),
      messages: [
        { id: '1', sender: 'customer', type: 'text' as any, content: 'Oi Rafael, eu tentei pagar no pix mas deu erro no código.', timestamp: new Date() }
      ],
      notes: 'Dificuldade com Pix Gerencianet'
    },
    {
      id: '2',
      name: 'João Francisco',
      phone: '5521977776666',
      funnelStage: FunnelStage.STAGE_1_COMMITMENT,
      status: ChatStatus.BOT,
      lastMessageAt: new Date(Date.now() - 3600000),
      messages: []
    }
  ]);

  const [selectedId, setSelectedId] = useState<string | null>(contacts[0].id);

  // Real implementation: This selectedContact is bound to the view
  const selectedContact = contacts.find(c => c.id === selectedId);

  const updateContact = (contact: Contact) => {
    setContacts(prev => prev.map(c => c.id === contact.id ? contact : c));
  };

  /**
   * Simulates receiving a real webhook from WhatsApp.
   * This is the "Integration Point" validating the logic works.
   */
  const handleSimulateIncoming = async () => {
    const targetId = selectedId || contacts[0].id;
    const targetContact = contacts.find(c => c.id === targetId);
    if (!targetContact) return;

    const userText = prompt("Simular mensagem do cliente (Webhook):", "Quero saber mais");
    if (!userText) return;

    // Update UI immediately to show User message
    const updatedWithUserMsg = {
      ...targetContact,
      messages: [...targetContact.messages, {
        id: Date.now().toString(),
        sender: 'customer' as const,
        type: 'text' as any,
        content: userText,
        timestamp: new Date()
      }]
    };
    updateContact(updatedWithUserMsg);

    // Call the REAL webhook handler logic
    await webhookHandler.handleIncomingMessage(
      { from: targetContact.phone, text: userText, type: 'text' },
      updatedWithUserMsg, // Pass the NEW state
      updateContact // Pass the state updater
    );
  };

  // --- RENDER VIEWS ---

  if (activeTab === 'config') return <AdminPanel />;
  if (activeTab === 'stats') return <StatsView contacts={contacts} />;

  // Default: Chats View (Atendimentos)
  if (activeTab === 'chats' || activeTab === 'contacts') { // Merging for simplicity in this artifact
    return (
      <div className="flex h-full relative overflow-hidden bg-white">
        {/* Contact Sidebar */}
        <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-slate-800 tracking-tight">Atendimentos</h2>
              <div className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                {contacts.filter(c => c.status === ChatStatus.HUMAN).length} HANDOFFS
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Buscar conversa..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-emerald-500 transition-all" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contacts.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full p-4 border-b border-slate-50 flex gap-3 text-left transition-all hover:bg-slate-50 ${selectedId === c.id ? 'bg-emerald-50/50 border-r-4 border-emerald-500' : ''}`}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-500 font-bold">
                    {c.name[0]}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-white flex items-center justify-center ${c.status === ChatStatus.HUMAN ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                    {c.status === ChatStatus.HUMAN ? <User className="w-3 h-3 text-white" /> : <Bot className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className="text-sm font-bold text-slate-800 truncate">{c.name}</h4>
                    <span className="text-[10px] text-slate-400">12:30</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{c.messages[c.messages.length - 1]?.content || "Iniciando funil..."}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
          {selectedContact ? (
            <ChatArea
              contact={selectedContact}
              onUpdate={updateContact}
              onSimulateIncoming={handleSimulateIncoming}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-bold">Selecione uma conversa</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <div>Select a tab</div>;
};

export default Dashboard;
