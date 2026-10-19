const config = window.DIARIO_CONFIG || {};

const form = document.querySelector('#diarioForm');
const submitButton = document.querySelector('#submitButton');
const syncStatus = document.querySelector('#syncStatus');
const successPanel = document.querySelector('#successPanel');
const routeSelect = document.querySelector('[data-list="rotas"]');
const sentidoSelect = document.querySelector('#sentidoSelect');

const routeDirections = new Map();

const ROUTE_ENDPOINTS = {
  1: ['Albazine', 'Baixa'],
  2: ['Tchumene', 'Baixa'],
  3: ['Casa Branca', 'UEM'],
  4: ['Marracuene', 'Baixa'],
  5: ['Matola Gare', 'Baixa'],
  6: ['Matola Gare', 'Museu'],
  7: ['Boane', 'Baixa'],
  8: ['Missão Roque', 'Museu'],
  9: ['Casa Branca', 'Museu'],
  10: ['Boane', 'Mozal'],
  11: ['Tchumene', 'Museu'],
  12: ['Marracuene', 'Museu'],
  13: ['Coca-Cola', 'Museu']
};

const normalise = value =>
  String(value ?? '').trim();

const isActive = item =>
  !item.estado ||
  [
    'activo',
    'activa',
    'operacional',
    'disponível',
    'disponivel'
  ].includes(
    normalise(item.estado).toLowerCase()
  );


// ======================================================
// DATA DE HOJE
// ======================================================

function setToday() {
  const now = new Date();

  const offset = now.getTimezoneOffset();

  const local = new Date(
    now.getTime() - offset * 60000
  );

  form.elements.data.value =
    local.toISOString().slice(0, 10);

  document.querySelector('#todayLabel').textContent =
    new Intl.DateTimeFormat(
      'pt-MZ',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    ).format(now);
}


// ======================================================
// CARREGAR DADOS MESTRE
// ======================================================

