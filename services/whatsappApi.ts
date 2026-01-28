import { supabase } from './supabaseClient';

/**
 * WhatsApp Cloud API Service (Secure Backend Version)
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_BASE_URL || 'https://placeholder.supabase.co/functions/v1';

const normalizePhone = (to: string): string => {
  return to.replace(/\D/g, '');
};

const sendBackendRequest = async (payload: any): Promise<any> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error("[WhatsApp API] Unauthorized: No active session");
      return { success: false, error: "Unauthorized" };
    }

    const response = await fetch(`${BACKEND_URL}/whatsapp-send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp API] Backend Error:`, data);
      return { success: false, error: data.error || 'Unknown error' };
    }

    return { success: true, data };

  } catch (error) {
    console.error(`[WhatsApp API] Network/Client Error:`, error);
    return { success: false, error: error.message };
  }
};

export const whatsappApi = {
  /**
   * Envia mensagem de texto via Backend Seguro.
   */
  async sendText(to: string, text: string) {
    const normalizedTo = normalizePhone(to);
    return sendBackendRequest({
      to: normalizedTo,
      message: text
    });
  },

  /**
   * Envia áudio nativo.
   * Por enquanto envia link de texto para manter compatibilidade.
   */
  async sendAudio(to: string, audioUrl: string) {
    const normalizedTo = normalizePhone(to);
    return sendBackendRequest({
      to: normalizedTo,
      type: "audio",
      media_url: audioUrl
    });
  },

  /**
   * Envia vídeo.
   */
  async sendVideo(to: string, videoUrl: string) {
    const normalizedTo = normalizePhone(to);
    return sendBackendRequest({
      to: normalizedTo,
      type: "video",
      media_url: videoUrl
    });
  },

  /**
   * Marca conversa como humana (Client-side logic only for now).
   */
  async markConversationAsHuman(contactId: string) {
    console.log(`[Handoff] Marking conversation ${contactId} as human.`);
    return { success: true };
  }
};
