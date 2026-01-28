# Script PowerShell para upload de áudios para WhatsApp Cloud API
# Gera media_id e salva em audio_assets

$SUPABASE_URL = "https://zhsheloddageqpwexsxe.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc2hlbG9kZGFnZXFwd2V4c3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzE0MTMsImV4cCI6MjA4MzcwNzQxM30.NtcU7lnNc1S5AltDe_iS2d6H9qLwZh-oONJ_6TQ-TxY"

# Mapeamento: audio_key -> storage_path
$audios = @{
    "boas_vindas" = "boas_vindas.ogg"
    "comprometimento" = "comprometimento.ogg"
    "entendendo_problema" = "entendendo_problema_do_cliente.ogg"
    "explicando" = "explicando_e_fala_da_provasocial (1).ogg"
    "provasocial1" = "provasocial.ogg"
    "provasocial2" = "provasocial2.ogg"
    "provasocial3" = "provasocial3.ogg"
    "pagamentonaentrega" = "pagamentonaentrega.ogg"
    "transicaoassistente" = "transicaoassistente.ogg"
}

Write-Host "======================================"
Write-Host "Upload de Audios para WhatsApp Cloud API"
Write-Host "======================================"
Write-Host ""

foreach ($audio_key in $audios.Keys) {
    $storage_path = $audios[$audio_key]
    
    Write-Host "Uploading: $audio_key ($storage_path)..."
    
    $body = @{
        audio_key = $audio_key
        storage_path = $storage_path
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/whatsapp-media-upload" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $ANON_KEY"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        if ($response.success) {
            Write-Host "Success! Media ID: $($response.media_id)"
        } else {
            Write-Host "Failed! Response: $($response | ConvertTo-Json -Compress)"
        }
    } catch {
        Write-Host "Error: $_"
    }
    
    Write-Host ""
    Start-Sleep -Seconds 1
}

Write-Host "======================================"
Write-Host "Upload concluido!"
Write-Host "======================================"

