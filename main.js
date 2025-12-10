/**
 * POKÉCOLLECTOR - MAIN LOGIC
 * Verwaltet das Laden, Anzeigen und Filtern der Pokémon-Daten.
 */

// --- KONFIGURATION & STATE ---
const API_URL = 'https://pokeapi.co/api/v2/pokemon';
const SPECIES_URL = 'https://pokeapi.co/api/v2/pokemon-species';
let currentOffset = 0;
const limit = 24; // Anzahl der Pokémon pro Ladung
let isLoading = false;
let allLoadedPokemon = []; // Lokaler Speicher für Suche/Filterung

// Mapping für deutsche Typen und Farben
const typeTranslations = {
    normal: { name: 'Normal', color: 'bg-gray-400' },
    fire: { name: 'Feuer', color: 'bg-orange-500' },
    water: { name: 'Wasser', color: 'bg-blue-500' },
    grass: { name: 'Pflanze', color: 'bg-green-500' },
    electric: { name: 'Elektro', color: 'bg-yellow-400' },
    ice: { name: 'Eis', color: 'bg-cyan-300' },
    fighting: { name: 'Kampf', color: 'bg-red-700' },
    poison: { name: 'Gift', color: 'bg-purple-500' },
    ground: { name: 'Boden', color: 'bg-yellow-600' },
    flying: { name: 'Flug', color: 'bg-indigo-400' },
    psychic: { name: 'Psycho', color: 'bg-pink-500' },
    bug: { name: 'Käfer', color: 'bg-lime-500' },
    rock: { name: 'Gestein', color: 'bg-yellow-700' },
    ghost: { name: 'Geist', color: 'bg-purple-700' },
    dragon: { name: 'Drache', color: 'bg-indigo-600' },
    steel: { name: 'Stahl', color: 'bg-gray-500' },
    dark: { name: 'Unlicht', color: 'bg-gray-800' },
    fairy: { name: 'Fee', color: 'bg-pink-300' }
};

// DOM Elemente
const grid = document.getElementById('pokedexGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadedCountEl = document.getElementById('loadedCount');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('pokemonModal');
const modalContent = document.getElementById('modalContent');
const filterContainer = document.getElementById('typeFilters');

// --- INITIALISIERUNG ---
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    fetchPokemonBatch();
    
    // Event Listeners
    loadMoreBtn.addEventListener('click', fetchPokemonBatch);
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
});

/**
 * Erstellt die Filter-Buttons für die Typen
 */
function initFilters() {
    filterContainer.innerHTML = '';
    // "Alle" Button
    const allBtn = document.createElement('button');
    allBtn.className = `px-4 py-2 rounded-full text-sm font-semibold bg-gray-800 text-white shadow hover:shadow-md transition`;
    allBtn.innerText = 'Alle';
    allBtn.onclick = () => filterByType(null);
    filterContainer.appendChild(allBtn);

    // Typ Buttons
    Object.keys(typeTranslations).forEach(typeKey => {
        const btn = document.createElement('button');
        const typeData = typeTranslations[typeKey];
        btn.className = `px-4 py-2 rounded-full text-sm font-semibold text-white shadow hover:shadow-md transition opacity-80 hover:opacity-100 ${typeData.color}`;
        btn.innerText = typeData.name;
        btn.onclick = () => filterByType(typeKey);
        filterContainer.appendChild(btn);
    });
}

// --- API LOGIK ---

/**
 * Lädt einen Batch an Pokémon (Pagination)
 */
