// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN");
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    const url = new URL(req.url);

    // 1. VERIFICAÇÃO DO WEBHOOK (GET)
    if (req.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
            return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
    }

    // 2. RECEBIMENTO DE EVENTOS (POST)
    if (req.method === "POST") {
        try {
            const payload = await req.json();
            const entry = payload.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;
            const message = value?.messages?.[0];
            const contactInfo = value?.contacts?.[0];

            if (!message) {
                return new Response("No message found", { status: 200 });
            }

            const wa_id = message.from;
            const name = contactInfo?.profile?.name || wa_id;
            const wamid = message.id;

            // --- TRATAMENTO DE CONTEÚDO ---
            let textBody = "";

            if (message.type === "text") {
                textBody = message.text?.body || "";
            } else if (message.type === "audio" || (message.type === "document" && message.document?.mime_type?.startsWith("audio/"))) {
                const audioId = message.type === "audio" ? message.audio.id : message.document.id;
                try {
                    const mediaUrl = await getMediaUrl(audioId);
                    if (mediaUrl) {
                        const { bytes, mimeType } = await downloadMedia(mediaUrl, WHATSAPP_TOKEN);
                        const transcription = await transcribeWithWhisper(bytes, mimeType);
                        textBody = transcription || "[Áudio sem transcrição]";
                    }
                } catch (err) {
                    console.error("Erro transcrição:", err);
                    textBody = "[Erro no áudio]";
                }
            } else if (message.type === "image") {
                const imageId = message.image.id;
                try {
                    const mediaUrl = await getMediaUrl(imageId);
                    if (mediaUrl && OPENAI_API_KEY) {
                        const { bytes, mimeType } = await downloadMedia(mediaUrl, WHATSAPP_TOKEN);
                        const visionText = await analyzeImageWithOpenAI(bytes, mimeType);
                        textBody = visionText || "[Imagem sem texto]";
                    } else {
                        textBody = "[Imagem recebida]";
                    }
                } catch (err) {
                    console.error("Erro vision:", err);
                    textBody = "[Erro na imagem]";
                }
            }

            // 3. DEDUPLICAÇÃO
            const { data: existing } = await supabase
                .from("conversations")
                .select("id")
                .eq("wa_message_id", wamid)
                .maybeSingle();

            if (existing) {
                return new Response("Duplicate", { status: 200 });
            }

            // 4. IDENTIFICAR/CRIAR CONTATO
            let { data: contact, error: contactError } = await supabase
                .from("contacts")
                .select("*")
                .eq("phone", wa_id)
                .maybeSingle();

            if (!contact) {
                console.log(`Criando novo contato: ${wa_id}`);
                const { data: newContact, error: createError } = await supabase
                    .from("contacts")
                    .insert({
                        phone: wa_id,
                        name: name,
                        current_stage: "lead",
                        current_step_key: null
                    })
                    .select()
                    .single();

                if (createError || !newContact) {
                    console.error("Erro ao criar contato:", createError);
                    throw new Error("Falha ao criar contato");
                }
                contact = newContact;
            }

            // --- INTENT CLASSIFICATION ---
            const cleanBody = textBody.toLowerCase();

            // 1. HANDOFF / ERRO (Highest Priority)
            const handoffKeywords = ["erro", "não consigo pagar", "nao consigo pagar", "pix não vai", "boleto falhou", "travou", "falha", "não funciona", "problema"];
            const isHandoff = handoffKeywords.some(k => cleanBody.includes(k));

            if (isHandoff && contact.current_stage !== "handoff") {
                console.log("🔥 HANDOFF TRIGGERED");
                await sendFunnelAudio(wa_id, "transacaoassistente.ogg", contact.id);

                await supabase.from("contacts").update({
                    current_stage: "handoff",
                    last_interaction_at: new Date().toISOString()
                }).eq("id", contact.id);

                await saveMessage(contact.id, "system", "[Handoff Triggered: transacaoassistente.ogg]");
                return new Response("HANDOFF_PROCESSED", { status: 200 });
            }

            // Stop if already in handoff (Human takeover)
            if (contact.current_stage === "handoff") {
                return new Response("IN_HANDOFF", { status: 200 });
            }

            // 2. PAGAMENTO NA ENTREGA (FAQ)
            const paymentKeywords = ["pagamento na entrega", "pagar na entrega", "pagar quando receber", "paga na entrega", "pagamento entrega"];
            const isPaymentQuestion = paymentKeywords.some(k => cleanBody.includes(k));

            if (isPaymentQuestion) {
                console.log("💰 PAYMENT FAQ TRIGGERED");
                await sendFunnelAudio(wa_id, "pagamentonaentrega.ogg", contact.id);
                await saveMessage(contact.id, "system", "[FAQ: pagamentonaentrega.ogg]");
                // Does NOT advance funnel step, just answers question
                return new Response("FAQ_SENT", { status: 200 });
            }

            // 3. GREETING / RESET (Start Funnel)
            const greetings = ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "opa", "começar", "iniciar"];
            // Exact match or starts with... simpler: if it contains greeting or is first contact
            const isGreeting = greetings.some(g => cleanBody === g || cleanBody.startsWith(g + " "));
            const isNewContact = !contact.current_step_key;

            let targetStepKey: string | null = null;

            if (isGreeting || isNewContact) {
                console.log("👋 GREETING/NEW DETECTED. Starting Funnel.");
                targetStepKey = "etapa_1_welcome";

                // Reset in DB if needed (to ensure clean state)
                if (contact.current_step_key !== "etapa_1_welcome") {
                    await supabase.from("contacts").update({
                        current_step_key: "etapa_1_welcome",
                        current_stage: "lead",
                        last_interaction_at: new Date().toISOString()
                    }).eq("id", contact.id);
                    contact.current_step_key = "etapa_1_welcome"; // Update local
                }
            } else {
                // 4. CONTINUE FUNNEL (Standard Flow)
                // Get current step to find NEXT
                if (contact.current_step_key) {
                    const { data: currentStepDB } = await supabase
                        .from("funnel_steps")
                        .select("next_step")
                        .eq("step_key", contact.current_step_key)
                        .maybeSingle();

                    if (currentStepDB?.next_step) {
                        targetStepKey = currentStepDB.next_step;
                    } else {
                        console.log("🚫 End of funnel or no next step.");
                        // Check if we are at the end, maybe silence or manual check?
                    }
                } else {
                    // Fallback to start
                    targetStepKey = "etapa_1_welcome";
                }
            }

            // --- PROCESS STEPS SEQUENCE ---
            if (targetStepKey) {
                await processFunnelStep(targetStepKey, wa_id, contact.id);
            }

            // 7. SALVAR MSG USER
            if (textBody) {
                await saveMessage(contact.id, "user", textBody, wamid);
            }

            return new Response("OK", { status: 200 });

        } catch (error: any) {
            console.error("Webhook Error:", error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }
    return new Response("Method Not Allowed", { status: 405 });
});

