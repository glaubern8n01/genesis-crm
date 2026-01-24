
import React, { useState } from 'react';
import { Layout, Mail, Lock, ChevronRight } from 'lucide-react';

interface LoginProps {
  onLogin: (email: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('glaubermcorreia@gmail.com');
  const [password, setPassword] = useState('glauber1@');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'glaubermcorreia@gmail.com' && password === 'glauber1@') {
      onLogin(email);
    } else {
      setError('Credenciais inválidas para o painel Gênesis.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-3xl shadow-2xl shadow-emerald-500/20 mb-6 border-4 border-white/10">
            <Layout className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">Gênesis CRM</h1>
          <p className="text-emerald-400 font-medium mt-2">White Label WhatsApp Business</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[40px] shadow-2xl space-y-6">
          {error && <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold text-center border border-rose-100">{error}</div>}
          
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Usuário</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Senha</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-medium"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            Acessar Painel
            <ChevronRight className="w-5 h-5" />
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-12 font-medium">
          Laboratório Gênesis © 2025 • Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};

export default Login;
