# Entrega da Fase 3 — Minha Virada 0.3.0

## Resultado

Módulo financeiro local e offline integrado à arquitetura existente: contas, receitas/despesas, regras recorrentes, cartões e parcelas, faturas e pagamentos, transferências, benefício separado, orçamentos, calendário, relatórios/CSV, projeções de 12 meses e exportação/recuperação de segurança. Fase 4 não iniciada.

## Auditoria inicial

Foram inspecionados estrutura, dependências, schema, migrations, rotas, dashboard, componentes, design system, formulários, hooks, testes e PWA antes da implementação. O banco encontrado era v2, com nove tabelas: settings, audit, checkIns, habits, habitLogs, attempts, tasks, taskRecords e routineEvents. As declarações v1/v2 foram preservadas.

A referência inicial executou lint, typecheck, 46 testes unitários/integrados, build PWA e 5 E2E. Todos passaram antes das alterações financeiras. Não havia AGENTS.md no projeto nem repositório remoto configurado.

Reutilizamos Shell/HashRouter, lazy loading, temas, fontes, tokens, navegação inferior, formulário de preferências, PWA e componentes de feedback. Não recriamos o projeto. Nenhuma dependência de runtime foi adicionada; a única adição foi `@types/node@24.19.2` em desenvolvimento para tipar Web Crypto nativo nos testes de Node 24. Versão do app/lockfile: 0.3.0.

## Funcionalidades

- Onboarding financeiro independente, com parâmetros sugeridos/editáveis e categorias confirmadas. Não cria contas, dinheiro, receitas, despesas ou regras automaticamente.
- Contas próprias e de benefício, com referência/saldo inicial confirmado, status e cor. Saldos derivados de fatos confirmados; proteção de referência após uso.
- Receitas e despesas manuais, previstas/pendentes/parciais/pagas/canceladas; competência, vencimento e data de pagamento distintos; edição protegida, cancelamento lógico, pagamentos parciais, estornos e histórico antes/depois.
- Categorias personalizadas, edição e arquivamento; elegibilidade para benefício e proteção de histórico já utilizado.
- Recorrências mensal, semanal, anual e por dias; início/fim, ocorrências únicas, edição de uma ocorrência ou das próximas, preservando pagamentos e cancelamentos manuais.
- Múltiplos cartões, limite, fechamento, vencimento, conta padrão, compras em uma ou várias parcelas, faturas, pagamentos parciais, estorno integral e crédito carregado entre faturas.
- Transferências próprias, sem classificação como receita/despesa, com estorno auditável.
- Benefício acumulativo com extrato próprio, créditos, consumos, ajustes assinados e categoria não elegível somente mediante confirmação. Pagamento vinculado e extrato não são contados duas vezes.
- Orçamentos por mês/categoria/fonte, comparação com registros e indicação de margem/excesso. Orçamentos do ticket podem estimar a parcela mensal ainda não utilizada, sem alterar saldo real.
- Dashboard financeiro com saldo bancário, compromissos, saídas confirmadas, ticket separado, vencimentos e simulação até o próximo salário. Resumo compacto integrado ao início, preservando rotina e privacidade anterior.
- Calendário mensal de vencimentos, filtros por mês/estado/conta/categoria e pesquisa. Relatório de competência separado do caixa realizado, histórico mensal, gráficos e CSV.
- Projeções de 12 meses e cenários conservador/base/otimista com hipóteses editáveis. Valores pagos não são descontados novamente; ausência de receita não inventa salário; variáveis desconhecidas geram aviso de incompletude; saldo negativo e encerramento de parcelas são sinalizados.
- Backup v3 de todos os dados, validação estrutural/relacional, checksum canônico, pré-visualização, restauração confirmada e atômica com cópia anterior. Aviso de ausência de cópia recente confirmada pelo usuário.

## Arquitetura financeira

| Camada                                         | Responsabilidade                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `features/finance/models.ts`                   | Entidades e schemas Zod                                                  |
| `services/finance/money.ts`, `dates.ts`        | Entrada monetária, divisão de centavos e calendários                     |
| `services/finance/calculations.ts`, `views.ts` | Saldos, obrigações, competência, caixa, orçamento, projeções e seletores |
| `services/finance/*-commands.ts`               | Operações por domínio, validações e vínculos                             |
| `services/finance/transaction.ts`              | Transações, UUIDs, revisão, idempotência e histórico                     |
| `services/finance/commands.ts`                 | Fachada pública dos comandos                                             |
| `services/finance/forms.ts`                    | Adaptação de formulário para comandos validados                          |
| `repositories/finance-data.ts`                 | Snapshot tipado e nomes de tabelas financeiras                           |
| `hooks/useFinance.ts`                          | Leitura reativa consistente                                              |
| `features/finance/*.tsx`                       | Apresentação e ações, usando serviços de domínio                         |
| `services/backup.ts`                           | Snapshot completo, validação, checksum e recuperação                     |

