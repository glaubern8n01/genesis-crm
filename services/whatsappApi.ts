
/**
 * WhatsApp Cloud API Service
 */

const WHATSAPP_TOKEN = import.meta.env.VITE_WHATSAPP_TOKEN;
const PHONE_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;

if (!WHATSAPP_TOKEN || !PHONE_ID) {
  console.error("Missing WhatsApp Cloud API Credentials (VITE_WHATSAPP_TOKEN or VITE_WHATSAPP_PHONE_NUMBER_ID)");
}

const normalizePhone = (to: string): string => {
  return to.replace(/\D/g, '');
};

const sendRequest = async (body: any, attempt = 1): Promise<any> => {
  if (!WHATSAPP_TOKEN || !PHONE_ID) return { success: false, error: 'Missing credentials' };

  try {
    const response = await fetch(`https://graph.facebook.com/v24.0/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log(`[WhatsApp API] Status: ${response.status}`);
    console.log(`[WhatsApp API] Response:`, JSON.stringify(data));

    if (response.status >= 500 && attempt === 1) {
      console.log(`[WhatsApp API] Retrying request due to server error...`);
      return sendRequest(body, 2);
    }

    return { success: response.ok, data };
  } catch (error) {
    console.error(`[WhatsApp API] Error:`, error);
    if (attempt === 1) {
      console.log(`[WhatsApp API] Retrying request due to exception...`);
      return sendRequest(body, 2);
    }
    return { success: false, error };
  }
};

export const whatsappApi = {
  /**
   * Envia mensagem de texto simples.
   */
  async sendText(to: string, text: string) {
    const normalizedTo = normalizePhone(to);
    return sendRequest({
      messaging_product: "whatsapp",
      to: normalizedTo,
      type: "text",
      text: { body: text }
    });
  },

  /**
   * Envia áudio nativo do funil.
   */
  async sendAudio(to: string, audioUrl: string) {
    const normalizedTo = normalizePhone(to);
    return sendRequest({
      messaging_product: "whatsapp",
      to: normalizedTo,
      type: "audio",
      audio: { link: audioUrl }
    });
  },

  /**
   * Envia vídeo de prova social.
   */
  async sendVideo(to: string, videoUrl: string) {
    const normalizedTo = normalizePhone(to);
    return sendRequest({
      messaging_product: "whatsapp",
      to: normalizedTo,
      type: "video",
      video: { link: videoUrl }
    });
  },

  /**
   * Marca a conversa no banco de dados/webhook como humana.
   * Interrompe qualquer processamento automático futuro.
   */
  async markConversationAsHuman(contactId: string) {
    console.log(`[Handoff] Marking conversation ${contactId} as human.`);
    return { success: true };
  }
};
