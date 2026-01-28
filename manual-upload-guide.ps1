# Script para fazer upload direto via WhatsApp Cloud API
# e salvar media_id no banco

$WHATSAPP_TOKEN = "EAAQOrLmXEekBQj4eRo43koYalu SGkN3kpxOCKFjEQ2ZBKgmTivib0YBbyQriRsO5kP6UlTOJJocFNs9zNuuUAgpZAKpGLzkz76aKWDDFCoLfVr2KLPPUw7pw1R0UJWMPi51rSwsRHlMkgZCAh7qSBwtdEluluXcZB2MPcfDBdwZCp57jBdqHSZAwkEWNDG4ke8e3ZCcFTB5YuFbfT49y1C2qWxbZCoAjfk2cjhXa"
$PHONE_NUMBER_ID = "997670663418866"
$SUPABASE_PROJECT = "zhsheloddageqpwexsxe"

# Nota: Este script é só um exemplo
# Como precisamos dos arquivos .ogg do Storage, 
# vamos usar INSERT SQL direto no final

Write-Host "Para fazer upload via WhatsApp Cloud API diretamente,"
Write-Host "precisamos dos arquivos .ogg localmente."
Write-Host ""
Write-Host "OPCAO ALTERNATIVA:"
Write-Host "Vou criar SQL statements para você executar manualmente"
Write-Host "APOS fazer upload via Dashboard do Supabase"
Write-Host ""

# Placeholder - você precisará pegar os media_ids reais após upload
$media_ids_examples = @{
    "boas_vindas" = "MEDIA_ID_1"
    "comprometimento" = "MEDIA_ID_2"
    "entendendo_problema" = "MEDIA_ID_3"
    "explicando" = "MEDIA_ID_4"
    "provasocial1" = "MEDIA_ID_5"
    "provasocial2" = "MEDIA_ID_6"
    "provasocial3" = "MEDIA_ID_7"
    "pagamentonaentrega" = "MEDIA_ID_8"
    "transicaoassistente" = "MEDIA_ID_9"
}

Write-Host "SQL para inserir após obter media_ids:"
Write-Host ""
foreach ($key in $media_ids_examples.Keys) {
    $mid = $media_ids_examples[$key]
    Write-Host "INSERT INTO audio_assets (audio_key, media_id, mime_type) VALUES ('$key', '$mid', 'audio/ogg');"
}
