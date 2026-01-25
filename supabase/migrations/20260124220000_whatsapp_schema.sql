-- Add wa_message_id to conversations for deduplication
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS wa_message_id text;

-- Add constraint only if it doesn't exist (idempotent way using a DO block is safest for unique constraints)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_wa_message_id_key') THEN
        ALTER TABLE conversations ADD CONSTRAINT conversations_wa_message_id_key UNIQUE (wa_message_id);
    END IF;
END $$;

-- Add funnel tracking columns to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_step_key text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz DEFAULT now();

-- Ensure contacts has phone as unique if not already (it usually is, but good to ensure for lookup)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_phone_key') THEN
        ALTER TABLE contacts ADD CONSTRAINT contacts_phone_key UNIQUE (phone);
    END IF;
END $$;