async function loadMasterData() {

  try {

    const url =
      config.masterDataUrl ||
      'data/master-data.json';

    const response = await fetch(
      `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`,
      {
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(
        'Não foi possível consultar as listas.'
      );
    }

    const data = await response.json();


    // VIATURAS

    fillSelect(
      'viaturas',
      data.viaturas,
      item => item.codigo,
      item => item.codigo
    );


    // MOTORISTAS

    fillSelect(
      'motoristas',
      data.motoristas,
      item => item.codigo,
      item => item.codigo
    );


    // ASSISTENTES

    fillSelect(
      'assistentes',
      data.assistentes,
      item => item.codigo,
      item => item.codigo,
      true
    );


    // ROTAS

    fillRoutes(
      data.rotas
    );


    // TIPOS DE DESLOCAÇÃO

    fillSelect(
      'tiposDeslocacao',
      data.tiposDeslocacao,
      item => item.nome || item,
      item => item.nome || item
    );
    tripsContainer.querySelectorAll('.trip-entry').forEach(trip => updateTripType(trip));


    const updated =
      data.actualizadoEm
        ? new Date(data.actualizadoEm)
        : new Date();


    document.querySelector(
      '#dataTimestamp'
    ).textContent =
      `Listas actualizadas: ${
        new Intl.DateTimeFormat(
          'pt-MZ',
          {
            dateStyle: 'short',
            timeStyle: 'short'
          }
        ).format(updated)
      }`;


    syncStatus.className =
      'sync online';

    syncStatus.innerHTML =
      '<span></span>Dados actualizados';

  } catch (error) {

    console.error(
      'Erro ao carregar listas:',
      error
    );

    syncStatus.className =
      'sync error';

    syncStatus.innerHTML =
      '<span></span>Falha na actualização';


    document
      .querySelectorAll('select[data-list]')
      .forEach(select => {

        select.innerHTML =
          '<option value="">Lista indisponível</option>';

      });

  }

}


// ======================================================
// PREENCHER SELECTS
// ======================================================

function fillSelect(
  key,
  items = [],
  label,
  value,
  optional = false
) {

  const select =
    document.querySelector(
      `[data-list="${key}"]`
    );


  const active =
    items.filter(
      item =>
        typeof item === 'string' ||
        isActive(item)
    );


  select.innerHTML =

    `<option value="">${
      optional
        ? 'Sem assistente / Seleccionar'
        : 'Seleccionar'
    }</option>`

    +

    active
      .map(
        item =>
          `<option value="${escapeHtml(
            value(item)
          )}">
            ${escapeHtml(
              label(item)
            )}
          </option>`
      )
      .join('');

}


// ======================================================
// DADOS DA ROTA
// ======================================================

function routeField(
  item,
  ...keys
) {

  if (typeof item === 'string') {
    return item;
  }


  const key =
    keys.find(
      candidate =>
        normalise(
          item?.[candidate]
        )
    );


  return key
    ? normalise(
        item[key]
      )
    : '';

}


// ======================================================
// ORIGEM E DESTINO DA ROTA
// ======================================================

function getRouteEndpoints(
  item,
  value,
  label
) {

  const origem =
    routeField(
      item,
      'origem',
      'Origem'
    );


  const destino =
    routeField(
      item,
      'destino',
      'Destino'
    );


  if (
    origem &&
    destino
  ) {

    return [
      origem,
      destino
    ];

  }


  const code =
    routeField(
      item,
      'codigo',
      'Código da Rota',
      'ID_Rota'
    )
    ||
    value;


  const match =
    normalise(code)
      .match(/\d+$/);


  const codeNumber =
    Number.parseInt(
      match?.[0] || '',
      10
    );


  if (
    ROUTE_ENDPOINTS[
      codeNumber
    ]
  ) {

    return ROUTE_ENDPOINTS[
      codeNumber
    ];

  }


  const routeName =
    routeField(
      item,
      'nome',
      'Nome da Rota',
      'rota',
      'Rota'
    )
    ||
    label;


  const separator =
    [
      ' → ',
      ' - ',
      ' – ',
      ' — ',
      ' / '
    ]
      .find(
        candidate =>
          routeName.includes(
            candidate
          )
      );


  if (!separator) {
    return null;
  }


  const parts =
    routeName
      .split(separator)
      .map(normalise)
      .filter(Boolean);


  return parts.length >= 2
    ? [
        parts[0],
        parts
          .slice(1)
          .join(separator)
      ]
    : null;

}


// ======================================================
// PREENCHER ROTAS
// ======================================================

function fillRoutes(
  items = []
) {

  const active =
    items.filter(
      item =>
        typeof item === 'string' ||
        isActive(item)
    );


  routeDirections.clear();


  const options =
    active
      .map(
        item => {

          const fallback =
            routeField(
              item,
              'nome',
              'Nome da Rota',
              'rota',
              'Rota'
            );


          const value =
            routeField(
              item,
              'codigo',
              'Código da Rota',
              'rota',
              'Rota'
            )
            ||
            fallback;


          const label =
            routeField(
              item,
              'codigo',
              'Código da Rota'
            )
            ||
            fallback
            ||
            value;


          const endpoints =
            getRouteEndpoints(
              item,
              value,
              fallback || label
            );


          if (
            value &&
            endpoints
          ) {

            routeDirections.set(
              value,
              endpoints
            );

          }


          return value
            ? `<option value="${escapeHtml(
                value
              )}">
                ${escapeHtml(
                  label
                )}
              </option>`
            : '';

        }
      )
      .join('');


  routeSelect.innerHTML =
    '<option value="">Seleccionar</option>'
    +
    options;


  updateSentidos();

}


// ======================================================
// ACTUALIZAR SENTIDO
// ======================================================

function updateSentidos() {

  const endpoints =
    routeDirections.get(
      routeSelect.value
    );


  sentidoSelect.value = '';


  if (!routeSelect.value) {

    sentidoSelect.disabled =
      true;

    sentidoSelect.innerHTML =
      '<option value="">Seleccione primeiro a rota</option>';

  }

  else if (!endpoints) {

    sentidoSelect.disabled =
      true;

    sentidoSelect.innerHTML =
      '<option value="">Sentidos indisponíveis</option>';

  }

  else {

    const [
      origem,
      destino
    ] =
      endpoints;


    const ida =
      `${origem} → ${destino}`;


    const volta =
      `${destino} → ${origem}`;


    sentidoSelect.disabled =
      false;


    sentidoSelect.innerHTML =

      '<option value="">Seleccionar</option>'

      +

      `<option value="${escapeHtml(
        ida
      )}">
        ${escapeHtml(
          ida
        )}
      </option>`

      +

      `<option value="${escapeHtml(
        volta
      )}">
        ${escapeHtml(
          volta
        )}
      </option>`;

  }


  updateProgress();

}


// ======================================================
// SEGURANÇA HTML
// ======================================================

function escapeHtml(
  value
) {

  return normalise(value)
    .replace(
      /[&<>'"]/g,
      char =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#039;',
          '"': '&quot;'
        })[char]
    );

}


// ======================================================
// PROGRESSO DO FORMULÁRIO
// ======================================================

function updateProgress() {

  const required =
    [
      ...form.querySelectorAll(
        '[required]'
      )
    ];


  const complete =
    required.filter(
      field =>
        field.value.trim()
    ).length;


  const pct =
    Math.round(
      (
        complete /
        required.length
      )
      *
      100
    );


  document.querySelector(
    '#progressText'
  ).textContent =
    `${pct}%`;


  document.querySelector(
    '#progressBar'
  ).style.width =
    `${pct}%`;

}


// ======================================================
// ALTERAÇÃO DOS CAMPOS
// ======================================================

form.addEventListener(
  'input',
  event => {

    event.target
      .classList
      .remove(
        'invalid'
      );


    updateProgress();

  }
);


// ======================================================
// ALTERAÇÃO DA ROTA
// ======================================================

