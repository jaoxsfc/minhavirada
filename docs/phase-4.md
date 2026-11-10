# Minha Virada — Fase 4 · versão 0.4.0

## Auditoria antes de alterações

A versão 0.3.0 foi inspecionada: estrutura React/TypeScript/Vite, componentes, HashRouter, temas, Dexie v1/v2/v3, comandos financeiros, projeções, RHF/Zod, motor de tarefas, dashboard e backup. Não havia AGENTS.md nem repositório Git/remoto nesta pasta. As dependências e versões foram mantidas; nenhum pacote foi adicionado. O lockfile só muda a versão da aplicação.

Antes de editar: lint, typecheck, build, 106 testes unitários/de integração e 9 E2E passaram. A auditoria usou bancos de teste isolados, sem acessar ou alterar o perfil real do navegador.

## Funcionalidades

- Metas pessoais/financeiras criáveis, editáveis, concluíveis e arquiváveis; categoria, prioridade, descrição, início, prazo opcional, valor-alvo opcional, conta preferencial e observações.
- Sugestões confirmadas individualmente: reserva de R$ 10.000 editável, casamento, moradia, renda extra e saúde. Identidade única evita duplicar ao reabrir, inclusive quando arquivadas.
- Marcos editáveis com conclusão, prazo/orçamento opcionais e notas. Casamento/moradia começam com etapas sugeridas, sem quantias ou datas presumidas.
- Alocações bancárias e retiradas imutáveis com histórico, progresso, restante, disponibilidade por conta e evolução mensal. Pode alocar saldo existente ou transferir e alocar atomicamente.
- Projeção de prazo por histórico observado, com indicação explícita de insuficiência de dados.
- Oportunidades/projetos no mesmo cadastro, com etapas da ideia à conclusão/perda/cancelamento; cliente/origem, serviço, categoria, valores conhecidos ou desconhecidos, custos previstos, próxima ação, prazo, observações e arquivamento.
- Recebimentos parciais, custos realizados e estornos vinculados aos serviços financeiros existentes, além de histórico editável de tempo em minutos.
- Indicadores individuais e agregados: oportunidades, propostas, contratos, previsão restante, receita recebida, custos pagos, resultado líquido de caixa, tempo e receita por hora. Confirmação de cobertura evita indicadores enganosos.
- Tarefas vinculadas criadas no contexto de metas/projetos, com o mesmo motor da Fase 2; semana, conclusão e reabertura no contexto, edição/recorrência/adiamento na tela existente.
- Meu futuro: reserva, próxima prioridade, marcos próximos, oportunidades, recomendação determinística por dados reais e resumo semanal. Home mantém acesso compacto e não expõe detalhes privados das metas.
- Visão financeira mostra a parte do saldo alocada às metas e disponibilidade após compromissos/alocações, sem descontar reserva do patrimônio.
- Interface local/offline, responsiva, modo claro/escuro, controles rotulados, progresso nativo acessível e feedback de salvamento/erro.

## Arquitetura e invariantes

Foram preservados a organização em features/services/repositories/hooks, HashRouter, Dexie, RHF/Zod, temas e tokens. FutureForm centraliza formulários; LinkedTasks reaproveita TaskForm, saveTask, taskOccurrences e updateOccurrence.

Alocações são derivadas do ledger goalMovements; não há dois saldos de reserva para manter sincronizados. Não foi criada uma tabela goalAllocations redundante. Oportunidades e projetos compartilham projects, com stage; converter uma oportunidade em contrato não cria outro cadastro.

Comandos de metas/projetos usam a infraestrutura mutate existente: UUID, hash de payload, controle de revisão, transação e histórico financeiro. Postagens de projetos chamam saveEntry/payTarget; contribuições com transferência chamam addTransfer. A transação externa engloba todos os efeitos e reverte operações internas em caso de falha. Dexie.waitFor preserva o contexto transacional durante o hash assíncrono.

O lastro é conferido nas fronteiras de datas, com eventos ordenados e posição ao fim do dia. Cada meta/conta deve ser não negativa; todas as metas juntas devem caber no saldo confirmado da conta. Gastos, transferências, estornos e correções retroativas não podem descobrir uma reserva. A conta de origem de uma transferência para reserva precisa ter saldo livre suficiente, sem criar reserva por cheque especial.

Dinheiro permanece em centavos inteiros. Ticket, limites, valores previstos e estimados não são reserva. Alocação e retirada não geram receita/despesa. Transferências próprias não geram patrimônio. Arquivar mantém valores e histórico: reative a meta para liberar sua reserva.

Métricas usam pagamentos ativos; estornos preservam links e deixam de contar no realizado. Resultado líquido é de caixa até agora, exige confirmação de custos completos e não inclui custos ainda não pagos. Receita por hora exige tempo completo confirmado e minutos positivos. Campos desconhecidos são null. O tempo de check-ins não é convertido automaticamente em horas de projetos.

Projeção exige pelo menos 90 dias observados e ritmo líquido positivo nos últimos 90 dias. A primeira data de alocação é excluída para não extrapolar um saldo inicial como contribuição recorrente. Sem base suficiente, não há prazo inventado.

## Migração e backup

