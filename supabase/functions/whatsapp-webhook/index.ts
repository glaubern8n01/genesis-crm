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
            // console.log("Payload:", JSON.stringify(payload));

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

            // --- TRATAMENTO DE ÁUDIO/IMAGEM/TEXTO ---
            let textBody = "";

            if (message.type === "text") {
                textBody = message.text?.body || "";
            } else if (message.type === "audio" || (message.type === "document" && message.document?.mime_type?.startsWith("audio/"))) {
                // É áudio. Buscar URL, baixar e transcrever.
                const audioId = message.type === "audio" ? message.audio.id : message.document.id;
                console.log(`Recebido áudio ID: ${audioId}. Iniciando transcrição...`);

                try {
                    const mediaUrl = await getMediaUrl(audioId);
                    if (mediaUrl) {
                        const { bytes, mimeType } = await downloadMedia(mediaUrl);
                        const transcription = await transcribeWithWhisper(bytes, mimeType);
                        if (transcription) {
                            console.log(`Transcrição realizada: "${transcription}"`);
                            textBody = transcription;
                        } else {
                            console.log("Transcrição retornou vazio.");
                        }
                    }
                } catch (err) {
                    console.error("Erro no fluxo de transcrição:", err);
                }
            } else if (message.type === "image") {
                // É imagem. Tentar OCR (Vision) se API Key existir.
                const imageId = message.image.id;
                console.log(`Recebida imagem ID: ${imageId}. Iniciando Vision...`);

                try {
                    const mediaUrl = await getMediaUrl(imageId);
                    if (mediaUrl && OPENAI_API_KEY) {
                        // Vision precisa de URL pública ou base64. Graph API URL precisa de header auth.
                        // OpenAI não aceita header auth na URL. Precisamos baixar e converter pra base64.
                        const { bytes, mimeType } = await downloadMedia(mediaUrl);
                        const visionText = await analyzeImageWithOpenAI(bytes, mimeType);
                        if (visionText) {
                            console.log(`Vision result: "${visionText}"`);
                            textBody = visionText;
                        } else {
                            textBody = "[IMAGEM SEM TEXTO DETECTADO]";
                        }
                    } else {
                        textBody = "[IMAGEM RECEBIDA]";
                    }
                } catch (err) {
                    console.error("Erro no fluxo de imagem:", err);
                    textBody = "[IMAGEM COM ERRO]";
                }
            }

            // 3. DEDUPLICAÇÃO
            const { data: existing } = await supabase
                .from("conversations")
                .select("id")
                .eq("wa_message_id", wamid)
                .maybeSingle();

            if (existing) {
                console.log("Duplicado ignorado:", wamid);
                return new Response("Duplicate", { status: 200 });
            }

            // 4. IDENTIFICAR/CRIAR CONTATO
            let { data: contact, error: contactError } = await supabase
                .from("contacts")
                .select("*")
                .eq("phone", wa_id)
                .maybeSingle();

            if (!contact) {
                console.log("Novo contato:", wa_id);
                const { data: newContact, error: createError } = await supabase
                    .from("contacts")
                    .insert({
                        phone: wa_id,
                        name: name,
                        current_stage: "lead",
                        // current_step_key vazio
                    })
                    .select()
                    .single();

                if (createError || !newContact) {
                    throw new Error("Falha ao criar contato");
                }
                contact = newContact;
            }

            // --- DETECTAR HANDOFF POR PALAVRAS-CHAVE ---
            // Se o texto (transcrição ou OCR) contiver palavras de erro, forçar handoff.
            // "erro", "pix", "boleto", "código", "não consigo", "pagamento"
            const keywords = ["erro", "pix", "boleto", "codigo", "código", "pagar", "pagamento", "não consigo", "nao consigo", "travou", "falha"];
            const lowerText = textBody.toLowerCase();
            const shouldHandoff = keywords.some(k => lowerText.includes(k));

            if (shouldHandoff && contact.current_stage !== "handoff") {
                console.log("Handoff trigger detectado por palavra-chave:", textBody);

                // 1. Enviar áudio de transição
                const handoffAudio = "transicaoassistente.mp3";
                await sendFunnelAudio(wa_id, handoffAudio);

                // 2. Atualizar contato para stage handoff
                await supabase.from("contacts").update({
                    current_stage: "handoff",
                    last_interaction_at: new Date().toISOString()
                }).eq("id", contact.id);

                // 3. Salvar msg do user
                if (textBody) {
                    await supabase.from("conversations").insert({
                        contact_id: contact.id, sender: "user", message: textBody, wa_message_id: wamid, created_at: new Date().toISOString()
                    });
                }
                // 4. Salvar msg do sistema
                await supabase.from("conversations").insert({
                    contact_id: contact.id, sender: "system", message: `[Handoff Triggered] ${handoffAudio}`, created_at: new Date().toISOString()
                });

                // Tentar criar alerta de handoff se tabela existir (opcional, based on previous context)
                // await supabase.from("ticket_handoff").insert(...)

                return new Response("EVENT_PROCESSED_HANDOFF", { status: 200 });
            }

            // 5. DETERMINAR PASSO DO FUNIL (TARGET STEP)
            let targetStep: any = null;

            if (!contact.current_step_key) {
                // --- CENÁRIO: PRIMEIRO CONTATO (WELCOME) ---
                const { data: firstStep } = await supabase
                    .from("funnel_steps")
                    .select("*")
                    .ilike("step_key", "etapa_1%") // Assume etapa_1 é welcome
                    .limit(1)
                    .maybeSingle();

                if (firstStep) {
                    targetStep = firstStep;
                } else {
                    // Fallback 
                    const { data: oldest } = await supabase.from("funnel_steps").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
                    targetStep = oldest;
                }

            } else {
                // --- CENÁRIO: AVANÇAR PASSO ---
                // O usuário JÁ está em um passo. Ele respondeu. Agora queremos avançar.
                const { data: currentStep } = await supabase
                    .from("funnel_steps")
                    .select("*")
                    .eq("step_key", contact.current_step_key)
                    .maybeSingle();

                if (currentStep && currentStep.next_step) {
                    const { data: next } = await supabase
                        .from("funnel_steps")
                        .select("*")
                        .eq("step_key", currentStep.next_step)
                        .maybeSingle();
                    targetStep = next;
                } else {
                    // Sem próximo passo ou passo inválido -> Mantém (ou reinicia se quiser, mas manter é safer)
                    // targetStep = currentStep; (Se quiser repetir a msg anterior)
                    // Mas geralmente se funil acabou, não manda nada ou manda para handoff.
                    // Vamos tentar handoff se funil acabou? Ou apenas não faz nada?
                    // Por enquanto: se não tem next, não faz nada (usuário fala e ninguém responde, ou handoff manual)
                }
            }

            // 6. EXECUTAR AÇÃO
            if (targetStep) {
                console.log(`Executando passo: ${targetStep.step_key}`);

                // A. TEXTO
                if (targetStep.text_response && targetStep.text_response.trim().length > 0) {
                    await sendMessage(wa_id, { type: "text", text: { body: targetStep.text_response } });
                }

                // B. ÁUDIO DO FUNIL
                if (targetStep.audio_path) {
                    await sendFunnelAudio(wa_id, targetStep.audio_path);
                }

                // C. ATUALIZAR ESTADO
                await supabase.from("contacts").update({
                    current_step_key: targetStep.step_key,
                    last_interaction_at: new Date().toISOString()
                }).eq("id", contact.id);

                // D. LOGAR SYSTEM MSG
                await supabase.from("conversations").insert({
                    contact_id: contact.id,
                    sender: "system",
                    message: targetStep.text_response || `[Step: ${targetStep.step_key}]`,
                    created_at: new Date().toISOString()
                });
            }

            // 7. SALVAR MSG DO USER
            if (textBody) {
                await supabase.from("conversations").insert({
                    contact_id: contact.id,
                    sender: "user",
                    message: textBody,
                    wa_message_id: wamid,
                    created_at: new Date().toISOString()
                });
            }

            return new Response("EVENT_PROCESSED", { status: 200 });

        } catch (error: any) {
            console.error("Error processing webhook:", error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    return new Response("Method Not Allowed", { status: 405 });
});

