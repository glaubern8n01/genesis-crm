# 🚀 LIBERAR SEU NÚMERO - PASSO A PASSO

## ⚡ AÇÃO AGORA (5 minutos)

### PASSO 1: Meta Developer Console

1. **Abra**: https://developers.facebook.com/apps

2. **Login** com sua conta Meta

3. **Selecione seu App** (o app do WhatsApp Business)

---

### PASSO 2: Adicionar Número de Teste

4. **Menu lateral esquerdo** → Clique em **"WhatsApp"** (ícone verde)

5. **Clique em**: **"API Setup"** ou **"Get Started"**

6. **Procure seção**: 
   - **"To"** (Destinatário)
   - OU **"Phone Numbers"** 
   - OU **"Recipients"**
   - OU **"Test Numbers"**

7. **Deve ter um botão**: 
   - "Add recipient" 
   - OU "Manage phone numbers"
   - OU "Add phone number"

8. **Digite seu número**:
   ```
   +5527997730304
   ```
   
   **IMPORTANTE**:
   - ✅ Com `+55` na frente
   - ✅ SEM espaços
   - ✅ SEM traços
   - ✅ Exemplo: `+5527997730304`

---

### PASSO 3: Verificar Código

9. **Após adicionar**, Meta vai enviar **CÓDIGO no WhatsApp**

10. **Abra seu WhatsApp** (5527997730304)

11. **Código vai chegar** em 1-2 minutos

12. **Digite o código** no Meta Developer Console

13. **Confirme**

14. **Status deve mudar** para "Verified" ou "Active"

---

### PASSO 4: Testar

15. **Resetar contato** (execute no SQL Editor do Supabase):
```sql
UPDATE contacts 
SET current_step_key = NULL, current_stage = 'lead'
WHERE phone = '5527997730304';
```

16. **Enviar "oi"** no WhatsApp para o número do bot

17. **Deve receber**:
    - ✅ Texto: "Olá! Como posso ajudar?"
    - ✅ Áudio 1: boas_vindas (voice note)
    - ✅ Áudio 2: comprometimento (voice note)

---

## 📸 ONDE ENCONTRAR NO META CONSOLE

### Opção A: Via Configuração Rápida
```
Dashboard → WhatsApp → Configuração → API Setup
→ Procure campo "To" ou "Phone Numbers"
```

### Opção B: Via Configurações
```
Dashboard → Configurações → Básico
→ Procure "WhatsApp Business Account"
→ Clique em "Manage"
→ Phone Numbers / Recipients
```

### Opção C: Testagem
```
Dashboard → WhatsApp → Tools → Test
→ Add Test Phone Number
```

---

## 🎯 SCREENSHOTS DE REFERÊNCIA

A tela deve ter algo como:

```
┌─────────────────────────────────────┐
│  Send messages to                   │
│                                     │
│  Phone number                       │
│  ┌────────────────────────────┐    │
│  │ +5527997730304             │    │
│  └────────────────────────────┘    │
│                                     │
│  [ Add phone number ]               │
│                                     │
│  Phone numbers (1)                  │
│  ✅ +5527997730304  Verified       │
└─────────────────────────────────────┘
```

---

## ⚠️ SE NÃO ACHAR

**Me envie screenshot da tela** do Meta Developer Console mostrando:
- Dashboard principal do seu app
- Menu lateral esquerdo
- Qualquer seção relacionada a "WhatsApp"

Vou te guiar exatamente onde clicar.

---

## 🆘 TROUBLESHOOTING

### "Não encontro onde adicionar número"
→ Pode estar em Products → WhatsApp → Settings → Phone Numbers

### "Não recebi código no WhatsApp"
→ Aguarde 2-3 minutos, ou clique em "Resend code"

### "Código já expirou"
→ Clique em "Send new code"

### "Já está adicionado mas ainda dá erro"
→ Verificar se status é "Verified" (não apenas "Pending")

---

## ✅ RESUMO

1. Meta Console → WhatsApp → API Setup
2. Adicionar `+5527997730304`
3. Verificar código no WhatsApp
4. Resetar contato (SQL)
5. Testar enviando "oi"

**ISSO VAI RESOLVER!** O código está 100% OK, só falta autorizar o número no Meta.
