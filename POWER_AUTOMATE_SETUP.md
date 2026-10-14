# Sincronização do Excel no SharePoint

Este fluxo actualiza os menus do formulário através de um evento enviado ao GitHub.

## Tabelas do workbook

- Frota: `tbl_frota`
- Motoristas: `tbl_motoristas`
- Assistentes: `tbl_motoristas16`
- Rotas: `Table18`

Para facilitar a manutenção futura, recomenda-se renomear `tbl_motoristas16` para `tbl_assistentes` e `Table18` para `tbl_rotas`.

## Fluxo no Power Automate

1. Criar um fluxo agendado com recorrência de 5 minutos.
2. Adicionar quatro acções **List rows present in a table** do Excel Online (Business), usando o mesmo workbook do SharePoint e as tabelas indicadas acima.
3. Adicionar uma acção **Select** para cada tabela e devolver apenas os códigos e estados:

### Viaturas

```json
{
  "codigo": "Código",
  "estado": "Estado"
}
```

### Motoristas

```json
{
  "codigo": "Código",
  "estado": "Estado"
}
```

### Assistentes

```json
{
  "codigo": "Código",
  "estado": "Estado"
}
```

### Rotas

```json
{
  "codigo": "Código da Rota",
  "estado": "Estado"
}
```

4. Adicionar a acção GitHub **Create a repository dispatch event**.
5. Preencher:

- Repository Owner: `sirmotors4-questionarios`
- Repository Name: `diario-bordo`
- Event Name: `sync-master-data`
- Event Payload:

```json
{
  "actualizadoEm": "@{utcNow()}",
  "viaturas": "@{body('Select_Viaturas')}",
  "motoristas": "@{body('Select_Motoristas')}",
  "assistentes": "@{body('Select_Assistentes')}",
  "rotas": "@{body('Select_Rotas')}"
}
```

Os nomes entre parênteses devem coincidir com os nomes dados às quatro acções Select no fluxo.

## Informação pública

O ficheiro `data/master-data.json` é público. O fluxo foi limitado a códigos e estados. Não envie nomes, matrículas, números de carta, contactos, documentos, datas de admissão ou outras informações pessoais.

## Consulta do histórico diário

O formulário consulta o histórico quando **Data** e **Viatura** estão preenchidas. Para activar esta função, crie um fluxo instantâneo chamado `WEB - Histórico Diário de Bordo`.

### 1. Gatilho HTTP

Use **When an HTTP request is received** e aceite o método `GET`. O formulário enviará estes parâmetros na URL:

- `data`: data no formato `AAAA-MM-DD`;
- `viatura`: código da viatura.

No fluxo, leia-os com:

```text
triggerOutputs()?['queries']?['data']
triggerOutputs()?['queries']?['viatura']
```

### 2. Ler a tabela Excel

Adicione **List rows present in a table** (Excel Online Business) e escolha:

- a localização e biblioteca do ficheiro no SharePoint;
- o mesmo workbook usado pelo fluxo `WEB - Registo Diário de Bordo`;
- a mesma tabela usada na acção **Add a row into a table** desse fluxo.

Active a paginação da acção se a tabela puder ultrapassar 256 linhas.

### 3. Filtrar data e viatura

Adicione **Filter array**. Em **From**, use o campo `value` da acção anterior. No modo avançado, use a expressão abaixo e ajuste `Data` e `Viatura` apenas se os cabeçalhos reais do Excel tiverem nomes diferentes:

```text
@and(
  equals(string(item()?['Data']), string(triggerOutputs()?['queries']?['data'])),
  equals(toUpper(trim(string(item()?['Viatura']))), toUpper(trim(string(triggerOutputs()?['queries']?['viatura']))))
)
```

Se a coluna Data do Excel incluir hora, substitua a primeira comparação por:

```text
equals(formatDateTime(item()?['Data'], 'yyyy-MM-dd'), triggerOutputs()?['queries']?['data'])
```

### 4. Preparar a resposta

Adicione **Select** com a saída do Filter array. Devolva somente os campos necessários ao cartão do histórico:

| Chave devolvida | Coluna no Excel |
|---|---|
| `data` | Data |
| `turno` | Turno |
| `deslocacao` | Deslocação |
| `hora_inicio` | Hora Início |
| `hora_fim` | Hora Fim |
| `viatura` | Viatura |
| `motorista` | Motorista |
| `assistente` | Assistente |
| `rota` | Rota |
| `sentido` | Sentido |
| `km_inicio` | KM Início |
| `km_fim` | KM Fim |
| `combustivel_inicio` | Combustível Início |
| `combustivel_fim` | Combustível Fim |
| `observacoes` | Observações |

Por fim, adicione **Response**:

- Status code: `200`
- Header `Content-Type`: `application/json`
- Header `Access-Control-Allow-Origin`: o domínio publicado do formulário
- Body:

```json
{
  "viagens": "@{body('Select_Historico')}"
}
```

Guarde o fluxo, copie a URL HTTP e coloque-a em `historyUrl` no ficheiro `config.js`. O código do formulário acrescenta automaticamente `data` e `viatura` à URL.

### Resultado no formulário

- viagens retornadas pelo Excel: cartão azul com `Já lançado`;
- viagens adicionadas antes do envio final: cartão verde com `Lançamento actual`;
- nenhuma viagem encontrada: `Não lançado`;
- o botão **Enviar registos** envia as deslocações adicionadas uma a uma para o fluxo de registo existente.
