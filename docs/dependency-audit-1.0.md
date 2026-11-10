# Dependências — avaliação da candidata 1.0

Auditoria em 10/11/2026, mantendo o lockfile: **17 alertas em ferramentas (2 baixos, 15 moderados), zero altos/críticos e zero vulnerabilidades na auditoria de produção (`npm audit --omit=dev`).** Os 17 nomes não representam 17 causas independentes: são três advisories raiz propagados pelos consumidores. Nenhum pacote foi adicionado ou atualizado.

## Causas e exposição

| Causa                                                                                   | Severidade | Exposição neste projeto                                                                   | Tratamento                                                                                         |
| --------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [deepmerge: prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)     | Baixa      | Resolução de módulos/Workbox no build, sem receber backups pessoais ou servir API pública | Avaliar correção upstream em manutenção isolada; não presumir audit fix seguro                     |
| [glob: cancelamento por AbortSignal](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | Moderada   | Percurso de arquivos no build de precache, com caminhos definidos pelo projeto            | Não executar build sobre repositórios não confiáveis; avaliar correção compatível com Workbox/Node |
| [minimatch: amplificação de padrões](https://github.com/advisories/GHSA-g3hv-75wg-m249) | Moderada   | Globs de lint/build; não recebe arquivos importados pelo app                              | Padrões estáticos; revisar atualização compatível sem major/override automático                    |

A exposição é análise do código e grafo local, não garantia de impossibilidade de exploração. Ferramentas participam da cadeia de fornecimento. CI precisa de revisão de PRs, proteção de branch e npm ci; não executar código de terceiros com permissão de publicação. O workflow mantém contents:read na validação e concede pages/id-token:write somente no job manual de publicação.

## Todos os nomes reportados

| Pacote                               | Versão resolvida | Severidade | Origem reportada                         |
| ------------------------------------ | ---------------- | ---------- | ---------------------------------------- |
| @eslint-community/eslint-utils       | 4.10.1           | moderada   | eslint                                   |
| @eslint/config-array                 | 0.23.5           | moderada   | minimatch                                |
| @eslint/js                           | 10.0.1           | moderada   | eslint                                   |
| @rollup/plugin-node-resolve          | 16.0.3           | baixa      | deepmerge                                |
| @typescript-eslint/eslint-plugin     | 8.72.2           | moderada   | parser, type-utils, utils e eslint       |
| @typescript-eslint/parser            | 8.72.2           | moderada   | typescript-estree e eslint               |
| @typescript-eslint/type-utils        | 8.72.2           | moderada   | typescript-estree, utils e eslint        |
| @typescript-eslint/typescript-estree | 8.72.2           | moderada   | minimatch                                |
| @typescript-eslint/utils             | 8.72.2           | moderada   | eslint-utils, typescript-estree e eslint |
| deepmerge                            | 4.3.1            | baixa      | Prototype poisoning (raiz)               |
| eslint                               | 10.14.0          | moderada   | eslint-utils, config-array e minimatch   |
| eslint-plugin-react-hooks            | 7.1.1            | moderada   | eslint                                   |
| glob                                 | 11.1.0           | moderada   | AbortSignal (raiz) e minimatch           |
| minimatch                            | 10.2.6           | moderada   | Amplificação de globs (raiz)             |
| typescript-eslint                    | 8.72.2           | moderada   | eslint/plugin/parser/utils               |
| vite-plugin-pwa                      | 2.0.0            | moderada   | workbox-build                            |
| workbox-build                        | 7.4.1            | moderada   | plugin-node-resolve e glob               |

## Decisão de lançamento

Achados atuais não indicam falha do runtime pessoal, mas permanecem risco de ferramentas reconhecido e pendência de manutenção. Repetir auditoria antes da publicação: resultados mudam. Vulnerabilidade de produção, alta/crítica ou caminho explorável novo exige reclassificação como bloqueador. Não declarar ausência de riscos com base apenas em npm audit.
