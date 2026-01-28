// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            }
        });
    }

    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const contentType = req.headers.get("content-type") || "";
        let audioKey: string;
        let audioBytes: ArrayBuffer;
        let mimeType = "audio/ogg";

        // Handle multipart/form-data or JSON
        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            audioKey = formData.get("audio_key") as string;
            const file = formData.get("file") as File;
            const storagePath = formData.get("storage_path") as string;

            if (!audioKey) {
                return new Response(JSON.stringify({ error: "audio_key is required" }), { status: 400 });
            }

            if (file) {
                // Direct file upload
                audioBytes = await file.arrayBuffer();
                mimeType = file.type || "audio/ogg";
            } else if (storagePath) {
                // Download from Supabase Storage
                const { data: signed, error: signError } = await supabase.storage
                    .from("audios_para_transcrever")
                    .createSignedUrl(storagePath, 300);

                if (signError || !signed?.signedUrl) {
                    return new Response(
                        JSON.stringify({ error: `Failed to get signed URL: ${signError?.message}` }),
                        { status: 400 }
                    );
                }

                const downloadRes = await fetch(signed.signedUrl);
                if (!downloadRes.ok) {
                    return new Response(
                        JSON.stringify({ error: "Failed to download from storage" }),
                        { status: 400 }
                    );
                }

                audioBytes = await downloadRes.arrayBuffer();
                const contentTypeHeader = downloadRes.headers.get("content-type");
                if (contentTypeHeader) mimeType = contentTypeHeader;

                // Force audio/ogg for .ogg files
                if (storagePath.endsWith(".ogg")) {
                    mimeType = "audio/ogg";
                }
            } else {
                return new Response(
                    JSON.stringify({ error: "Either file or storage_path is required" }),
                    { status: 400 }
                );
            }
        } else {
            // JSON body (for storage_path only)
            const body = await req.json();
            audioKey = body.audio_key;
            const storagePath = body.storage_path;

            if (!audioKey || !storagePath) {
                return new Response(
                    JSON.stringify({ error: "audio_key and storage_path are required" }),
                    { status: 400 }
                );
            }

            // Download from Supabase Storage
            const { data: signed, error: signError } = await supabase.storage
                .from("audios_para_transcrever")
                .createSignedUrl(storagePath, 300);

            if (signError || !signed?.signedUrl) {
                return new Response(
                    JSON.stringify({ error: `Failed to get signed URL: ${signError?.message}` }),
                    { status: 400 }
                );
            }

            const downloadRes = await fetch(signed.signedUrl);
            if (!downloadRes.ok) {
                return new Response(
                    JSON.stringify({ error: "Failed to download from storage" }),
                    { status: 400 }
                );
            }

            audioBytes = await downloadRes.arrayBuffer();
            const contentTypeHeader = downloadRes.headers.get("content-type");
            if (contentTypeHeader) mimeType = contentTypeHeader;

            // Force audio/ogg for .ogg files
            if (storagePath.endsWith(".ogg")) {
                mimeType = "audio/ogg";
            }
        }

        // Validate file size (WhatsApp limit: 16MB)
        const fileSizeBytes = audioBytes.byteLength;
        if (fileSizeBytes > 16 * 1024 * 1024) {
            return new Response(
                JSON.stringify({ error: "File too large. Max size: 16MB" }),
                { status: 400 }
            );
        }

        console.log(`Uploading audio: ${audioKey}, size: ${fileSizeBytes} bytes, mime: ${mimeType}`);

        // Upload to WhatsApp Cloud API
        const mediaId = await uploadToWhatsApp(audioBytes, mimeType);

        if (!mediaId) {
            return new Response(
                JSON.stringify({ error: "Failed to upload to WhatsApp" }),
                { status: 500 }
            );
        }

        console.log(`✅ WhatsApp Media ID: ${mediaId}`);

        // Save to audio_assets (upsert)
        const { data: asset, error: upsertError } = await supabase
            .from("audio_assets")
            .upsert({
                audio_key: audioKey,
                media_id: mediaId,
                mime_type: mimeType,
                file_size_bytes: fileSizeBytes,
                updated_at: new Date().toISOString()
            }, {
                onConflict: "audio_key"
            })
            .select()
            .single();

        if (upsertError) {
            console.error("Failed to save to audio_assets:", upsertError);
            return new Response(
                JSON.stringify({
                    error: "Failed to save media_id",
                    details: upsertError.message,
                    media_id: mediaId // Still return media_id for debugging
                }),
                { status: 500 }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                audio_key: audioKey,
                media_id: mediaId,
                mime_type: mimeType,
                file_size_bytes: fileSizeBytes,
                uploaded_at: asset.uploaded_at
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" }
            }
        );

    } catch (error: any) {
        console.error("Upload Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500 }
        );
    }
});

async function uploadToWhatsApp(bytes: ArrayBuffer, mimeType: string): Promise<string | null> {
    // Normalize mime type
    if (mimeType === "application/ogg") mimeType = "audio/ogg";

    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");

    // Create blob with proper mime type
    const blob = new Blob([bytes], { type: mimeType });
    formData.append("file", blob, "audio.ogg");
    formData.append("type", mimeType);

    console.log(`Uploading to WhatsApp: ${mimeType}, ${bytes.byteLength} bytes`);

    const res = await fetch(
        `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/media`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`
            },
            body: formData
        }
    );

    if (!res.ok) {
        const errorText = await res.text();
        console.error("WhatsApp Upload Failed:", errorText);
        return null;
    }

    const data = await res.json();
    return data.id || null;
}