routeSelect.addEventListener(
  'change',
  updateSentidos
);




// ======================================================
// HISTÓRICO DO DIA — CONSULTA GET
// ======================================================

const historyStatus = document.querySelector('#historyStatus');
const historyResults = document.querySelector('#historyResults');
const refreshHistoryButton = document.querySelector('#refreshHistory');
let historyRequestController = null;
let historyQueryVersion = 0;

function historyField(row, ...names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null) {
      return String(row[name]).trim();
    }
  }
  return '';
}

function historyDate(value) {
  const raw = String(value ?? '').trim();
  const number = Number(raw);
  if (raw && /^\d+(?:\.\d+)?$/.test(raw) && number > 0 && number < 200000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(number) * 86400000)
      .toISOString().slice(0, 10);
  }
  return raw.slice(0, 10);
}

function setSelectIfValid(select, candidates) {
  if (!select || select.value) return false;
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (!value) continue;
    const options = [...select.options];
    const match = options.find(opt => opt.value.trim() === value || opt.textContent.trim() === value);
    if (match) {
      select.value = match.value;
      autoFilled.set(select, match.value);
      return true;
    }
  }
  return false;
}

function historyStartMinutes(row) {
  const value = normalizedHour(historyField(row, 'Hora_Inicio', 'Hora_Saida', 'Hora Saída', 'hora_inicio'));
  if (!value) return Number.POSITIVE_INFINITY;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
function chronologicalHistory(rows) {
  return [...rows].sort((a, b) => {
    const delta = historyStartMinutes(a) - historyStartMinutes(b);
    if (delta !== 0) return delta;
    const na = Number(historyField(a, 'Nr', 'nr'));
    const nb = Number(historyField(b, 'Nr', 'nr'));
    return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
  });
}

function latestHistoryRow(rows) {
  return chronologicalHistory(rows).at(-1);
}

function populateFromLastTrip(rows) {
  if (!rows.length) return;
  // Respeitar alterações já introduzidas pelo utilizador.
  const last = latestHistoryRow(rows);
  setSelectIfValid(form.elements.turno, [historyField(last, 'Turno','turno')]);
  setSelectIfValid(form.elements.motorista, [historyField(last, 'Motorista','motorista')]);
  setSelectIfValid(form.elements.assistente, [historyField(last, 'Assistente','assistente')]);
  const route = historyField(last, 'Rota', 'rota');
  const routeOptions = [...routeSelect.options];
  const routeMatch = routeOptions.find(option =>
    option.value.trim() === route || option.textContent.trim() === route);
  // Os códigos do menu podem ser diferentes do nome da rota no Excel.
  const endpointsMatch = routeOptions.find(option => {
    const ends = routeDirections.get(option.value);
    if (!ends) return false;
    const text = route.replace(/[–—→]/g,'-').split('-').map(s=>s.trim().toLowerCase());
    return text.length === 2 && ends.map(s=>s.trim().toLowerCase()).join('|') === text.join('|');
  });
  const chosen = routeMatch || endpointsMatch;
  if (chosen) {
    for (const trip of document.querySelectorAll('#currentTrips .trip-entry')) {
      const routeField = tripField(trip,'rota');
      if (!routeField.value && isOperationalTrip(trip)) {
        routeField.value = chosen.value;
        autoFilled.set(routeField, routeField.value);
        updateTripDirections(trip);
        setSelectIfValid(tripField(trip,'sentido'), [historyField(last,'Sentido','sentido')]);
      }
    }
  }
  updateProgress();
}

function historyEndpoints(row) {
  const origem = historyField(row, 'Origem', 'origem');
  const destino = historyField(row, 'Destino', 'destino');
  const sentido = historyField(row, 'Sentido', 'sentido');
  // Nos percursos operacionais, Origem/Destino podem estar vazios no Excel.
  // Recuperá-los do Sentido, sem partir nomes como Coca-Cola.
  const parts = sentido.split(/\s+(?:-|–|—|→)\s+/).map(v => v.trim()).filter(Boolean);
  return {
    origem: origem || (parts.length === 2 ? parts[0] : ''),
    destino: destino || (parts.length === 2 ? parts[1] : '')
  };
}

function renderHistory(rows) {
  if (!rows.length) {
    historyStatus.textContent = 'Não lançado — não há deslocações registadas para esta data e viatura.';
    historyResults.replaceChildren();
    return;
  }

  historyStatus.textContent = `${rows.length} deslocação(ões) encontrada(s).`;
  historyResults.replaceChildren();

  chronologicalHistory(rows).forEach((row, index) => {
    const item = document.createElement('article');
    item.className = 'history-item';
    const title = document.createElement('strong');
    title.textContent = `Deslocação ${index + 1} · ${historyField(row, 'Turno', 'turno') || 'Turno não indicado'}`;
    item.append(title);

    const tipo = historyField(row, 'Tipo_Deslocacao', 'Tipo de Deslocação', 'deslocacao');
    const operacional = /\\boperacional\\b/i.test(tipo) && !/n[aã]o.operacional/i.test(tipo);
    const pontos = historyEndpoints(row);
    const data = [
      ...(operacional ? [
        ['Rota', historyField(row, 'Rota', 'rota')],
        ['Sentido', historyField(row, 'Sentido', 'sentido')]
      ] : []),
      ['Origem', pontos.origem],
      ['Destino', pontos.destino],
      ['Tipo', tipo],
      ['Hora de início', normalizedHour(historyField(row, 'Hora_Inicio','Hora_Saida','Hora Saída','hora_inicio')) || historyField(row, 'Hora_Inicio','Hora_Saida','Hora Saída','hora_inicio')],
      ['Hora de fim', normalizedHour(historyField(row, 'Hora_Fim','Hora_Chegada','Hora Chegada','hora_fim')) || historyField(row, 'Hora_Fim','Hora_Chegada','Hora Chegada','hora_fim')],
      ['KM inicial', historyField(row, 'Km_Inicial', 'Km Inicial', 'km_inicio')],
      ['KM final', historyField(row, 'Km_Final', 'Km Final', 'km_fim')],
      ['Combustível inicial', historyField(row, 'Combustivel_Inicial', 'Nível Combustível Início', 'combustivel_inicio')],
      ['Combustível final', historyField(row, 'Combustivel_Final', 'Nível Combustível Fim', 'combustivel_fim')],
      ['Motorista', historyField(row, 'Motorista', 'motorista')],
      ['Observações', historyField(row, 'Observacoes', 'Observações', 'observacoes')]
    ];

    const grid = document.createElement('dl');
    grid.className = 'history-details';
    data.filter(([, value]) => value !== '').forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      grid.append(dt, dd);
    });
    item.append(grid);
    historyResults.append(item);
  });
}

