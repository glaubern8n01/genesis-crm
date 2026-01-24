
import { whatsappApi } from './whatsappApi';
import { GeminiService } from './geminiService';
import { funnelConfigService, FunnelConfig } from './funnelConfig';
import { FunnelStage, Contact, ChatStatus } from '../types';

const gemini = new GeminiService();

interface WebhookPayload {
    from: string;
    text?: string;
    type: 'text' | 'audio' | 'unknown';
}

export const webhookHandler = {
    /**
     * Core logic to handle an incoming message (simulating a webhook event).
     * In a real backend, this would be the controller for POST /webhook.
     */
    async handleIncomingMessage(
        payload: WebhookPayload,
        contact: Contact,
        updateContact: (c: Contact) => void
    ) {
        console.log(`[Webhook] Processing message from ${payload.from}`);

        // 1. If Human, ignore (Handoff mode)
        if (contact.status === ChatStatus.HUMAN) {
            console.log('[Webhook] Contact is in HUMAN mode. Bot skipping.');
            return;
        }

        // 2. Load Config
        const config = await funnelConfigService.loadConfig();

        // 3. Classify Intent
        // Only classify if it's text. If audio, we might need STT (not implemented yet, assuming continue or need hook).
        // For now, treat non-empty text as actionable.
        const userMessage = payload.text || "(Audio/Media received)";

        console.log('[Webhook] Classifying intent...');
        const analysis = await gemini.classifyIntent(userMessage, contact.funnelStage);

        console.log('[Webhook] Intent:', analysis);

        // 4. Decision Logic
        if (analysis.intent === 'handoff' || analysis.intent === 'payment_difficulty') {
            // Handoff Trigger
            const newContact = { ...contact, status: ChatStatus.HUMAN, funnelStage: FunnelStage.HANDOFF };
            updateContact(newContact);

            await whatsappApi.markConversationAsHuman(contact.id);

            // Send Handoff Audio
            const handoffAudio = config.assets.audios[FunnelStage.HANDOFF];
            if (handoffAudio) {
                await whatsappApi.sendAudio(contact.phone, handoffAudio);
            }
            return;
        }

        // 5. Normal Funnel Progression
        const nextStage = config.mapping[contact.funnelStage];

        // Update Contact Stage
        const newContact = {
            ...contact,
            funnelStage: nextStage,
            lastMessageAt: new Date()
        };
        updateContact(newContact);

        // 6. Send Next Asset
        const nextAudio = config.assets.audios[nextStage];
        if (nextAudio) {
            console.log(`[Webhook] Sending audio for stage ${nextStage}`);
            await whatsappApi.sendAudio(contact.phone, nextAudio);
        }

        // Special: Social Proof Video at Stage 3
        if (nextStage === FunnelStage.STAGE_3_EXPLANATION && config.assets.videos.length > 0) {
            console.log(`[Webhook] Sending Social Proof Video`);
            await whatsappApi.sendVideo(contact.phone, config.assets.videos[0]);
        }
    },

    /**
     * Start the funnel for a new contact (First "Oi")
     */
    async startFunnel(contact: Contact, updateContact: (c: Contact) => void) {
        const config = await funnelConfigService.loadConfig();
        const firstStage = FunnelStage.STAGE_0_WELCOME;

        const newContact = { ...contact, funnelStage: firstStage };
        updateContact(newContact);

        const welcomeAudio = config.assets.audios[firstStage];
        if (welcomeAudio) {
            await whatsappApi.sendAudio(contact.phone, welcomeAudio);
        }
    }
};
