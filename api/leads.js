// /api/leads.js — guarda e le os cadastros de pacientes (Vercel KV / Upstash Redis via REST)
// POST (publico): salva um cadastro.  GET (protegido por senha): lista todos.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_API_TOKEN;
const LIST_KEY = 'carolina:leads';

async function kv(cmd){
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  if(!r.ok) throw new Error('KV ' + r.status);
  const j = await r.json();
  return j.result;
}

function readJson(req){
  if(req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if(typeof req.body === 'string'){ try { return Promise.resolve(JSON.parse(req.body)); } catch(e){ return Promise.resolve({}); } }
  return new Promise(function(resolve){
    let d = '';
    req.on('data', function(c){ d += c; });
    req.on('end', function(){ try { resolve(JSON.parse(d || '{}')); } catch(e){ resolve({}); } });
    req.on('error', function(){ resolve({}); });
  });
}

function clean(v, n){
  var s = (v == null ? '' : ('' + v));
  return s.trim().slice(0, n);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-access-code');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if(req.method === 'OPTIONS'){ res.status(200).end(); return; }

  // diagnostico temporario: lista os NOMES das variaveis de ambiente relacionadas (sem valores)
  if(req.method === 'GET' && req.url && req.url.indexOf('diag') !== -1){
    const names = Object.keys(process.env).filter(function(k){ return /KV|REDIS|UPSTASH/i.test(k); }).sort();
    res.status(200).json({ ok:true, envNames:names, hasUrl:!!KV_URL, hasToken:!!KV_TOKEN });
    return;
  }

  if(!KV_URL || !KV_TOKEN){ res.status(500).json({ ok:false, error:'KV nao configurado' }); return; }

  try {
    if(req.method === 'POST'){
      const body = (await readJson(req)) || {};
      const lead = {
        id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        nome: clean(body.nome, 120),
        whatsapp: clean(body.whatsapp, 40),
        origem: clean(body.origem, 80),
        motivo: clean(body.motivo, 160),
        expectativa: clean(body.expectativa, 200),
        criadoEm: new Date().toISOString()
      };
      if(!lead.nome && !lead.whatsapp){ res.status(400).json({ ok:false, error:'vazio' }); return; }
      await kv(['RPUSH', LIST_KEY, JSON.stringify(lead)]);
      res.status(200).json({ ok:true, id: lead.id });
      return;
    }

    if(req.method === 'GET'){
      const code = req.headers['x-access-code'] || '';
      const expected = process.env.ACCESS_CODE || '';
      if(!expected || code !== expected){ res.status(401).json({ ok:false, error:'nao autorizado' }); return; }
      const arr = (await kv(['LRANGE', LIST_KEY, '0', '-1'])) || [];
      const leads = arr.map(function(s){ try { return JSON.parse(s); } catch(e){ return null; } }).filter(Boolean);
      res.status(200).json({ ok:true, total: leads.length, leads: leads });
      return;
    }

    res.status(405).json({ ok:false, error:'metodo nao permitido' });
  } catch(e){
    res.status(500).json({ ok:false, error: String((e && e.message) || e) });
  }
};
