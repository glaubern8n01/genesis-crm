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
                        const { bytes, mimeType } = await downloadMedia(mediaUrl);
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
                        const { bytes, mimeType } = await downloadMedia(mediaUrl);
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

            // --- DETECTAR REINÍCIO "OI" / "OLÁ" / SAUDAÇÕES ---
            const greetings = ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "opa", "e ai", "e aí", "tudo bem"];
            // Remove pontuação e espaços para comparar
            const cleanBody = textBody.toLowerCase().replace(/[.,!?;:]/g, "").trim();
            const isGreeting = greetings.some(g => cleanBody === g || cleanBody.startsWith(g + " "));

            if (isGreeting) {
                console.log(`Greeting detected '${textBody}'. Resetting to funnel start.`);

                // 1. Resetar estado no banco IMEDIATAMENTE
                const { error: resetError } = await supabase.from("contacts").update({
                    current_step_key: null,
                    current_stage: "lead", // Garante que sai de handoff/fechamento
                    last_interaction_at: new Date().toISOString()
                }).eq("id", contact.id);

                if (resetError) console.error("Erro no reset:", resetError);

                // 2. Atualizar objeto local para o fluxo abaixo pegar o início
                contact.current_step_key = null;
                contact.current_stage = "lead";
            }

            // --- DETECTAR HANDOFF (Palavras-chave + Visão + Áudio se falhar) ---
            const keywords = ["erro", "pix", "boleto", "codigo", "código", "pagar", "pagamento", "não consigo", "nao consigo", "travou", "falha", "não funciona", "nao funciona", "problema"];
            const shouldHandoff = keywords.some(k => textBody.toLowerCase().includes(k));

            if (shouldHandoff && contact.current_stage !== "handoff") {
                console.log("Handoff acionado por palavra-chave/visão.");

                // 1. Enviar áudio de transição
                await sendFunnelAudio(wa_id, "transicaoassistente.mp3");

                // 2. Atualizar contato para HANDOFF
                await supabase.from("contacts").update({
                    current_stage: "handoff",
                    last_interaction_at: new Date().toISOString()
                }).eq("id", contact.id);

                // 3. Salvar mensagens
                if (textBody) await saveMessage(contact.id, "user", textBody, wamid);
                await saveMessage(contact.id, "system", "[Handoff Triggered: transicaoassistente.mp3]");

                return new Response("HANDOFF_PROCESSED", { status: 200 });
            }

            // 5. DETERMINAR PRÓXIMO PASSO
            let targetStep: any = null;

            if (!contact.current_step_key) {
                // >>>> CENÁRIO: INÍCIO DO FUNIL (OU RESTART) <<<<
                const { data: steps } = await supabase
                    .from("funnel_steps")
                    .select("*")
                    .order("created_at", { ascending: true });

                if (steps && steps.length > 0) {
                    // Prioridade: 'etapa_1', 'welcome', 'boas_vindas'
                    targetStep = steps.find((s: any) => s.step_key.toLowerCase().startsWith("etapa_1")) ||
                        steps.find((s: any) => s.step_key.toLowerCase().includes("welcome")) ||
                        steps.find((s: any) => s.step_key.toLowerCase().includes("boas_vinda")) ||
                        steps[0];
                }
            } else {
                // >>>> CENÁRIO: AVANÇAR <<<<
                const { data: currentStep } = await supabase
                    .from("funnel_steps")
                    .select("*")
                    .eq("step_key", contact.current_step_key)
                    .maybeSingle();

                if (currentStep) {
                    if (currentStep.next_step) {
                        const { data: next } = await supabase
                            .from("funnel_steps")
                            .select("*")
                            .eq("step_key", currentStep.next_step)
                            .maybeSingle();

                        if (next) {
                            targetStep = next;
                        } else {
                            console.warn(`Próximo passo '${currentStep.next_step}' não encontrado.`);
                        }
                    } else {
                        console.log("Fim do funil.");
                    }
                } else {
                    console.warn(`Passo atual inválido. Resetando.`);
                    const { data: start } = await supabase.from("funnel_steps").select("*").ilike("step_key", "etapa_1%").maybeSingle();
                    targetStep = start;
                }
            }

            // 6. EXECUTAR PASSO
            if (targetStep) {
                console.log(`Executando passo: ${targetStep.step_key}`);

                // Se for greeting detectado (isGreeting), e o passo tiver texto, enviamos.
                // O usuário pediu explicitamente "Responder em texto imediatamente: Olá! Como posso ajudar?".
                // Vamos garantir isso SE o targetStep for o primeiro E foi um greeting.
                if (isGreeting && !contact.current_step_key) {
                    await sendMessage(wa_id, { type: "text", text: { body: "Olá! Como posso ajudar?" } });
                    // Pequeno delay para garantir ordem
                    await new Promise(r => setTimeout(r, 600));
                } else if (targetStep.text_response?.trim()) {
                    // Caso normal: manda o texto do passo (se já não mandou acima)
                    // Se mandou acima, evita duplicar se o texto for igual? 
                    // Simplificação: Se mandou hardcoded, ignora o do banco? Ou manda os dois? 
                    // O usuário quer "texto Olá" + "audio boas vindas". Se o banco tiver texto diferente, manda também.
                    await sendMessage(wa_id, { type: "text", text: { body: targetStep.text_response } });
                }

                // B. Enviar Áudio/Vídeo
                if (targetStep.audio_path) {
                    await sendFunnelAudio(wa_id, targetStep.audio_path);
                }

                // C. ATUALIZAR CONTATO
                const { error: updateError } = await supabase.from("contacts").update({
                    current_step_key: targetStep.step_key,
                    last_interaction_at: new Date().toISOString()
                }).eq("id", contact.id);

                if (updateError) console.error("ERRO UPDATE:", updateError);

                // D. Log System
                await saveMessage(contact.id, "system", targetStep.text_response || `[Mídia: ${targetStep.audio_path}]`);
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

// --- HELPERS (Mesmos da anterior) ---
async function saveMessage(contactId: string, sender: string, text: string, wamid?: string) {
    await supabase.from("conversations").insert({
        contact_id: contactId, sender, message: text, wa_message_id: wamid || null, created_at: new Date().toISOString()
    });
}

async function sendMessage(to: string, messageBody: any) {
    const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    await new Promise(r => setTimeout(r, 400));
    const payload = { messaging_product: "whatsapp", recipient_type: "individual", to: to, ...messageBody };
    const res = await fetch(url, {
        method: "POST", headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (!res.ok) console.error("Send Error:", await res.text());
}

async function sendFunnelAudio(to: string, storagePath: string) {
    const { data: signed } = await supabase.storage.from("audios_para_transcrever").createSignedUrl(storagePath, 3600);
    if (!signed?.signedUrl) return;
    try {
        const { bytes, mimeType } = await downloadMedia(signed.signedUrl);
        const mediaId = await uploadMediaToWhatsApp(bytes, mimeType);
        const msgType = mimeType.includes("video") ? "video" : "audio";
        const msgContent = { id: mediaId };
        if (mediaId) await sendMessage(to, { type: msgType, [msgType]: msgContent });
        else await sendMessage(to, { type: "audio", audio: { link: signed.signedUrl } });
    } catch (e) { await sendMessage(to, { type: "audio", audio: { link: signed.signedUrl } }); }
}

async function getMediaUrl(mediaId: string): Promise<string | null> {
    const res = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, { headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
}

async function downloadMedia(url: string): Promise<{ bytes: ArrayBuffer, mimeType: string }> {
    const res = await fetch(url, { headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` } });
    if (!res.ok) throw new Error("Download Fail");
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

async function uploadMediaToWhatsApp(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    let ext = "bin";
    if (mimeType.includes("audio")) ext = "mp3";
    if (mimeType.includes("video")) ext = "mp4";
    if (mimeType.includes("image")) ext = "jpg";
    formData.append("file", new Blob([bytes], { type: mimeType }), `file.${ext}`);
    formData.append("type", mimeType);
    const res = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/media`, {
        method: "POST", headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` }, body: formData
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
}
