
import React, { useState, useEffect } from 'react';
import { Layout, Users, MessageSquare, PieChart, LogOut, Settings, Bell, Search, Filter } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');

  const handleLogin = (email: string) => {
    if (email === 'glaubermcorreia@gmail.com') {
      setIsAuthenticated(true);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 bg-slate-900 text-white flex flex-col items-center lg:items-stretch py-6 px-4">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Layout className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold hidden lg:block tracking-tight">Gênesis CRM</span>
        </div>

        <nav className="flex-1 space-y-2 w-full">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-3 px-3 py-3 w-full rounded-xl transition-all ${activeTab === 'stats' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <PieChart className="w-5 h-5" />
            <span className="hidden lg:block font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex items-center gap-3 px-3 py-3 w-full rounded-xl transition-all ${activeTab === 'chats' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="hidden lg:block font-medium">Atendimentos</span>
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex items-center gap-3 px-3 py-3 w-full rounded-xl transition-all ${activeTab === 'contacts' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Users className="w-5 h-5" />
            <span className="hidden lg:block font-medium">Contatos</span>
          </button>
        </nav>

        <div className="pt-6 border-t border-white/10 w-full space-y-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-3 px-3 py-3 w-full rounded-xl transition-all ${activeTab === 'config' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="hidden lg:block font-medium">Configurações</span>
          </button>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center gap-3 px-3 py-3 w-full text-rose-400 hover:text-rose-300 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden lg:block font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 text-slate-400">
            <h2 className="text-slate-900 font-semibold capitalize">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar contatos..."
                className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500 transition-all w-64"
              />
            </div>
            <button className="p-2 text-slate-400 hover:text-emerald-500 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
              GC
            </div>
          </div>
        </header>

        {/* Dashboard Area */}
        <div className="flex-1 overflow-hidden">
          <Dashboard activeTab={activeTab} />
        </div>
      </main>
    </div>
  );
};

export default App;
