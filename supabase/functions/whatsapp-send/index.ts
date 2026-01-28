// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        })
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        return new Response('Unauthorized', { status: 401 })
    }

    // Client for Auth (User Context)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
    })

    // Client for Admin (Storage Access)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate User
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Supabase Session' }), { status: 401 })
    }

    try {
        const body = await req.json()
        const { to, message, type = 'text', media_url, storage_path } = body

        // Prepare message payload
        let messagePayload: any = {
            messaging_product: "whatsapp",
            to: to,
        };

        if (type === 'text') {
            messagePayload.type = "text";
            messagePayload.text = { body: message };
        } else if (type === 'audio' || type === 'video') {

            let finalUrl = media_url;

            // Resolve Storage Path if provided
            if (storage_path && !finalUrl) {
                // Determine bucket (assume "audios_para_transcrever" for this context, or generic)
                // Usando audios_para_transcrever como default se não especificado
                const bucket = "audios_para_transcrever";
                const { data: signed, error: signError } = await supabaseAdmin.storage
                    .from(bucket)
                    .createSignedUrl(storage_path, 300);

                if (signError || !signed) {
                    throw new Error(`Failed to sign URL for ${storage_path}: ${signError?.message}`);
                }
                finalUrl = signed.signedUrl;
            }

            if (!finalUrl) {
                throw new Error("Missing media_url or storage_path for media message");
            }

            // Download & Upload to WhatsApp
            // Determine Mime Type roughly
            let mimeType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';

            // Download
            const { bytes, mimeType: detectedMime } = await downloadMedia(finalUrl);
            if (detectedMime) mimeType = detectedMime;

            // Upload
            const mediaId = await uploadMediaToWhatsApp(bytes, mimeType);

            if (!mediaId) {
                throw new Error("Failed to upload media to WhatsApp");
            }

            // Set Payload
            messagePayload.type = type;
            if (type === 'audio') {
                messagePayload.audio = { id: mediaId };
            } else {
                messagePayload.video = { id: mediaId };
            }

        } else {
            throw new Error(`Unsupported message type: ${type}`);
        }

        // --- SEND TO WHATSAPP ---
        const wbUrl = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const res = await fetch(wbUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messagePayload)
        })

        const data = await res.json()

        if (!res.ok) {
            console.error("WhatsApp API Error:", JSON.stringify(data));
            throw new Error(data.error?.message || "WhatsApp API Error");
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        })

    } catch (e: any) {
        console.error("Handler Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
    }
})

// --- HELPERS ---

async function downloadMedia(url: string): Promise<{ bytes: ArrayBuffer, mimeType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha ao baixar media de origem: " + res.statusText);
    const mimeType = res.headers.get("content-type") || "";
    const bytes = await res.arrayBuffer();
    // console.log(`Downloaded ${bytes.byteLength} bytes, mime: ${mimeType}`);
    return { bytes, mimeType };
}

async function uploadMediaToWhatsApp(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/media`;

    // Fallback mime type se vazio
    if (!mimeType) mimeType = "application/octet-stream";

    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");

    // Normalize OGG for WhatsApp
    if (mimeType === "application/ogg") mimeType = "audio/ogg";

    let ext = "bin";

    if (mimeType.includes("audio") || mimeType.includes("ogg")) ext = "ogg";
    if (mimeType.includes("mpeg")) ext = "mp3";

    // Force OGG if mime has ogg
    if (mimeType.includes("ogg")) ext = "ogg";

    if (mimeType.includes("video")) ext = "mp4";
    if (mimeType.includes("image")) ext = "jpg";
    if (mimeType.includes("pdf")) ext = "pdf";

    const fileBlob = new Blob([bytes], { type: mimeType });
    formData.append("file", fileBlob, `file.${ext}`);
    formData.append("type", mimeType);

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`
        },
        body: formData
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error("Erro uploadMediaToWhatsApp:", txt);
        return null;
    }

    const data = await res.json();
    return data.id || null;
}
