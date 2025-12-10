/**
 * POKÉCOLLECTOR - TCG FINDER LOGIC
 * Verbindet PokéAPI (für Übersetzung) und TCG API (für Kartendaten).
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
    // Check ob wir von der Startseite kommen (URL Parameter ?search=...)
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search');
    
    if (searchTerm) {
        searchInput.value = searchTerm;
        handleSearch();
    }

    // Event Listeners
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
    showError(false);
    startPlaceholder.classList.add('hidden');
    resultsHeader.classList.add('hidden');
    setsGrid.innerHTML = '';
    loadingSpinner.classList.remove('hidden'); // Spinner an
    loadingSpinner.classList.add('flex');

    try {
        // SCHRITT 1: Namen übersetzen (Deutsch -> Englisch)
        // Die TCG API funktioniert nur mit englischen Namen.
        const englishName = await getEnglishName(query);
        
        // Update UI Text
        searchedNameEl.innerText = `${query} (${englishName})`;

        // SCHRITT 2: Karten von der TCG API holen
        // Wir holen nur relevante Felder um Daten zu sparen (select=...)
        const tcgRes = await fetch(`${TCG_API_URL}?q=name:"${englishName}"&orderBy=-set.releaseDate&select=id,name,set,images,rarity`);
        const tcgData = await tcgRes.json();

        if (tcgData.count === 0) {
            throw new Error(`Keine Karten für "${query}" gefunden.`);
        }

        // SCHRITT 3: Karten nach Sets gruppieren
        // Die API gibt eine Liste aller Karten zurück. Wir wollen aber wissen, in welchen SETS sie sind.
        const setsMap = groupCardsBySet(tcgData.data);

        // SCHRITT 4: Rendern
        renderSets(setsMap);

    } catch (error) {
        console.error(error);
        showError(true, error.message || "Ein unbekannter Fehler ist aufgetreten.");
        startPlaceholder.classList.remove('hidden');
    } finally {
        loadingSpinner.classList.add('hidden');
        loadingSpinner.classList.remove('flex');
    }
}

/**
 * Versucht den deutschen Namen in den englischen zu übersetzen mittels PokéAPI.
 * Wenn der Name nicht gefunden wird, geben wir den Original-Input zurück (vielleicht war er schon englisch).
 */
async function getEnglishName(inputName) {
    try {
        const cleanName = inputName.toLowerCase();
        const response = await fetch(`${POKE_SPECIES_URL}/${cleanName}`);
        
        if (!response.ok) {
            // Wenn 404, ist es vielleicht schon der englische Name oder ein Tippfehler.
            // Wir versuchen es einfach mit dem Eingabewert.
            return inputName;
        }

        const data = await response.json();
        const englishEntry = data.names.find(n => n.language.name === 'en');
        
        return englishEntry ? englishEntry.name : inputName;
    } catch (e) {
        return inputName; // Fallback
    }
}

/**
 * Gruppiert die rohe Kartenliste nach Set-ID.
 * Berechnet dabei auch, wie viele Karten dieses Pokémons im Set sind.
 */
function groupCardsBySet(cards) {
    const sets = new Map();

    cards.forEach(card => {
        const setId = card.set.id;

        if (!sets.has(setId)) {
            // Set initialisieren
            sets.set(setId, {
                info: card.set, // Set Name, Logo, Release Date
                cards: [] // Die Karten dieses Pokemons in diesem Set
            });
        }

        // Karte zum Set hinzufügen
        sets.get(setId).cards.push({
            name: card.name,
            image: card.images.small,
            rarity: card.rarity
        });
    });

    return sets;
}

// --- RENDERING ---

function renderSets(setsMap) {
    resultsHeader.classList.remove('hidden');
    resultsHeader.classList.add('flex');
    setCountEl.innerText = setsMap.size;

    // Map zu Array umwandeln für Iteration
    const setsArray = Array.from(setsMap.values());

    setsArray.forEach(setObj => {
        const setInfo = setObj.info;
        const cardsInSet = setObj.cards;
        
        // Karte erstellen
        const cardEl = document.createElement('div');
        cardEl.className = "bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full";
        
        // Karten-Preview Bilder (Maximal 3 anzeigen)
        const previewImages = cardsInSet.slice(0, 3).map(c => 
            `<img src="${c.image}" class="w-16 h-24 object-contain -ml-4 first:ml-0 hover:scale-110 transition-transform z-10 shadow-md bg-white rounded" title="${c.name}">`
        ).join('');

        const remainingCount = cardsInSet.length > 3 ? `+${cardsInSet.length - 3}` : '';

        cardEl.innerHTML = `
            <div class="flex justify-between items-start mb-6 h-16">
                <img src="${setInfo.logo}" alt="${setInfo.name}" class="h-full max-w-[70%] object-contain object-left">
                <img src="${setInfo.symbol}" alt="Symbol" class="h-6 w-6 object-contain opacity-60">
            </div>

            <div class="flex-grow">
                <h3 class="text-lg font-bold text-gray-900 mb-1 leading-tight">${setInfo.name}</h3>
                <p class="text-sm text-gray-400 mb-4">Erschienen: ${formatDate(setInfo.releaseDate)}</p>
                
                <div class="bg-blue-50 rounded-xl p-3 mb-4">
                    <p class="text-xs text-tcg-blue font-bold uppercase tracking-wide mb-2">
                        Gefundene Karten (${cardsInSet.length})
                    </p>
                    <div class="flex items-end pl-2">
                        ${previewImages}
                        ${remainingCount ? `<span class="ml-2 text-xs font-bold text-gray-400">${remainingCount}</span>` : ''}
                    </div>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                <span>Serie: ${setInfo.series}</span>
                <span>${setInfo.total} Karten im Set</span>
            </div>
            
            <a href="https://pkmncards.com/set/${setInfo.id}/" target="_blank" class="mt-4 block w-full text-center bg-gray-900 text-white py-2 rounded-xl text-sm font-semibold hover:bg-poke-red transition-colors">
                Set Details ansehen <i class="fa-solid fa-external-link-alt ml-1 text-xs"></i>
            </a>
        `;

        setsGrid.appendChild(cardEl);
    });
}

// --- HELPER ---

function showError(show, msg = '') {
    if (show) {
        errorMessage.classList.remove('hidden');
        errorText.innerText = msg;
    } else {
        errorMessage.classList.add('hidden');
    }
}

function formatDate(dateString) {
    if(!dateString) return 'Unbekannt';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('de-DE', options);
}