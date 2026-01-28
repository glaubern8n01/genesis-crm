#!/bin/bash

# Script para fazer upload em lote de áudios para o WhatsApp
# Uso: ./upload-audios.sh

# Configurações (EDITE AQUI)
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-anon-key"

# Lista de áudios obrigatórios do funil
audios=(
  "boas_vindas.ogg"
  "comprometimento.ogg"
  "entendendo_problema.ogg"
  "explicando.ogg"
  "provasocial1.ogg"
  "provasocial2.ogg"
  "provasocial3.ogg"
  "pagamento_na_entrega.ogg"
  "transacaoassistente.ogg"
)

echo "======================================"
echo "Upload de Áudios para WhatsApp Cloud API"
echo "======================================"
echo ""

for audio in "${audios[@]}"; do
  # Remove extensão .ogg para criar audio_key
  key="${audio%.ogg}"
  
  echo "📤 Uploading: $key ($audio)..."
  
  response=$(curl -s -X POST "$SUPABASE_URL/functions/v1/whatsapp-media-upload" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"audio_key\": \"$key\", \"storage_path\": \"$audio\"}")
  
  # Verifica se teve sucesso
  if echo "$response" | grep -q "\"success\":true"; then
    media_id=$(echo "$response" | grep -o '"media_id":"[^"]*"' | cut -d'"' -f4)
    echo "✅ Success! Media ID: $media_id"
  else
    echo "❌ Failed! Response: $response"
  fi
  
  echo ""
  sleep 1  # Delay para evitar rate limiting
done

echo "======================================"
echo "Upload concluído!"
echo "======================================"
echo ""
echo "Verificar áudios registrados:"
echo "curl $SUPABASE_URL/functions/v1/whatsapp-debug/audio-assets"
echo ""