Migração Dexie v3 → v4 exclusivamente aditiva, sem upgrade que transforme ou apague registros:

| Tabela             | Finalidade                                                        |
| ------------------ | ----------------------------------------------------------------- |
| goals              | objetivos, revisões e identidade única de sugestão                |
| goalMilestones     | etapas, orçamento opcional e conclusão                            |
| goalMovements      | alocações/retiradas por conta, com vínculo único de transferência |
| projects           | oportunidades e projetos por etapa                                |
| projectReceipts    | vínculos únicos com entrada e pagamento de receita/custo          |
| projectTimeEntries | períodos dedicados em minutos e revisões                          |
| futureTaskLinks    | uma relação por tarefa com meta ou projeto                        |

As 28 tabelas anteriores, incluindo recoverySnapshots, são mantidas. O teste de migração abre um banco nativo v30 e compara o conteúdo de cada tabela anterior depois da abertura em v4; tabelas novas começam vazias. Os testes anteriores continuam cobrindo migrações v1/v2, saúde, hábitos, tarefas, cartões, ticket e preferências.

Backup v4 inclui as sete novas tabelas, estrutura Zod, checksum e validação de relações/lastro. Arquivos v3 legítimos são validados e normalizados para v4 com novas entidades vazias. Snapshots de recuperação v3 continuam importáveis. A prévia normalizada pode ser restaurada sem divergência de checksum. Antes da substituição, o estado atual é preservado em recoverySnapshots dentro da mesma transação. O formato continua JSON legível, sem senha; isso não implementa a Fase 5.

## Arquivos novos

- src/features/future/models.ts
- src/features/future/form-fields.ts
- src/features/future/FutureForm.tsx
- src/features/future/FuturePage.tsx
- src/features/future/FutureOverview.tsx
- src/features/future/FutureSummary.tsx
- src/features/future/GoalDetails.tsx
- src/features/future/ProjectDetails.tsx
- src/features/future/LinkedTasks.tsx
- src/features/future/ReservationSummary.tsx
- src/repositories/future.ts
- src/repositories/future-data.ts
- src/hooks/useFuture.ts
- src/services/future-calculations.ts
- src/services/future-backup.ts
- src/styles/future.css
- src/tests/future.test.ts
- src/tests/future-backup.test.ts
- src/tests/future-privacy.test.tsx
- e2e/future.spec.ts
- docs/phase-4.md

## Arquivos atualizados

- src/db/database.ts
- src/db/backup-contract.ts
- src/services/finance/transaction.ts
- src/services/backup.ts
- src/app/App.tsx
- src/main.tsx
- src/features/dashboard/Dashboard.tsx
- src/features/finance/FinanceOverview.tsx
- src/features/finance/FinancialSummary.tsx
- src/features/tasks/TaskForm.tsx
- src/features/settings/BackupPage.tsx
- src/tests/finance-backup.test.ts
- src/tests/settings.test.ts
- src/tests/routines.test.ts
- package.json
- package-lock.json
- README.md
- docs/financial-invariants.md
- docs/design-system.md

## Verificação final

- npm run lint: aprovado.
- npm run typecheck: aprovado.
- npm test: 152 testes aprovados em 13 arquivos; 46 novos testes nesta fase.
- npm run build: aprovado, PWA gerado com 46 recursos estáticos em precache.
- npm run test:e2e: 13 cenários aprovados; 4 novos cenários. Chromium/Pixel 7, pt-BR, America/Sao_Paulo, persistência offline, navegação, temas e largura desktop.
- Revisão visual de capturas mobile clara, mobile escura e desktop; sem transbordamento horizontal.
- Os testes antigos foram mantidos, com atualização apenas das expectativas da versão atual do schema/backup.
- Bancos e contextos de testes isolados. Nenhuma exclusão/importação foi feita nos dados reais do usuário.

## Limitações e próxima fase

Android físico ainda exige verificação de instalação HTTPS, teclado, suspensão/reabertura e modo avião. As capturas/testes usam emulação Chromium; não substituem esse teste.

Não há integração bancária, conferência automática de comprovantes, WhatsApp, notificações sensíveis ou sincronização. Confirme apenas movimentos reais e evite lançar novamente um recebimento já registrado por outro fluxo. Não há associação retroativa pela interface a pagamentos antigos: novos recebimentos/custos de projetos são registrados pelo fluxo do projeto.

Correções de alocações usam retirada e novo aporte, mantendo o histórico; não se edita uma contribuição silenciosamente. A retirada só libera a alocação. A composição com transferência está disponível no aporte; depois de liberar, faça eventual transferência em Finanças. Cobertura é validada ao fim de cada dia, sem intradia/horários bancários.

Indicadores e projeções dependem da completude dos registros informados. O prazo projetado é estimativo e não aconselhamento financeiro. Nenhuma receita prevista vira dinheiro automaticamente.

Backups e IndexedDB permanecem legíveis no dispositivo. Próxima fase recomendada: Fase 5, proteção e recuperação dos dados, incluindo criptografia de backups e validação de recuperação conforme seu escopo. As Fases 5 e 6 não foram implementadas. Nenhuma publicação/deploy foi realizada; não há remoto configurado.
