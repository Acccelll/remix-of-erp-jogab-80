# Base geográfica — municípios brasileiros

## `municipios-br.json`

Coordenadas dos 5.571 municípios brasileiros, usadas pela tela
`/rh/logistica` para posicionar colaboradores e obras no mapa a partir de
cidade + UF, sem depender de serviço externo de geocodificação.

- **Fonte:** dados do IBGE, compilados em
  [`kelvins/municipios-brasileiros`](https://github.com/kelvins/municipios-brasileiros)
  (licença MIT, © 2016 Kelvin S. do Prado).
- **Formato:** `{ fonte, formato, total, municipios: [[nome, uf, lat, lng], …] }`,
  ordenado por UF e depois por nome.
- **Precisão:** coordenadas arredondadas para 4 casas (~11 m) — o suficiente
  para posicionamento em nível de cidade e o que mantém o arquivo em ~220 KB
  (~77 KB comprimido).

Fica em `public/` de propósito: é buscado sob demanda por
`src/lib/logistica/municipios.ts` quando a tela de logística abre, e não
entra no bundle JavaScript.

### Como regerar

```js
// a partir de json/municipios.json e json/estados.json do repositório acima
const ufPorCodigo = Object.fromEntries(estados.map((e) => [e.codigo_uf, e.uf]));
const municipios = mun
  .map((m) => [
    m.nome,
    ufPorCodigo[m.codigo_uf],
    Math.round(m.latitude * 1e4) / 1e4,
    Math.round(m.longitude * 1e4) / 1e4,
  ])
  .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0], "pt-BR"));
```

Ao atualizar, conferir que `total` bate com o número de municípios do IBGE
vigente — o teste `src/lib/logistica/__tests__/municipios.test.ts` valida a
integridade do arquivo.