// Helper to process step(s) logic including bursts
async function processFunnelStep(stepKey: string, wa_id: string, contactId: string) {
    let currentKey: string | null = stepKey;

    // Loop to handle "Burst" sequences (like Social Proofs)
    // We limit execution to avoid infinite loops, e.g. max 5 steps in one burst
    let stepsProcessed = 0;

    while (currentKey && stepsProcessed < 5) {
        console.log(`🚀 Processing Step: ${currentKey}`);

        const { data: step } = await supabase
            .from("funnel_steps")
            .select("*")
            .eq("step_key", currentKey)
            .maybeSingle();

        if (!step) {
            console.error(`Step ${currentKey} not found in DB.`);
            break;
        }

        // 1. Send Text (if any) - FORCE for Welcome
        if (currentKey === "etapa_1_welcome") {
            await sendMessage(wa_id, { type: "text", text: { body: "Olá! Como posso ajudar?" } }, contactId);
            await new Promise(r => setTimeout(r, 800)); // Natural delay
        } else if (step.text_response) {
            await sendMessage(wa_id, { type: "text", text: { body: step.text_response } }, contactId);
        }

        // 2. Send Audio (if any)
        if (step.audio_path) {
            try {
                await sendFunnelAudio(wa_id, step.audio_path, contactId);
            } catch (audioError: any) {
                // Don't block funnel if audio fails - log and continue
                console.error(`⚠️ Audio failed for step ${currentKey}, but continuing:`, audioError.message);
                await saveMessage(contactId, "system", `[AUDIO FAILED - ${step.audio_path}]: ${audioError.message}`);
            }
        }

        // 3. Update DB State
        await supabase.from("contacts").update({
            current_step_key: currentKey,
            last_interaction_at: new Date().toISOString()
        }).eq("id", contactId);

        const logMsg = step.text_response
            ? `${step.text_response} ${step.audio_path ? `[+Audio: ${step.audio_path}]` : ''}`
            : `[Audio Step: ${step.audio_path}]`;

        await saveMessage(contactId, "system", logMsg);

        // 4. CHECK FOR AUTO-ADVANCE (BURST)
        // Rule: If it's a "Social Proof" step (etapa_4 -> 5, 5 -> 6, 6 -> 7), advance immediately.
        // Actually, logic said: "Depois que responder... envia explicando (4)... Provas Sociais (5,6,7) em sequencia".
        // So 4 is NOT burst. 4 waits for reply. 
        // 5 (social1), 6 (social2), 7 (social3) should be burst?
        // Let's implement Burst Logic based on step keys:
        const isBurstStep = currentKey.startsWith("etapa_5") || currentKey.startsWith("etapa_6");

        if (isBurstStep && step.next_step) {
            console.log(`⚡ Bursting to next step: ${step.next_step}`);
            currentKey = step.next_step;
            await new Promise(r => setTimeout(r, 1500)); // Delay between burst messages
            stepsProcessed++;
        } else {
            // Stop processing, wait for user input for next time
            currentKey = null;
        }
    }
}

