let deferredPrompt = null;
const installButton = document.getElementById('install-button');

if (window.matchMedia('(display-mode: standalone)').matches) {
    if (installButton) installButton.style.display = 'none';
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installButton) {
        installButton.style.display = 'flex';
    }
});

if (installButton) {
    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installButton.style.display = 'none';
    });
}

window.addEventListener('appinstalled', () => {
    if (installButton) installButton.style.display = 'none';
    deferredPrompt = null;
});
