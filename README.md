# Minha Virada

PWA pessoal, privado e offline-first. **Versão 1.0.0-rc.1 — candidata da Fase 6.** Finanças, hábitos, rotina, metas, renda extra, backup criptografado e auditoria de integridade funcionam localmente. Onboarding opcional, interface mobile refinada e proteção de edições. Sem integração com WhatsApp. **Ainda não liberada para uso real:** validação Android física e origem HTTPS pública pendentes. Veja o [checklist de lançamento](docs/release-1.0-checklist.md) e o [relatório da Fase 6](docs/phase-6.md).

## Executar

Node.js 24 LTS e npm. No PowerShell, prefira `npm.cmd` quando a política local bloquear scripts `.ps1`.

```sh
npm ci
npm run dev
```

Para o PWA de produção e uso offline:

```sh
npm run build
npm run preview
```

O service worker não roda no dev. Instalação exige HTTPS ou localhost de desenvolvimento. No Android físico, use um endereço HTTPS; o localhost de um computador não é o localhost do celular.

## Entregas

- [Fase 1](docs/phase-1.md): fundação, navegação, preferências, temas, armazenamento, PWA e CI.
- [Fase 2](docs/phase-2.md): check-ins, hábitos, tarefas, calendário e relatórios pessoais.
- [Fase 3](docs/phase-3.md): contas, lançamentos, recorrências, cartões/parcelas/faturas, benefício separado, orçamentos, projeções e backup JSON recuperável.
- [Fase 4](docs/phase-4.md): metas, marcos, reservas com lastro, oportunidades, projetos, recebimentos, custos, tempo e tarefas vinculadas.
- [Fase 6](docs/phase-6.md): candidata 1.0, refinamento mobile, proteção de edição, onboarding, acessibilidade e preparação de lançamento. [Checklist](docs/release-1.0-checklist.md).
- [Fase 5](docs/phase-5.md): segurança, backup completo/criptografado, recuperação, integridade, armazenamento e atualização controlada. [Auditoria inicial](docs/phase-5-audit.md).
- [Invariantes contábeis](docs/financial-invariants.md) e [design system](docs/design-system.md).

## Primeiro uso financeiro

1. Abra Finanças → Configurar minhas finanças. Os valores sugeridos são editáveis e não geram dinheiro, contas ou cobranças. Categorias sugeridas só são adicionadas após sua confirmação.
2. Em Contas, cadastre seu banco, poupança/carteira e benefício separadamente. Confirme o saldo inicial real e sua data de referência. Não registre receitas antigas já incluídas nesse saldo.
3. Cadastre despesas e receitas previstas. Use Pagar conta / Confirmar recebimento somente quando o dinheiro realmente sair ou entrar; informe a data efetiva. Pagamentos parciais mantêm o restante pendente.
4. Cadastre regras recorrentes explicitamente. Salário, crédito do ticket, carro e seguro não são criados automaticamente. Informe início, fim quando houver e a categoria correta.
5. Cadastre cartão e compras; uma parcela também representa compra à vista no cartão. O pagamento da fatura é um fluxo separado da compra.
6. Use Ticket para créditos, consumos e ajustes. Categoria incompatível exige confirmação explícita. O saldo restrito do ticket nunca é somado ao banco.
7. Faça uma cópia em Configurações → Seus dados e segurança antes de confiar dados importantes ao navegador.

Os registros financeiros e de saúde não são verificados junto a bancos, empregadores ou serviços externos. Sua confirmação representa o fato informado por você.

## O que está implementado

Contas correntes, poupança, carteira, dinheiro físico, outras e benefício; categorias próprias editáveis/arquiváveis; saldos derivados; lançamentos previstos/pendentes/parciais/pagos/cancelados, competência, vencimento, pagamento, edição protegida, cancelamento e estornos auditáveis; filtros e pesquisa.

Recorrências mensais, semanais, anuais e por intervalo de dias, com ocorrências idempotentes; edição de uma ocorrência ou das próximas sem reescrever pagamentos anteriores; múltiplos cartões, ciclos, parcelas exatas em centavos, faturas, pagamentos parciais, créditos de estorno e histórico.

