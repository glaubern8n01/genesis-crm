#!/usr/bin/env pwsh
# Test WhatsApp Audio Send Directly

Write-Host "🧪 TESTE DIRETO WHATSAPP API - AUDIO" -ForegroundColor Cyan
Write-Host ""

# INSTRUÇÃO: Cole seus valores aqui
$WHATSAPP_TOKEN = "COLE_SEU_TOKEN_AQUI"
$PHONE_ID = "COLE_SEU_PHONE_NUMBER_ID_AQUI"
$TO_NUMBER = "5527997730304"
$MEDIA_ID = "1618646812482887"  # boas_vindas

if ($WHATSAPP_TOKEN -eq "EAAQOrLmXEekBQj4eRo43koYaluSGkN3kpxOCKFjEQ2ZBKgmTivib0YBbyQriRsO5kP6UlTOJJocFNs9zNuuUAgpZAKpGLzkz76aKWDDFCoLfVr2KLPPUw7pw1R0UJWMPi51rSwsRHlMkgZCAh7qSBwtdEluluXcZB2MPcfDBdwZCp57jBdqHSZAwkEWNDG4ke8e3ZCcFTB5YuFbfT49y1C2qWxbZCoAjfk2cjhXa
VITE_WHATSAPP_PHONE_NUMBER_ID=997670663418866") {
    Write-Host "❌ ERRO: Edite este arquivo e cole seu WHATSAPP_TOKEN" -ForegroundColor Red
    Write-Host ""
    Write-Host "Encontre no Supabase:" -ForegroundColor Yellow
    Write-Host "Dashboard → Projeto → Settings → Edge Functions → Secrets" -ForegroundColor Yellow
    Write-Host "Procure por: WHATSAPP_TOKEN" -ForegroundColor Yellow
    exit 1
}

Write-Host "📤 Enviando áudio via WhatsApp API..." -ForegroundColor Yellow
Write-Host "Para: $TO_NUMBER"
Write-Host "Media ID: $MEDIA_ID"
Write-Host ""

try {
    $body = @{
        messaging_product = "whatsapp"
        recipient_type = "individual"
        to = $TO_NUMBER
        type = "audio"
        audio = @{
            id = $MEDIA_ID
        }
    } | ConvertTo-Json -Compress

    $headers = @{
        "Authorization" = "Bearer $WHATSAPP_TOKEN"
        "Content-Type" = "application/json"
    }

    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "https://graph.facebook.com/v17.0/$PHONE_ID/messages" `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "✅ SUCESSO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resposta da API:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5

} catch {
    Write-Host "❌ ERRO!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host ""
    
    $errorBody = $_.ErrorDetails.Message
    if ($errorBody) {
        Write-Host "Erro detalhado:" -ForegroundColor Yellow
        $errorBody | ConvertFrom-Json | ConvertTo-Json -Depth 5
        
        # Parse specific error
        $errorObj = $errorBody | ConvertFrom-Json
        if ($errorObj.error.code -eq 131030) {
            Write-Host ""
            Write-Host "🚨 PROBLEMA: Número não está na lista permitida!" -ForegroundColor Red
            Write-Host ""
            Write-Host "SOLUÇÃO:" -ForegroundColor Yellow
            Write-Host "1. Acesse: https://developers.facebook.com/apps" -ForegroundColor White
            Write-Host "2. Seu App → WhatsApp → API Setup" -ForegroundColor White
            Write-Host "3. Adicione o número: +$TO_NUMBER" -ForegroundColor White
            Write-Host "4. Verifique o código no WhatsApp" -ForegroundColor White
        }
    } else {
        Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host "Fim do teste" -ForegroundColor Gray
