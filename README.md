<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Gênesis CRM - WhatsApp Funnel Automation

CRM automatizado com funil de vendas via WhatsApp usando Supabase Edge Functions e Meta Cloud API.

## 🎯 Características

- ✅ Funil de vendas automatizado via WhatsApp
- ✅ Envio de áudios como **mensagem de voz** (voice note) usando media_id
- ✅ Transcrição de áudio recebido com OpenAI Whisper
- ✅ Análise de imagem com GPT-4 Vision
- ✅ Classificação de intenção (pagamento, handoff, etc)
- ✅ Gestão de contatos e conversas
- ✅ Dashboard administrativo

---

## 📋 Pré-requisitos

- **Node.js** (v18+)
- **Conta Supabase** (com projeto criado)
- **WhatsApp Business API** (Meta Cloud API)
  - Phone Number ID
  - Access Token
  - Webhook configurado
- **OpenAI API Key** (opcional, para transcrição e visão)

---

## 🚀 Instalação Local

### 1. Clone e instale dependências

```bash
git clone <repository-url>
cd genesis-crm
npm install
```

### 2. Configure variáveis de ambiente

Crie o arquivo `.env.local`:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# WhatsApp Cloud API (Meta)
WHATSAPP_TOKEN=your-whatsapp-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
META_VERIFY_TOKEN=your-custom-verify-token

# OpenAI (opcional)
OPENAI_API_KEY=sk-...

# Supabase Service Role (backend only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Execute a aplicação

```bash
npm run dev
```

Acesse `http://localhost:5173`

---

## 🗄️ Configuração do Banco de Dados

### Aplicar Migrations

1. **Migration inicial** (se ainda não aplicada):
   ```bash
   supabase migration up
   ```

2. **Migration de audio_assets** (OBRIGATÓRIA):
   ```bash
   supabase db push
   ```

   Ou execute manualmente no SQL Editor do Supabase:
   - Abra `supabase/migrations/20260128_audio_assets.sql`
   - Copie e execute no Supabase Dashboard → SQL Editor

---

## 🎙️ Configuração de Áudios (CRÍTICO)

### ⚠️ IMPORTANTE: Envio como "Mensagem de Voz"

Os áudios do funil são enviados como **mensagem de voz** (voice note) no WhatsApp, NÃO como arquivo compartilhado.

Isso é feito através de:
1. Upload único do áudio para WhatsApp Cloud API
2. Armazenamento do `media_id` retornado
3. Reutilização do `media_id` em cada envio

### Passo 1: Fazer Upload dos Áudios

Os áudios devem estar no formato **`.ogg` com codec OPUS**.

#### Opção A: Upload via Storage Path (Recomendado)

Se os áudios já estão no bucket `audios_para_transcrever`:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/whatsapp-media-upload \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "audio_key": "boas_vindas",
    "storage_path": "boas_vindas.ogg"
  }'
```

#### Opção B: Upload Direto (arquivo local)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/whatsapp-media-upload \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -F "audio_key=boas_vindas" \
  -F "file=@/path/to/boas_vindas.ogg"
```

### Passo 2: Áudios Obrigatórios do Funil

Faça upload de TODOS os áudios abaixo:

| audio_key | Descrição |
|-----------|-----------|
| `boas_vindas` | Áudio de boas-vindas inicial |
| `comprometimento` | Áudio de comprometimento |
| `entendendo_problema` | Entendimento do problema do cliente |
| `explicando` | Explicação do produto/serviço |
| `provasocial1` | Primeira prova social |
| `provasocial2` | Segunda prova social |
| `provasocial3` | Terceira prova social |
| `pagamento_na_entrega` | Resposta FAQ sobre pagamento |
| `transacaoassistente` | Transição para atendente humano |

**Exemplo de script bash para upload em lote:**

```bash
#!/bin/bash
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-anon-key"

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

for audio in "${audios[@]}"; do
  key="${audio%.ogg}"
  echo "Uploading $key..."
  curl -X POST "$SUPABASE_URL/functions/v1/whatsapp-media-upload" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"audio_key\": \"$key\", \"storage_path\": \"$audio\"}"
  echo ""
done
```

### Passo 3: Verificar Upload

Liste todos os áudios registrados:

```bash
curl https://your-project.supabase.co/functions/v1/whatsapp-debug/audio-assets
```

Resposta esperada:
```json
{
  "success": true,
  "count": 9,
  "assets": [
    {
      "audio_key": "boas_vindas",
      "media_id": "1234567890",
      "mime_type": "audio/ogg",
      "uploaded_at": "2026-01-28T10:00:00Z"
    },
    ...
  ]
}
```

---

## 🧪 Testes

### 1. Testar Envio de Áudio Isolado

