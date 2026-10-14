const config = window.DIARIO_CONFIG || {};

const form = document.querySelector('#diarioForm');
const submitButton = document.querySelector('#submitButton');
const syncStatus = document.querySelector('#syncStatus');
const successPanel = document.querySelector('#successPanel');
const routeSelect = document.querySelector('[data-list="rotas"]');
const sentidoSelect = document.querySelector('#sentidoSelect');
const historyList = document.querySelector('#historyList');
const historyStatus = document.querySelector('#historyStatus');
const refreshHistoryButton = document.querySelector('#refreshHistory');
const addTripButton = document.querySelector('#addTripButton');

const routeDirections = new Map();
let savedTrips = [];
let pendingTrips = [];
let historyRequest = 0;

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
// HISTÓRICO E DESLOCAÇÕES DESTA SESSÃO
// ======================================================

const tripFieldNames = [
  'rota',
  'sentido',
  'tipoDeslocacao',
  'horaSaida',
  'horaChegada',
  'kmInicial',
  'kmFinal',
  'nivelCombustivelInicial',
  'nivelCombustivelFinal',
  'observacoes'
];

function pickValue(item, ...keys) {
  const entries = Object.entries(item || {});
  const wanted = keys.map(key => normalise(key).toLowerCase());
  const match = entries.find(([key]) => wanted.includes(normalise(key).toLowerCase()));
  return match ? match[1] : '';
}

function normaliseTrip(item) {
  return {
    data: pickValue(item, 'data', 'Data'),
    turno: pickValue(item, 'turno', 'Turno'),
    deslocacao: pickValue(item, 'deslocacao', 'Deslocação', 'tipoDeslocacao'),
    hora_inicio: pickValue(item, 'hora_inicio', 'Hora Início', 'Hora de saída', 'horaSaida'),
    hora_fim: pickValue(item, 'hora_fim', 'Hora Fim', 'Hora de chegada', 'horaChegada'),
    viatura: pickValue(item, 'viatura', 'Viatura'),
    motorista: pickValue(item, 'motorista', 'Motorista'),
    assistente: pickValue(item, 'assistente', 'Assistente'),
    rota: pickValue(item, 'rota', 'Rota'),
    sentido: pickValue(item, 'sentido', 'Sentido'),
    km_inicio: pickValue(item, 'km_inicio', 'KM Início', 'KM inicial', 'kmInicial'),
    km_fim: pickValue(item, 'km_fim', 'KM Fim', 'KM final', 'kmFinal'),
    combustivel_inicio: pickValue(item, 'combustivel_inicio', 'Combustível Início', 'nivelCombustivelInicial'),
    combustivel_fim: pickValue(item, 'combustivel_fim', 'Combustível Fim', 'nivelCombustivelFinal'),
    observacoes: pickValue(item, 'observacoes', 'Observações')
  };
}

function currentHistoryKey() {
  return {
    data: normalise(form.elements.data.value),
    viatura: normalise(form.elements.viatura.value)
  };
}

function isCurrentSelection(trip) {
  const key = currentHistoryKey();
  return normalise(trip.data) === key.data && normalise(trip.viatura) === key.viatura;
}

function renderTrip(trip, current = false, index = -1) {
  const title = [trip.rota, trip.sentido].filter(Boolean).join(' · ') || 'Deslocação';
  const hours = [trip.hora_inicio, trip.hora_fim].filter(Boolean).join(' – ') || 'Hora não indicada';
  const km = trip.km_inicio !== '' && trip.km_fim !== ''
    ? `${trip.km_inicio} – ${trip.km_fim} km`
    : 'KM não indicado';
  const remove = current
    ? `<button type="button" class="remove-trip" data-remove-trip="${index}">Remover</button>`
    : '';

  return `
    <article class="history-entry${current ? ' current' : ''}">
      <div class="history-entry-head">
        <span class="history-badge">${current ? 'Lançamento actual' : 'Já lançado'}</span>
        <strong>${escapeHtml(title)}</strong>
        ${remove}
      </div>
      <div class="history-meta">
        <span>${escapeHtml(hours)}</span>
        <span>${escapeHtml(km)}</span>
        <span>${escapeHtml(trip.deslocacao || 'Tipo não indicado')}</span>
        ${trip.motorista ? `<span>Motorista: ${escapeHtml(trip.motorista)}</span>` : ''}
      </div>
    </article>`;
}