async function loadHistory() {
  historyRequestController?.abort();
  historyRequestController = null;
  const version = ++historyQueryVersion;

  const data = form.elements.data.value;
  const viatura = form.elements.viatura.value;
  historyResults.replaceChildren();
  const context = data + '|' + viatura;
  if (context !== lastHistoryContext) {
    clearAutoValues();
    // O cartão ainda não lançado da nova selecção pode servir de origem apenas após preenchimento.
    if (tripsContainer.children.length === 1) tripsContainer.firstElementChild.dataset.contextKey = context;
    lastHistoryContext = context;
  }
  availableHistory = [];
  tripsContainer.querySelectorAll('.trip-entry').forEach(updateHourSuggestions);
  refreshHistoryButton.hidden = !data || !viatura;

  if (!data || !viatura) {
    historyStatus.textContent = 'Seleccione a data e a viatura para consultar o histórico.';
    return;
  }

  if (!config.historyUrl) {
    historyStatus.textContent = 'Consulta do histórico ainda não configurada.';
    return;
  }

  const controller = new AbortController();
  historyRequestController = controller;
  const timeout = setTimeout(() => controller.abort(), 25000);
  historyStatus.textContent = 'A consultar o histórico...';

  try {
    const url = new URL(config.historyUrl);
    url.searchParams.set('Data', data);
    url.searchParams.set('Viatura', viatura);

    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('Formato inválido: esperava-se uma lista JSON.');
    if (version !== historyQueryVersion) return;

    // Verificação defensiva: mesmo que o fluxo devolva linhas a mais,
    // não apresentar registos de outra viatura ou data.
    const matching = result.filter(row =>
      historyField(row, 'Viatura', 'viatura') === viatura &&
      historyDate(historyField(row, 'Data', 'data')) === data
    );
    availableHistory = chronologicalHistory(matching);
    renderHistory(availableHistory);
    populateFromLastTrip(availableHistory);
    tripsContainer.querySelectorAll('.trip-entry').forEach(trip=>{updateHourSuggestions(trip); seedStartFromPrevious(trip);});
  } catch (error) {
    if (version !== historyQueryVersion) return;
    console.error('Falha ao consultar histórico:', error);
    historyStatus.textContent = controller.signal.aborted
      ? 'A consulta demorou demasiado tempo. Tente actualizar.'
      : 'Não foi possível consultar o histórico. Tente actualizar.';
    historyResults.replaceChildren();
  } finally {
    clearTimeout(timeout);
    if (historyRequestController === controller) historyRequestController = null;
  }
}

form.elements.data.addEventListener('change', loadHistory);
form.elements.viatura.addEventListener('change', loadHistory);
refreshHistoryButton.addEventListener('click', loadHistory);

// ======================================================
// DESLOCAMENTOS CORRENTES E ENVIO AGRUPADO
// ======================================================

