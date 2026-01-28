-- Create table to store WhatsApp Media IDs for audio assets
-- This allows one-time upload to WhatsApp and reuse of media_id

CREATE TABLE IF NOT EXISTS audio_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_key text UNIQUE NOT NULL,
    media_id text NOT NULL,
    mime_type text DEFAULT 'audio/ogg',
    file_size_bytes integer,
    uploaded_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create index for fast lookup by audio_key
CREATE INDEX IF NOT EXISTS idx_audio_assets_audio_key ON audio_assets(audio_key);

-- Create index for media_id (for debugging/validation)
CREATE INDEX IF NOT EXISTS idx_audio_assets_media_id ON audio_assets(media_id);

-- Add comment to table
COMMENT ON TABLE audio_assets IS 'Stores WhatsApp Cloud API media_id for audio files. Files are uploaded once to WhatsApp and reused via media_id.';

-- Add optional audio_key column to funnel_steps (for future enhancement, not required)
-- This maintains compatibility with existing audio_path column
ALTER TABLE funnel_steps ADD COLUMN IF NOT EXISTS audio_key text;

-- Add comment
COMMENT ON COLUMN funnel_steps.audio_key IS 'Optional: reference to audio_assets.audio_key. If null, audio_path is used to derive the key.';