function renderHistory() {
  const key = currentHistoryKey();
  const current = pendingTrips
    .map((trip, index) => ({ trip, index }))
    .filter(({ trip }) => isCurrentSelection(trip));

  if (!key.data || !key.viatura) {
    historyStatus.textContent = 'Seleccione a data e a viatura para consultar.';
    historyList.innerHTML = '<div class="history-empty">A aguardar a data e a viatura.</div>';
    return;
  }

  const cards = [
    ...current.map(({ trip, index }) => renderTrip(trip, true, index)),
    ...savedTrips.map(trip => renderTrip(trip))
  ];

  historyList.innerHTML = cards.join('') || '<div class="history-empty"><strong>Não lançado</strong><br>Não existem viagens para esta data e viatura.</div>';

  const savedText = `${savedTrips.length} ${savedTrips.length === 1 ? 'viagem lançada' : 'viagens lançadas'}`;
  const currentText = current.length ? ` · ${current.length} ${current.length === 1 ? 'actual' : 'actuais'}` : '';
  historyStatus.textContent = `${savedText}${currentText}`;
}

async function loadDailyHistory() {
  const key = currentHistoryKey();
  const requestId = ++historyRequest;
  savedTrips = [];
  renderHistory();

  if (!key.data || !key.viatura) return;

  if (config.demoMode) {
    const entries = JSON.parse(localStorage.getItem('sirDiarioBordoDemo') || '[]');
    savedTrips = entries.map(normaliseTrip).filter(isCurrentSelection);
    renderHistory();
    return;
  }

  if (!config.historyUrl) {
    historyStatus.textContent = 'Consulta ao Excel ainda não configurada.';
    historyList.innerHTML = '<div class="history-empty">Configure <strong>historyUrl</strong> para mostrar os lançamentos do SharePoint.</div>';
    return;
  }

  refreshHistoryButton.disabled = true;
  historyStatus.textContent = 'A consultar o histórico no SharePoint...';
  historyList.innerHTML = '<div class="history-empty">A carregar viagens...</div>';

  try {
    const url = new URL(config.historyUrl, window.location.href);
    url.searchParams.set('data', key.data);
    url.searchParams.set('viatura', key.viatura);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Consulta recusada. HTTP ${response.status}`);
    const body = await response.json();
    if (requestId !== historyRequest) return;
    const rows = Array.isArray(body) ? body : (body.viagens || body.value || body.items || []);
    savedTrips = rows.map(normaliseTrip);
    renderHistory();
  } catch (error) {
    if (requestId !== historyRequest) return;
    console.error('Erro ao consultar histórico:', error);
    historyStatus.textContent = 'Não foi possível consultar o histórico.';
    historyList.innerHTML = '<div class="history-empty">Falha na ligação ao SharePoint. Tente actualizar.</div>';
  } finally {
    if (requestId === historyRequest) refreshHistoryButton.disabled = false;
  }
}

function collectCurrentTrip() {
  const invalid = [...form.querySelectorAll('[required]')].filter(field => !field.value.trim());
  if (invalid.length) {
    invalid.forEach(field => field.classList.add('invalid'));
    invalid[0].focus();
    document.querySelector('#formHint').textContent = 'Preencha todos os campos obrigatórios.';
    return null;
  }

  const values = new FormData(form);
  const kmInicio = Number(values.get('kmInicial'));
  const kmFim = Number(values.get('kmFinal'));
  if (kmFim < kmInicio) {
    form.elements.kmFinal.classList.add('invalid');
    form.elements.kmFinal.focus();
    document.querySelector('#formHint').textContent = 'O KM final não pode ser inferior ao KM inicial.';
    return null;
  }

  return {
    data: values.get('data'), turno: values.get('turno'),
    deslocacao: values.get('tipoDeslocacao'),
    hora_inicio: values.get('horaSaida'), hora_fim: values.get('horaChegada'),
    viatura: values.get('viatura'), motorista: values.get('motorista'),
    assistente: values.get('assistente'), rota: values.get('rota'),
    sentido: values.get('sentido'), km_inicio: kmInicio, km_fim: kmFim,
    combustivel_inicio: Number(values.get('nivelCombustivelInicial')),
    combustivel_fim: Number(values.get('nivelCombustivelFinal')),
    observacoes: values.get('observacoes') || ''
  };
}

function clearTripFields() {
  tripFieldNames.forEach(name => {
    if (form.elements[name]) form.elements[name].value = '';
  });
  updateSentidos();
  updateProgress();
}

addTripButton.addEventListener('click', () => {
  const trip = collectCurrentTrip();
  if (!trip) return;
  pendingTrips.push(trip);
  clearTripFields();
  renderHistory();
  document.querySelector('#formHint').textContent = 'Deslocação adicionada. Pode preencher outra ou enviar os registos.';
  document.querySelector('#dailyHistory').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

historyList.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-trip]');
  if (!button) return;
  pendingTrips.splice(Number(button.dataset.removeTrip), 1);
  renderHistory();
});

form.elements.data.addEventListener('change', loadDailyHistory);
form.elements.viatura.addEventListener('change', loadDailyHistory);
refreshHistoryButton.addEventListener('click', loadDailyHistory);

// Quando existem deslocações adicionadas, o envio final processa a fila.
form.addEventListener('submit', async event => {
  if (!pendingTrips.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const hasCurrentTrip = tripFieldNames.some(name => normalise(form.elements[name]?.value));
  if (hasCurrentTrip) {
    const current = collectCurrentTrip();
    if (!current) return;
    pendingTrips.push(current);
    renderHistory();
  }

  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'A enviar...';
  document.querySelector('#formHint').textContent = `A enviar ${pendingTrips.length} deslocações...`;

  try {
    for (const payload of pendingTrips) {
      if (config.submissionUrl && !config.demoMode) {
        const response = await fetch(config.submissionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Submissão recusada. HTTP ${response.status}`);
      } else {
        const entries = JSON.parse(localStorage.getItem('sirDiarioBordoDemo') || '[]');
        entries.push(payload);
        localStorage.setItem('sirDiarioBordoDemo', JSON.stringify(entries));
      }
    }

    const total = pendingTrips.length;
    pendingTrips = [];
    form.hidden = true;
    successPanel.hidden = false;
    document.querySelector('#successMessage').textContent = `${total} ${total === 1 ? 'deslocação foi enviada' : 'deslocações foram enviadas'} para o sistema com sucesso.`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error('Erro no envio para Power Automate:', error);
    document.querySelector('#formHint').textContent = 'Não foi possível concluir o envio. As deslocações continuam nesta página.';
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Enviar registos';
  }
}, true);


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
// ENVIO DO FORMULÁRIO PARA POWER AUTOMATE
// ======================================================

