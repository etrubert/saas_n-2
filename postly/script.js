/* =========================================
   POSTLY - Script JavaScript
   Génération de posts LinkedIn via Claude API
   ========================================= */

// CONFIGURATION
const CONFIG = {
    // Le backend local (server.js) tourne sur le même hôte que cette page
    GENERATE_ENDPOINT: '/api/generate',

    // Endpoint pour la newsletter (Mailchimp, Brevo, ConvertKit, etc.)
    NEWSLETTER_ENDPOINT: '/api/subscribe',

    // Délai avant ouverture du popup (en ms)
    POPUP_DELAY: 1500
};

// =========================================
// SÉLECTION DES ÉLÉMENTS DU DOM
// =========================================

const elements = {
    generateBtn: document.getElementById('generate-btn'),
    urlInput: document.getElementById('article-url'),
    errorMessage: document.getElementById('error-message'),
    loadingState: document.getElementById('loading-state'),
    resultContainer: document.getElementById('result-container'),
    summaryContent: document.getElementById('summary-content'),
    postContent: document.getElementById('post-content'),
    copyBtn: document.getElementById('copy-btn'),
    copyLabel: document.getElementById('copy-label'),
    modal: document.getElementById('newsletter-modal'),
    closeModal: document.getElementById('close-modal'),
    subscribeBtn: document.getElementById('subscribe-btn'),
    emailInput: document.getElementById('email-input'),
    newsletterForm: document.getElementById('newsletter-form'),
    newsletterSuccess: document.getElementById('newsletter-success')
};

// =========================================
// FONCTIONS UTILITAIRES
// =========================================

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.add('visible');
}

function hideError() {
    elements.errorMessage.classList.remove('visible');
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

function setLoading(isLoading) {
    if (isLoading) {
        elements.resultContainer.classList.remove('visible');
        elements.loadingState.classList.add('visible');
        elements.generateBtn.disabled = true;
    } else {
        elements.loadingState.classList.remove('visible');
        elements.generateBtn.disabled = false;
    }
}

// =========================================
// APPEL AU BACKEND LOCAL (qui appelle Ollama)
// =========================================

async function generateLinkedInPost(url) {
    const response = await fetch(CONFIG.GENERATE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Erreur ${response.status}`);
    }

    if (!data.summary || !data.post) {
        throw new Error('Réponse incomplète du modèle');
    }

    return data;
}

// =========================================
// GESTION DE LA GÉNÉRATION
// =========================================

async function handleGenerate() {
    const url = elements.urlInput.value.trim();
    hideError();

    // Validation
    if (!url) {
        showError("Veuillez coller une URL d'article");
        return;
    }

    if (!isValidUrl(url)) {
        showError('URL invalide. Format attendu : https://...');
        return;
    }

    setLoading(true);

    try {
        const result = await generateLinkedInPost(url);

        // Affichage des résultats
        elements.summaryContent.textContent = result.summary;
        elements.postContent.textContent = result.post;
        elements.resultContainer.classList.add('visible');

        // Ouverture du popup après délai
        setTimeout(() => {
            elements.modal.classList.add('visible');
        }, CONFIG.POPUP_DELAY);

    } catch (error) {
        console.error('Erreur génération:', error);
        showError(`Erreur : ${error.message}`);
    } finally {
        setLoading(false);
    }
}

// =========================================
// COPIE DU POST
// =========================================

function handleCopy() {
    navigator.clipboard.writeText(elements.postContent.textContent).then(() => {
        elements.copyLabel.textContent = 'Copié !';
        setTimeout(() => {
            elements.copyLabel.textContent = 'Copier';
        }, 2000);
    });
}

// =========================================
// GESTION DU MODAL NEWSLETTER
// =========================================

function closeNewsletterModal() {
    elements.modal.classList.remove('visible');
    // Reset après fermeture
    setTimeout(() => {
        elements.newsletterForm.style.display = 'block';
        elements.newsletterSuccess.classList.remove('visible');
        elements.emailInput.value = '';
    }, 300);
}

async function handleSubscribe() {
    const email = elements.emailInput.value.trim();

    if (!email || !email.includes('@')) {
        elements.emailInput.style.borderColor = '#E24B4A';
        return;
    }

    elements.emailInput.style.borderColor = '#E5E9F0';

    try {
        // 🔧 OPTIONNEL : Décommenter pour envoyer à un vrai endpoint
        /*
        await fetch(CONFIG.NEWSLETTER_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        */

        // Affichage du succès
        elements.newsletterForm.style.display = 'none';
        elements.newsletterSuccess.classList.add('visible');

        // Fermeture automatique
        setTimeout(closeNewsletterModal, 2500);

    } catch (error) {
        console.error('Erreur inscription:', error);
        showError("Erreur lors de l'inscription");
    }
}

// =========================================
// EVENT LISTENERS
// =========================================

elements.generateBtn.addEventListener('click', handleGenerate);
elements.urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleGenerate();
});

elements.copyBtn.addEventListener('click', handleCopy);

elements.closeModal.addEventListener('click', closeNewsletterModal);
elements.subscribeBtn.addEventListener('click', handleSubscribe);
elements.emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSubscribe();
});

// Fermeture du modal en cliquant en dehors
elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeNewsletterModal();
});
