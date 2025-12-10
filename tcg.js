/**
 * POKÉCOLLECTOR - TCG FINDER LOGIC (FIXED & OPTIMIZED)
 */

// --- KONFIGURATION ---
const TCG_API_URL = 'https://api.pokemontcg.io/v2/cards';
const POKE_SPECIES_URL = 'https://pokeapi.co/api/v2/pokemon-species';

// DOM Elemente
const searchInput = document.getElementById('tcgInput');
const searchBtn = document.getElementById('searchBtn');
const setsGrid = document.getElementById('setsGrid');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultsHeader = document.getElementById('resultsHeader');
const startPlaceholder = document.getElementById('startPlaceholder');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const searchedNameEl = document.getElementById('searchedPokemonName');
const setCountEl = document.getElementById('setCount');

// --- INITIALISIERUNG ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search');
    
    if (searchTerm) {
        searchInput.value = searchTerm;
        handleSearch();
    }

    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
});

// --- HAUPTLOGIK ---

async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // UI Reset
    resetUI();
    console.log(`🔍 Starte Suche nach: "${query}"`);

    try {
        // SCHRITT 1: Namen übersetzen
        const englishName = await getEnglishName(query);
        console.log(`✅ Übersetzt zu: "${englishName}"`);
        
        searchedNameEl.innerText = `${query} (${englishName})`;

        // SCHRITT 2: Karten holen
        // pageSize=250 verhindert Timeouts bei großen Ergebnissen
        const queryUrl = `${TCG_API_URL}?q=name:${englishName}*&orderBy=-set.releaseDate&pageSize=250&select=id,name,set,images,rarity`;
        
        console.log(`📡 Frage TCG API ab: ${queryUrl}`);
        const tcgRes = await fetch(queryUrl);

        // API Limit Check (429 = Zu viele Anfragen)
        if (tcgRes.status === 429) {
            throw new Error("Zu viele Anfragen! Die API hat uns kurzzeitig blockiert. Bitte warte eine Minute.");
        }
        
        if (!tcgRes.ok) {
            throw new Error(`API Fehler: ${tcgRes.status}`);
        }

        const tcgData = await tcgRes.json();
        console.log(`📦 Gefundene Karten: ${tcgData.count}`);

        if (tcgData.count === 0) {
            throw new Error(`Keine Karten für "${query}" (Englisch: "${englishName}") gefunden.`);
        }

        // SCHRITT 3: Gruppieren
        const setsMap = groupCardsBySet(tcgData.data);
        console.log(`📂 Gruppiert in ${setsMap.size} Sets`);

        // SCHRITT 4: Rendern
        renderSets(setsMap);

    } catch (error) {
        console.error("❌ Fehler:", error);
        showError(true, error.message || "Ein unbekannter Fehler ist aufgetreten.");
        startPlaceholder.classList.remove('hidden');
    } finally {
        loadingSpinner.classList.add('hidden');
        loadingSpinner.classList.remove('flex');
    }
}

/**
 * Holt den englischen Namen.
 * Versucht es erst als exakten Match, falls 404, gibt input zurück.
 */
async function getEnglishName(inputName) {
    try {
        // Namen bereinigen und klein schreiben für die URL
        const cleanName = inputName.trim().toLowerCase().replace(' ', '-');
        
        // Wenn der Name schon Englisch klingt (oder Pikachu ist), API fragen
        const response = await fetch(`${POKE_SPECIES_URL}/${cleanName}`);
        
        if (!response.ok) {
            console.warn("⚠️ Übersetzung fehlgeschlagen (404), nutze Original-Eingabe.");
            return inputName; // Fallback: Wir nutzen einfach die Eingabe
        }

        const data = await response.json();
        const englishEntry = data.names.find(n => n.language.name === 'en');
        
        return englishEntry ? englishEntry.name : inputName;
    } catch (e) {
        console.warn("⚠️ Verbindungsfehler zur PokéAPI, nutze Original-Eingabe.");
        return inputName;
    }
}

