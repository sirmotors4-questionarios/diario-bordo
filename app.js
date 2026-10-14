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

function renderHistory(rows) {
  if (!rows.length) {
    historyStatus.textContent = 'Não lançado — não há deslocações registadas para esta data e viatura.';
    historyResults.replaceChildren();
    return;
  }

  historyStatus.textContent = `${rows.length} deslocação(ões) encontrada(s).`;
  historyResults.replaceChildren();

  rows.forEach((row, index) => {
    const item = document.createElement('article');
    item.className = 'history-item';
    const title = document.createElement('strong');
    title.textContent = `Deslocação ${index + 1} · ${historyField(row, 'Turno', 'turno') || 'Turno não indicado'}`;
    item.append(title);

    const data = [
      ['Rota', historyField(row, 'Rota', 'rota')],
      ['Sentido', historyField(row, 'Sentido', 'sentido')],
      ['Tipo', historyField(row, 'Tipo_Deslocacao', 'Tipo de Deslocação', 'deslocacao')],
      ['Hora', [historyField(row, 'Hora', 'Hora_Inicio', 'hora_inicio'), historyField(row, 'Hora_Fim', 'hora_fim')].filter(Boolean).join(' – ')],
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
    renderHistory(matching);
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

function setupTrip(trip) {
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
  trip.dataset.registrationId = newRegistrationId();
  // A nova deslocação começa sem valores; Data/Viatura/Equipa permanecem.
  trip.querySelectorAll('input, textarea').forEach(field => { field.value = ''; field.classList.remove('invalid'); });
  trip.querySelectorAll('select').forEach(field => { field.value = ''; field.classList.remove('invalid'); });
  tripField(trip, 'rota').innerHTML = routeSelect.innerHTML;
  tripField(trip, 'sentido').removeAttribute('id');
  tripField(trip, 'sentido').disabled = true;
  setupTrip(trip);
  tripsContainer.append(trip);
  updateTripDirections(trip);
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
    rota: get('rota'),
    sentido: get('sentido'),
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
