# Minha Virada — Fase 6

Versão entregue: **1.0.0-rc.1**, candidata à 1.0.0. Não houve publicação. A aprovação de uso real depende dos bloqueadores físicos/públicos em [release-1.0-checklist.md](release-1.0-checklist.md).

## Diagnóstico e decisões

O [diagnóstico inicial](phase-6-audit.md) priorizou perda acidental de edições, publicação automática, distância entre abertura e check-in, onboarding extenso, contraste/toque, estados vazios e classificação de dependências. Todas as áreas foram inspecionadas em código e varredura de rotas; a matriz final abre seções financeiras configuradas, não apenas suas telas iniciais.

Preservados React/TypeScript/Vite, Dexie v4/35 tabelas, repositories/services, validação Zod/RHF, cálculos em centavos, backup e identidade visual. Não há migration nem reescrita de dados. Nenhuma dependência nova ou upgrade major. Sem sincronização, autenticação ou integração WhatsApp.

A navegação continua por hash com os mesmos caminhos, agora usando `createHashRouter`/`RouterProvider` da biblioteca existente. Esta adaptação habilita `useBlocker`, necessário para bloquear links e voltar sem desmontar a edição; não troca o framework nem exige fallback de rotas do servidor.

## Interface e experiência

- Tokens semânticos de texto secundário, foco, erro, sucesso, bordas de controles, séries de gráficos e superfície suave, mantendo verde #173E34, off-white #F6F3EB, dourado #C6A56B e verde claro #DCE9DE. Temas claro/escuro/automático continuam disponíveis.
- Texto secundário e controles mais legíveis, alvos principais de 44 px, quebra de títulos/ações, cards e espaçamentos consistentes. Indicadores incluem texto, além de cor.
- Foco visível, diálogo nativo de saída com foco contido/Escape/retorno e títulos focados após navegação. Link de salto move foco ao conteúdo sem alterar a rota hash. Movimento reduzido preservado.
- Barra inferior mantém os cinco destinos e área segura. `visualViewport` reduz disputa com teclado quando detecta redução suficiente com campo focado. Isso é adaptação testada por simulação, não evidência de teclado físico Android.
- Guarda registra somente flags de alteração; valores e senhas não são copiados para outro armazenamento. Links/voltar mantêm edição até confirmar saída; editores principais também confirmam fechamento/substituição. Depois de salvar, o bloqueio é removido. `beforeunload` é proteção adicional dependente do navegador, não recuperação de rascunhos após encerramento forçado.
- Estado vazio de filtros em metas/projetos oferece mostrar todo o histórico. Séries de gráficos usam tokens com contraste e a segunda linha é tracejada, além da tabela alternativa. Relatórios pessoais agora apontam para os relatórios financeiros implementados, removendo texto antigo de indisponibilidade.

## Dia, dinheiro e planos

Depois de configurar o perfil, a home começa com check-in e acompanhamento do dia; o hero de apresentação e os três cards repetidos ficam no primeiro uso. Resumos semanais, tarefas/hábitos, finanças e metas usam dados existentes. Não há inferência de consumo, humor ou atividade em lacunas.

O resumo financeiro do início respeita `hideSensitive` e omite valores do DOM por padrão, incluindo a simulação. O detalhe continua acessível em Finanças. O próximo objetivo é selecionado por prioridade/prazo real; títulos privados e marcos não são expostos na home, e detalhes adicionais respeitam consentimento. A tela específica continua sendo o lugar de acompanhar o plano.

A visão financeira oferece transferência e compra parcelada diretamente, usando os mesmos formulários/validações. Disponível, comprometido, pago, ticket, projeção e reservas mantêm suas distinções. Não se alteraram lançamentos, lastro, alocações ou regras de pagamento.

## Primeiro uso

Mais → Primeiros passos é opcional e pulável, com explicação de finalidade, armazenamento local e risco de perda. Configuração curta pede nome/aparência; na ausência de perfil, valores financeiros ficam zero em vez de pressupor renda. Nenhuma transação, hábito ou meta é criada ao abrir ou salvar.

Quatro destinos independentes orientam hábito, meta, primeiro lançamento e primeira cópia externa. O progresso é derivado dos registros existentes, não de nova tabela ou flags que se perdem no backup. Retomar não gera sugestões duplicadas. Preferências completas continuam editáveis no caminho anterior. Confirmar sugestões usa os comandos idempotentes já existentes.

## Performance e limites reais

Rotas e gráficos continuam lazy. Relatórios pessoais oferecem tabela dos dados; gráficos mantêm animações desativadas. A lista financeira renderiza 50 registros inicialmente e carrega mais sob demanda. Busca/filtros continuam sobre todos os registros e não alteram cálculos, exportação ou persistência.

Fontes locais agora declaram WOFF2 diretamente; quatro fallbacks WOFF antes gerados (~73,3 kB) deixam de ser emitidos. Isso reduz arquivos do artefato, mas não equivale a reduzir o download do navegador moderno que já escolhia WOFF2.