Benefício acumulativo com extrato, créditos/consumos/ajustes e regras de elegibilidade; transferências próprias sem receita/despesa; orçamentos por mês/categoria/fonte; vencimentos em calendário; competência separada do caixa realizado; CSV; histórico mensal e gráficos; 12 meses de projeção com cenários editáveis, alertas de saldo negativo e encerramento de parcelas.

Hábitos, check-ins, histórico de consumo, tarefas e preferências anteriores permanecem funcionais. O dashboard pessoal recebe um resumo financeiro compacto, sem substituir a rotina. Indicadores de consumo continuam ocultos por padrão.

## Metas e renda extra

Em Metas → Meu futuro, acompanhe prioridades, reserva, marcos e evolução semanal. Em Minhas metas, crie objetivos pessoais ou financeiros, edite/arquive e defina etapas com orçamento opcional. Sugestões exigem confirmação e não se repetem; casamento e moradia começam sem valor ou prazo presumidos.

Uma contribuição aloca saldo bancário confirmado, em centavos, para uma única meta. Não altera patrimônio. Você pode escolher uma conta existente ou realizar uma transferência entre contas próprias e alocar o valor no mesmo ato. Ticket, limites e receitas previstas não sustentam reservas. Retiradas liberam alocação, preservando o histórico; uma transferência posterior continua sendo feita em Finanças. Para movimentar saldo reservado, libere-o antes. Metas arquivadas mantêm suas reservas: reative a meta para liberá-las.

A projeção de prazo exige 90 dias de observação e ritmo líquido positivo. A primeira data de alocação é excluída da estimativa para não extrapolar saldo inicial como aporte recorrente. O histórico mensal mostra alocações líquidas e total reservado; a estimativa não oferece garantia.

Mais → Renda extra organiza oportunidades e projetos por etapa. Valores estimados/contratados e custos previstos ficam separados do caixa. Recebimentos parciais e custos pagos criam lançamentos e pagamentos pelo serviço financeiro existente, de forma atômica e idempotente. Não registre novamente um movimento já registrado em Finanças; o fluxo de projetos é para um novo recebimento/custo confirmado. Estornos preservam o vínculo e recalculam os resultados.

Registre o tempo dedicado em minutos. Resultado líquido de caixa exige confirmação de todos os custos pagos até agora; receita recebida por hora exige confirmação de todo o tempo e duração maior que zero. Esses indicadores não são lucro contábil nem incluem despesas ainda não pagas. Edite a cobertura quando houver informação incompleta.

Tarefas criadas dentro de metas/projetos usam o motor existente; conclusão, edição, recorrência e adiamento ficam em Hábitos → Tarefas. A home mantém apenas um acesso compacto ao futuro; valores de alocação aparecem nela somente com a configuração de privacidade autorizada.

## Projeções e limites financeiros

O saldo real inclui apenas saldos iniciais e movimentos confirmados até hoje. Não inclui limite de cartão, ticket, salário sugerido nem receita prevista. Contas arquivadas não têm seus saldos apagados.

Comprometido é o total de obrigações conhecidas, inclusive meses futuros. A disponibilidade até o próximo salário é uma simulação: saldo bancário de hoje menos compromissos conhecidos até a próxima data, inclusive contas nessa data, sem antecipar salário.

As projeções partem do saldo real de hoje, usando apenas valores ainda não pagos/recebidos. Incluem recorrências, parcelas, faturas, previsões manuais e hipóteses. A estimativa variável é **adicional**, para gastos que você ainda não lançou. Vazio significa desconhecida e a projeção fica marcada como incompleta; zero é uma premissa explícita. Cenários mudam previsões, nunca o saldo real.

Orçamentos de ticket do mês estimam a parte ainda não consumida nem prevista em lançamentos; não criam consumos reais. Metas e parâmetros sugeridos de combustível/alimentação não descontam saldo automaticamente. Cada mês pode ter despesas e orçamentos diferentes.

A referência de reserva e o saldo em poupança não criam contribuições para metas. Potencial de poupança é uma projeção de fluxo, não dinheiro garantido ou valor já reservado.

