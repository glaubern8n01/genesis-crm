# 🚀 DEPLOY MANUAL - whatsapp-webhook v28

## INSTRUÇÕES RÁPIDAS

1. **Acesse**: https://supabase.com/dashboard/project/zhsheloddageqpwexsxe/functions

2. **Clique em** `whatsapp-webhook`

3. **Clique "Edit" ou "New Version"**

4. **Cole o código**: Use o código do arquivo local:
   ```
   supabase/functions/whatsapp-webhook/index.ts
   ```
   
   **OU copie do GitHub**:
   ```
   https://github.com/glaubern8n01/genesis-crm/blob/main/supabase/functions/whatsapp-webhook/index.ts
   ```

5. **Deploy**

6. **Aguarde** até status = ACTIVE

---

## OPÇÃO 2: PowerShell (se disponível no PC)

```powershell
cd "c:\Users\ADM\Desktop\genezi\gênesis-crm---rafael-gusmão (1)"
# Requer Supabase CLI + Docker
npx supabase functions deploy whatsapp-webhook
```

---

## SQL RESET (se número ficar em handoff)

Execute no **SQL Editor** do Supabase:

```sql
-- Reset seu número de teste
UPDATE contacts 
SET 
    current_stage = 'lead',
    current_step_key = NULL,
    status = 'BOT_ATIVO'
WHERE phone = '5527997730304';
```

**URL SQL Editor**: https://supabase.com/dashboard/project/zhsheloddageqpwexsxe/sql

---

## O QUE FOI CORRIGIDO

### 1. ✅ Audio Key Mapping
- **Problema**: `pagamento_na_entrega.ogg` não encontrava `pagamento_na_entrega` no banco
- **Solução**: Função `normalizeAudioKey()` mapeia variações automaticamente

### 2. ✅ Non-Blocking Audio Failure
- **Problema**: Se áudio falhava, **TODO** o fluxo morria (throw sem catch)
- **Solução**: `try-catch` em `processFunnelStep` - texto envia mesmo se áudio falhar

### 3. ✅ Enhanced Logging
- **Antes**: Logs genéricos
- **Agora**: `[AUDIO-LOOKUP]`, `[AUDIO-SEND]`, `[AUDIO-ERROR]` com emojis

### 4. ✅ WhatsApp API Status Tracking
- **Nova função**: `sendMessageWithStatus()` retorna `{success: boolean, error?: string}`
- **Benefício**: Logs detalham HTTP status + error payload da Meta

---

## VERSÃO FINAL

- **Commit**: 840c5fe
- **Versão esperada**: v28 (após deploy)
- **Arquivos modificados**:
  - `supabase/functions/whatsapp-webhook/index.ts` (+93 linhas, -24 linhas)

**Confirme deploy e teste enviando "oi" no WhatsApp!**
