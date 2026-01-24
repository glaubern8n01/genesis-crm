
import React from 'react';
import { Contact, ChatStatus } from '../types';
import { User, MessageSquare, Bot, AlertTriangle } from 'lucide-react';

interface ContactListProps {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ContactList: React.FC<ContactListProps> = ({ contacts, selectedId, onSelect }) => {
  return (
    <div className="w-80 h-full bg-white flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Atendimentos</h3>
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors">Abertos</button>
          <button className="flex-1 px-3 py-1.5 bg-white text-slate-400 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors border border-slate-200">Resolvidos</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => onSelect(contact.id)}
            className={`w-full p-4 flex gap-3 items-start border-b border-slate-50 transition-all hover:bg-slate-50 text-left relative ${selectedId === contact.id ? 'bg-emerald-50/50 border-r-4 border-r-emerald-500' : ''}`}
          >
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
                <User className="w-7 h-7" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${contact.status === ChatStatus.HUMAN ? 'bg-amber-500' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'}`}>
                {contact.status === ChatStatus.HUMAN ? <User className="w-3 h-3 text-white" /> : <Bot className="w-3 h-3 text-white" />}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <h4 className="text-sm font-bold text-slate-900 truncate">{contact.name}</h4>
                <span className="text-[10px] text-slate-400 font-medium">12:30</span>
              </div>
              <p className="text-xs text-slate-500 truncate mb-2">
                {contact.messages.length > 0 
                  ? contact.messages[contact.messages.length - 1].content 
                  : 'Nenhuma mensagem recente'}
              </p>
              
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold uppercase tracking-tight">
                  {contact.funnelStage.replace('_', ' ')}
                </span>
                {contact.notes && (
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                )}
              </div>
            </div>

            {contact.status === ChatStatus.HUMAN && (
              <div className="absolute top-4 right-4 w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ContactList;