Não há saldo calculado gravado como fonte de verdade ou regras financeiras embutidas nos componentes. A trilha privada de alterações faz parte do banco e do backup; não há logs de saldos ou dados pessoais no console nem envio para servidores.

Leia as regras completas em [financial-invariants.md](financial-invariants.md). Exemplos centrais:

- R$ 100,01 em três parcelas = R$ 33,34 + R$ 33,34 + R$ 33,33.
- Comprar R$ 100,01 no cartão não debita o banco. Pagar R$ 10 reduz o banco em R$ 10, mantendo a compra reconhecida uma única vez no relatório de despesas.
- Estornar a compra após pagar R$ 10 gera crédito no cartão; não devolve automaticamente R$ 10 ao banco.
- Ticket não é banco, e limite não é dinheiro.
- Transferir R$ 100 entre contas próprias não aumenta receita nem diminui o total bancário.
- Salário sugerido não é salário recebido. Uma projeção nunca modifica o saldo real.

## Migração v2 → v3

Migração aditiva em `src/db/database.ts`, sem limpeza/recriação/transformação das nove tabelas anteriores. As tabelas novas são:

| Grupo                 | Tabelas                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| Cadastro              | financeAccounts, financeCategories, financeSettings                                  |
| Obrigações            | financeEntries, financeRules, financeOccurrences                                     |
| Cartões               | financeCards, financePurchases, financeInstallments, financeInvoices, financeCredits |
| Fatos financeiros     | financePayments, financeTransfers, benefitLedger                                     |
| Planejamento          | financeBudgets                                                                       |
| Integridade/histórico | financeOperations, financeChanges                                                    |
| Recuperação           | backupState, recoverySnapshots                                                       |

Índices incluem conta, categoria, datas, cartão, estado e entidade. Chaves únicas protegem regra/data, compra/número da parcela, cartão/ciclo, pagamento/extrato e mês/categoria/fonte do orçamento. Entidades financeiras usam UUIDs; singletons de configuração têm chave fixa. Nenhuma movimentação financeira é inserida pela migração.

O teste de upgrade v2 compara todas as tabelas anteriores, incluindo consumo, gatilhos, privacidade, conclusões de hábitos, tarefas e histórico. Também mantivemos a compatibilidade do upgrade v1 até a versão atual e acrescentamos migração nativa no Chromium.

## Backup antecipado

A Fase 3 introduz o núcleo JSON recuperável solicitado, sem antecipar criptografia por senha ou funcionalidades de metas. Inclui todas as fases anteriores e financeiras; exclui cópias internas recursivas. Formato/schema v3, checksum SHA-256 canônico e validação de totais, ciclos, vínculos, parcelas, IDs, tipos e duplicidades.

A pré-visualização validada pode ser lida novamente sem depender da ordem dos campos JSON. Há teste específico com auditoria legada, preferências e cancelamento, além de reversão de pagamento seguida de correção do lançamento.

Restaurar exige digitar RESTAURAR. A cópia anterior e a substituição são uma só transação; falha de escrita desfaz tudo. A interface permite baixar a cópia anterior para importá-la pelo mesmo fluxo. Não há merge silencioso. Limites: 20 MB e 100 mil registros por tabela. Não é arquivo criptografado ou assinado, e checksum não comprova autoria.

## Arquivos criados

- `src/features/finance/`: models.ts, shared.ts, FinancePage.tsx, FinanceForm.tsx, FinanceOverview.tsx, FinancialSummary.tsx, FinanceAccounts.tsx, FinanceEntries.tsx, FinanceCards.tsx, FinanceBenefit.tsx, FinanceCalendar.tsx, FinancePlans.tsx, FinanceReports.tsx, FinanceCharts.tsx.
- `src/services/finance/`: money.ts, dates.ts, calculations.ts, views.ts, transaction.ts, account-commands.ts, entry-commands.ts, card-commands.ts, payment-commands.ts, benefit-commands.ts, commands.ts, forms.ts.
- `src/services/backup.ts`, `src/features/settings/BackupPage.tsx`.
- `src/repositories/finance-data.ts`, `src/hooks/useFinance.ts`, `src/lib/csv.ts`, `src/styles/finance.css`.
- `src/tests/finance-fixtures.ts`, finance-money.test.ts, finance-ledger.test.ts, finance-projection.test.ts, finance-backup.test.ts.
- `e2e/finance.spec.ts`, este relatório e `docs/financial-invariants.md`.