Juros, multas, tarifas, câmbio, rotativo, taxas e regras específicas de emissores não são calculados automaticamente. Registre encargos reais separadamente e distribua os pagamentos sem repetir valores. Estornos de compras são integrais nesta versão. Para corrigir valores já pagos, estorne os pagamentos registrados antes de editar; não há alteração silenciosa de histórico. Fechamento/vencimento de cartão com compras ficam protegidos: outro ciclo exige novo cadastro, mantendo faturas anteriores.

## Arquitetura e banco

React/TypeScript estrito, Vite, Tailwind, HashRouter, Dexie, RHF/Zod, Recharts e Lucide foram preservados. Manrope permanece local. Sem backend, autenticação externa ou Zustand. Dependências de runtime não foram adicionadas; `@types/node@24.19.2` foi adicionado apenas em desenvolvimento para tipar testes do Web Crypto nativo do Node 24.

- `src/features/finance`: telas e formulários; não grava saldos nem implementa o cálculo financeiro.
- `src/services/finance`: dinheiro, datas, cálculos, seletores e comandos por domínio. `commands.ts` mantém a fachada pública; `transaction.ts` centraliza atomicidade e idempotência.
- `src/repositories/finance-data.ts` e `src/hooks/useFinance.ts`: leitura tipada/reativa e consistente do banco.
- `src/features/future`, `src/repositories/future.ts`, `src/services/future-calculations.ts`: telas, comandos e indicadores de metas/projetos.
- `src/db/backup-registry.ts`, `src/services/backup.ts`, `backup-crypto.ts`, `integrity.ts` e `storage.ts`: registro de tabelas, validação, criptografia, recuperação transacional, auditoria e diagnóstico de armazenamento.

Os schemas v1 a v3 são mantidos. A migração **v4 é aditiva**, acrescentando sete tabelas de metas/projetos sem reescrever dados anteriores. A migração v3 continua acrescentando tabelas financeiras e de backup sem apagar/transformar preferências, saúde, hábitos, tarefas ou histórico. Não gera movimentos reais. Dinheiro é armazenado em centavos inteiros; datas de competência/vencimento são locais; timestamps de auditoria são UTC. Entidades financeiras usam UUID; configurações singleton usam identificadores fixos.

## Backup, recuperação e segurança

Abra Configurações → Seus dados e segurança, também disponível no menu Mais. O endereço anterior `/mais/backup` continua funcionando.

O registro central cobre as **35 tabelas** do Dexie v4, inclusive históricos e pontos de recuperação locais, com verificação automatizada de cobertura. O banco não precisa de nova migração nesta fase. O arquivo informa versão do formato/aplicativo/schema, data, UUID aleatório e contagens; o checksum SHA-256 canônico detecta alterações acidentais, não autoria.

A opção recomendada é o arquivo `.mvbackup` com **AES-256-GCM**, IV aleatório de 96 bits, salt aleatório de 128 bits, tag de 128 bits e PBKDF2-HMAC-SHA-256 com 600 mil iterações. Parâmetros são versionados e autenticados. Web Crypto exige HTTPS/localhost. Use frase-senha longa, com pelo menos 12 caracteres; guarde-a separadamente. **Perder a senha impede abrir o arquivo.** O aplicativo não grava senha/chave nem oferece recuperação de senha. JSON legível continua disponível com aviso explícito.

A importação valida formato/tamanho, solicita novamente a senha quando necessário, autentica, confere checksum, estruturas, contagens, campos desconhecidos e relações antes da prévia. A prévia não modifica o banco. Arquivos antigos v3/v4 têm conversores validados com fixtures; IDs e relações são mantidos. Formatos futuros e campos desconhecidos são rejeitados, sem descarte silencioso.

A confirmação literal `RESTAURAR` substitui os dados em transação. Antes disso, um ponto de recuperação é gravado e relido; falhas ou quota insuficiente bloqueiam a substituição e preservam o estado anterior. Pontos anteriores e os importados são preservados, sem recursão de snapshots. Eles também se perdem ao limpar o navegador; não são tratados como backup externo.

Reenvios concorrentes ou após reiniciar não repetem a mesma restauração enquanto o estado restaurado permanecer igual. Se você modificar registros e escolher deliberadamente a mesma cópia outra vez, ela poderá ser restaurada novamente. Testes injetam falhas antes e depois da limpeza e comprovam rollback.

