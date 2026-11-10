# Entrega da Fase 2 — Minha Virada 0.2.0

## Auditoria antes de alterar os arquivos

A pasta foi inspecionada, incluindo shell/rotas, componentes, formulários, hooks, repositório de preferências, CSS, banco, PWA, testes e workflow Pages. Não havia AGENTS.md no projeto. A arquitetura da Fase 1 foi mantida.

O schema encontrado era v1, com apenas `settings` e `audit`, sem migrações históricas. Componentes e recursos reutilizados: Shell/HashRouter, PwaStatus, configuração inicial e privacidade, painel/cards, tokens de cores, temas, fontes locais, foco e navegação mobile com safe area. Novos componentes usam os mesmos tokens.

As versões instaladas foram verificadas com `npm ls --depth=0`:

| Grupo         | Versões instaladas                                                |
| ------------- | ----------------------------------------------------------------- |
| Interface     | React/React DOM 19.3.1; React Router 7.18.5; Lucide 1.71.0        |
| Persistência  | Dexie 4.4.7; dexie-react-hooks 4.4.0                              |
| Formulários   | React Hook Form 7.91.0; resolvers 7.0.5; Zod 4.6.7                |
| Gráficos      | Recharts 3.10.1                                                   |
| Build/estilos | Vite 8.3.7; TypeScript 6.0.3; Tailwind 4.3.5                      |
| PWA           | vite-plugin-pwa 2.0.0                                             |
| Testes        | Vitest 5.1.0; RTL 16.3.3; Playwright 1.65.0; fake-indexeddb 6.2.8 |

Nenhuma dependência foi adicionada ou atualizada. Apenas a versão do aplicativo passou para 0.2.0 no manifesto e lockfile.

**Referência inicial executada antes das alterações:** lint e typecheck aprovados; 9 testes em 2 arquivos aprovados; build PWA aprovado; os 2 E2E anteriores aprovados, incluindo navegação, temas e offline.

## Funcionalidades implementadas

- Check-in completo por data local, com consumo explícito sim/não, validação, edição, confirmação, unicidade por data e revisão otimista. Uma edição antiga não sobrescreve silenciosamente alterações concorrentes.
- Acompanhamento privado com datas iniciais e novas etapas preservadas, totais, sequência confirmada, lacunas, vontade/gatilhos e últimas 8 semanas. Não há diagnóstico, tratamento ou linguagem punitiva.
- Cadastro/edição/arquivamento/reativação de hábitos; frequência, categoria, início, descrição, dias preferenciais, duração sugerida e histórico. As quatro sugestões exigem confirmação e usam identificadores estáveis para não duplicar.
- Tarefas pontuais, diárias e semanais; horário, prioridade e duração; edição, conclusão, reabertura, adiamento, histórico, filtros por intervalo/estado e arquivamento.
- Dashboard conectado a IndexedDB: check-in de hoje, tarefas próximas, hábitos programados, conclusões rápidas, registros e minutos da semana. Finanças permanecem indisponíveis, sem saldo inventado.
- Calendário com registro/ausência/atividade distintos e detalhe por dia, sem inferir ausência de consumo em dias não preenchidos.
- Relatórios semanais e mensais de humor, energia, atividade e projetos; gráficos com lacunas reais e tabela de dados acessível. Animações dos gráficos são desabilitadas, respeitando quem prefere menos movimento.
- Privacidade por padrão no início e calendário; os detalhes sensíveis exigem acesso às áreas pessoais ou consentimento na configuração. Nenhuma notificação ou telemetria foi adicionada. Observações e gatilhos não aparecem no dashboard.
- Datas atuais do dashboard são atualizadas ao retornar ao app e na virada do dia. Um check-in em edição mantém a data aberta e seu rascunho.

## Migração criada

`src/db/database.ts` mantém a declaração v1 e adiciona v2. É uma alteração aditiva de schema; não há transformação de dados que exija callback `upgrade`.

| Tabela nova     | Identidade/índices relevantes                           |
| --------------- | ------------------------------------------------------- |
| `checkIns`      | Data local como chave primária                          |
| `habits`        | ID, status, início                                      |
| `habitLogs`     | Chave composta hábito + data                            |
| `attempts`      | ID e data inicial única                                 |
| `tasks`         | ID, status, início                                      |
| `taskRecords`   | Tarefa + data original; vencimento e estado             |
| `routineEvents` | ID incremental; entidade, entidade ID, data e timestamp |

`settings` e `audit` permanecem intactas. Não são criados hábitos, check-ins, etapas ou movimentos financeiros automaticamente. Migração validada tanto com Dexie/fake-indexeddb quanto com um banco v1 nativo no Chromium, preservando nome, salário planejado, tema e privacidade.

Ocorrências recorrentes são calculadas para o período consultado. Somente ações confirmadas geram um registro, com identidade estável. Adiar muda a data de vencimento, preservando a original; concluir novamente é idempotente. Histórico de ações e entidade é gravado na mesma transação.

`src/db/backup-contract.ts` prepara versão, lista de tabelas e validadores serializáveis para o backup da Fase 5. Não implementa exportação ou restauração nesta fase.

## Arquivos criados

