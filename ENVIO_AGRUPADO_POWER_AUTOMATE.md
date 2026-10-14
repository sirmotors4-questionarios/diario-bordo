# Integração do envio agrupado — Power Automate

A versão nesta ramificação é uma preparação. **Não publicar até adaptar e testar o fluxo de submissão**. O fluxo actual recebe um único objecto por pedido; o novo formulário envia um envelope com `registos`, uma lista de objectos com as mesmas propriedades de cada registo anterior.

## Corpo de entrada

```json
{
  "registos": [
    {
      "data": "2026-09-18",
      "turno": "Manhã",
      "viatura": "AOT 487 MC",
      "motorista": "M1",
      "assistente": "A1",
      "deslocacao": "Operacional",
      "hora_inicio": "12:20",
      "hora_fim": "13:35",
      "rota": "Rota 6",
      "sentido": "Museu → Matola Gare",
      "km_inicio": 5318,
      "km_fim": 5353,
      "combustivel_inicio": 12.4,
      "combustivel_fim": 11.5,
      "observacoes": ""
    }
  ]
}
```

## Ajustes obrigatórios ao fluxo de submissão

1. No accionador HTTP POST, definir esquema com `registos` como array obrigatório e objectos contendo os nomes e tipos do contrato acima.
2. Validar que há pelo menos um elemento e que **todos** têm Data, Viatura, Hora, KM e demais campos obrigatórios. Validar que KM final não é inferior ao inicial.
3. Iterar pelos elementos usando Apply to each: `triggerBody()?['registos']`. No passo `Add a row into a table` da tabela `tbl_diario_bordo`, usar `items('Apply_to_each')?['km_inicio']` e equivalentes para cada coluna. Preservar mapeamentos actuais de conversão de datas, horas, códigos e tipos.
4. Não devolver confirmação de sucesso antes de todas as linhas serem efectivamente gravadas. Após concluir, devolver resposta HTTP 200 com JSON no formato `{"sucesso":true,"gravados":1}`, sendo gravados a quantidade REAL de linhas inseridas.
5. **Importante:** um loop de escrita de linhas Excel NÃO é uma transacção atómica. Se uma linha falhar depois de outra ter sido criada, podem existir inserções parciais. Para evitar duplicados num reenvio, implementar identificador único por lote e por registo, detecção de duplicados e reconciliação. Não responder com sucesso em caso de inserção parcial; permitir verificação administrativa antes de reenvio. É necessária essa salvaguarda antes da utilização em produção.
6. Testar lote de 2 ou mais registos, validações de erro e repetição da mesma requisição; confirmar todas as linhas e histórico via GET.
7. Rever o mecanismo de autenticação: o `config.js` público contém actualmente uma URL assinada do Power Automate. A opção Anyone expõe o endpoint a chamadas de terceiros.

## Interface

Os registos já lançados são só de leitura (azul) no histórico. Os correntes aparecem a verde, podem ser editados e removidos antes da submissão. Um único clique em Enviar registos envia todo o lote.
