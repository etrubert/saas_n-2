'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

type Result = { article: string; post: string };

export default function Home() {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [copyLabel, setCopyLabel] = useState('Copier');
    const [showModal, setShowModal] = useState(false);
    const [modalShownOnce, setModalShownOnce] = useState(false);
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState(false);
    const [subscribed, setSubscribed] = useState(false);

    useEffect(() => {
        if (!result || modalShownOnce) return;

        function onScroll() {
            const scrolled = window.scrollY + window.innerHeight;
            const total = document.documentElement.scrollHeight;
            // Déclenche dès qu'on est à 50px ou moins du bas
            if (scrolled >= total - 50) {
                setShowModal(true);
                setModalShownOnce(true);
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        // Cas où la page n'est pas scrollable : on vérifie une fois au montage
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, [result, modalShownOnce]);

    const isValidUrl = (s: string) => {
        try {
            new URL(s);
            return true;
        } catch {
            return false;
        }
    };

    async function handleGenerate() {
        setError('');
        const trimmed = url.trim();

        if (!trimmed) {
            setError("Veuillez coller une URL d'article");
            return;
        }
        if (!isValidUrl(trimmed)) {
            setError('URL invalide. Format attendu : https://...');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
            if (!data.article || !data.post) throw new Error('Réponse incomplète du modèle');
            setResult(data);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erreur inconnue';
            setError(`Erreur : ${msg}`);
        } finally {
            setLoading(false);
        }
    }

    function handleCopy() {
        if (!result) return;
        navigator.clipboard.writeText(result.post).then(() => {
            setCopyLabel('Copié !');
            setTimeout(() => setCopyLabel('Copier'), 2000);
        });
    }

    function closeModal() {
        setShowModal(false);
        setTimeout(() => {
            setSubscribed(false);
            setEmail('');
            setEmailError(false);
        }, 300);
    }

    async function handleSubscribe() {
        if (!email.trim() || !email.includes('@')) {
            setEmailError(true);
            return;
        }
        setEmailError(false);

        try {
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur inscription');

            setSubscribed(true);
            setTimeout(closeModal, 2500);
        } catch (e) {
            console.error('Erreur inscription :', e);
            setEmailError(true);
        }
    }

    return (
        <main className={styles.container}>
            <section className={styles.hero}>
                <span className={styles.badge}>Propulsé par Ollama (gemma3)</span>
                <h1 className={styles.heroTitle}>
                    Transforme un article<br />
                    en post LinkedIn viral.
                </h1>
                <p className={styles.heroSubtitle}>
                    Colle l&apos;URL d&apos;un article, et Postly te génère un post LinkedIn prêt à publier en quelques secondes.
                </p>

                <div className={styles.inputCard}>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                        placeholder="https://exemple.com/article-de-blog"
                        autoComplete="off"
                        className={styles.urlInput}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className={styles.btnPrimary}
                    >
                        Générer mon post
                    </button>
                </div>
                {error && <p className={styles.errorMessage}>{error}</p>}
            </section>

            {loading && (
                <section className={styles.loadingState}>
                    <div className={styles.spinner}></div>
                    <p>Analyse de l&apos;article en cours… (peut prendre 30-60s)</p>
                </section>
            )}

            {result && (
                <section className={styles.resultContainer}>
                    <div className={styles.resultCard}>
                        <h2>Article rédigé</h2>
                        <div className={styles.articleContent}>{result.article}</div>
                    </div>

                    <div className={styles.resultCard}>
                        <div className={styles.resultHeader}>
                            <h2>Post LinkedIn</h2>
                            <button onClick={handleCopy} className={styles.btnCopy}>
                                {copyLabel}
                            </button>
                        </div>
                        <div className={styles.postContent}>{result.post}</div>
                        <button onClick={handleCopy} className={styles.btnCopyLarge}>
                            {copyLabel === 'Copier' ? 'Copier le post LinkedIn' : copyLabel}
                        </button>
                    </div>
                </section>
            )}

            <footer className={styles.footer}>
                <p>© 2026 Postly — Made with Ollama</p>
            </footer>

            {showModal && (
                <div
                    className={styles.modal}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeModal();
                    }}
                >
                    <div className={styles.modalContent}>
                        <button onClick={closeModal} className={styles.closeModal} aria-label="Fermer">
                            ×
                        </button>

                        {!subscribed ? (
                            <>
                                <h3>Reçois 1 post LinkedIn viral par semaine</h3>
                                <p>Inscris-toi à la newsletter et reçois chaque lundi un post LinkedIn analysé et décortiqué.</p>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
                                    placeholder="ton@email.com"
                                    autoComplete="email"
                                    className={styles.emailInput}
                                    style={{ borderColor: emailError ? '#E24B4A' : undefined }}
                                />
                                <button onClick={handleSubscribe} className={styles.btnPrimary} style={{ width: '100%' }}>
                                    Je m&apos;inscris
                                </button>
                            </>
                        ) : (
                            <>
                                <div className={styles.successCheck}>✓</div>
                                <h3>Merci pour ton inscription !</h3>
                                <p>Tu recevras ton premier post lundi prochain.</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
