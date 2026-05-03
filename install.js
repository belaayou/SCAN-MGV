let deferredPrompt = null;
const installButton = document.getElementById('install-button');

// ✅ Vérifier si déjà installée
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('✅ App déjà installée en mode standalone');
    if (installButton) installButton.style.display = 'none';
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('✅ beforeinstallprompt détecté');
    if (installButton) installButton.style.display = 'flex';
});

if (installButton) {
    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
            console.log('✅ App installée');
        } else {
            console.log('❌ Installation refusée');
        }
        deferredPrompt = null;
        installButton.style.display = 'none';
    });
}

window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installée');
    if (installButton) installButton.style.display = 'none';
    deferredPrompt = null;
});
