# Diário de Bordo — SIR Motors

Aplicação web estática publicada em `https://sirmotors4-questionarios.github.io/diario-bordo/`.

## Estado actual

- Interface responsiva para telemóvel e computador.
- Listas de viaturas, motoristas, assistentes, rotas e tipos de deslocação.
- Filtragem de registos activos/disponíveis.
- Validação dos campos obrigatórios.
- Modo de demonstração com armazenamento apenas no navegador.

## Ligação aos dados

Edite `config.js` e indique dois endereços HTTPS:

- `masterDataUrl`: devolve as listas actualizadas em JSON.
- `submissionUrl`: recebe o registo preenchido em JSON.

Depois defina `demoMode: false`.

Nunca coloque palavras-passe, tokens do SharePoint ou chaves privadas nestes ficheiros. Todo o conteúdo de um site GitHub Pages é público.

## Publicação no GitHub Pages

O repositório chama-se `diario-bordo` dentro da conta `sirmotors4-questionarios`. Nas definições do repositório, active **Pages** a partir da branch `main` e da pasta raiz.
