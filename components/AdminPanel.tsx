
import React, { useEffect, useState } from 'react';
import { Save, Upload, Play, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';
import { funnelConfigService, FunnelConfig } from '../services/funnelConfig';
import { listBucketFiles, getPublicUrl } from '../services/supabaseStorage';
import { FunnelStage } from '../types';

const AdminPanel: React.FC = () => {
    const [config, setConfig] = useState<FunnelConfig | null>(null);
    const [availableFiles, setAvailableFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [loadedConfig, files] = await Promise.all([
            funnelConfigService.loadConfig(),
            listBucketFiles()
        ]);
        setConfig(loadedConfig);
        setAvailableFiles(files.map(f => f.name));
        setLoading(false);
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        await funnelConfigService.saveConfig(config);
        setSaving(false);
        alert('Configuração do Funil salva com sucesso!');
    };

    const updateAudioMapping = (stage: FunnelStage, filename: string) => {
        if (!config) return;
        // Construct public URL if choosing a file (assuming file is in bucket)
        // Or if it's already a full URL, keep it.
        // For simplicity, we store the full Public URL in the config.
        const url = filename.startsWith('http') ? filename : getPublicUrl(filename);

        setConfig({
            ...config,
            assets: {
                ...config.assets,
                audios: {
                    ...config.assets.audios,
                    [stage]: url
                }
            }
        });
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando painel administrativo...</div>;
    if (!config) return <div className="p-8 text-center text-rose-500">Erro ao carregar configuração.</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Configuração do Funil</h1>
                    <p className="text-slate-500 text-sm">Gerencie os áudios e vídeos de cada etapa do funil</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                    {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar Alterações
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Audio Mapping Section */}
                <div className="space-y-6">
                    <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        Mapeamento de Áudios
                    </h2>

                    {Object.values(FunnelStage).filter(s => s !== FunnelStage.HANDOFF).map((stage) => (
                        <div key={stage} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                Etapa: {stage.replace('STAGE_', '').replace('_', ' ')}
                            </label>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                        <Play className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500 truncate font-mono">
                                            {config.assets.audios[stage]?.split('/').pop() || 'Nenhum áudio selecionado'}
                                        </p>
                                    </div>
                                </div>

                                <select
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-emerald-500 transition-all"
                                    value={config.assets.audios[stage] || ''}
                                    onChange={(e) => updateAudioMapping(stage, e.target.value)}
                                >
                                    <option value="">Selecione um arquivo do bucket...</option>
                                    {availableFiles.filter(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav')).map(f => (
                                        <option key={f} value={getPublicUrl(f)}>{f}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Handoff & Video Section */}
                <div className="space-y-8">
                    {/* Handoff Config */}
                    <div>
                        <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2 mb-6">
                            <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                            Configuração de Handoff
                        </h2>
                        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
                            <div className="flex items-start gap-4">
                                <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0 mt-1" />
                                <div>
                                    <label className="text-xs font-black text-rose-400 uppercase tracking-widest mb-2 block">
                                        Áudio de Transição (Handoff)
                                    </label>
                                    <p className="text-xs text-rose-700 mb-4 leading-relaxed">
                                        Este áudio será enviado assim que a IA detectar "payment_difficulty" ou "handoff". A automação será pausada imediatamente.
                                    </p>
                                    <select
                                        className="w-full p-2 bg-white border border-rose-200 rounded-lg text-sm text-slate-700 outline-none focus:border-rose-500 transition-all"
                                        value={config.assets.audios[FunnelStage.HANDOFF] || ''}
                                        onChange={(e) => updateAudioMapping(FunnelStage.HANDOFF, e.target.value)}
                                    >
                                        <option value="">Selecione um arquivo...</option>
                                        {availableFiles.filter(f => f.endsWith('.mp3')).map(f => (
                                            <option key={f} value={getPublicUrl(f)}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Video Config */}
                    <div>
                        <h2 className="font-bold text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2 mb-6">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            Vídeos de Prova Social
                        </h2>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <p className="text-xs text-slate-400 mb-4">
                                Vídeos enviados durante a etapa de EXPLICAÇÃO.
                            </p>
                            {config.assets.videos.map((url, idx) => (
                                <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded-lg">
                                    <span className="text-xs font-bold text-slate-500 w-6">#{idx + 1}</span>
                                    <input
                                        type="text"
                                        value={url}
                                        readOnly
                                        className="flex-1 bg-transparent text-xs text-slate-600 outline-none truncate"
                                    />
                                    <button
                                        onClick={() => {
                                            const newVideos = config.assets.videos.filter((_, i) => i !== idx);
                                            setConfig({ ...config, assets: { ...config.assets, videos: newVideos } });
                                        }}
                                        className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-500 rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-400 mb-2">Adicionar Vídeo do Bucket</label>
                                <select
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setConfig({
                                                ...config,
                                                assets: {
                                                    ...config.assets,
                                                    videos: [...config.assets.videos, e.target.value]
                                                }
                                            });
                                        }
                                    }}
                                    value=""
                                >
                                    <option value="">+ Selecionar vídeo...</option>
                                    {availableFiles.filter(f => f.endsWith('.mp4')).map(f => (
                                        <option key={f} value={getPublicUrl(f)}>{f}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