## Arquivos modificados

- `src/db/database.ts`: schema aditivo e tabelas tipadas v3.
- `src/db/backup-contract.ts`: versão de dados local atualizada; contratos da Fase 2 preservados.
- `src/app/App.tsx`: rotas financeiras e de backup reais, mantendo destinos da Fase 4 indisponíveis.
- `src/features/dashboard/Dashboard.tsx`: resumo financeiro e acesso ao módulo.
- `src/main.tsx`: estilos financeiros locais.
- `src/tests/setup.ts`: Web Crypto nativo para o ambiente de teste.
- `src/tests/settings.test.ts`, `src/tests/routines.test.ts`: expectativas de versão atualizadas, mantendo testes de comportamento anteriores.
- `tsconfig.json`, `package.json`, `package-lock.json`: tipos Node dos testes e versão 0.3.0.
- README e documentação do design system.

Rotina, saúde, preferências, navegação principal, PWA, base path e workflow GitHub Pages foram preservados. Nenhuma configuração de serviços externos foi introduzida.

## Validação executada

| Verificação                       | Resultado                                                     |
| --------------------------------- | ------------------------------------------------------------- |
| `npm.cmd run lint`                | Aprovado, sem avisos                                          |
| `npm.cmd run typecheck`           | Aprovado                                                      |
| `npm.cmd test`                    | 106 testes aprovados, 10 arquivos                             |
| `npm.cmd run build`               | Aprovado; manifest, service worker e recursos offline gerados |
| `npm.cmd run test:e2e`            | 9 cenários aprovados, Chromium com Pixel 7 emulado            |
| `npm.cmd audit --omit=dev --json` | Zero vulnerabilidades de produção                             |

São 46 testes anteriores e 60 financeiros novos. A cobertura inclui centavos/resíduos, datas/fechamento, receitas/despesas, caixa e competência, parcial, estornos, concorrência/idempotência, saldo inicial, transferências, ticket/elegibilidade, recorrências, edição futura/reativação, orçamentos, cenários, ausência de receita, saldo negativo, fim de parcelas, persistência, migração, exportação, validação, restauração/rollback e pré-visualização normalizada.

Dos 9 E2E, 5 são regressões das fases anteriores e 4 novos: banco/ticket/pagamentos/estorno/offline; cartão/parcelas/fatura/relatório/CSV/projeção; download/importação/restauração com cópia anterior; e upgrade v2 preservando check-in/privacidade antes do onboarding financeiro.

Capturas mobile offline e desktop escuro foram inspecionadas. Os dados de testes e imagens são sintéticos, isolados do perfil real. O JSON em test-results é um artefato de teste, não backup dos dados do usuário.

A execução local usou o preview na porta 4337 e PLAYWRIGHT_EXTERNAL_SERVER=1, conforme a limitação Windows já documentada. O CI Linux continua com servidor próprio. Os 15 alertas de ferramentas transitivas conhecidos permanecem documentados, sem mudança forçada de versões principais.

## Limitações

- Android foi emulado; teste em aparelho físico, instalação, teclado, suspensão e modo avião continuam pendentes.
- Sem integração bancária, conciliação automática, importação OFX/CSV ou cálculo de encargos. Confirmações representam fatos informados pelo usuário.
- Estorno de compra é integral. Valor de compra/fatura depende dos registros; regras específicas de emissores e devolução bancária de crédito de cartão não são conciliadas automaticamente.
- Saldos iniciais usados e ciclos de cartão com histórico são protegidos. Mudanças de ciclo exigem novo cadastro, para não alterar retroativamente faturas.
- Projeções de 12 meses são hipóteses explícitas e podem ser incompletas. Materialização automática de recorrências alcança esse horizonte; parcelas já cadastradas preservam seu prazo completo.
- JSON e IndexedDB não são criptografados. Cópias internas não substituem arquivo externo; clearing do navegador pode apagar tudo. Recursos completos de senha/cripto ficam para a Fase 5.
- Não houve auditoria formal completa com leitor de tela nem publicação, pois não há remoto GitHub configurado. O workflow de publicação foi mantido.

## Próximos passos

Validar instalação/uso offline e recuperação com uma cópia de teste em Android físico. Depois, a fase recomendada é Metas e renda extra, com alocação financeira sem dupla contagem. **Nenhuma funcionalidade da Fase 4 foi implementada nesta entrega.**