const tripsContainer = document.querySelector('#currentTrips');
const addTripButton = document.querySelector('#addTrip');
const tripTemplate = tripsContainer.querySelector('.trip-entry').cloneNode(true);
let nextTripId = 2;
let availableHistory = [];
let lastHistoryContext = '';
const autoFilled = new WeakMap();
function currentContext() { return form.elements.data.value + '|' + form.elements.viatura.value; }
function setAutoValue(field, value) {
  if (!field || !value || field.value) return;
  field.value = value;
  autoFilled.set(field, value);
}
function clearAutoValues() {
  for (const field of form.querySelectorAll('input,select')) {
    const previous=autoFilled.get(field);
    if (previous !== undefined) {
      if (field.value === previous) field.value='';
      autoFilled.delete(field);
    }
  }
}

// Cada cartão conserva o identificador mesmo após uma tentativa falhada.
function newRegistrationId() { return crypto.randomUUID(); }
tripsContainer.querySelector('.trip-entry').dataset.registrationId = newRegistrationId();

function tripField(trip, name) {
  return trip.querySelector('[name="' + name + '"]');
}

function updateTripDirections(trip) {
  const route = tripField(trip, 'rota').value;
  const sentido = tripField(trip, 'sentido');
  const endpoints = routeDirections.get(route);
  const previous = sentido.value;
  sentido.replaceChildren();
  const initial = document.createElement('option');
  initial.value = '';
  initial.textContent = endpoints ? 'Seleccionar' : 'Seleccione primeiro a rota';
  sentido.append(initial);
  sentido.disabled = !endpoints;
  if (endpoints) {
    const [from, to] = endpoints;
    for (const name of [from + ' → ' + to, to + ' → ' + from]) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      sentido.append(option);
    }
    if ([...sentido.options].some(option => option.value === previous)) {
      sentido.value = previous;
    }
  }
}