Baseline: index 318,09 kB / 101,35 kB gzip, database 190,61 / 57,36 kB, gráficos 387,77 / 110,43 kB; precache 1218,47 KiB. A candidata adiciona o roteador com bloqueio e onboarding: index 377,04 / 119,49 kB; database e gráficos permanecem nos mesmos tamanhos; precache 1285,41 KiB/48 recursos. **Não houve redução global do bundle.** O custo adicional é explícito e não há alegação de melhora de Core Web Vitals ou benchmark físico. Medições finais podem variar poucos bytes conforme o hash/build.

Não foram alteradas consultas transacionais por atalhos de performance; consistência financeira tem prioridade. Grandes conjuntos ainda exigem medição no aparelho. Todos os recursos são locais; não se introduziu CDN, fonte remota ou telemetria.

## Segurança e PWA

Criptografia, importação validada, recuperação/rollback, deduplicação, limites e auditoria da Fase 5 foram mantidos. O formato permanece versão 1 e schema 4; apenas `appVersion` registra a candidata. Arquivos v3/v4 e artefatos PWA antigos permanecem fixtures artificiais, fora do que é publicado.

Testes de atualização usam arquivos estáticos arquivados autênticos da baseline 0.5.0 e da 0.4.0, com perfil/check-in criados no contexto de teste. Conferem edição antes da atualização, banco nativo v40, perfil/registros, ativação em outra aba e offline. A peculiaridade do helper antigo 0.4 (salvar e reabrir após ativar) continua documentada.

Manifest, ícones, base/escopo, CSP, cache estático e atualização com confirmação preservados. Workflow deixa de publicar por push: requer `workflow_dispatch`, `publish=true`, branch main e validação prévia. Configuração de revisores do ambiente depende do repositório remoto e não foi inventada nem alterada via conta externa.

Auditoria: zero achados em produção, 17 de ferramentas classificados por pacote/causa/exposição em [dependency-audit-1.0.md](dependency-audit-1.0.md). Sem atualização major automática. Inspeção de `public`, manifesto, workflow e artefato não encontrou arquivos pessoais ou segredos necessários ao app; isto não é certificação de secret scanning de um remoto inexistente.

## Verificação

Baseline: lint, typecheck, build e 192 testes aprovados; os 17 E2E emitiram aprovação individual. O encerramento automático do servidor de preview pelo runner ficou preso no ambiente Windows restrito; os testes finais usam servidor de preview explícito e `PLAYWRIGHT_EXTERNAL_SERVER=1`, encerrado separadamente. A CI Linux mantém o gerenciamento padrão de servidor.

Rodada da candidata: lint, typecheck, **202 testes unitários/de integração em 20 arquivos** e build aprovados. Os 10 testes novos cobrem onboarding, navegação/fechamento, privacidade financeira, contraste e lista longa sem mutação. Todos os 192 anteriores permanecem.

A rodada final E2E aprovou **22 de 22 cenários em 3,3 minutos**, incluindo os 17 anteriores e cinco adições: primeiros passos sem transações; edição/navegação/voltar; matriz de 25 rotas × quatro larguras × dois temas (200 visitas), zoom e viewport; artefato Pages em subdiretório; atualização desde a baseline 0.5.0. Revisão visual final feita em capturas dos temas claro/escuro, onboarding e viewport mobile com acompanhamento diário. Artefatos/capturas locais em `test-results` são temporários e não publicados.

Os testes de contraste verificam os pares semânticos de texto/erro (>=4,5:1), foco, bordas de controles e séries de gráficos (>=3:1) nas superfícies, junto de semântica/teclado/foco básicos em Chromium. Isto não é uma certificação WCAG completa. [WCAG 2.2](https://www.w3.org/TR/wcag/) é a referência de critérios; leitura com TalkBack e revisão humana continuam pendentes.

## Android, lançamento e arquivos

Não houve teste em Android físico, instalação pública ou deploy. `adb` não está disponível no PATH deste ambiente; nenhum dispositivo foi presumido como conectado. O [roteiro manual](android-1.0-manual.md) define dados/evidências, teclado, TalkBack, reinicialização, modo avião, KDF, backup/restauração e finanças. O [checklist](release-1.0-checklist.md) separa aprovado, pendente e bloqueador; [publishing-1.0.md](publishing-1.0.md) explica autorização, base, ambiente, HTTPS e reversão.

Arquivos novos: `EditingGuard.tsx`, `useMobileViewport.ts`, `OnboardingPage.tsx`, `refinement.css`; cinco arquivos de testes unitários (`release-navigation`, `onboarding`, `release-contrast`, `finance-list`, `finance-home-privacy`); E2E `release.spec.ts`, `pages.spec.ts`, fixture PWA 0.5.0; este relatório, diagnóstico, auditoria de dependências, roteiro Android, checklist e instruções de publicação.

Arquivos ajustados: App/main, SettingsForm, HabitForm, CheckInPage, TaskForm, FinanceForm, FutureForm, Dashboard, FinancialSummary, FinanceOverview, FinancePage, FinanceEntries, FutureSummary, FuturePage, ReportsPage, FinanceCharts; `backup.ts` e asserção de versão do teste; E2E de atualização e sincronização do reload no teste de apagamento, workflow Pages, package/lock, README e documentação visual/formato. Não houve alteração de schema, migrations, serviços de ledger ou arquivos de dados reais.

Próximo passo: concluir validação física/HTTPS, registrar e corrigir eventuais falhas, repetir testes afetados e só então promover a 1.0.0 mediante autorização de publicação.
