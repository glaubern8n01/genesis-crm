# Guia de Deploy no Vercel

Este projeto requer configuração de Environment Variables para funcionar corretamente em produção.

## 1. Variáveis Obrigatórias
No painel do Vercel (Settings > Environment Variables), adicione:

| Nome | Valor Exemplo / Onde Encontrar |
|------|--------------------------------|
| `VITE_SUPABASE_URL` | `https://xyz.supabase.co` (Settings > API no Supabase) |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (Settings > API no Supabase) |
| `VITE_ENABLE_SIMULATOR` | `false` (Define se o botão de teste aparece) |
| `VITE_GEMINI_API_KEY` | Chave da API do Google Gemini |
| `VITE_WHATSAPP_TOKEN` | Token do Meta for Developers |
| `VITE_WHATSAPP_PHONE_NUMBER_ID` | ID do número de telefone (Meta) |

## 2. Solução de Problemas Comuns

### Tela "Configuração Ausente"
Se você ver esta tela ao acessar o app, significa que o Vercel não tem acesso às variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Verifique se elas foram adicionadas corretamente e faça um Redeploy.

### Erro de Build
O projeto usa `npm ci` e `npm run build`. Certifique-se nas configurações do Vercel que o **Framework Preset** está como `Vite`.

## 3. Segurança
NUNCA commite o arquivo `.env` ou `.env.local` no GitHub. Mantenha os segredos apenas no Vercel.
