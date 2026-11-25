import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import {
    climateExperience,
    missionPage,
    pollutionPage,
    footprintPage,
    algorithmPage,
    bindInteractive
} from './interactive.js';

const API = 'http://localhost:8081/api/v2';
const app = document.querySelector('#app');

const $ = selector => document.querySelector(selector);
const fmt = n => Number(n).toLocaleString('en-IN');

const state = {
    districts: [],
    projects: [],
    missions: [],
    selected: 'pune',
    scenario: '0',
    rain: 0,
    capacity: 100,
    demand: 100,
    budget: 50,
    extra: false,
    result: null,
    applied: null,
    page: 'dashboard',
    map: null,
    busy: false,
    theme: localStorage.getItem('aqua-theme-natural') || 'light',
    layer: 'scarcity',
    compare: 'chennai'
};

const pages = [
    ['dashboard', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8 M5 10v11h14V10 M10 21v-7h4v7"/></svg>', 'National Dashboard'],
    ['map', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3Z M9 3v15 M15 6v15"/></svg>', 'India Water Atlas'],
    ['climate', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2"/></svg>', 'Climate Experience'],
    ['network', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h5v5H3Z M16 14h5v5h-5Z M8 7h7v9h1 M5 10v9h7"/></svg>', 'Water Allocation'],
    ['solutions', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4C7 3 3 10 6 17c7 4 14-2 14-13Z M4 21L16 9"/></svg>', 'Solution Planner'],
    ['forecast', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18v15H3Z M7 3v6 M17 3v6 M3 11h18"/></svg>', 'Future Water Plan'],
    ['pollution', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6 M10 3v7L4 20h16l-6-10V3 M7 15h10"/></svg>', 'Pollution Lab'],
    ['game', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10l4 9-2 3-5-4h-4l-5 4-2-3Z M7 10v4 M5 12h4 M16 11h.1 M18 13h.1"/></svg>', 'Save Your District'],
    ['footprint', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/></svg>', 'My Water Footprint'],
    ['quality', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 15l6 6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0"/></svg>', 'Quality Explorer'],
    ['algorithms', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18 M7 16v-5 M12 16V7 M17 16V4"/></svg>', 'Algorithm Visualizer']
];

async function fetchJSON(path, options) {
    const response = await fetch(API + path, options);

    if (!response.ok) {
        throw new Error(
            'Server returned error ' + response.status
        );
    }

    return response.json();
}

function post(path, body) {
    return fetchJSON(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function selectedDistrict() {
    return state.districts.find(
        d => d.id === state.selected
    ) || state.districts[0];
}

function currentInputs() {
    return {
        districtId: state.selected,
        rainfallReduction: state.rain,
        capacityPercent: state.capacity,
        demandPercent: state.demand,
        budget: state.budget,
        extraSource: state.extra
    };
}

async function simulate() {
    const inputs = currentInputs();

    state.result = await post('/simulate', inputs);
    state.applied = { ...inputs };
}

async function runSimulation() {
    if (state.busy) return;

    state.busy = true;

    const controls = document.querySelectorAll(
        '.controls input, .controls select, .controls button'
    );

    controls.forEach(el => el.disabled = true);

    if ($('#run')) {
        $('#run').textContent = 'Calculating...';
    }

    try {
        await simulate();
        state.busy = false;
        render();

    } catch (error) {
        state.busy = false;

        controls.forEach(el => el.disabled = false);

        if ($('#run')) {
            $('#run').textContent = 'Run Java Analysis';
        }

        if ($('#simulation-error')) {
            $('#simulation-error').textContent =
                error.message;
        } else {
            alert(error.message);
        }
    }
}

function pending() {
    if (!state.applied) return true;

    const inputs = currentInputs();

    return Object.keys(inputs).some(
        key => inputs[key] !== state.applied[key]
    );
}

function updatePending() {
    const el = $('#scenario-status');

    if (!el) return;

    el.textContent = pending()
        ? 'Changes pending. Run Java Analysis.'
        : 'Results are up to date';

    el.style.color = pending()
        ? '#e9a34b'
        : 'var(--accent)';
}

function heading(title, description) {
    return `
        <div class="heading">
            <span class="eyebrow">
                AQUAWISE 3.0 · WATER INTELLIGENCE
            </span>

            <h1>${title}</h1>
            <p>${description}</p>
        </div>
    `;
}

function metric(label, value, note = '') {
    return `
        <div class="metric">
            <span>${label}</span>
            <strong>${value}</strong>
            <small>${note}</small>
        </div>
    `;
}

function progress(label, value, total) {
    const percent = total
        ? Math.max(0, Math.min(100, value / total * 100))
        : 0;

    return `
        <div class="bar-row">
            <span>${label}</span>
            <strong>${fmt(value)} / ${fmt(total)}</strong>
        </div>

        <div class="track">
            <div style="width:${percent}%"></div>
        </div>
    `;
}

function slider(id, label, value, min, max, suffix) {
    return `
        <label class="field">
            ${label}
            <b id="${id}-value">${value}${suffix}</b>

            <input type="range"
                id="${id}"
                min="${min}"
                max="${max}"
                value="${value}"
                data-suffix="${suffix}">
        </label>
    `;
}

function districtOptions(value = state.selected) {
    return state.districts.map(d => `
        <option value="${d.id}"
            ${d.id === value ? 'selected' : ''}>
            ${d.name}, ${d.state}
        </option>
    `).join('');
}

function shell() {
    document.documentElement.dataset.theme = state.theme;

    app.innerHTML = `
        <div class="layout" data-page="${state.page}">

            <aside>

                <div class="brand">
                    <div class="brand-symbol"><svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/></svg></div>

                    <div>
                        Aqua<span>Wise</span>
                        <small>WATER INTELLIGENCE 3.0</small>
                    </div>
                </div>

                <div class="nav-label">EXPLORE</div>

                <nav class="nav">
                    ${pages.map(([id, icon, label]) => `
                        <button data-go="${id}"
                            class="${state.page === id
                                ? 'active' : ''}">
                            <span>${icon}</span>
                            ${label}
                        </button>
                    `).join('')}
                </nav>

                <div class="aside-note">
                    <div class="water-drop"><svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/></svg></div>
                    <h3>Every drop matters.</h3>

                    <p>
                        Understand the crisis.
                        Make better decisions.
                        Build a water-resilient future.
                    </p>
                </div>

            </aside>

            <main>
                <header>
                    <div>
                        <span class="eyebrow">
                            INDIA · CLIMATE · WATER
                        </span>
                    </div>

                    <div class="header-actions">
                        <span class="online">
                            ● Java engine connected
                        </span>

                        <button id="theme-toggle"
                            class="theme-button">
                            ${state.theme === 'dark'
                                ? '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2"/></svg> Light' : '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/></svg> Dark'}
                        </button>
                    </div>
                </header>

                <div id="view"></div>
            </main>

        </div>
    `;
}

function controls() {
    return `
        <div class="panel controls">

            <span class="eyebrow">SCENARIO BUILDER</span>
            <h3>Planning controls</h3>

            <label class="field">
                Select district
                <select id="district">
                    ${districtOptions()}
                </select>
            </label>

            <label class="field">
                Climate scenario

                <select id="scenario">
                    ${[
                        ['0', 'Normal rainfall'],
                        ['15', 'Moderate rainfall deficit'],
                        ['25', 'El Niño stress scenario'],
                        ['40', 'Severe drought scenario'],
                        ['custom', 'Custom scenario']
                    ].map(([v, name]) => `
                        <option value="${v}"
                            ${state.scenario === v
                                ? 'selected' : ''}>
                            ${name}
                        </option>
                    `).join('')}
                </select>
            </label>

            ${slider(
                'rain', 'Assumed rainfall reduction',
                state.rain, 0, 60, '%'
            )}

            ${slider(
                'capacity', 'Pipeline capacity',
                state.capacity, 10, 100, '%'
            )}

            ${slider(
                'demand', 'Water demand',
                state.demand, 50, 150, '%'
            )}

            ${slider(
                'budget', 'Conservation budget',
                state.budget, 0, 150, ' Cr'
            )}

            <label class="toggle">
                <input type="checkbox" id="extra"
                    ${state.extra ? 'checked' : ''}>

                Enable emergency water source
            </label>

            <button id="run" class="primary">
                Run analysis
            </button>

            <button id="reset" class="secondary">
                Reset Scenario
            </button>

            <p id="scenario-status" class="note"></p>

            <div id="simulation-error"
                class="error-text"></div>
        </div>
    `;
}

function bindControls() {
    if (!$('#district')) return;

    $('#district').onchange = e => {
        state.selected = e.target.value;
        updatePending();
        runSimulation();
    };

    $('#scenario').onchange = e => {
        state.scenario = e.target.value;

        if (state.scenario !== 'custom') {
            state.rain = Number(state.scenario);
            $('#rain').value = state.rain;
            $('#rain-value').textContent =
                state.rain + '%';
        }

        updatePending();
    };

    ['rain', 'capacity', 'demand', 'budget']
        .forEach(id => {

            const el = $('#' + id);

            el.oninput = e => {
                state[id] = Number(e.target.value);

                $('#' + id + '-value').textContent =
                    state[id] + el.dataset.suffix;

                if (id === 'rain') {
                    state.scenario = 'custom';
                    $('#scenario').value = 'custom';
                }

                updatePending();
            };
        });

    $('#extra').onchange = e => {
        state.extra = e.target.checked;
        updatePending();
    };

    $('#run').onclick = runSimulation;

    $('#reset').onclick = () => {
        state.scenario = '0';
        state.rain = 0;
        state.capacity = 100;
        state.demand = 100;
        state.budget = 50;
        state.extra = false;

        runSimulation();
    };

    updatePending();
}

function results() {
    const r = state.result;

    if (!r) {
        return '<div class="panel">Run analysis first.</div>';
    }

    return `
        <div class="panel">
            <span class="eyebrow">SIMULATION RESULTS</span>

            <h2>${r.district.name}</h2>

            <p>
                ${r.district.state} ·
                ${state.applied.rainfallReduction}%
                assumed rainfall reduction
            </p>

            <div class="metrics two">

                ${metric(
                    'Local water supply',
                    fmt(r.available),
                    'ML/day'
                )}

                ${metric(
                    'Emergency supply',
                    fmt(r.extraSupply),
                    'ML/day'
                )}

                ${metric(
                    'Total demand',
                    fmt(r.demand),
                    'ML/day'
                )}

                ${metric(
                    'Water delivered',
                    fmt(r.delivered),
                    'ML/day'
                )}

                ${metric(
                    'Water shortage',
                    fmt(r.unmet),
                    'ML/day'
                )}

                ${metric(
                    'Demand coverage',
                    r.coverage + '%',
                    'Maximum feasible delivery'
                )}

            </div>

            ${progress(
                'Overall coverage',
                r.delivered,
                r.demand
            )}

            <h3 class="section-title">
                Sector-wise water distribution
            </h3>

            ${Object.entries(r.allocation).map(
                ([name, data]) => progress(
                    name,
                    data.delivered,
                    data.demand
                )
            ).join('')}

            <p class="note">
                Units: million litres per day (ML/day).
                Maximum flow optimizes total delivery,
                not fairness between sectors.
            </p>
        </div>
    `;
}

// ==========================================
// NATIONAL DASHBOARD
// ==========================================

function dashboard() {
    const supply = state.districts.reduce(
        (sum, d) => sum + d.supply, 0
    );

    const demand = state.districts.reduce(
        (sum, d) => sum + d.demand, 0
    );

    const shortage = state.districts.reduce(
        (sum, d) => sum +
            Math.max(0, d.demand - d.supply), 0
    );

    return heading(
        'Water, climate and communities',
        'Explore water scarcity, experience climate change and become part of the solution.'
    ) + `

        <div class="hero">
            <div class="hero-content">
                <span class="eyebrow">
                    INDIA WATER RESILIENCE
                </span>

                <h2>
                    Understanding our
                    water future.
                </h2>

                <p>
                    Experience changing rainfall,
                    manage district water crises,
                    investigate pollution and discover
                    sustainable solutions.
                </p>

                <div class="button-row">
                    <button class="primary" data-go="climate">
                        Experience El Niño ↗
                    </button>

                    <button class="secondary" data-go="game">
                        Play a water mission
                    </button>
                </div>
            </div>

            <div class="lake-ripples" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>

        <div class="metrics">

            ${metric(
                'Districts covered',
                state.districts.length,
                'Selected Indian districts'
            )}

            ${metric(
                'Baseline supply',
                fmt(supply),
                'ML/day'
            )}

            ${metric(
                'Baseline demand',
                fmt(demand),
                'ML/day'
            )}

            ${metric(
                'Baseline shortage',
                fmt(shortage),
                'ML/day'
            )}

        </div>

        <div class="panel">
            <h3>Water security overview</h3>

            ${progress(
                'Combined baseline supply',
                supply,
                demand
            )}

            <p class="note">
                These totals represent the selected
                simulated districts, not all of India.
            </p>
        </div>

        <h2>Explore the tools</h2>

        <div class="feature-grid">

            ${[
                ['map', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3Z M9 3v15 M15 6v15"/></svg>', 'Explore India',
                    'Compare water stress across districts.'],

                ['climate', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16a4 4 0 1 1 1-8 6 6 0 0 1 11 1 4 4 0 0 1 1 8H5 M8 19l-1 2 M13 19l-1 2"/></svg>', 'Experience El Niño',
                    'Watch a landscape respond to changing rainfall.'],

                ['game', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10l4 9-2 3-5-4h-4l-5 4-2-3Z M7 10v4 M5 12h4 M16 11h.1 M18 13h.1"/></svg>', 'Save Your District',
                    'Become a water manager and complete missions.'],

                ['pollution', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6 M10 3v7L4 20h16l-6-10V3 M7 15h10"/></svg>', 'Pollution Detective',
                    'Investigate simulated water contamination.'],

                ['footprint', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/></svg>', 'Your Water Footprint',
                    'Discover how much water you use every day.'],

                ['network', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h5v5H3Z M16 14h5v5h-5Z M8 7h7v9h1 M5 10v9h7"/></svg>', 'Water Allocation',
                    'Explore how water moves through pipelines.'],

                ['solutions', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4C7 3 3 10 6 17c7 4 14-2 14-13Z M4 21L16 9"/></svg>', 'Solution Planner',
                    'Find the best conservation investments.'],

                ['forecast', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18v15H3Z M7 3v6 M17 3v6 M3 11h18"/></svg>', 'Future Water Plan',
                    'Explore 30, 60 and 90-day scenarios.'],

                ['quality', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 15l6 6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0"/></svg>', 'Quality Explorer',
                    'Search districts and verify report IDs.'],

                ['algorithms', '<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18 M7 16v-5 M12 16V7 M17 16V4"/></svg>', 'Inside the Algorithms',
                    'Watch Java algorithms solve problems.']

            ].map(([id, icon, title, desc]) => `
                <button class="feature" data-go="${id}">
                    <div class="feature-icon">${icon}</div>
                    <h3>${title}</h3>
                    <p>${desc}</p>
                    <span>Open tool →</span>
                </button>
            `).join('')}

        </div>

        <div class="panel">
            <h3>Official information resources</h3>

            <div class="source-links">
                <a href="https://mausam.imd.gov.in/"
                    target="_blank" rel="noopener">
                    India Meteorological Department ↗
                </a>

                <a href="https://cgwb.gov.in/"
                    target="_blank" rel="noopener">
                    Central Ground Water Board ↗
                </a>

                <a href="https://cpcb.nic.in/"
                    target="_blank" rel="noopener">
                    Central Pollution Control Board ↗
                </a>

                <a href="https://www.climate.gov/"
                    target="_blank" rel="noopener">
                    NOAA Climate Information ↗
                </a>
            </div>

            <p class="note">
                External resources. Live measurements
                are not automatically imported.
            </p>
        </div>
    `;
}

// ==========================================
// INDIA WATER ATLAS
// ==========================================

function districtEstimate(d) {
    const supply = Math.round(
        d.supply * (1 - 0.7 * state.rain / 100)
    );

    const demand = Math.round(
        d.demand * state.demand / 100
    );

    const extra = state.extra
        ? Math.round(d.supply * 0.20)
        : 0;

    const household = Math.floor(demand * 0.42);
    const agriculture = Math.floor(demand * 0.34);

    const industry =
        demand - household - agriculture;

    const capacity = [
        household, agriculture, industry
    ].reduce((sum, n) =>
        sum + Math.round(n * state.capacity / 100), 0
    );

    const delivered = Math.min(
        supply + extra, demand, capacity
    );

    return {
        supply,
        demand,
        delivered,
        shortage: demand - delivered,
        ratio: (demand - delivered) / demand
    };
}

function riskColor(ratio) {
    if (ratio > 0.35) return '#ff767b';
    if (ratio > 0.20) return '#f8c45e';
    return '#43d9ad';
}

function mapPage() {
    const d = selectedDistrict();

    const other = state.districts.find(
        item => item.id === state.compare
    ) || state.districts[0];

    const a = districtEstimate(d);
    const b = districtEstimate(other);

    return heading(
        'India Water Atlas',
        'Explore modeled water availability and compare the challenges faced by different Indian districts.'
    ) + `

        <div class="panel">

            <div class="atlas-toolbar">

                <label class="field">
                    Map layer

                    <select id="map-layer">
                        ${[
                            ['scarcity', 'Water scarcity'],
                            ['climate', 'Climate-related supply loss'],
                            ['household', 'Household demand'],
                            ['agriculture', 'Agricultural demand'],
                            ['conservation', 'Conservation need']
                        ].map(([id, name]) => `
                            <option value="${id}"
                                ${state.layer === id
                                    ? 'selected' : ''}>
                                ${name}
                            </option>
                        `).join('')}
                    </select>
                </label>

                <label class="field">
                    Rainfall reduction

                    <select id="atlas-rain">
                        ${[0, 15, 25, 40, 60].map(n => `
                            <option value="${n}"
                                ${state.rain === n
                                    ? 'selected' : ''}>
                                ${n}%
                            </option>
                        `).join('')}

                        ${![0,15,25,40,60].includes(state.rain)
                            ? `<option selected
                                value="${state.rain}">
                                ${state.rain}% custom
                               </option>` : ''}
                    </select>
                </label>

            </div>

            <div id="map"></div>

            <div class="legend">
                <span><i style="background:#43d9ad"></i>Low</span>
                <span><i style="background:#f8c45e"></i>Moderate</span>
                <span><i style="background:#ff767b"></i>High</span>
            </div>

            <p class="note">
                Marker colours represent the selected
                modeled indicator. District markers
                are not administrative boundaries.
            </p>
        </div>

        <div class="panel">
            <h2>Compare two districts</h2>

            <div class="equal-columns">

                <div>
                    <label class="field">
                        First district
                        <select id="compare-first">
                            ${districtOptions(state.selected)}
                        </select>
                    </label>

                    ${metric(
                        d.name,
                        fmt(a.shortage),
                        'Shortage · ML/day'
                    )}

                    ${progress(
                        'Water delivered',
                        a.delivered,
                        a.demand
                    )}
                </div>

                <div>
                    <label class="field">
                        Second district
                        <select id="compare-second">
                            ${districtOptions(state.compare)}
                        </select>
                    </label>

                    ${metric(
                        other.name,
                        fmt(b.shortage),
                        'Shortage · ML/day'
                    )}

                    ${progress(
                        'Water delivered',
                        b.delivered,
                        b.demand
                    )}
                </div>

            </div>

            <button class="primary" id="analyze-district">
                Analyze ${d.name} ↗
            </button>
        </div>

        <div class="panel">
            <h3>District water overview</h3>

            <div class="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>District</th>
                            <th>Supply</th>
                            <th>Demand</th>
                            <th>Delivered</th>
                            <th>Shortage</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${state.districts.map(d => {
                            const e = districtEstimate(d);

                            return `
                                <tr>
                                    <td>${d.name}</td>
                                    <td>${fmt(e.supply)}</td>
                                    <td>${fmt(e.demand)}</td>
                                    <td>${fmt(e.delivered)}</td>
                                    <td style="color:${riskColor(e.ratio)}">
                                        ${fmt(e.shortage)}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <p class="note">
                All quantities in ML/day.
                Atlas values are client-side scenario estimates.
            </p>
        </div>
    `;
}

function drawMap() {
    state.map = L.map('map').setView([22.5, 79], 5);

    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors'
        }
    ).addTo(state.map);

    for (const d of state.districts) {
        const e = districtEstimate(d);

        let indicator = e.ratio;
        let detail = `Shortage: ${e.shortage} ML/day`;

        if (state.layer === 'climate') {
            const loss = d.supply - e.supply;
            indicator = loss / d.supply;
            detail = `Climate supply loss: ${loss} ML/day`;
        }

        if (state.layer === 'household') {
            const need = Math.floor(e.demand * 0.42);
            indicator = need / 1000;
            detail = `Household demand: ${need} ML/day`;
        }

        if (state.layer === 'agriculture') {
            const need = Math.floor(e.demand * 0.34);
            indicator = need / 800;
            detail = `Agricultural demand: ${need} ML/day`;
        }

        if (state.layer === 'conservation') {
            indicator = e.shortage / 1000;
            detail = `Conservation need: ${e.shortage} ML/day`;
        }

        const marker = L.circleMarker(
            [d.lat, d.lon],
            {
                radius: d.id === state.selected ? 14 : 10,
                color: '#ffffff',
                weight: 2,
                fillColor: riskColor(indicator),
                fillOpacity: 0.9
            }
        ).addTo(state.map);

        marker.bindTooltip(
            `<b>${d.name}</b><br>${detail}`
        );

        marker.on('click', () => {
            state.selected = d.id;
            render();
        });
    }

    setTimeout(() => state.map?.invalidateSize(), 100);

    $('#map-layer').onchange = e => {
        state.layer = e.target.value;
        render();
    };

    $('#atlas-rain').onchange = e => {
        state.rain = Number(e.target.value);
        state.scenario = String(state.rain);
        render();
    };

    $('#compare-first').onchange = e => {
        state.selected = e.target.value;
        render();
    };

    $('#compare-second').onchange = e => {
        state.compare = e.target.value;
        render();
    };

    $('#analyze-district').onclick = () => {
        state.page = 'climate';
        runSimulation();
    };
}

// ==========================================
// CLIMATE EXPERIENCE
// ==========================================

function climate() {
    return heading(
        'Experience El Niño',
        'Change rainfall conditions and watch how a simulated landscape and its water resources respond.'
    ) + climateExperience(state) + `

        <div class="columns">
            ${controls()}
            ${results()}
        </div>
    `;
}

// ==========================================
// WATER ALLOCATION
// ==========================================

function networkDiagram(r) {
    const sectors = Object.entries(r.allocation);

    return `
        <svg class="diagram" viewBox="0 0 800 340">

            <path class="pipe"
                d="M160 90 L330 170"/>

            <path class="${r.extraSupply
                ? 'pipe' : 'inactive-pipe'}"
                d="M160 250 L330 170"/>

            ${sectors.map(([name, data], i) => `
                <path
                    class="${data.delivered > 0
                        ? 'pipe' : 'inactive-pipe'}"
                    d="M430 170 L620 ${65 + i * 105}"
                    style="stroke-width:${data.delivered > 0
                        ? 3 + data.delivered / 90 : 2}"/>
            `).join('')}

            <g class="node">
                <rect x="20" y="50"
                    width="150" height="80" rx="16"/>

                <text x="95" y="82" text-anchor="middle">
                    Local source
                </text>

                <text x="95" y="105" text-anchor="middle">
                    ${r.available} ML/day
                </text>
            </g>

            <g class="node">
                <rect x="20" y="210"
                    width="150" height="80" rx="16"/>

                <text x="95" y="242" text-anchor="middle">
                    Emergency
                </text>

                <text x="95" y="265" text-anchor="middle">
                    ${r.extraSupply} ML/day
                </text>
            </g>

            <g class="node">
                <rect x="320" y="130"
                    width="130" height="80" rx="16"/>

                <text x="385" y="162" text-anchor="middle">
                    Treatment hub
                </text>

                <text x="385" y="185" text-anchor="middle">
                    ${r.delivered} ML/day
                </text>
            </g>

            ${sectors.map(([name, data], i) => `
                <g class="node">
                    <rect x="610" y="${25 + i * 105}"
                        width="170" height="80" rx="16"/>

                    <text x="695" y="${55 + i * 105}"
                        text-anchor="middle">
                        ${name}
                    </text>

                    <text x="695" y="${78 + i * 105}"
                        text-anchor="middle">
                        ${data.delivered} / ${data.demand}
                    </text>
                </g>
            `).join('')}

        </svg>
    `;
}

function network() {
    return heading(
        'Water Allocation',
        'Follow water through an animated distribution network powered by the Edmonds–Karp maximum-flow algorithm.'
    ) + `

        <div class="panel">
            <h3>Water distribution network</h3>

            ${networkDiagram(state.result)}

            <p class="note">
                Moving lines indicate active delivery paths.
                Sector values come from the Java simulation.
            </p>
        </div>

        <div class="columns">
            ${controls()}
            ${results()}
        </div>

        <button class="primary" data-go="algorithms">
            Explore the algorithm ↗
        </button>
    `;
}

// ==========================================
// SOLUTION PLANNER
// ==========================================

function solutions() {
    const r = state.result;

    return heading(
        'Solution Planner',
        'Discover which conservation projects provide the greatest modeled water savings within your budget.'
    ) + `

        <div class="columns">

            ${controls()}

            <div>

                <div class="panel">
                    <span class="eyebrow">
                        JAVA · 0/1 KNAPSACK
                    </span>

                    <h2>Recommended investment plan</h2>

                    <div class="metrics two">
                        ${metric(
                            'Investment',
                            '₹' + r.plan.cost + ' Cr',
                            'Illustrative project costs'
                        )}

                        ${metric(
                            'Potential savings',
                            r.plan.savings,
                            'ML/day'
                        )}

                        ${metric(
                            'Current shortage',
                            r.unmet,
                            'ML/day'
                        )}

                        ${metric(
                            'Remaining shortage',
                            r.afterPlanShortage,
                            'ML/day after assumed savings'
                        )}
                    </div>

                    ${r.plan.projects.length
                        ? r.plan.projects.map(p => `
                            <div class="project">
                                <div>
                                    <strong>${p.name}</strong>
                                    <p>Investment: ₹${p.cost} Cr</p>
                                </div>

                                <span>+${p.saving} ML/day</span>
                            </div>
                        `).join('')
                        : '<p>No projects fit this budget.</p>'}

                    <p class="note">
                        Savings are assumed to be additive
                        and fully realized. Actual projects
                        require engineering and feasibility studies.
                    </p>
                </div>

                <div class="panel">
                    <h3>Identified challenges</h3>

                    ${r.problems.map(p => `
                        <div class="problem">${p}</div>
                    `).join('')}

                    <h3>Suggested responses</h3>

                    ${r.solutions.map(s => `
                        <div class="solution">${s}</div>
                    `).join('')}
                </div>

            </div>
        </div>

        <button class="primary" data-go="game">
            Try making your own decisions ↗
        </button>
    `;
}

// ==========================================
// FUTURE WATER PLAN
// ==========================================

function forecast() {
    const r = state.result;

    return heading(
        'Future Water Plan',
        'Explore how continued rainfall stress could affect water availability over the next 30, 60 and 90 days.'
    ) + `

        <div class="columns">

            ${controls()}

            <div class="panel">

                <h2>${r.district.name} resilience timeline</h2>

                <div class="timeline">

                    ${r.forecast.map((f, i) => `
                        <div class="timeline-item">

                            <div class="timeline-dot">${i + 1}</div>

                            <div class="timeline-content">
                                <span class="eyebrow">
                                    DAY ${f.days}
                                </span>

                                <h2>
                                    ${fmt(f.estimatedShortage)}
                                    ML/day
                                </h2>

                                <p>Estimated shortage</p>

                                ${progress(
                                    'Estimated delivery',
                                    f.estimatedDelivered,
                                    r.demand
                                )}

                                <h3>Suggested action</h3>

                                <p>${[
                                    'Inspect distribution leaks and introduce conservation measures.',
                                    'Review supplementary supply and implement priority conservation projects.',
                                    'Evaluate long-term storage, reuse and recharge infrastructure.'
                                ][i]}</p>
                            </div>

                        </div>
                    `).join('')}

                </div>

                <div class="notice">
                    These are conditional model projections,
                    not official weather forecasts.
                </div>

            </div>
        </div>
    `;
}

// ==========================================
// QUALITY EXPLORER
// ==========================================

function quality() {
    return heading(
        'Quality Explorer',
        'Find districts instantly and investigate the membership of simulated water-monitoring report IDs.'
    ) + `

        <div class="equal-columns">

            <div class="panel">
                <span class="eyebrow">TRIE SEARCH</span>
                <h2>Find a district</h2>

                <input id="search"
                    placeholder="Try Pu, Mum or Chen">

                <div id="suggestions" class="suggestions">
                    Start typing to discover districts.
                </div>

                <p class="note">
                    Java traverses a prefix tree instead
                    of scanning every district name.
                </p>
            </div>

            <div class="panel">
                <span class="eyebrow">BLOOM FILTER</span>
                <h2>Verify a report ID</h2>

                <input id="report" value="WQ-PUNE">

                <button class="primary" id="verify">
                    Verify report
                </button>

                <div id="verify-output"></div>

                <p class="note">
                    Report IDs are synthetic. Membership
                    does not certify water safety.
                </p>
            </div>

        </div>

        <div class="panel">
            <h3>Try these sample IDs</h3>

            <div class="button-row">
                ${['WQ-PUNE', 'WQ-MUMBAI', 'WQ-CHENNAI',
                    'WQ-XYZ'].map(id => `
                    <button class="secondary"
                        data-report="${id}">
                        ${id}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function bindQuality() {
    let timer;

    $('#search').oninput = e => {
        clearTimeout(timer);

        const query = e.target.value;

        timer = setTimeout(async () => {
            try {
                const names = await fetchJSON(
                    '/search?q=' + encodeURIComponent(query)
                );

                if (!$('#suggestions') ||
                    $('#search').value !== query) return;

                $('#suggestions').innerHTML = names.length
                    ? names.map(n => `
                        <div class="suggestion-item">
                            ${escapeHTML(n)}
                        </div>
                    `).join('')
                    : 'No matching district';

            } catch (error) {
                if ($('#suggestions')) {
                    $('#suggestions').textContent =
                        error.message;
                }
            }
        }, 180);
    };

    $('#verify').onclick = async () => {
        const output = $('#verify-output');

        output.textContent = 'Checking...';

        try {
            const r = await fetchJSON(
                '/verify?id=' +
                encodeURIComponent($('#report').value)
            );

            output.innerHTML = `
                <div class="notice">
                    <strong>Bloom filter:</strong>
                    ${r.bloomPossiblyPresent
                        ? 'Possibly present'
                        : 'Definitely absent'}

                    <br>

                    <strong>Exact verification:</strong>
                    ${r.exactFound
                        ? 'Report found'
                        : 'Report not found'}
                </div>

                <div class="bit-grid">
                    ${r.positions.map(p => `
                        <div class="bit ${p.bit ? 'set' : ''}">
                            <strong>${p.bit}</strong>
                            <small>Index ${p.position}</small>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            output.textContent = error.message;
        }
    };

    document.querySelectorAll('[data-report]')
        .forEach(button => {
            button.onclick = () => {
                $('#report').value = button.dataset.report;
                $('#verify').click();
            };
        });
}

// ==========================================
// PAGE RENDERING
// ==========================================

const context = {
    state,
    $,
    fmt,
    fetchJSON,
    post,
    heading,
    metric,
    progress,
    slider,
    districtOptions,
    escapeHTML,
    runSimulation,
    render
};

function render() {
    if (state.map) {
        state.map.remove();
        state.map = null;
    }

    shell();

    const views = {
        dashboard,
        map: mapPage,
        climate,
        network,
        solutions,
        forecast,
        quality,

        game: () => missionPage(context),
        pollution: () => pollutionPage(context),
        footprint: () => footprintPage(context),
        algorithms: () => algorithmPage(context)
    };

    $('#view').innerHTML = views[state.page]() + `

        <footer>
            <strong>AquaWise 3.0</strong>
            · Water & Climate Intelligence

            <br>

            District quantities, project costs,
            climate scenarios and pollution samples
            are simulated. Not official environmental
            measurements or operational water advice.
        </footer>
    `;

    document.querySelectorAll('[data-go]')
        .forEach(button => {
            button.onclick = () => {
                if (state.busy) return;

                state.page = button.dataset.go;
                render();
                window.scrollTo(0, 0);
            };
        });

    $('#theme-toggle').onclick = () => {
        state.theme = state.theme === 'dark'
            ? 'light' : 'dark';

        localStorage.setItem('aqua-theme-natural', state.theme);

        render();
    };

    bindControls();

    if (state.page === 'map') drawMap();
    if (state.page === 'quality') bindQuality();

    bindInteractive(context);
}

async function init() {
    app.innerHTML = `
        <div class="loading-screen">
            <div class="water-drop"><svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/></svg></div>
            <h1>AquaWise 3.0</h1>
            <p>Connecting to the water intelligence engine...</p>
        </div>
    `;

    try {
        const [districts, projects, missions] =
            await Promise.all([
                fetchJSON('/districts'),
                fetchJSON('/projects'),
                fetchJSON('/missions')
            ]);

        state.districts = districts;
        state.projects = projects;
        state.missions = missions;

        await simulate();

        render();

    } catch (error) {
        app.innerHTML = `
            <div class="startup-error">
                <h1>Backend connection failed</h1>

                <p>
                    Make sure the updated Java Spring Boot
                    backend is running on port 8081.
                </p>

                <pre>${escapeHTML(error.message)}</pre>

                <button class="primary" id="retry">
                    Retry connection
                </button>
            </div>
        `;

        $('#retry').onclick = init;
    }
}

init();