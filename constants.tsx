
import { FunnelStage } from './types';

export const RAFAEL_IDENTITY = {
  name: 'Rafael Gusmão',
  role: 'Consultor Nutracêutico',
  company: 'Laboratório Gênesis',
  tone: 'humano, calmo, empático, profissional, nunca robótico'
};

export const PRODUCT_CONTEXT = `
Produto: Nutraceutico natural para gastrite, azia, refluxo, estufamento e gordura no fígado.
Laboratório: Gênesis (30 anos).
Rafael: Consultor que guia o cliente.
Regras: Nunca admitir ser bot. Nunca texto longo. Foco total nos áudios.
`;


import { getAssetMapFromSupabase } from './services/supabaseStorage';

export const ASSETS = {
  audios: {
    [FunnelStage.STAGE_0_WELCOME]: 'https://storage.googleapis.com/genesis-storage/boas_vindas.mp3',
    [FunnelStage.STAGE_1_COMMITMENT]: 'https://storage.googleapis.com/genesis-storage/comprometimento.mp3',
    [FunnelStage.STAGE_2_PROBLEM]: 'https://storage.googleapis.com/genesis-storage/entendendo_problema_do_cliente.mp3',
    [FunnelStage.STAGE_3_EXPLANATION]: 'https://storage.googleapis.com/genesis-storage/explicando_e_fala_da_prova_social.mp3',
    [FunnelStage.STAGE_4_TREATMENT]: 'https://storage.googleapis.com/genesis-storage/pagamento_na_entrega.mp3',
    [FunnelStage.HANDOFF]: 'https://storage.googleapis.com/genesis-storage/transicaoassistente.mp3',
  },
  videos: [
    'https://storage.googleapis.com/genesis-storage/provasocial1.mp4',
    'https://storage.googleapis.com/genesis-storage/provasocial2.mp4',
    'https://storage.googleapis.com/genesis-storage/provasocial3.mp4',
  ]
};

export const loadAssets = async () => {
  try {
    const supabaseAssets = await getAssetMapFromSupabase();
    console.log('[Assets] Assets loaded from Supabase');

    // Merge logic: Use Supabase if available, else fallback
    const mergedAudios = { ...ASSETS.audios };
    Object.keys(supabaseAssets.audios).forEach(key => {
      if (supabaseAssets.audios[key]) mergedAudios[key as FunnelStage] = supabaseAssets.audios[key];
    });

    const mergedVideos = supabaseAssets.videos.length > 0 ? supabaseAssets.videos : ASSETS.videos;

    return {
      audios: mergedAudios,
      videos: mergedVideos
    };
  } catch (e) {
    console.error('[Assets] Failed to load from Supabase, using fallback:', e);
    return ASSETS;
  }
};

export const NEXT_STAGE_MAP: Record<FunnelStage, FunnelStage> = {
  [FunnelStage.STAGE_0_WELCOME]: FunnelStage.STAGE_1_COMMITMENT,
  [FunnelStage.STAGE_1_COMMITMENT]: FunnelStage.STAGE_2_PROBLEM,
  [FunnelStage.STAGE_2_PROBLEM]: FunnelStage.STAGE_3_EXPLANATION,
  [FunnelStage.STAGE_3_EXPLANATION]: FunnelStage.STAGE_4_TREATMENT,
  [FunnelStage.STAGE_4_TREATMENT]: FunnelStage.STAGE_5_DECISION,
  [FunnelStage.STAGE_5_DECISION]: FunnelStage.STAGE_5_DECISION,
  [FunnelStage.HANDOFF]: FunnelStage.HANDOFF
};

