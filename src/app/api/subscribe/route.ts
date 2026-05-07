import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TABLE = 'newsletter_subscribers';

export async function POST(req: NextRequest) {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return NextResponse.json(
                { error: 'Supabase non configuré (vérifie .env.local)' },
                { status: 500 }
            );
        }

        const { email } = await req.json();

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });

        if (!response.ok) {
            const errorText = await response.text();

            // Si l'email existe déjà, on renvoie un succès quand même (UX)
            if (response.status === 409 || errorText.includes('duplicate')) {
                return NextResponse.json({ ok: true, alreadySubscribed: true });
            }

            console.error('[subscribe] Supabase error:', response.status, errorText);
            return NextResponse.json(
                { error: 'Erreur lors de l\'inscription' },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('[subscribe] Erreur :', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
