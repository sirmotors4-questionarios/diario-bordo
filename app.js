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


        const response =
          await fetch(
            config.submissionUrl,
            {

              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(
                  payload
                )

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
          'Enviar registo';

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

    }
  );


// ======================================================
// INICIALIZAÇÃO
// ======================================================

setToday();

loadMasterData();

updateProgress();
