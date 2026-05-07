/* =========================================
   POSTLY - Serveur local Node.js
   Sert le site + endpoint /api/generate (Ollama)
   Lancement : node server.js
   ========================================= */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'gemma3:4b';

// =========================================
// PROMPT
// =========================================

const SYSTEM_PROMPT = `Tu es un expert en copywriting LinkedIn.

À partir du contenu d'article fourni ci-dessous, génère :
1. Un résumé en 3-4 phrases concises
2. Un post LinkedIn viral prêt à publier avec :
   - Un hook accrocheur (1-2 lignes)
   - 3 à 5 bullets format "→ [Idée] : [Bénéfice]"
   - Une question ouverte à la fin
   - 3-5 hashtags pertinents
   - Sauts de ligne fréquents
   - Phrases courtes
   - Ton professionnel mais conversationnel

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans markdown :
{"summary": "...", "post": "..."}`;

// =========================================
// FETCH + EXTRACTION HTML → TEXTE
// =========================================

async function fetchArticleText(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Impossible de récupérer l'article (HTTP ${response.status})`);
    }

    const html = await response.text();

    // Extraction simple du texte : on retire scripts, styles, et balises
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

    // On limite à 8000 caractères pour ne pas saturer le modèle
    if (text.length > 8000) {
        text = text.slice(0, 8000) + '...';
    }

    return text;
}

// =========================================
// APPEL OLLAMA
// =========================================

async function callOllama(articleText) {
    const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt: `${SYSTEM_PROMPT}\n\n--- CONTENU DE L'ARTICLE ---\n${articleText}\n--- FIN ---`,
            stream: false,
            format: 'json'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama a renvoyé une erreur : ${errorText}`);
    }

    const data = await response.json();
    const rawResponse = data.response || '';

    // Tentative de parsing JSON
    try {
        return JSON.parse(rawResponse);
    } catch (e) {
        const match = rawResponse.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        throw new Error('Le modèle n\'a pas renvoyé de JSON valide');
    }
}

// =========================================
// SERVEUR HTTP
// =========================================

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
};

function serveStatic(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    // Sécurité : on empêche de sortir du dossier
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Fichier introuvable');
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

async function handleGenerate(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const { url } = JSON.parse(body);
            if (!url) throw new Error('URL manquante');

            console.log(`[generate] Fetch ${url}`);
            const articleText = await fetchArticleText(url);
            console.log(`[generate] Texte extrait : ${articleText.length} caractères`);

            console.log(`[generate] Appel Ollama (${OLLAMA_MODEL})...`);
            const result = await callOllama(articleText);
            console.log(`[generate] OK`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('[generate] Erreur :', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: error.message }));
        }
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/generate') {
        handleGenerate(req, res);
    } else {
        serveStatic(req, res);
    }
});

server.listen(PORT, () => {
    console.log(`\n✅ Postly tourne sur http://localhost:${PORT}`);
    console.log(`   Modèle Ollama : ${OLLAMA_MODEL}`);
    console.log(`   Ctrl+C pour arrêter\n`);
});