// --- HELPERS (Mesmos da anterior) ---
async function saveMessage(contactId: string, sender: string, text: string, wamid?: string) {
    await supabase.from("conversations").insert({
        contact_id: contactId, sender, message: text, wa_message_id: wamid || null, created_at: new Date().toISOString()
    });
}

async function sendMessage(to: string, messageBody: any, contactId?: string) {
    const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    await new Promise(r => setTimeout(r, 400));
    const payload = { messaging_product: "whatsapp", recipient_type: "individual", to: to, ...messageBody };
    const res = await fetch(url, {
        method: "POST", headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errorText = await res.text();
        console.error("Send Error:", errorText);
        if (contactId) {
            await supabase.from("conversations").insert({
                contact_id: contactId,
                sender: "system",
                message: `[FATAL SEND ERROR]: ${errorText}`,
                created_at: new Date().toISOString()
            });
        }
    }
}

async function sendFunnelAudio(to: string, storagePath: string, contactId: string) {
    try {
        // Extract and normalize audio_key from storage path
        const rawKey = extractAudioKey(storagePath);
        const audioKey = normalizeAudioKey(rawKey);

        console.log(`🎵 [AUDIO-LOOKUP] Raw key: ${rawKey} | Normalized: ${audioKey}`);
        await saveMessage(contactId, "system", `[AUDIO-LOOKUP] Searching for: ${audioKey}`);

        // Lookup media_id from audio_assets table
        const { data: asset, error: lookupError } = await supabase
            .from("audio_assets")
            .select("media_id, mime_type")
            .eq("audio_key", audioKey)
            .maybeSingle();

        if (lookupError || !asset?.media_id) {
            const errorMsg = `[AUDIO-LOOKUP] ❌ NOT FOUND: ${audioKey} (raw: ${rawKey})`;
            console.error(errorMsg);
            await saveMessage(contactId, "system", errorMsg);
            throw new Error(`Media ID not found for: ${audioKey}`);
        }

        const mediaId = asset.media_id;
        console.log(`✅ [AUDIO-LOOKUP] FOUND: ${audioKey} → media_id: ${mediaId}`);
        await saveMessage(contactId, "system", `[AUDIO-SEND] media_id: ${mediaId}`);

        // Send audio message using media_id
        const waPayload = {
            type: "audio",
            audio: { id: mediaId }
        };

        console.log(`📤 [AUDIO-SEND] Sending to WhatsApp API: ${to}`);
        const sendResult = await sendMessageWithStatus(to, waPayload, contactId);

        if (sendResult.success) {
            console.log(`✅ [AUDIO-SEND] SUCCESS: ${audioKey} → ${to}`);
            await saveMessage(contactId, "system", `[AUDIO-SENT] ✅ ${audioKey}`);
        } else {
            console.error(`❌ [AUDIO-SEND] FAILED: ${sendResult.error}`);
            await saveMessage(contactId, "system", `[AUDIO-FAILED] ${sendResult.error}`);
            throw new Error(sendResult.error);
        }

    } catch (e: any) {
        console.error("❌ [AUDIO-ERROR]:", e.message);
        if (contactId) {
            await saveMessage(contactId, "system", `[AUDIO-ERROR]: ${e.message}`);
        }
        throw e; // Re-throw to be caught by try-catch in processFunnelStep
    }
}

// Helper function to extract audio_key from storage path
function extractAudioKey(storagePath: string): string {
    // Remove directory path and file extension
    const filename = storagePath.split('/').pop() || storagePath;
    return filename.replace(/\.(ogg|mp3|m4a|wav)$/i, '');
}

// Robust audio key normalizer - handles name variations
function normalizeAudioKey(key: string): string {
    // Mapper for known variations
    const mapper: Record<string, string> = {
        "pagamento_na_entrega": "pagamentonaentrega",
        "pagamento_entrega": "pagamentonaentrega",
        "transacao_assistente": "transicaoassistente",
        "prova_social1": "provasocial1",
        "prova_social2": "provasocial2",
        "prova_social3": "provasocial3"
    };

    // Check if direct match exists in mapper
    if (mapper[key]) {
        console.log(`🔄 [NORMALIZE] ${key} → ${mapper[key]}`);
        return mapper[key];
    }

    // Return as-is if no mapping needed
    return key;
}

// Enhanced sendMessage with status return
async function sendMessageWithStatus(to: string, messageBody: any, contactId?: string): Promise<{ success: boolean, error?: string }> {
    try {
        const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        await new Promise(r => setTimeout(r, 400));
        const payload = { messaging_product: "whatsapp", recipient_type: "individual", to: to, ...messageBody };

        const res = await fetch(url, {
            method: "POST",
            headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();

        if (!res.ok) {
            console.error(`❌ WhatsApp API Error (${res.status}):`, responseText);
            if (contactId) {
                await saveMessage(contactId, "system", `[WA-API-ERROR ${res.status}]: ${responseText}`);
            }
            return { success: false, error: `HTTP ${res.status}: ${responseText}` };
        }

        console.log(`✅ WhatsApp API Success (${res.status})`);
        return { success: true };

    } catch (error: any) {
        console.error("❌ Send Error:", error.message);
        if (contactId) {
            await saveMessage(contactId, "system", `[SEND-ERROR]: ${error.message}`);
        }
        return { success: false, error: error.message };
    }
}

async function getMediaUrl(mediaId: string): Promise<string | null> {
    const res = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, { headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
}

// downloadMedia function removed - no longer needed with media_id approach
// Media is uploaded once via whatsapp-media-upload endpoint and reused

async function downloadMedia(url: string, authToken?: string): Promise<{ bytes: ArrayBuffer, mimeType: string }> {
    // Keep for image/audio transcription (incoming messages)
    const headers: any = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    console.log("Downloading media from:", url);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Download Fail: ${res.statusText}`);

    let mimeType = res.headers.get("content-type") || "application/octet-stream";
    console.log("Downloaded Content-Type:", mimeType);

    if (url.includes(".ogg")) {
        mimeType = "audio/ogg";
    }

    const bytes = await res.arrayBuffer();
    return { bytes, mimeType };
}

async function transcribeWithWhisper(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    if (!OPENAI_API_KEY) return null;
    const formData = new FormData();
    formData.append("model", "whisper-1");
    let ext = "mp3";
    if (mimeType.includes("ogg")) ext = "ogg";
    formData.append("file", new Blob([bytes], { type: mimeType }), `audio.${ext}`);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` }, body: formData
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text || null;
}

async function analyzeImageWithOpenAI(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    if (!OPENAI_API_KEY) return null;
    const base64 = btoa(new Uint8Array(bytes).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: [{ type: "text", text: "Descreva erro pagamento." }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }] }], max_tokens: 60
        })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
}

// uploadMediaToWhatsApp function removed - no longer needed for funnel audio
// All funnel audio is pre-uploaded via whatsapp-media-upload endpoint
// This function was used for on-demand upload, which is now eliminated