- `src/components/RoutineUI.tsx`: estados de dados, feedback, validação visual, seletor de dias e ação protegida contra envio simultâneo.
- `src/features/dashboard/DailyOverview.tsx`: resumo real do dia/semana e ações rápidas.
- `src/features/habits/models.ts`, `CheckInPage.tsx`, `HabitForm.tsx`, `HabitsPage.tsx`, `TrackingPage.tsx`, `CalendarPage.tsx`.
- `src/features/tasks/models.ts`, `TaskForm.tsx`, `TasksPage.tsx`.
- `src/features/reports/ReportsPage.tsx`.
- `src/repositories/routines.ts` e `src/services/routines.ts`.
- `src/hooks/useRoutines.ts`, `src/hooks/useLocalToday.ts`.
- `src/lib/calendar.ts`, `src/lib/routine-events.ts`.
- `src/db/backup-contract.ts` e `src/styles/routines.css`.
- `src/tests/routines.test.ts`, `routine-calculations.test.ts`, `privacy.test.tsx`, `checkin-ui.test.tsx`.
- `e2e/routines.spec.ts` e este relatório.

## Arquivos modificados

- `src/app/App.tsx`: rotas reais da Fase 2 e lazy loading; destinos financeiros continuam indisponíveis.
- `src/features/dashboard/Dashboard.tsx`: integra o resumo e preserva saudação, data e configuração.
- `src/db/database.ts`: migração aditiva e tabelas tipadas.
- `src/main.tsx`: estilos de rotina e mensagens Zod em português brasileiro.
- `src/tests/settings.test.ts`: atualiza expectativas de versão, mantendo os testes de persistência, validação e rollback.
- `vite.config.ts`: `clientsClaim` para garantir controle da primeira aba após a instalação inicial do service worker. `registerType: prompt` permanece; atualizações futuras continuam exigindo confirmação.
- `playwright.config.ts`: locale pt-BR e fuso America/Sao_Paulo.
- `package.json`, `package-lock.json`, `README.md`, `docs/design-system.md`: versão, documentação e componentes.

O workflow Pages existente e a estratégia de build/base path não foram substituídos.

## Testes executados e resultados

| Comando                 | Resultado final                             |
| ----------------------- | ------------------------------------------- |
| `npm.cmd run lint`      | Aprovado, sem avisos                        |
| `npm.cmd run typecheck` | Aprovado                                    |
| `npm.cmd test`          | 46 testes aprovados, 6 arquivos             |
| `npm.cmd run build`     | Aprovado; manifest e service worker gerados |
| `npm.cmd run test:e2e`  | 5 cenários aprovados em Chromium/Pixel 7    |

Os 46 testes incluem a base da Fase 1 e criação/edição/unicidade/concorrência de check-ins; validação; persistência/reabertura; rollback; consumo e lacunas; etapas; CRUD/arquivamento de hábitos; sugestões idempotentes; tarefas diárias/semanais, filtros, conclusão/adiamento/histórico; calendário e ano bissexto; semanas atravessando domingo/segunda; gráficos com `null`; privacidade; contratos de backup e preservação de rascunho na meia-noite.

Os 5 E2E cobrem os 2 cenários da fundação e 3 novos: jornada de check-ins/edição/acompanhamento/calendário/consentimento/relatórios/reabertura offline; hábitos/tarefas editáveis sem duplicação; e migração v1 no navegador com perfil preservado.

O teste offline encontrou uma condição de corrida na primeira ativação do service worker, corrigida com `clientsClaim`. A suíte final completa passou com o controle confirmado antes de desconectar.

A execução local usou o preview na porta 4337, `PLAYWRIGHT_EXTERNAL_SERVER=1` e o navegador em `.playwright`, conforme a limitação Windows já documentada na Fase 1. O workflow Linux continua gerenciando seu servidor exclusivo.

Capturas de teste revisadas: formulário mobile offline, tarefas mobile, dashboard claro e relatórios desktop escuros. As imagens são geradas em `test-results` e usam exclusivamente dados sintéticos criados pelos testes, nunca dados reais do usuário.

## Limitações e próximos passos

- A validação Android foi emulada em Chromium/Pixel 7. Instalação, teclado, suspensão/reabertura e modo avião em Android físico ainda precisam de teste no dispositivo.
- Não foi realizada auditoria formal completa de acessibilidade. Há labels, estados, foco, navegação e alternativa tabular para gráficos; a revisão com leitor de tela permanece recomendada.
- Backup, restauração, criptografia e exclusão com confirmação pertencem à Fase 5. IndexedDB continua sem criptografia, sem sincronização e sujeito a perda se o navegador apagar dados. Nenhuma promessa de recuperação foi adicionada.
- Os limites de visualização do histórico e regras de agenda estão documentados no README; os registros completos permanecem no banco.
- Não houve publicação, pois não há repositório remoto GitHub configurado nesta pasta. O workflow anterior foi preservado.
- Alertas conhecidos de dependências de ferramentas da Fase 1 permanecem documentados; dependências não foram alteradas.

Próximo passo desta entrega: validar os fluxos e a instalação no Android físico com dados de teste. A Fase 3 não foi iniciada.