function groupCardsBySet(cards) {
    const sets = new Map();

    cards.forEach(card => {
        // Sicherstellen, dass Set-Daten existieren
        if (!card.set || !card.set.id) return;

        const setId = card.set.id;

        if (!sets.has(setId)) {
            sets.set(setId, {
                info: card.set,
                cards: []
            });
        }

        // Füge Karte hinzu (mit Sicherheitscheck für Bilder)
        sets.get(setId).cards.push({
            name: card.name,
            image: card.images?.small || 'https://via.placeholder.com/150?text=No+Image',
            rarity: card.rarity || 'Common'
        });
    });

    return sets;
}

function renderSets(setsMap) {
    resultsHeader.classList.remove('hidden');
    resultsHeader.classList.add('flex');
    setCountEl.innerText = setsMap.size;

    const setsArray = Array.from(setsMap.values());

    setsArray.forEach(setObj => {
        const setInfo = setObj.info;
        const cardsInSet = setObj.cards;
        
        const cardEl = document.createElement('div');
        cardEl.className = "bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full";
        
        // Preview Images sicherstellen
        const previewImages = cardsInSet.slice(0, 3).map(c => 
            `<img src="${c.image}" class="w-16 h-24 object-contain -ml-4 first:ml-0 hover:scale-110 transition-transform z-10 shadow-md bg-white rounded border border-gray-100" title="${c.name}">`
        ).join('');

        const remainingCount = cardsInSet.length > 3 ? `+${cardsInSet.length - 3}` : '';
        const releaseDate = setInfo.releaseDate ? formatDate(setInfo.releaseDate) : 'Unbekannt';

        cardEl.innerHTML = `
            <div class="flex justify-between items-start mb-6 h-16">
                ${setInfo.logo ? `<img src="${setInfo.logo}" alt="${setInfo.name}" class="h-full max-w-[70%] object-contain object-left">` : '<span class="text-xl font-bold">?</span>'}
                ${setInfo.symbol ? `<img src="${setInfo.symbol}" alt="Symbol" class="h-6 w-6 object-contain opacity-60">` : ''}
            </div>

            <div class="flex-grow">
                <h3 class="text-lg font-bold text-gray-900 mb-1 leading-tight">${setInfo.name}</h3>
                <p class="text-sm text-gray-400 mb-4">Erschienen: ${releaseDate}</p>
                
                <div class="bg-blue-50 rounded-xl p-3 mb-4">
                    <p class="text-xs text-tcg-blue font-bold uppercase tracking-wide mb-2">
                        Gefundene Karten (${cardsInSet.length})
                    </p>
                    <div class="flex items-end pl-2 h-24">
                        ${previewImages}
                        ${remainingCount ? `<span class="ml-2 text-xs font-bold text-gray-400 self-center">${remainingCount}</span>` : ''}
                    </div>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                <span>Serie: ${setInfo.series || 'Divers'}</span>
                <span>${setInfo.total || '?'} Karten</span>
            </div>
            
            <a href="https://pkmncards.com/set/${setInfo.id}/" target="_blank" class="mt-4 block w-full text-center bg-gray-900 text-white py-2 rounded-xl text-sm font-semibold hover:bg-poke-red transition-colors">
                Set Details <i class="fa-solid fa-external-link-alt ml-1 text-xs"></i>
            </a>
        `;

        setsGrid.appendChild(cardEl);
    });
}

// --- HELPER ---

function resetUI() {
    showError(false);
    startPlaceholder.classList.add('hidden');
    resultsHeader.classList.add('hidden');
    setsGrid.innerHTML = '';
    loadingSpinner.classList.remove('hidden');
    loadingSpinner.classList.add('flex');
}

function showError(show, msg = '') {
    if (show) {
        errorMessage.classList.remove('hidden');
        errorText.innerText = msg;
    } else {
        errorMessage.classList.add('hidden');
    }
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('de-DE', options);
}