form.addEventListener(
  'submit',
  async event => {

    event.preventDefault();


    // ----------------------------------------------
    // VALIDAR CAMPOS OBRIGATÓRIOS
    // ----------------------------------------------

    const invalid =
      [
        ...form.querySelectorAll(
          '[required]'
        )
      ]
        .filter(
          field =>
            !field.value.trim()
        );


    if (
      invalid.length
    ) {

      invalid.forEach(
        field =>
          field
            .classList
            .add(
              'invalid'
            )
      );


      invalid[0].focus();


      document.querySelector(
        '#formHint'
      ).textContent =
        'Preencha todos os campos obrigatórios.';


      return;

    }


    // ----------------------------------------------
    // LER DADOS DO FORMULÁRIO
    // ----------------------------------------------

    const dadosFormulario =
      new FormData(
        form
      );


    const kmInicial =
      Number(
        dadosFormulario.get(
          'kmInicial'
        )
      );


    const kmFinal =
      Number(
        dadosFormulario.get(
          'kmFinal'
        )
      );


    const combustivelInicial =
      Number(
        dadosFormulario.get(
          'nivelCombustivelInicial'
        )
      );


    const combustivelFinal =
      Number(
        dadosFormulario.get(
          'nivelCombustivelFinal'
        )
      );


    // ----------------------------------------------
    // VALIDAR QUILOMETRAGEM
    // ----------------------------------------------

    if (
      kmFinal <
      kmInicial
    ) {

      document.querySelector(
        '#formHint'
      ).textContent =
        'O KM final não pode ser inferior ao KM inicial.';


      form.elements
        .kmFinal
        .classList
        .add(
          'invalid'
        );


      form.elements
        .kmFinal
        .focus();


      return;

    }


    // ----------------------------------------------
    // JSON EXACTAMENTE COMO O POWER AUTOMATE ESPERA
    // ----------------------------------------------

    const payload = {

      data:
        dadosFormulario.get(
          'data'
        ),

      turno:
        dadosFormulario.get(
          'turno'
        ),

      deslocacao:
        dadosFormulario.get(
          'tipoDeslocacao'
        ),

      hora_inicio:
        dadosFormulario.get(
          'horaSaida'
        ),

      hora_fim:
        dadosFormulario.get(
          'horaChegada'
        ),

      viatura:
        dadosFormulario.get(
          'viatura'
        ),

      motorista:
        dadosFormulario.get(
          'motorista'
        ),

      assistente:
        dadosFormulario.get(
          'assistente'
        ),

      rota:
        dadosFormulario.get(
          'rota'
        ),

      sentido:
        dadosFormulario.get(
          'sentido'
        ),

      km_inicio:
        kmInicial,

      km_fim:
        kmFinal,

      combustivel_inicio:
        combustivelInicial,

      combustivel_fim:
        combustivelFinal,

      observacoes:
        dadosFormulario.get(
          'observacoes'
        )
        ||
        ''

    };


    console.log(
      'Dados enviados ao Power Automate:',
      payload
    );


    // ----------------------------------------------
    // BLOQUEAR BOTÃO
    // ----------------------------------------------

    submitButton.disabled =
      true;


    submitButton
      .querySelector(
        'span'
      )
      .textContent =
        'A enviar...';


    document.querySelector(
      '#formHint'
    ).textContent =
      'A enviar o registo para o sistema...';


    try {


      // ============================================
      // ENVIO REAL
      // ============================================

      if (
        config.submissionUrl &&
        !config.demoMode
      ) {


        const response = await fetch(
          config.submissionUrl,
          {
            method: 'POST',
        
            headers: {
              'Content-Type': 'application/json'
            },
        
            body: JSON.stringify(payload)
          }
        );


        if (
          !response.ok
        ) {

          throw new Error(
            `Submissão recusada. HTTP ${response.status}`
          );

        }

      }


      // ============================================
      // MODO DEMONSTRAÇÃO
      // ============================================

      else {


        const entries =
          JSON.parse(
            localStorage.getItem(
              'sirDiarioBordoDemo'
            )
            ||
            '[]'
          );


        entries.push(
          payload
        );


        localStorage.setItem(
          'sirDiarioBordoDemo',
          JSON.stringify(
            entries
          )
        );

      }


      // ============================================
      // SUCESSO
      // ============================================

      form.hidden =
        true;


      successPanel.hidden =
        false;


      document.querySelector(
        '#successMessage'
      ).textContent =

        config.demoMode

          ?

          'Modo de demonstração: o registo ficou guardado neste dispositivo.'

          :

          'Os dados foram enviados para o sistema com sucesso.';


      document.querySelector(
        '#formHint'
      ).textContent =
        'Registo enviado com sucesso.';


      window.scrollTo(
        {
          top: 0,
          behavior: 'smooth'
        }
      );

    }

    catch (
      error
    ) {


      console.error(
        'Erro no envio para Power Automate:',
        error
      );


      document.querySelector(
        '#formHint'
      ).textContent =
        'Não foi possível enviar. Confirme a ligação e tente novamente.';

    }

    finally {


      submitButton.disabled =
        false;


      submitButton
        .querySelector(
          'span'
        )
        .textContent =
          'Enviar registos';

    }

  }
);


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


      pendingTrips = [];


      savedTrips = [];


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


      loadDailyHistory();

    }
  );


// ======================================================
// INICIALIZAÇÃO
// ======================================================

setToday();

loadMasterData();

updateProgress();

renderHistory();
