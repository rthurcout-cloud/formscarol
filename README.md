# Formulário da Carolina + Painel de Cadastros

Landing page/formulário da psicóloga **Carolina Rodrigues** (idêntica à original) que, a cada envio, **salva o cadastro** do paciente. A Carolina acessa um **painel protegido por senha** e **baixa o PDF** de cada paciente (ou de todos).

## Arquivos
- `index.html` — a landing/formulário (comportamento visual **inalterado**; ao enviar, salva o cadastro em segundo plano).
- `api/leads.js` — guarda (POST) e lista (GET, com senha) os cadastros no **Vercel KV**.
- `painel.html` — painel da Carolina: senha → lista de pacientes → **PDF por paciente** e **PDF de todos**.

## Como colocar no ar (Vercel) — 1 vez só
1. Suba esta pasta para um **repositório no GitHub** (ou use `vercel` CLI).
2. Em **vercel.com** → *Add New Project* → importe o repositório.
3. Em **Storage** → crie um banco **KV** (Upstash Redis) e **conecte** a este projeto. Isso cria automaticamente as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
4. Em **Settings → Environment Variables**, adicione:
   - `ACCESS_CODE` = a **senha do painel** da Carolina (ex.: uma senha forte que só ela saiba).
5. **Deploy**. Pronto.

## Endereços
- Formulário (para divulgar): `https://SEU-PROJETO.vercel.app/`
- Painel da Carolina (privado): `https://SEU-PROJETO.vercel.app/painel.html`

## Privacidade (LGPD)
São dados sensíveis. O painel exige senha (`ACCESS_CODE`); o link do painel não deve ser divulgado. Os cadastros ficam no KV do projeto; os PDFs são gerados sob demanda e salvos pela Carolina.
