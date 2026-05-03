let deferredPrompt;
const installButton = document.getElementById('install-button');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // ✅ Afficher le bouton
    installButton.style.display = 'block';

    installButton.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('✅ App installée');
            }
            deferredPrompt = null;
            installButton.style.display = 'none';
        });
    });
});

window.addEventListener('appinstalled', () => {
    installButton.style.display = 'none';
    deferredPrompt = null;
    console.log('✅ PWA installée avec succès');
});
