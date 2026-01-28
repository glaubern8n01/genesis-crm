// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            }
        });
    }

    // --- DEBUG ENDPOINTS ---

    // 1. GET /audio-assets - List all audio assets
    if (req.method === "GET" && url.pathname.includes("/audio-assets")) {
        try {
            const { data: assets, error } = await supabase
                .from("audio_assets")
                .select("audio_key, media_id, mime_type, file_size_bytes, uploaded_at, updated_at")
                .order("audio_key");

            if (error) throw error;

            return new Response(
                JSON.stringify({ success: true, count: assets?.length || 0, assets }),
                { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        } catch (e: any) {
            return new Response(
                JSON.stringify({ error: e.message }),
                { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
            );
        }
    }

    // 2. GET /funnel-state/:phone - Get contact funnel state
    if (req.method === "GET" && url.pathname.includes("/funnel-state/")) {
        try {
            const phone = url.pathname.split("/funnel-state/")[1];
            if (!phone) {
                return new Response(JSON.stringify({ error: "Phone number required" }), { status: 400 });
            }

            const { data: contact, error } = await supabase
                .from("contacts")
                .select("id, phone, name, current_stage, current_step_key, last_interaction_at, created_at")
                .eq("phone", phone)
                .maybeSingle();

            if (error) throw error;

            if (!contact) {
                return new Response(
                    JSON.stringify({ success: false, message: "Contact not found" }),
                    { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
                );
            }

            return new Response(
                JSON.stringify({ success: true, contact }),
                { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        } catch (e: any) {
            return new Response(
                JSON.stringify({ error: e.message }),
                { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
            );
        }
    }

    // 3. POST /send-audio - Test audio send
    if (req.method === "POST" && url.pathname.includes("/send-audio")) {
        try {
            const body = await req.json();
            const { to, audio_key } = body;

            if (!to || !audio_key) {
                return new Response(
                    JSON.stringify({ error: "to and audio_key are required" }),
                    { status: 400 }
                );
            }

            // Lookup media_id
            const { data: asset, error: lookupError } = await supabase
                .from("audio_assets")
                .select("media_id")
                .eq("audio_key", audio_key)
                .maybeSingle();

            if (lookupError || !asset?.media_id) {
                return new Response(
                    JSON.stringify({
                        error: `Media ID not found for audio_key: ${audio_key}`,
                        hint: "Upload the audio first using whatsapp-media-upload endpoint"
                    }),
                    { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
                );
            }

            // Send to WhatsApp
            const waUrl = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
            const payload = {
                messaging_product: "whatsapp",
                to: to,
                type: "audio",
                audio: { id: asset.media_id }
            };

            const res = await fetch(waUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                return new Response(
                    JSON.stringify({ error: "WhatsApp API error", details: data }),
                    { status: res.status, headers: { "Access-Control-Allow-Origin": "*" } }
                );
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    audio_key,
                    media_id: asset.media_id,
                    to,
                    whatsapp_response: data
                }),
                { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );

        } catch (e: any) {
            return new Response(
                JSON.stringify({ error: e.message }),
                { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
            );
        }
    }

    return new Response(
        JSON.stringify({
            error: "Not found",
            available_endpoints: [
                "GET /audio-assets - List all registered audio media IDs",
                "GET /funnel-state/:phone - Get contact funnel state",
                "POST /send-audio - Test send audio (body: {to, audio_key})"
            ]
        }),
        { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
});
