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
            console.log("Payload:", JSON.stringify(payload));

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
                    // Não falhar o request, apenas seguir sem texto (ou tratar como erro)
                }
            } else if (message.type === "image") {
                console.log("Imagem recebida. Placeholder para OCR futuro.");
                textBody = "[IMAGEM RECEBIDA]";
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
                        // current_step_key será preenchido na lógica de envio
                    })
                    .select()
                    .single();

                if (createError || !newContact) {
                    console.error("Erro criar contato:", createError);
                    throw new Error("Falha ao criar contato");
                }
                contact = newContact;
            }

            // 5. DETERMINAR PASSO DO FUNIL (TARGET STEP)
            let targetStep: any = null;

            if (!contact.current_step_key) {
                // --- CENÁRIO: NOVO NO FUNIL ---
                const { data: firstStep } = await supabase
                    .from("funnel_steps")
                    .select("*")
                    .ilike("step_key", "etapa_1%")
                    .limit(1)
                    .maybeSingle();

                if (firstStep) {
                    targetStep = firstStep;
                } else {
                    const { data: oldestStep } = await supabase
                        .from("funnel_steps")
                        .select("*")
                        .order("created_at", { ascending: true })
                        .limit(1)
                        .maybeSingle();
                    targetStep = oldestStep;
                }

            } else {
                // --- CENÁRIO: JÁ NO FUNIL ---
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
                        targetStep = next;
                    } else {
                        targetStep = currentStep;
                    }
                } else {
                    console.warn("Passo atual inválido, reiniciando funil.");
                    const { data: firstBack } = await supabase
                        .from("funnel_steps")
                        .select("*")
                        .ilike("step_key", "etapa_1%")
                        .maybeSingle();
                    targetStep = firstBack;
                }
            }

            // 6. EXECUTAR AÇÃO (ENVIAR E SALVAR)
            if (targetStep) {
                console.log(`Executando passo: ${targetStep.step_key}`);

                // A. Enviar TEXTO (Request Separado)
                if (targetStep.text_response && targetStep.text_response.trim().length > 0) {
                    console.log(`Sending TEXT body length=${targetStep.text_response.length}`);
                    await sendMessage(wa_id, {
                        type: "text",
                        text: { body: targetStep.text_response }
                    });
                }

                // B. Enviar ÁUDIO (Request Separado)
                if (targetStep.audio_path) {
                    // 1. Gerar Signed URL para baixar o arquivo
                    const { data: signed, error: storageError } = await supabase.storage
                        .from("audios_para_transcrever")
                        .createSignedUrl(targetStep.audio_path, 3600);

                    if (storageError) {
                        console.error(`Erro Storage ao gerar link para ${targetStep.audio_path}:`, storageError);
                    } else if (signed?.signedUrl) {
                        console.log(`Baixando audio para upload nativo: ${targetStep.audio_path}`);

                        try {
                            // 2. Baixar o arquivo do Supabase
                            const { bytes, mimeType } = await downloadMedia(signed.signedUrl);

                            // 3. Upload para o WhatsApp
                            const mediaId = await uploadMediaToWhatsApp(bytes, mimeType);

                            // 4. Enviar com ID
                            if (mediaId) {
                                console.log(`Enviando audio NATIVO ID=${mediaId}`);
                                await sendMessage(wa_id, {
                                    type: "audio",
                                    audio: { id: mediaId }
                                });
                            } else {
                                // Fallback se falhar upload (mas ideal seria não falhar)
                                console.warn("Upload falhou, tentando link (fallback ruim, mas evita silêncio)");
                                await sendMessage(wa_id, {
                                    type: "audio",
                                    audio: { link: signed.signedUrl }
                                });
                            }
                        } catch (err) {
                            console.error("Erro no envio de mídia nativa:", err);
                            // Fallback
                            await sendMessage(wa_id, {
                                type: "audio",
                                audio: { link: signed.signedUrl }
                            });
                        }

                    } else {
                        console.error("Erro desconhecido: Signed URL vazia para", targetStep.audio_path);
                    }
                }

                // C. Salvar OUTBOUND na conversa (System)
                await supabase.from("conversations").insert({
                    contact_id: contact.id,
                    sender: "system",
                    message: targetStep.text_response || `[Audio: ${targetStep.audio_path}]`,
                    wa_message_id: null, // Outbound não tem wamid do Meta
                    created_at: new Date().toISOString()
                });

                // D. Atualizar Contato (Estado)
                await supabase.from("contacts").update({
                    current_step_key: targetStep.step_key,
                    last_interaction_at: new Date().toISOString()
                }).eq("id", contact.id);

            } else {
                console.warn("Nenhum passo encontrado para executar.");
            }

            // 7. SALVAR INBOUND MSG (User)
            // Salvamos no final para garantir que o fluxo rodou
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

    // Pequeno delay para garantir ordem texto -> áudio se chamado rápido
    await new Promise(r => setTimeout(r, 200));

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        ...messageBody
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Meta API Erro (Send):", errorText);
    } else {
        const successData = await res.json();
        console.log("Mensagem enviada WhatsApp. ID:", successData?.messages?.[0]?.id);
    }
}

async function getMediaUrl(mediaId: string): Promise<string | null> {
    const url = `https://graph.facebook.com/v17.0/${mediaId}`;
    const res = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`
        }
    });
    if (!res.ok) {
        console.error("Erro getMediaUrl:", await res.text());
        return null;
    }
    const data = await res.json();
    return data.url || null;
}

async function downloadMedia(url: string): Promise<{ bytes: ArrayBuffer, mimeType: string }> {
    const res = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`
        }
    });
    if (!res.ok) throw new Error("Falha ao baixar media: " + res.statusText);
    const mimeType = res.headers.get("content-type") || "application/octet-stream";
    const bytes = await res.arrayBuffer();
    return { bytes, mimeType };
}

async function transcribeWithWhisper(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    if (!OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY não definida!");
        return null;
    }

    // Criar FormData
    const formData = new FormData();
    formData.append("model", "whisper-1");
    // É importante passar um nome de arquivo com extensão correta para o Whisper identificar
    // Mapear mimeType comum
    let ext = "mp3";
    if (mimeType.includes("ogg")) ext = "ogg";
    if (mimeType.includes("wav")) ext = "wav";
    if (mimeType.includes("m4a")) ext = "m4a";

    const fileBlob = new Blob([bytes], { type: mimeType });
    formData.append("file", fileBlob, `audio.${ext}`);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error("Erro Whisper API:", errText);
        return null;
    }

    const data = await res.json();
    return data.text || null;
}

async function uploadMediaToWhatsApp(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/media`;

    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    const fileBlob = new Blob([bytes], { type: mimeType });
    // Nome do arquivo é obrigatório em alguns casos
    let ext = "bin";
    if (mimeType.includes("audio")) ext = "mp3";
    if (mimeType.includes("video")) ext = "mp4";

    formData.append("file", fileBlob, `upload.${ext}`);
    formData.append("type", mimeType);

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`
        },
        body: formData
    });

    if (!res.ok) {
        console.error("Erro uploadMediaToWhatsApp:", await res.text());
        return null;
    }

    const data = await res.json();
    return data.id || null;
}