// --- HELPERS ---

async function sendMessage(to: string, messageBody: any) {
    const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    await new Promise(r => setTimeout(r, 300)); // Delay
    const payload = { messaging_product: "whatsapp", recipient_type: "individual", to: to, ...messageBody };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) console.error("Meta Send Error:", await res.text());
}

async function sendFunnelAudio(to: string, storagePath: string) {
    // 1. Assina URL
    const { data: signed } = await supabase.storage.from("audios_para_transcrever").createSignedUrl(storagePath, 3600);
    if (!signed?.signedUrl) {
        console.error("Erro signed URL:", storagePath);
        return;
    }

    try {
        // 2. Baixa bytes
        const { bytes, mimeType } = await downloadMedia(signed.signedUrl);
        // 3. Upload WhatsApp
        const mediaId = await uploadMediaToWhatsApp(bytes, mimeType);

        if (mediaId && mimeType.includes("video")) {
            await sendMessage(to, { type: "video", video: { id: mediaId } });
        } else if (mediaId) {
            await sendMessage(to, { type: "audio", audio: { id: mediaId } });
        } else {
            // Fallback link
            await sendMessage(to, { type: "audio", audio: { link: signed.signedUrl } });
        }
    } catch (e) {
        console.error("Erro sendFunnelAudio:", e);
        // Fallback
        await sendMessage(to, { type: "audio", audio: { link: signed.signedUrl } });
    }
}