async function fetchPokemonBatch() {
    if (isLoading) return;
    isLoading = true;
    loadMoreBtn.innerText = 'Lade Daten...';
    loadMoreBtn.disabled = true;

    try {
        // 1. Hole Liste von IDs/Namen
        const response = await fetch(`${API_URL}?limit=${limit}&offset=${currentOffset}`);
        const data = await response.json();
        
        // 2. Parallel Details für alle Pokémon im Batch holen (Promise.all für Performance)
        const promises = data.results.map(async (pokemon) => {
            return await getFullPokemonData(pokemon.url);
        });

        const newPokemonList = await Promise.all(promises);
        
        // 3. Füge zur globalen Liste hinzu und rendere
        allLoadedPokemon = [...allLoadedPokemon, ...newPokemonList];
        renderPokemon(newPokemonList);

        // State Update
        currentOffset += limit;
        loadedCountEl.innerText = allLoadedPokemon.length;
        
    } catch (error) {
        console.error("Fehler beim Laden:", error);
        alert("Fehler beim Laden der Pokémon. Bitte prüfe deine Internetverbindung.");
    } finally {
        isLoading = false;
        loadMoreBtn.innerText = 'Mehr Pokémon laden';
        loadMoreBtn.disabled = false;
    }
}

/**
 * Holt detaillierte Daten + Deutsche Übersetzung für ein einzelnes Pokémon
 */
async function getFullPokemonData(url) {
    // Basic Data (Stats, Types, ID, Image)
    const res = await fetch(url);
    const data = await res.json();

    // Species Data (Deutscher Name, Beschreibung)
    const speciesRes = await fetch(data.species.url);
    const speciesData = await speciesRes.json();

    // Finde deutschen Namen
    const germanNameObj = speciesData.names.find(n => n.language.name === 'de');
    const germanName = germanNameObj ? germanNameObj.name : data.name;

    // Finde deutsche Beschreibung (Flavor Text)
    const germanDescObj = speciesData.flavor_text_entries.find(e => e.language.name === 'de');
    const description = germanDescObj ? germanDescObj.flavor_text.replace(/[\n\f]/g, ' ') : "Keine Beschreibung verfügbar.";

    // Bild-URL (Official Artwork ist hochwertiger)
    const image = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;

    return {
        id: data.id,
        nameDe: germanName,
        nameEn: data.name,
        types: data.types.map(t => t.type.name),
        stats: data.stats,
        height: data.height / 10, // in Meter
        weight: data.weight / 10, // in kg
        image: image,
        description: description,
        genera: speciesData.genera.find(g => g.language.name === 'de')?.genus || 'Pokémon'
    };
}

// --- RENDERING ---

/**
 * Rendert eine Liste von Pokémon Cards ins Grid
 */
function renderPokemon(list) {
    // Wenn es der erste Load ist, Placeholder entfernen? 
    // Wir hängen einfach an (Grid wird nicht geleert außer bei Filter)
    
    list.forEach(poke => {
        const card = document.createElement('div');
        
        // Bestimme Hauptfarbe basierend auf dem ersten Typ
        const mainType = poke.types[0];
        const typeColorClass = typeTranslations[mainType]?.color || 'bg-gray-400';
        
        // Erstelle Type Badges HTML
        const badgesHtml = poke.types.map(t => {
            const tData = typeTranslations[t] || { name: t, color: 'bg-gray-400' };
            return `<span class="px-2 py-1 rounded-md text-xs text-white font-bold ${tData.color} shadow-sm">${tData.name}</span>`;
        }).join(' ');

        card.className = "group bg-white rounded-3xl p-4 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer flex flex-col items-center relative overflow-hidden";
        card.onclick = () => openModal(poke);

        card.innerHTML = `
            <div class="absolute top-4 right-4 text-gray-300 font-bold text-xl opacity-50 group-hover:opacity-100 transition">#${String(poke.id).padStart(3, '0')}</div>
            
            <div class="z-10 bg-gray-50 rounded-full p-4 mb-4 mt-2 group-hover:scale-110 transition-transform duration-300 w-40 h-40 flex items-center justify-center">
                <img src="${poke.image}" alt="${poke.nameDe}" class="w-full h-full object-contain drop-shadow-md" loading="lazy">
            </div>
            
            <div class="text-center w-full z-10">
                <h3 class="text-xl font-bold text-gray-800 mb-1 group-hover:text-poke-red transition-colors">${poke.nameDe}</h3>
                <div class="flex justify-center gap-2 mt-2">
                    ${badgesHtml}
                </div>
            </div>

            <div class="absolute -bottom-10 -left-10 w-32 h-32 ${typeColorClass} rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition"></div>
        `;
        
        grid.appendChild(card);
    });
}

