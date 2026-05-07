import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'gemma3:4b';

const SYSTEM_PROMPT = `Tu es un expert en rédaction et en copywriting LinkedIn.

À partir du contenu d'article fourni ci-dessous, génère DEUX livrables :

1) UN ARTICLE RÉÉCRIT, complet et structuré (champ "article") :
   - Un titre accrocheur en première ligne (préfixé par "# ")
   - Une introduction qui pose le contexte et l'enjeu (1 paragraphe)
   - 3 à 5 sections avec sous-titres (préfixés par "## ")
   - Chaque section : 2-3 paragraphes clairs avec exemples concrets
   - Une conclusion qui ouvre la réflexion
   - Style narratif et engageant, pas un résumé sec
   - Longueur : 500 à 800 mots
   - Utilise les sauts de ligne (\\n\\n) entre paragraphes

2) UN POST LINKEDIN viral prêt à publier (champ "post") :
   - Un hook accrocheur (1-2 lignes)
   - 3 à 5 bullets format "→ [Idée] : [Bénéfice]"
   - Une question ouverte à la fin
   - 3-5 hashtags pertinents
   - Sauts de ligne fréquents pour la lisibilité mobile
   - Phrases courtes
   - Ton professionnel mais conversationnel

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans markdown autour du JSON :
{"article": "...", "post": "..."}`;

const BROWSER_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="120", "Not(A:Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
};

function htmlToText(html: string): string {
    return html
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
}

async function tryDirectFetch(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, { headers: BROWSER_HEADERS });
        if (!response.ok) {
            console.log(`[fetch direct] HTTP ${response.status}, fallback Jina`);
            return null;
        }
        const text = htmlToText(await response.text());
        // Si le texte extrait est trop court, c'est probablement une page de paywall/blocage
        if (text.length < 500) {
            console.log(`[fetch direct] texte trop court (${text.length} char), fallback Jina`);
            return null;
        }
        console.log(`[fetch direct] OK (${text.length} caractères)`);
        return text;
    } catch (e) {
        console.log(`[fetch direct] erreur, fallback Jina :`, e instanceof Error ? e.message : e);
        return null;
    }
}

async function tryJinaReader(url: string): Promise<string> {
    // Jina Reader : service gratuit qui extrait le contenu lisible d'une page
    // https://jina.ai/reader/
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
        headers: { 'X-Return-Format': 'text' },
    });

    if (!response.ok) {
        throw new Error(
            `Impossible de récupérer l'article. Le site bloque l'accès ou l'URL est invalide (HTTP ${response.status}).`
        );
    }

    let text = await response.text();
    text = text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    console.log(`[fetch jina] OK (${text.length} caractères)`);
    return text;
}

async function fetchArticleText(url: string): Promise<string> {
    let text = await tryDirectFetch(url);
    if (!text) {
        text = await tryJinaReader(url);
    }

    if (text.length < 200) {
        throw new Error(
            "Le contenu extrait est trop court. L'article est peut-être derrière un paywall ou requiert un compte."
        );
    }

    if (text.length > 8000) {
        text = text.slice(0, 8000) + '...';
    }

    return text;
}

async function callOllama(articleText: string) {
    const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt: `${SYSTEM_PROMPT}\n\n--- CONTENU DE L'ARTICLE ---\n${articleText}\n--- FIN ---`,
            stream: false,
            format: 'json',
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama a renvoyé une erreur : ${errorText}`);
    }

    const data = await response.json();
    const rawResponse = data.response || '';

    try {
        return JSON.parse(rawResponse);
    } catch {
        const match = rawResponse.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("Le modèle n'a pas renvoyé de JSON valide");
    }
}

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();
        if (!url) {
            return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
        }

        console.log(`[generate] Fetch ${url}`);
        const articleText = await fetchArticleText(url);
        console.log(`[generate] Texte extrait : ${articleText.length} caractères`);

        console.log(`[generate] Appel Ollama (${OLLAMA_MODEL})...`);
        const result = await callOllama(articleText);
        console.log(`[generate] OK`);

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('[generate] Erreur :', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const maxDuration = 120;