async function getMediaUrl(mediaId: string): Promise<string | null> {
    const res = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, {
        headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
}

async function downloadMedia(url: string): Promise<{ bytes: ArrayBuffer, mimeType: string }> {
    const res = await fetch(url, { headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` } }); // Auth header funciona pra Graph, mas pra Storage Public URL é ignorado (ok)
    if (!res.ok) throw new Error("Download Error");
    const mimeType = res.headers.get("content-type") || "application/octet-stream";
    const bytes = await res.arrayBuffer();
    return { bytes, mimeType };
}

async function transcribeWithWhisper(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    if (!OPENAI_API_KEY) return null;
    const formData = new FormData();
    formData.append("model", "whisper-1");
    let ext = "mp3";
    if (mimeType.includes("ogg")) ext = "ogg";
    else if (mimeType.includes("wav")) ext = "wav";
    else if (mimeType.includes("m4a")) ext = "m4a";

    formData.append("file", new Blob([bytes], { type: mimeType }), `audio.${ext}`);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
        body: formData
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text || null;
}

async function analyzeImageWithOpenAI(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    if (!OPENAI_API_KEY) return null;
    // Base64
    const base64 = btoa(new Uint8Array(bytes).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    const urlData = `data:${mimeType};base64,${base64}`;

    const payload = {
        model: "gpt-4o-mini", // Use mini for speed/cost or gpt-4-turbo
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "O que tem nesta imagem? Se for um erro de pagamento, pix, boleto ou print de erro de sistema, descreva claramente 'ERRO PAGAMENTO'. Caso contrário descreva brevemente." },
                    { type: "image_url", image_url: { url: urlData } }
                ]
            }
        ],
        max_tokens: 100
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        console.error("OpenAI Vision Error:", await res.text());
        return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
}

async function uploadMediaToWhatsApp(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    let ext = "bin";
    if (mimeType.includes("audio")) ext = "mp3";
    else if (mimeType.includes("video")) ext = "mp4";

    formData.append("file", new Blob([bytes], { type: mimeType }), `file.${ext}`);
    formData.append("type", mimeType);

    const res = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/media`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` },
        body: formData
    });
    if (!res.ok) {
        console.error("Upload Media Error:", await res.text());
        return null;
    }
    const data = await res.json();
    return data.id || null;
}
