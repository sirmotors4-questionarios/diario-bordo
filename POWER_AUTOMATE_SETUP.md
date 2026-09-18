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
