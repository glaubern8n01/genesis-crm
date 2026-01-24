
import { supabase } from './supabaseClient';
import { FunnelStage } from '../types';

const BUCKET_NAME = 'audios_para_transcrever';

export const listBucketFiles = async () => {
    const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .list('', { limit: 100, offset: 0 });

    if (error) {
        console.error('[Supabase Storage] Error listing files:', error);
        return [];
    }

    console.log(`[Supabase Storage] Files found in ${BUCKET_NAME}: ${data?.length || 0}`);
    return data || [];
};

export const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
};

export const getAssetMapFromSupabase = async () => {
    const files = await listBucketFiles();
    const fileMap: any = {};

    // Mapeamento manual de arquivos para chaves do funil
    // Baseado na lista fornecida: 
    // boas_vindas.mp3, comprometimento.mp3, entendendo_problema_do_cliente.mp3, 
    // explicando_e_fala_da_provasocial.mp3, pagamento_na_entrega.mp3, 
    // transicaoassistente.mp3 e provasocial1/2/3.mp4

    const findFile = (partialName: string) => files.find(f => f.name.includes(partialName))?.name;

    const audioMap: Record<string, string> = {
        [FunnelStage.STAGE_0_WELCOME]: findFile('boas_vindas') || '',
        [FunnelStage.STAGE_1_COMMITMENT]: findFile('comprometimento') || '',
        [FunnelStage.STAGE_2_PROBLEM]: findFile('entendendo_problema') || '',
        [FunnelStage.STAGE_3_EXPLANATION]: findFile('explicando_e_fala') || '',
        [FunnelStage.STAGE_4_TREATMENT]: findFile('pagamento_na_entrega') || '',
        [FunnelStage.HANDOFF]: findFile('transicaoassistente') || ''
    };

    // Generate Public URLs for audios
    const processedAudios: any = {};
    Object.keys(audioMap).forEach(key => {
        if (audioMap[key]) {
            processedAudios[key] = getPublicUrl(audioMap[key]);
        }
    });

    // Videos
    const videos = [
        findFile('provasocial1'),
        findFile('provasocial2'),
        findFile('provasocial3')
    ].filter(Boolean).map(v => getPublicUrl(v as string));

    return {
        audios: processedAudios,
        videos: videos
    };
};