Envie um áudio de teste para seu número:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/whatsapp-debug/send-audio \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999",
    "audio_key": "boas_vindas"
  }'
```

✅ **Verificar no WhatsApp**: O áudio deve aparecer como **mensagem de voz** (ícone de microfone), NÃO como arquivo.

### 2. Testar Funil Completo

1. Envie "oi" para o número do WhatsApp Business
2. Você deve receber:
   - Texto: "Olá! Como posso ajudar?"
   - Áudio: boas_vindas (como voz)
   - Áudio: comprometimento (como voz)
3. Responda qualquer coisa
4. Você deve receber:
   - Áudio: entendendo_problema
   - Áudio: explicando
   - 3 provas sociais (em sequência)

### 3. Testar FAQ de Pagamento

Durante o funil, envie: "tem pagamento na entrega?"

Você deve receber:
- Áudio: pagamento_na_entrega (como voz)
- O funil NÃO avança (continua no mesmo step)

### 4. Testar Handoff

Durante o funil, envie: "não consigo pagar"

Você deve receber:
- Áudio: transacaoassistente (como voz)
- Estado do contato muda para `handoff`
- Próximas mensagens não ativam o funil (aguarda humano)

### 5. Verificar Estado do Contato

```bash
curl https://your-project.supabase.co/functions/v1/whatsapp-debug/funnel-state/5511999999999
```

---

## 📊 Edge Functions

### whatsapp-webhook

**Rota**: `POST /whatsapp-webhook`

Recebe eventos do WhatsApp (mensagens, status, etc).

**Funcionalidades**:
- Deduplicação por `wa_message_id`
- Transcrição de áudio recebido (Whisper)
- Análise de imagem (GPT-4 Vision)
- Classificação de intenção
- Envio de resposta do funil
- Atualização de estado do contato

### whatsapp-media-upload

**Rota**: `POST /whatsapp-media-upload`

Faz upload de áudio para WhatsApp e salva `media_id`.

**Body (JSON)**:
```json
{
  "audio_key": "boas_vindas",
  "storage_path": "boas_vindas.ogg"
}
```

**Body (Form-data)**:
```
audio_key: "boas_vindas"
file: <binary .ogg file>
```

### whatsapp-debug

**Rotas**:

#### `GET /whatsapp-debug/audio-assets`
Lista todos os áudios registrados com `media_id`.

#### `POST /whatsapp-debug/send-audio`
Testa envio de áudio para um número.

Body:
```json
{
  "to": "5511999999999",
  "audio_key": "boas_vindas"
}
```

#### `GET /whatsapp-debug/funnel-state/:phone`
Retorna estado atual do funil para um contato.

---

## 🔒 Segurança

- **Edge Functions**: Validam autenticação via token Supabase
- **Webhook**: Valida `META_VERIFY_TOKEN` no handshake
- **Tokens**: NUNCA exponha `WHATSAPP_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY` no frontend
- **RLS**: Políticas Row Level Security aplicadas nas tabelas

---

## 🚨 Troubleshooting

### Áudio enviado como "arquivo compartilhado"

❌ **Problema**: Áudio aparece com ícone de documento, não de microfone.

✅ **Solução**:
1. Verificar se o áudio foi registrado: `GET /whatsapp-debug/audio-assets`
2. Se não estiver, fazer upload: `POST /whatsapp-media-upload`
3. Verificar logs no Supabase: procurar por `[AUDIO-SEND]`
4. Garantir que o formato é `.ogg` com codec OPUS

### "Media ID not found"

❌ **Erro**: `Media ID not found for audio_key: boas_vindas`

✅ **Solução**: Fazer upload do áudio usando `whatsapp-media-upload` endpoint.

### Funil não avança

❌ **Problema**: Cliente responde mas não recebe próxima mensagem.

✅ **Solução**:
1. Verificar estado: `GET /whatsapp-debug/funnel-state/:phone`
2. Verificar `current_step_key` e `next_step` na tabela `funnel_steps`
3. Verificar logs do webhook no Supabase Dashboard

---

## 📦 Deploy (Vercel/Produção)

Ver [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) para instruções de deploy.

**Pós-Deploy OBRIGATÓRIO**:
1. Aplicar migration `20260128_audio_assets.sql`
2. Fazer upload de TODOS os 9 áudios via `whatsapp-media-upload`
3. Testar endpoints debug
4. Testar funil completo com número de teste

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs no Supabase Dashboard → Edge Functions → Logs
2. Procure por `[ERRO]` ou `[AUDIO-SEND]` nas conversas
3. Use endpoints de debug para diagnosticar estado

---

## 📄 Licença

Propriedade privada - Gênesis CRM © 2026

