// ======================================================
// SUPABASE CONFIG
// ======================================================

const SUPABASE_URL =
'// ======================================================
// SUPABASE CONFIG
// ======================================================

const SUPABASE_URL =
'https://rlkhtuflfyafdpshyrcs.supabase.co';

const SUPABASE_KEY =
'sb_publishable_pr-ErTMDI_ljq59D71pV0w_Jx7Qri8R';

let supabaseClient = null;

if (typeof supabase !== 'undefined') {

    supabaseClient = supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    console.log('▲ Supabase connecté');

} else {

    console.error(
        '▲ Librairie Supabase non chargée'
    );
}

// ======================================================
// FILE D'ATTENTE LOCALE
// ======================================================

function getPendingSupabase() {

    return JSON.parse(
        localStorage.getItem(
            'pendingSupabaseSync'
        ) || '[]'
    );
}

function savePendingSupabase(data) {

    localStorage.setItem(
        'pendingSupabaseSync',
        JSON.stringify(data)
    );
}

// ======================================================
// AJOUT FILE D'ATTENTE
// ======================================================

async function queueForSupabase(logEntry) {

    let queue = getPendingSupabase();

    const existingIndex =
        queue.findIndex(
            item =>
            item.scan_id === logEntry.scan_id
        );

    if (existingIndex !== -1) {

        queue[existingIndex] = logEntry;

    } else {

        queue.push(logEntry);
    }

    savePendingSupabase(queue);

    console.log(
        '▲ Ajout file Supabase',
        logEntry.scan_id
    );

    if (navigator.onLine) {

        await syncPendingScansToSupabase();
    }
}

// ======================================================
// SYNCHRO SUPABASE
// ======================================================

async function syncPendingScansToSupabase() {

    if (!navigator.onLine) return;

    if (!supabaseClient) return;

    const queue = getPendingSupabase();

    if (queue.length === 0) {

        console.log(
            '▲ Aucun élément à synchroniser'
        );

        return;
    }

    console.log(
        `▲ Synchronisation ${queue.length} scan(s)`
    );

    const syncedIds = [];

    for (const scan of queue) {

        try {

            const { error } =
            await supabaseClient
            .from('scans')
            .upsert(
                {
                    scan_id: scan.scan_id,

                    op: scan.op || '',

                    code: scan.code || '',

                    zone: scan.zone || '',

                    date: scan.date || '',

                    time: scan.time || ''
                },
                {
                    onConflict: 'scan_id'
                }
            );

            if (error) {

                console.error(
                    '▲ Supabase Error:',
                    error
                );

                continue;
            }

            syncedIds.push(
                scan.scan_id
            );

            console.log(
                '▲ Scan synchronisé:',
                scan.code
            );

        } catch (err) {

            console.error(
                '▲ Erreur réseau:',
                err
            );

            break;
        }
    }

    const remaining = queue.filter(
        item =>
        !syncedIds.includes(
            item.scan_id
        )
    );

    savePendingSupabase(
        remaining
    );

    console.log(
        `▲ Sync terminée. Reste: ${remaining.length}`
    );
}

// ======================================================
// COMPATIBILITÉ APP
// ======================================================

async function sendToSupabase(entry) {

    return queueForSupabase(entry);
}

async function syncPendingScans() {

    return syncPendingScansToSupabase();
}

// ======================================================
// RETOUR EN LIGNE
// ======================================================

window.addEventListener(
    'online',
    () => {

        console.log(
            '▲ Retour réseau'
        );

        syncPendingScansToSupabase();
    }
);';

const SUPABASE_KEY =
'VOTRE_CLE_PUBLISHABLE_ICI';

let supabaseClient = null;

if (typeof supabase !== 'undefined') {

    supabaseClient = supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    console.log('▲ Supabase connecté');

} else {

    console.error(
        '▲ Librairie Supabase non chargée'
    );
}

// ======================================================
// FILE D'ATTENTE LOCALE
// ======================================================

function getPendingSupabase() {

    return JSON.parse(
        localStorage.getItem(
            'pendingSupabaseSync'
        ) || '[]'
    );
}

function savePendingSupabase(data) {

    localStorage.setItem(
        'pendingSupabaseSync',
        JSON.stringify(data)
    );
}

// ======================================================
// AJOUT FILE D'ATTENTE
// ======================================================

async function queueForSupabase(logEntry) {

    let queue = getPendingSupabase();

    const existingIndex =
        queue.findIndex(
            item =>
            item.scan_id === logEntry.scan_id
        );

    if (existingIndex !== -1) {

        queue[existingIndex] = logEntry;

    } else {

        queue.push(logEntry);
    }

    savePendingSupabase(queue);

    console.log(
        '▲ Ajout file Supabase',
        logEntry.scan_id
    );

    if (navigator.onLine) {

        await syncPendingScansToSupabase();
    }
}

// ======================================================
// SYNCHRO SUPABASE
// ======================================================

async function syncPendingScansToSupabase() {

    if (!navigator.onLine) return;

    if (!supabaseClient) return;

    const queue = getPendingSupabase();

    if (queue.length === 0) {

        console.log(
            '▲ Aucun élément à synchroniser'
        );

        return;
    }

    console.log(
        `▲ Synchronisation ${queue.length} scan(s)`
    );

    const syncedIds = [];

    for (const scan of queue) {

        try {

            const { error } =
            await supabaseClient
            .from('scans')
            .upsert(
                {
                    scan_id: scan.scan_id,

                    op: scan.op || '',

                    code: scan.code || '',

                    zone: scan.zone || '',

                    date: scan.date || '',

                    time: scan.time || ''
                },
                {
                    onConflict: 'scan_id'
                }
            );

            if (error) {

                console.error(
                    '▲ Supabase Error:',
                    error
                );

                continue;
            }

            syncedIds.push(
                scan.scan_id
            );

            console.log(
                '▲ Scan synchronisé:',
                scan.code
            );

        } catch (err) {

            console.error(
                '▲ Erreur réseau:',
                err
            );

            break;
        }
    }

    const remaining = queue.filter(
        item =>
        !syncedIds.includes(
            item.scan_id
        )
    );

    savePendingSupabase(
        remaining
    );

    console.log(
        `▲ Sync terminée. Reste: ${remaining.length}`
    );
}

// ======================================================
// COMPATIBILITÉ APP
// ======================================================

async function sendToSupabase(entry) {

    return queueForSupabase(entry);
}

async function syncPendingScans() {

    return syncPendingScansToSupabase();
}

// ======================================================
// RETOUR EN LIGNE
// ======================================================

window.addEventListener(
    'online',
    () => {

        console.log(
            '▲ Retour réseau'
        );

        syncPendingScansToSupabase();
    }
);