Limites: conteúdo validado de até **20 MB**, arquivo de entrada de até **28 MB** para acomodar o ciphertext/base64, até 100 mil registros por entidade. Conjuntos acima desses limites são bloqueados sem truncamento. Pontos locais aumentam o tamanho do backup; guarde cópias externas com frequência.

Verificar integridade gera relatório não destrutivo por tipo, gravidade, contagem e entidade, com orientação. Não mostra valores privados, não consulta bancos e não corrige dados automaticamente. Exportação e restauração exigem dados estruturalmente compatíveis; um ponto de recuperação criado a partir de um banco já danificado pode exigir revisão antes de ser importado.

O estado do armazenamento confere leitura/gravação com uma base de teste descartável, sem mudar registros do app. A solicitação de persistência é explícita: depende do navegador e não impede exclusão manual ou perda do aparelho. Estimativas de uso/quota não são garantias.

O último backup externo é **informado por você**, após guardar o download. O app não verifica nuvem, outro aparelho ou retenção do arquivo. Gerar um download não basta. Para apagar todos os dados locais, é preciso confirmar uma cópia externa atual, reconhecer o impacto e digitar `APAGAR`; uma mudança posterior exige nova cópia. A exclusão também é transacional.

## Privacidade

Não há analytics, telemetria, sincronização ou envio de registros a servidores. Não há notificações de saúde ou finanças. Workbox guarda somente recursos estáticos; IndexedDB e arquivos de backup não entram no cache HTTP. Atualizações do app não apagam o banco. A CSP de produção restringe scripts, conexões, fontes e recursos à própria origem; estilos inline permanecem necessários para React/Recharts. A política via meta não substitui cabeçalhos de segurança do servidor nem oferece frame-ancestors. Atualizações ativadas em outra aba não recarregam uma edição sem confirmação. No salto a partir da 0.4.0, salve e reabra caso a tela antiga permaneça aberta após a ativação.

IndexedDB não é criptografado. Acesso ao dispositivo/perfil pode expor dados; limpeza de armazenamento, navegação privada e perda do dispositivo podem causar perda. Observações/gatilhos permanecem fora do dashboard, e a privacidade dos indicadores de consumo foi preservada. Nenhum diagnóstico ou tratamento é oferecido.

## Verificação

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes usam bancos/contextos isolados, sem ler ou apagar o perfil real do usuário. O E2E emula Pixel 7, pt-BR e America/Sao_Paulo. Android físico ainda precisa de verificação de instalação, teclado, suspensão/reabertura e modo avião.

No Windows restrito, o preview pode ser iniciado manualmente com `npm run preview -- --port 4337 --strictPort`, definindo `PLAYWRIGHT_EXTERNAL_SERVER=1` antes do E2E. O navegador local pode usar `PLAYWRIGHT_BROWSERS_PATH=.playwright`. O CI Linux mantém seu servidor exclusivo.

Na auditoria da candidata 1.0, `npm audit --omit=dev` retornou zero vulnerabilidades de produção. A auditoria completa informou 17 alertas de ferramentas (2 baixos e 15 moderados). Nenhuma dependência foi adicionada ou atualizada; mudanças incompatíveis não foram forçadas. A [classificação dos 17 alertas](docs/dependency-audit-1.0.md) separa três causas raiz e a exposição nas ferramentas.

## GitHub Pages

O workflow valida push/PR e **publica somente por ação manual** (`workflow_dispatch`, `publish=true`, branch `main`). Não há remoto GitHub nesta pasta; nenhuma publicação foi realizada. O teste de artefato em `/minha-virada/` valida recursos, rotas hash, refresh, manifest, escopo e offline localmente.

Antes de disparar a publicação autorizada, siga [as instruções](docs/publishing-1.0.md), configure proteções do ambiente e conclua [o roteiro Android físico](docs/android-1.0-manual.md). A base considera repositório de projeto ou `usuario.github.io`; domínios próprios exigem revisão. `createHashRouter` mantém os caminhos existentes sem rewrite de rotas no servidor.

Não promover a versão final 1.0.0 enquanto houver bloqueadores no checklist. Os testes são isolados; dados pessoais existentes e schema Dexie v4 permanecem preservados.
