# Fase 6 — diagnóstico inicial

Auditoria da versão 0.5.0 antes das alterações de interface. React 19, TypeScript 6, Vite 8, Dexie 4 e HashRouter preservados. Schema v4, 35 tabelas, sem necessidade de migration. Nenhuma atualização de dependências proposta.

## Evidências e cobertura

Inspecionados shell, preferências, segurança, dashboard, check-in, hábitos, tarefas, calendário, acompanhamento, relatórios, todas as seções financeiras e metas/projetos, incluindo formulários compartilhados. Varredura de 24 rotas em dois temas em contexto isolado: 48 visitas, nenhum overflow horizontal no Pixel 7. Revisão visual de capturas e leitura dos tokens/CSS; a alteração nativa de tema do fixture exige recarregar para notificar o hook, portanto a matriz visual final repetirá a confirmação do tema efetivo. Não é validação em Android físico.

Baseline: lint, typecheck, 192 testes e build aprovados. Os 17 cenários E2E emitiram aprovação individual; fechamento do runner ainda em observação. Bundle inicial index: 318,09 kB (101,35 kB gzip), database: 190,61 kB (57,36 kB gzip); gráficos em chunk separado de 387,77 kB. Precache: 46 recursos, 1218,47 KiB. Rotas e gráficos já usam lazy loading. IndexedDB não será limpo nem reescrito.

## Prioridades

| Prioridade | Diagnóstico                                                                          | Ação                                                                                        |
| ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| P0         | Navegação desmonta formulários editados sem confirmação                              | Guarda de navegação e fechamento, sem guardar rascunhos sensíveis fora da memória           |
| P0         | Workflow publica automaticamente em push main                                        | Publicação somente manual, com ambiente de aprovação e validação prévia                     |
| P0         | Sem acesso comprovado a aparelho Android nem origem GitHub/HTTPS                     | Bloquear lançamento real até executar roteiro físico e verificar deploy autorizado          |
| P1         | Hero e três cards repetidos afastam o check-in do topo para quem já configurou o app | Priorizar acompanhamento real; manter apresentação somente no primeiro uso                  |
| P1         | Primeiro formulário pede planejamento completo antes do uso                          | Introdução opcional, nome/aparência e próximos passos independentes; preferências editáveis |
| P1         | Texto secundário claro e foco dourado exigem mais contraste                          | Tokens semânticos de contraste, erro, foco e superfícies; testar razões aplicáveis          |
| P1         | Textos pequenos, títulos/ações sem quebra e áreas de toque inconsistentes            | Melhorar leitura e alvos, testar 320 px, zoom e desktop                                     |
| P1         | Teclado pode disputar espaço com navegação fixa                                      | Adaptar à visualViewport sem presumir teclado real em emulação                              |
| P1         | Lista de metas/projetos com filtro sem resultado fica vazia                          | Estado vazio específico do filtro                                                           |
| P2         | Descrição de metas no início é genérica                                              | Exibir próximo objetivo e próximo marco real, respeitando privacidade                       |
| P2         | Transferência e parcelamento exigem buscar seção                                     | Ações diretas na visão financeira, mesmas validações                                        |
| P2         | 17 alertas de ferramentas, sem classificação por causa                               | Relatório por advisory e exposição, sem updates major automáticos                           |

## Limites da auditoria

Leitura de código, Chromium desktop com emulação mobile e testes automatizados não comprovam TalkBack, teclado do Android, instalação standalone física, quota, desempenho do KDF no celular, HTTPS público ou estabilidade de dados em fabricante específico. Estes itens permanecerão explícitos no checklist. Sem redesenho geral, transações automáticas, novas dependências, sincronização ou publicação.