// --- SUCHE & FILTER ---

/**
 * Filtert die BEREITS GELADENEN Pokémon.
 * Hinweis: Eine Suche über ALLE 1000+ Pokémon via API auf Deutsch ist ohne Backend 
 * komplex. Wir filtern hier "live" den aktuellen View und laden bei Bedarf nach.
 */
function handleSearch(query) {
    const term = query.toLowerCase();
    
    // Grid leeren
    grid.innerHTML = '';

    // Filtern
    const filtered = allLoadedPokemon.filter(poke => {
        return poke.nameDe.toLowerCase().includes(term) || 
               poke.nameEn.toLowerCase().includes(term) ||
               String(poke.id) === term;
    });

    if(filtered.length === 0 && term.length > 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Keine Pokémon geladen, die "${query}" heißen.<br>Versuche "Mehr laden" zu klicken oder suche nach dem englischen Namen.</div>`;
    } else {
        renderPokemon(filtered);
    }
}

function filterByType(typeKey) {
    grid.innerHTML = '';
    if (!typeKey) {
        renderPokemon(allLoadedPokemon);
        return;
    }
    const filtered = allLoadedPokemon.filter(poke => poke.types.includes(typeKey));
    renderPokemon(filtered);
}


// --- MODAL ---

function openModal(poke) {
    const mainType = poke.types[0];
    const typeColor = typeTranslations[mainType]?.color || 'bg-gray-500';

    // Generiere Stats Balken
    const statsHtml = poke.stats.map(s => {
        // Name vereinfachen
        let sName = s.stat.name.replace('special-', 'Sp. ').replace('attack', 'Ang').replace('defense', 'Vert').replace('speed', 'Init').toUpperCase();
        let val = s.base_stat;
        let percent = Math.min((val / 150) * 100, 100); // Max grob 150
        
        return `
            <div class="mb-2">
                <div class="flex justify-between text-xs font-bold text-gray-500 mb-1">
                    <span>${sName}</span>
                    <span>${val}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="${typeColor} h-2 rounded-full" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // HTML Content
    const content = `
        <div class="text-center">
            <div class="mx-auto w-48 h-48 bg-gray-50 rounded-full p-2 mb-4 shadow-inner flex items-center justify-center relative">
                <img src="${poke.image}" class="w-full h-full object-contain drop-shadow-xl z-10">
                <div class="absolute inset-0 ${typeColor} opacity-20 blur-xl rounded-full"></div>
            </div>
            
            <h2 class="text-3xl font-bold text-gray-900 mb-1">${poke.nameDe}</h2>
            <p class="text-gray-500 font-medium mb-4">${poke.genera}</p>
            
            <div class="flex justify-center gap-2 mb-6">
                ${poke.types.map(t => `<span class="px-3 py-1 rounded-lg text-white text-sm font-bold ${typeTranslations[t]?.color}">${typeTranslations[t]?.name}</span>`).join('')}
            </div>

            <p class="text-gray-600 italic mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
                "${poke.description}"
            </p>

            <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div class="bg-gray-50 p-3 rounded-xl">
                    <span class="block text-gray-400 text-xs">GRÖSSE</span>
                    <span class="font-bold text-lg text-gray-800">${poke.height} m</span>
                </div>
                <div class="bg-gray-50 p-3 rounded-xl">
                    <span class="block text-gray-400 text-xs">GEWICHT</span>
                    <span class="font-bold text-lg text-gray-800">${poke.weight} kg</span>
                </div>
            </div>

            <div class="text-left bg-gray-50 p-4 rounded-2xl">
                <h4 class="font-bold text-gray-800 mb-3">Basiswerte</h4>
                ${statsHtml}
            </div>
        </div>
    `;

    // Modal befüllen
    modalContent.innerHTML = content;
    
    // TCG Link updaten
    const tcgLink = document.getElementById('modalTcgLink');
    // Wir übergeben den Namen als URL Parameter für bessere UX auf der zweiten Seite (optional, aber nice)
    tcgLink.href = `tcg.html?search=${poke.nameDe}`; 
    
    // Anzeigen
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
}