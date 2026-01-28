# Guia de Deploy Manual - WhatsApp Audio Fix

⚠️ **IMPORTANTE**: Este guia completa o deploy que não pôde ser automatizado via MCP devido à ausência do Docker.

## Status Atual do Deploy

### ✅ COMPLETO
1. **Migration** - Tabela `audio_assets` criada com sucesso
2. **Placeholders** - 9 registros inseridos na tabela (com PLACEHOLDER_MEDIA_ID)

### ⚠️ PENDENTE (Ação Manual Necessária)
1. **Deploy de Edge Functions**:
   - `whatsapp-media-upload` (novo)
   - `whatsapp-webhook` (atualizado)
   
2. **Upload real dos áudios** para gerar media_ids verdadeiros

---

## ETAPA 1: Deploy das Edge Functions

### Opção A: Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/zhsheloddageqpwexsxe/functions

2. **Deploy whatsapp-media-upload**:
   - Clique em "Deploy new function"
   - Nome: `whatsapp-media-upload`
   - Cole o código de: `supabase/functions/whatsapp-media-upload/index.ts`
   - Click "Deploy"

3. **Atualizar whatsapp-webhook**:
   - Clique na função existente `whatsapp-webhook`
   - Clique em "Edit"
   - Cole o código ATUALIZADO de: `supabase/functions/whatsapp-webhook/index.ts`
   - Click "Deploy"

4. **Deploy whatsapp-debug**:
   - Clique em "Deploy new function"
   - Nome: `whatsapp-debug`
   - Cole o código de: `supabase/functions/whatsapp-debug/index.ts`
   - Click "Deploy"

### Opção B: Via CLI (Requer Docker)

```bash
cd "c:\Users\ADM\Desktop\genezi\gênesis-crm---rafael-gusmão (1)"

# Fazer deploy de todas as funções
supabase functions deploy whatsapp-media-upload --project-ref zhsheloddageqpwexsxe
supabase functions deploy whatsapp-webhook --project-ref zhsheloddageqpwexsxe
supabase functions deploy whatsapp-debug --project-ref zhsheloddageqpwexsxe
```

---

## ETAPA 2: Upload dos Áudios para WhatsApp

Após deploy das Edge Functions, execute:

### Via PowerShell:

```powershell
cd "c:\Users\ADM\Desktop\genezi\gênesis-crm---rafael-gusmão (1)"
powershell -ExecutionPolicy Bypass -File upload-audios.ps1
```

### Via curl (exemplo de 1 áudio):

```bash
curl -X POST https://zhsheloddageqpwexsxe.supabase.co/functions/v1/whatsapp-media-upload \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc2hlbG9kZGFnZXFwd2V4c3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzE0MTMsImV4cCI6MjA4MzcwNzQxM30.NtcU7lnNc1S5AltDe_iS2d6H9qLwZh-oONJ_6TQ-TxY" \
  -H "Content-Type: application/json" \
  -d '{"audio_key": "boas_vindas", "storage_path": "boas_vindas.ogg"}'
```

---

## ETAPA 3: Verificar Upload

```bash
curl https://zhsheloddageqpwexsxe.supabase.co/functions/v1/whatsapp-debug/audio-assets
```

Deve retornar 9 áudios com `media_id` reais (não PLACEHOLDER).

---

## ETAPA 4: Testar Funil

### Teste 1: Envio Isolado

```bash
curl -X POST https://zhsheloddageqpwexsxe.supabase.co/functions/v1/whatsapp-debug/send-audio \
  -H "Content-Type: application/json" \
  -d '{"to": "5511999999999", "audio_key": "boas_vindas"}'
```

✅ Verificar no WhatsApp: áudio deve aparecer como **mensagem de voz** (microfone), não arquivo.

### Teste 2: Funil Completo

1. Envie "oi" para o número WhatsApp do funil
2. Você deve receber:
   - Texto: "Olá! Como posso ajudar?"
   - Áudio: boas_vindas (voz)
   - Áudio: comprometimento (voz)

---

## ETAPA 5: Git Commit & Push

```bash
cd "c:\Users\ADM\Desktop\genezi\gênesis-crm---rafael-gusmão (1)"

git add .
git commit -m "feat: WhatsApp audio fix - envio via media_id

- Criada tabela audio_assets para media_id
- Implementada função whatsapp-media-upload
- Mod ificada função whatsapp-webhook para usar media_id
- Criada função whatsapp-debug para testes
- Atualizado README completo
- Scripts de upload em lote"

git push origin main
```

---

##

 Troubleshooting

### Erro: "Media ID not found"

**Causa**: Áudio não foi uploadado ainda  
**Solução**: Execute ETAPA 2 (upload dos áudios)

### Erro: 404 no endpoint whatsapp-media-upload

**Causa**: Função não foi deployada  
**Solução**: Execute ETAPA 1 (deploy das Edge Functions)

### Áudio aparece como arquivo compartilhado

**Causa**: media_id incorreto ou formato de áudio inválido  
**Solução**: 
1. Verificar se .ogg tem codec OPUS
2. Re-fazer upload do áudio específico

---

## Endpoints Finais

- **Webhook**: `https://zhsheloddageqpwexsxe.supabase.co/functions/v1/whatsapp-webhook`
- **Upload**: `https://zhsheloddageqpwexsxe.supabase.co/functions/v1/whatsapp-media-upload`
- **Debug**: `https://zhsheloddageqpwexsxe.supabase.co/functions/v1/whatsapp-debug`

Configure o webhook no Meta Developer Console:
- URL: `https://zhsheloddageqpwexsxe.supabase.co/functions/v1/whatsapp-webhook`
- Verify Token: (configurado em `META_VERIFY_TOKEN`)

---

## Checklist Final

- [ ] Deploy whatsapp-media-upload (Dashboard ou CLI)
- [ ] Deploy whatsapp-webhook atualizado (Dashboard ou CLI)
- [ ] Deploy whatsapp-debug (Dashboard ou CLI)
- [ ] Upload 9 áudios via whatsapp-media-upload
- [ ] Verificar 9 media_ids em audio_assets (não placeholder)
- [ ] Testar envio isolado de áudio
- [ ] Testar funil completo
- [ ] Confirmar áudio como "mensagem de voz" no WhatsApp
- [ ] Git commit + push
- [ ] Configurar webhook no Meta

---

✅ **Deploy será considerado COMPLETO quando todos os ⚠️ itens forem resolvidos.**
