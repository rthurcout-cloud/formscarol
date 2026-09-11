// /api/leads.js — guarda e le os cadastros de pacientes (Vercel KV / Upstash Redis via REST)
// POST (publico): salva um cadastro.  GET (protegido por senha): lista todos.
// resolve as variaveis do banco mesmo que o Vercel adicione um prefixo (ex.: formscarol_KV_REST_API_URL)
function findEnv(suffixes){
  for(var i=0;i<suffixes.length;i++){ if(process.env[suffixes[i]]) return process.env[suffixes[i]]; }
  var keys = Object.keys(process.env);
  for(var j=0;j<suffixes.length;j++){
    var suf = suffixes[j];
    var k = keys.find(function(key){ return key.endsWith(suf) && process.env[key]; });
    if(k) return process.env[k];
  }
  return undefined;
}
const KV_URL = findEnv(['KV_REST_API_URL','UPSTASH_REDIS_REST_URL','REDIS_REST_API_URL']);
const KV_TOKEN = findEnv(['KV_REST_API_TOKEN','UPSTASH_REDIS_REST_TOKEN','REDIS_REST_API_TOKEN']);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if(req.method === 'OPTIONS'){ res.status(200).end(); return; }

  // diagnostico temporario (nao expoe a senha): confere se ACCESS_CODE existe e se bate
  if(req.method === 'GET' && req.url && req.url.indexOf('diag') !== -1){
    const hdr = req.headers['x-access-code'] || '';
    res.status(200).json({ ok:true, hasAccessCode: !!process.env.ACCESS_CODE, accessCodeLen: (process.env.ACCESS_CODE || '').length, matches: hdr === (process.env.ACCESS_CODE || '') });
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

    if(req.method === 'PATCH'){
      // paciente completando o proprio cadastro com a opcao de valor escolhida (publico)
      const body = (await readJson(req)) || {};
      const id = ('' + (body.id || '')).slice(0, 60);
      const plano = clean(body.plano, 80);
      if(!id){ res.status(400).json({ ok:false, error:'id ausente' }); return; }
      const arr = (await kv(['LRANGE', LIST_KEY, '0', '-1'])) || [];
      const idx = arr.findIndex(function(s){ try { return JSON.parse(s).id === id; } catch(e){ return false; } });
      if(idx < 0){ res.status(404).json({ ok:false, error:'nao encontrado' }); return; }
      let obj; try { obj = JSON.parse(arr[idx]); } catch(e){ obj = {}; }
      obj.plano = plano;
      obj.planoEm = new Date().toISOString();
      await kv(['LSET', LIST_KEY, '' + idx, JSON.stringify(obj)]);
      res.status(200).json({ ok:true });
      return;
    }

    if(req.method === 'DELETE'){
      const code = req.headers['x-access-code'] || '';
      const expected = process.env.ACCESS_CODE || '';
      if(!expected || code !== expected){ res.status(401).json({ ok:false, error:'nao autorizado' }); return; }
      const body = (await readJson(req)) || {};
      const id = ('' + (body.id || '')).slice(0, 60);
      if(!id){ res.status(400).json({ ok:false, error:'id ausente' }); return; }
      const arr = (await kv(['LRANGE', LIST_KEY, '0', '-1'])) || [];
      const target = arr.find(function(s){ try { return JSON.parse(s).id === id; } catch(e){ return false; } });
      if(target){ await kv(['LREM', LIST_KEY, '1', target]); }
      res.status(200).json({ ok:true, removed: !!target });
      return;
    }

    res.status(405).json({ ok:false, error:'metodo nao permitido' });
  } catch(e){
    res.status(500).json({ ok:false, error: String((e && e.message) || e) });
  }
};