function showTripEditor(trip) {
  tripsContainer.querySelectorAll('.trip-entry').forEach(other => {
    if (other !== trip) other.classList.add('trip-collapsed');
  });
  trip.classList.remove('trip-collapsed');
  trip.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function refreshTripSummary(trip) {
  const get = name => tripField(trip, name)?.value || '';
  const label = trip.querySelector('.trip-summary');
  if (!label) return;
  label.textContent = [get('rota'), get('sentido'), get('horaSaida') + '–' + get('horaChegada'),
    'KM ' + get('kmInicial') + '–' + get('kmFinal')].filter(Boolean).join(' · ');
}

function isOperationalTrip(trip) {
  const select = tripField(trip, 'tipoDeslocacao');
  const option = select.selectedOptions[0];
  const text = [select.value, option?.textContent].join(' ').toLowerCase();
  return /\boperacional\b/.test(text) && !/n[aã]o.operacional/.test(text);
}

function updateTripType(trip) {
  const type = tripField(trip, 'tipoDeslocacao').value;
  const operational = type && isOperationalTrip(trip);
  for (const label of trip.querySelectorAll('.operational-fields')) {
    label.hidden = !operational;
    const select = label.querySelector('select');
    select.disabled = !operational || (select.name === 'sentido' && !tripField(trip,'rota').value);
    select.required = Boolean(operational);
    if (!operational) select.value = '';
  }
  for (const label of trip.querySelectorAll('.nonoperational-fields')) {
    label.hidden = !type || operational;
    const input = label.querySelector('input');
    input.disabled = !type || operational;
    input.required = Boolean(type && !operational);
    if (!type || operational) input.value = '';
  }
  if (operational) updateTripDirections(trip);
  else if (tripField(trip,'horaSaida').value) applyPreviousEnd(trip,tripField(trip,'horaSaida').value,false);
  updateProgress();
}

// As opções da hora de início incluem finais do dia no histórico e no lote corrente.
function normalizedHour(raw) {
  const value = String(raw ?? '').trim();
  const time = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (time) {
    const h = Number(time[1]), m = Number(time[2]);
    return h < 24 && m < 60 ? String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') : '';
  }
  const number = Number(value);
  if (value && Number.isFinite(number) && number >= 0 && number < 1) {
    const minutes = Math.round(number * 1440) % 1440;
    return String(Math.floor(minutes/60)).padStart(2,'0') + ':' + String(minutes%60).padStart(2,'0');
  }
  return '';
}
function finalDestination(value) {
  const raw = String(value ?? '').trim();
  // Percursos: "Matola Gare - Museu", "Matola Gare – Museu", "Matola Gare → Museu".
  // Exigir espaços em torno do hífen para preservar topónimos como "Coca-Cola".
  const parts = raw.split(/\s+(?:-|–|—|→)\s+/);
  return (parts.length > 1 ? parts[1] : raw).trim();
}
function originCandidates(trip) {
  const current = [...tripsContainer.querySelectorAll('.trip-entry')];
  const currentBefore = current.slice(0, current.indexOf(trip)).filter(node => node.dataset.contextKey === currentContext()).map(node => ({
    time: tripField(node,'horaChegada').value,
    km: tripField(node,'kmFinal').value,
    fuel: tripField(node,'nivelCombustivelFinal').value,
    destination: finalDestination(tripField(node,'destino').value || tripField(node,'sentido').value),
    route: tripField(node,'rota').value,
    source: 'corrente'
  }));
  const historic = availableHistory.map(row => ({
    time: historyField(row,'Hora_Fim','Hora_Chegada','Hora Chegada','hora_fim'),
    km: historyField(row,'Km_Final','Km Final','km_fim'),
    fuel: historyField(row,'Combustivel_Final','Nível Combustível Fim','combustivel_fim'),
    destination: finalDestination(historyField(row,'Destino','destino') || historyField(row,'Sentido','sentido')),
    route: historyField(row,'Rota','rota'),
    source: 'histórico',
    nr: Number(historyField(row,'Nr','nr')) || 0
  }));
  return [...historic, ...currentBefore].filter(c => normalizedHour(c.time));
}
function lastCandidate(trip) {
  const options = originCandidates(trip);
  const currents = options.filter(o=>o.source==='corrente');
  if (currents.length) return currents.at(-1);
  return options.filter(o=>o.source==='histórico').sort((a,b)=> (a.nr && b.nr) ? b.nr-a.nr : normalizedHour(b.time).localeCompare(normalizedHour(a.time)))[0];
}
function updateHourSuggestions(trip) {
  const chooser = trip.querySelector('.start-time-suggestions');
  if (!chooser) return;
  const previous = chooser.value;
  const candidates = originCandidates(trip);
  // Uma opção por deslocamento, incluindo horas repetidas: não perder registos.
  chooser.candidates = candidates;
  chooser.replaceChildren(new Option('Sugestões: hora de fim anterior', ''));
  candidates.forEach((candidate, index) => {
    const time = normalizedHour(candidate.time);
    const label = time + ' · ' + (candidate.source === 'corrente'
      ? 'Deslocação ' + (index - availableHistory.length + 1)
      : 'Histórico ' + (candidate.nr || index + 1));
    chooser.add(new Option(label, String(index)));
  });
  chooser.value = previous && [...chooser.options].some(o=>o.value===previous) ? previous : '';
}

function fillFromCandidate(trip, selected, overwrite = true) {
  if (!selected) return;
  const fill = (field, value) => {
    const input = tripField(trip, field);
    if (input && value !== undefined && value !== null && String(value).trim() && (overwrite || !input.value)) {
      input.value = String(value).trim();
      autoFilled.set(input, input.value);
    }
  };
  fill('kmInicial', selected.km);
  fill('nivelCombustivelInicial', selected.fuel);
  if (!isOperationalTrip(trip)) fill('origem', selected.destination);
  updateProgress();
}

function applyPreviousEnd(trip, time, overwrite = true) {
  const wanted = normalizedHour(time);
  if (!wanted) return;
  const matches = originCandidates(trip).filter(c => normalizedHour(c.time) === wanted);
  const selected = matches.filter(c=>c.source==='corrente').at(-1)
    || matches.filter(c=>c.source==='histórico').sort((a,b)=>b.nr-a.nr)[0];
  fillFromCandidate(trip, selected, overwrite);
}
function onStartTimeChanged(trip) {
  resetEndTimeAfterStartChange(trip);
  updateHourSuggestions(trip);
  const time=tripField(trip,'horaSaida').value;
  applyPreviousEnd(trip,time,true);
}
function seedStartFromPrevious(trip) {
  const input=tripField(trip,'horaSaida');
  if(input.value) return;
  const previous=lastCandidate(trip);
  if(!previous) return;
  input.value=normalizedHour(previous.time);
  autoFilled.set(input,input.value);
  fillFromCandidate(trip, previous, false);
  updateHourSuggestions(trip);
}

function setupEndTimePicker(trip) {
  const end = tripField(trip, 'horaChegada');
  const start = tripField(trip, 'horaSaida');
  const wrapper = document.createElement('span');
  wrapper.className = 'end-time-picker-wrap';
  end.parentNode.insertBefore(wrapper, end);
  wrapper.append(end);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'end-time-picker-button';
  button.setAttribute('aria-label', 'Escolher hora de fim a partir da hora de início');
  button.title = 'Abrir relógio na hora de início';
  button.textContent = '◷';
  wrapper.append(button);

  const popover = document.createElement('span');
  popover.className = 'end-time-picker-popover';
  popover.hidden = true;
  const title = document.createElement('small');
  title.textContent = 'Escolher hora de fim';
  const picker = document.createElement('input');
  picker.type = 'time';
  picker.setAttribute('aria-label', 'Hora de fim no relógio');
  popover.append(title, picker);
  wrapper.append(popover);

  const close = () => { popover.hidden = true; };
  button.addEventListener('click', () => {
    // Preparar o selector, sem alterar o valor já gravado no campo Hora de fim.
    picker.value = end.value || start.value || '';
    popover.hidden = false;
    try { picker.showPicker?.(); } catch (_) { picker.focus(); }
  });
  picker.addEventListener('change', () => {
    if (picker.value) {
      end.value = picker.value;
      end.dispatchEvent(new Event('input', { bubbles: true }));
      end.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close();
  });
  document.addEventListener('pointerdown', event => {
    if (!wrapper.contains(event.target)) close();
  });
}

function resetEndTimeAfterStartChange(trip) {
  const end = tripField(trip, 'horaChegada');
  if (end.value) {
    end.value = '';
    autoFilled.delete(end);
    end.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const picker = trip.querySelector('.end-time-picker-popover input[type="time"]');
  if (picker) picker.value = '';
  const popover = trip.querySelector('.end-time-picker-popover');
  if (popover) popover.hidden = true;
}
function setupTrip(trip) {
  setupEndTimePicker(trip);
  const hour=tripField(trip,'horaSaida');
  const suggestions=document.createElement('select');
  suggestions.type='button';
  suggestions.className='start-time-suggestions';
  suggestions.setAttribute('aria-label','Sugerir hora de início a partir dos deslocamentos anteriores');
  suggestions.style.marginTop='6px';
  suggestions.addEventListener('change',()=>{
    if (suggestions.value === '') return;
    const selected = suggestions.candidates?.[Number(suggestions.value)];
    if (!selected) return;
    const newHour = normalizedHour(selected.time);
    if (hour.value !== newHour) resetEndTimeAfterStartChange(trip);
    hour.value = newHour;
    autoFilled.set(hour, hour.value);
    fillFromCandidate(trip, selected, true);
  });
  hour.closest('label').append(suggestions);
  hour.addEventListener('change',()=>{autoFilled.delete(hour);onStartTimeChanged(trip);});
  hour.addEventListener('focus',()=>updateHourSuggestions(trip));
  tripField(trip,'tipoDeslocacao').addEventListener('change', () => updateTripType(trip));
  const banner = trip.querySelector('.trip-banner');
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'secondary-button edit-trip';
  edit.textContent = 'Editar';
  edit.addEventListener('click', () => showTripEditor(trip));
  banner.append(edit);
  const summary = document.createElement('p');
  summary.className = 'trip-summary';
  banner.after(summary);
  tripField(trip, 'rota').addEventListener('change', () => {
    updateTripDirections(trip);
    updateProgress();
  });
  trip.querySelector('.remove-trip').addEventListener('click', () => {
    if (tripsContainer.children.length <= 1) return;
    trip.remove();
    refreshTripLabels();
    updateProgress();
  });
}

function refreshTripLabels() {
  const allTrips = [...tripsContainer.querySelectorAll('.trip-entry')];
  allTrips.forEach((trip, i) => {
    trip.querySelector('.trip-banner strong').textContent = 'Corrente · Deslocação ' + (i + 1);
    trip.querySelector('.remove-trip').hidden = allTrips.length === 1;
  });
}

setupTrip(tripsContainer.querySelector('.trip-entry'));
tripsContainer.querySelector('.trip-entry').dataset.contextKey = currentContext();
updateTripType(tripsContainer.querySelector('.trip-entry'));

addTripButton.addEventListener('click', () => {
  const active = tripsContainer.querySelector('.trip-entry:not(.trip-collapsed)')
    || tripsContainer.lastElementChild;

  // Não guardar um deslocamento incompleto como parte do lote.
  const invalid = [...active.querySelectorAll('[required]')]
    .filter(field => !field.value.trim());
  if (invalid.length) {
    invalid.forEach(field => field.classList.add('invalid'));
    invalid[0].focus();
    document.querySelector('#formHint').textContent =
      'Complete o deslocamento corrente antes de adicionar outro.';
    return;
  }
  if (Number(tripField(active, 'kmFinal').value) < Number(tripField(active, 'kmInicial').value)) {
    tripField(active, 'kmFinal').classList.add('invalid');
    tripField(active, 'kmFinal').focus();
    document.querySelector('#formHint').textContent = 'O KM final não pode ser inferior ao KM inicial.';
    return;
  }

  refreshTripSummary(active);
  active.classList.add('trip-collapsed');

  const trip = tripTemplate.cloneNode(true);
  trip.dataset.tripId = String(nextTripId++);
  trip.dataset.contextKey = currentContext();
  trip.dataset.registrationId = newRegistrationId();
  // A nova deslocação começa sem valores; Data/Viatura/Equipa permanecem.
  trip.querySelectorAll('input, textarea').forEach(field => { field.value = ''; field.classList.remove('invalid'); });
  trip.querySelectorAll('select').forEach(field => { field.value = ''; field.classList.remove('invalid'); });
  // O modelo HTML foi capturado antes do carregamento das listas mestre.
  // Copiar as opções já carregadas do formulário activo, não do modelo inicial.
  tripField(trip, 'tipoDeslocacao').innerHTML =
    tripField(tripsContainer.querySelector('.trip-entry'), 'tipoDeslocacao').innerHTML;
  tripField(trip, 'rota').innerHTML = routeSelect.innerHTML;
  tripField(trip, 'sentido').removeAttribute('id');
  tripField(trip, 'sentido').disabled = true;
  setupTrip(trip);
  tripsContainer.append(trip);
  updateTripType(trip);
  seedStartFromPrevious(trip);
  tripsContainer.querySelectorAll('.trip-entry').forEach(updateHourSuggestions);
  refreshTripLabels();
  updateProgress();
  document.querySelector('#formHint').textContent =
    'Deslocamento anterior adicionado ao lote. Preencha o seguinte.';
  trip.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

function tripPayload(trip, base) {
  const get = name => tripField(trip, name).value;
  const kmStart = Number(get('kmInicial'));
  const kmEnd = Number(get('kmFinal'));
  if (kmEnd < kmStart) {
    tripField(trip, 'kmFinal').classList.add('invalid');
    throw new Error('O KM final não pode ser inferior ao KM inicial.');
  }
  return {
    ...base,
    ID_Registo: trip.dataset.registrationId,
    deslocacao: get('tipoDeslocacao'),
    hora_inicio: get('horaSaida'),
    hora_fim: get('horaChegada'),
    rota: isOperationalTrip(trip) ? get('rota') : '',
    sentido: isOperationalTrip(trip) ? get('sentido') : '',
    origem: isOperationalTrip(trip) ? '' : get('origem'),
    destino: isOperationalTrip(trip) ? '' : get('destino'),
    km_inicio: kmStart,
    km_fim: kmEnd,
    combustivel_inicio: Number(get('nivelCombustivelInicial')),
    combustivel_fim: Number(get('nivelCombustivelFinal')),
    observacoes: get('observacoes') || ''
  };
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const invalid = [...form.querySelectorAll('[required]')].filter(field => !field.value.trim());
  if (invalid.length) {
    invalid.forEach(field => field.classList.add('invalid'));
    invalid[0].focus();
    document.querySelector('#formHint').textContent = 'Preencha todos os campos obrigatórios.';
    return;
  }
  const common = {
    data: form.elements.data.value,
    turno: form.elements.turno.value,
    viatura: form.elements.viatura.value,
    motorista: form.elements.motorista.value,
    assistente: form.elements.assistente.value
  };
  let registos;
  try {
    registos = [...tripsContainer.querySelectorAll('.trip-entry')]
      .map(trip => tripPayload(trip, common));
  } catch (error) {
    document.querySelector('#formHint').textContent = error.message;
    return;
  }

  submitButton.disabled = true;
  addTripButton.disabled = true;
  submitButton.querySelector('span').textContent = 'A enviar...';
  document.querySelector('#formHint').textContent = 'A enviar ' + registos.length + ' registo(s)...';

  try {
    if (config.submissionUrl && !config.demoMode) {
      // O fluxo de submissão deve aceitar este envelope e criar uma linha por registo.
      const response = await fetch(config.submissionUrl, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({registos})
      });
      if (!response.ok) throw new Error('Submissão recusada: HTTP ' + response.status);
      // Só marcar como concluído quando o fluxo confirmar a gravação integral.
      const confirmation = await response.json();
      if (confirmation?.sucesso !== true || Number(confirmation?.gravados) !== registos.length) {
        throw new Error('O serviço não confirmou a gravação integral. Não volte a enviar antes de verificar os registos no Excel.');
      }
    } else {
      const entries = JSON.parse(localStorage.getItem('sirDiarioBordoDemo') || '[]');
      entries.push(...registos);
      localStorage.setItem('sirDiarioBordoDemo', JSON.stringify(entries));
    }
    form.hidden = true;
    successPanel.hidden = false;
    document.querySelector('#successMessage').textContent =
      registos.length + ' deslocação(ões) registada(s) com sucesso.';
    loadHistory();
    window.scrollTo({top:0,behavior:'smooth'});
  } catch(error) {
    console.error('Falha no envio agrupado:', error);
    document.querySelector('#formHint').textContent = error.message || 'Erro na submissão.';
  } finally {
    submitButton.disabled = false;
    addTripButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Enviar registos';
  }
});

// ======================================================
// NOVO REGISTO
// ======================================================

document
  .querySelector(
    '#newEntry'
  )
  .addEventListener(
    'click',
    () => {


      form.reset();
      const extras = [...tripsContainer.querySelectorAll('.trip-entry')].slice(1);
      extras.forEach(trip => trip.remove());
      const firstTrip = tripsContainer.querySelector('.trip-entry');
      firstTrip.classList.remove('trip-collapsed');
      firstTrip.dataset.registrationId = newRegistrationId();
      firstTrip.dataset.contextKey = currentContext();
      updateTripType(firstTrip);
      refreshTripLabels();


      setToday();


      updateSentidos();


      form.hidden =
        false;


      successPanel.hidden =
        true;


      document.querySelector(
        '#formHint'
      ).textContent =
        'Confirme os dados antes de enviar.';


      updateProgress();
      loadHistory();

    }
  );


// ======================================================
// INICIALIZAÇÃO
// ======================================================

setToday();

loadMasterData();

updateProgress();
