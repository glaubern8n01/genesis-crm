
import { supabase } from './supabaseClient';
import { FunnelStage } from '../types';

const CONFIG_BUCKET = 'audios_para_transcrever'; // Using the same bucket for config
const CONFIG_FILE = 'funnel_config.json';

export interface FunnelConfig {
    assets: {
        audios: Record<FunnelStage, string>;
        videos: string[];
    };
    mapping: Record<FunnelStage, FunnelStage>;
}

// Default config as fallback
const DEFAULT_CONFIG: FunnelConfig = {
    assets: {
        audios: {
            [FunnelStage.STAGE_0_WELCOME]: 'https://storage.googleapis.com/genesis-storage/boas_vindas.mp3',
            [FunnelStage.STAGE_1_COMMITMENT]: 'https://storage.googleapis.com/genesis-storage/comprometimento.mp3',
            [FunnelStage.STAGE_2_PROBLEM]: 'https://storage.googleapis.com/genesis-storage/entendendo_problema_do_cliente.mp3',
            [FunnelStage.STAGE_3_EXPLANATION]: 'https://storage.googleapis.com/genesis-storage/explicando_e_fala_da_prova_social.mp3',
            [FunnelStage.STAGE_4_TREATMENT]: 'https://storage.googleapis.com/genesis-storage/pagamento_na_entrega.mp3',
            [FunnelStage.STAGE_5_DECISION]: '', // No specific audio for decision yet, avoids TS error
            [FunnelStage.HANDOFF]: 'https://storage.googleapis.com/genesis-storage/transicaoassistente.mp3',
        },
        videos: [
            'https://storage.googleapis.com/genesis-storage/provasocial1.mp4',
            'https://storage.googleapis.com/genesis-storage/provasocial2.mp4',
            'https://storage.googleapis.com/genesis-storage/provasocial3.mp4',
        ]
    },
    mapping: {
        [FunnelStage.STAGE_0_WELCOME]: FunnelStage.STAGE_1_COMMITMENT,
        [FunnelStage.STAGE_1_COMMITMENT]: FunnelStage.STAGE_2_PROBLEM,
        [FunnelStage.STAGE_2_PROBLEM]: FunnelStage.STAGE_3_EXPLANATION,
        [FunnelStage.STAGE_3_EXPLANATION]: FunnelStage.STAGE_4_TREATMENT,
        [FunnelStage.STAGE_4_TREATMENT]: FunnelStage.STAGE_5_DECISION,
        [FunnelStage.STAGE_5_DECISION]: FunnelStage.STAGE_5_DECISION,
        [FunnelStage.HANDOFF]: FunnelStage.HANDOFF
    }
};

export const funnelConfigService = {
    async loadConfig(): Promise<FunnelConfig> {
        try {
            const { data, error } = await supabase.storage
                .from(CONFIG_BUCKET)
                .download(CONFIG_FILE);

            if (error) {
                console.warn('[Funnel Config] Config file not found, using default/fallback.');
                return DEFAULT_CONFIG;
            }

            const text = await data.text();
            return JSON.parse(text) as FunnelConfig;
        } catch (e) {
            console.error('[Funnel Config] Failed to parse config:', e);
            return DEFAULT_CONFIG;
        }
    },

    async saveConfig(config: FunnelConfig): Promise<boolean> {
        try {
            const { error } = await supabase.storage
                .from(CONFIG_BUCKET)
                .upload(CONFIG_FILE, JSON.stringify(config, null, 2), {
                    contentType: 'application/json',
                    upsert: true
                });

            if (error) {
                console.error('[Funnel Config] Save failed:', error);
                return false;
            }
            return true;
        } catch (e) {
            console.error('[Funnel Config] Unexpected error saving config:', e);
            return false;
        }
    }
};
