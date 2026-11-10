# Invariantes financeiras — Fase 3

## Fonte de verdade

Valores monetários persistidos são inteiros seguros em centavos. Entrada decimal é convertida por partes (reais/centavos), sem usar arredondamento de número decimal como valor de origem. Parcelas diferem por no máximo um centavo, com resíduos nas primeiras; a soma é exatamente o total. R$ 100,01 em 3 vezes resulta em 3.334, 3.334 e 3.333 centavos.

Conta não tem saldo atual mutável. Saldo bancário é saldo inicial na referência, mais receitas recebidas, menos despesas/faturas pagas, mais/menos transferências próprias confirmadas até a data consultada. Movimentos estornados não entram. Movimentos anteriores à referência são rejeitados. Depois de utilizar a conta, saldo inicial/data/tipo ficam protegidos.

Previsto, pendente, parcial e pago são estados diferentes. O status parcial/pago é derivado dos pagamentos ativos. Receita prevista não é caixa. Despesa futura não é pagamento. Cancelamento exige ausência de pagamentos ativos; uma edição após pagamento requer estorno prévio. Histórico e revisões são preservados.

## Cartão: obrigação, competência e caixa

Uma compra gera uma obrigação e parcelas, sem retirar dinheiro do banco. O relatório por competência reconhece a compra inteira na data da compra. O fluxo de caixa reconhece somente o pagamento efetivo da fatura. Não somamos o pagamento da fatura novamente à despesa por competência.

Fechamento inclui compras daquele dia. Depois do fechamento, a compra passa para o ciclo seguinte. Vencimento igual/anterior ao dia de fechamento é no mês seguinte; posterior é no mesmo mês. Dias inexistentes são ajustados ao último do mês sem perder a âncora futura. Ciclos com histórico não são reescritos por uma edição do cartão.

Pagamento parcial reduz conta bancária e saldo pendente da fatura na mesma operação. Não aceita valor acima do pendente nem conta de benefício. Limite disponível nunca é dinheiro disponível.

Estorno de compra é integral e gera crédito por parcela na fatura correspondente, com identidade única. Créditos excedentes são carregados para faturas posteriores do mesmo cartão. Não criam entrada no banco. Exemplo: pagar R$ 10 e depois estornar uma compra não repõe automaticamente R$ 10 no banco; o valor permanece crédito no cartão até uso ou outro fato financeiro real.

Juros, multas, tarifas, rotativo e estorno parcial não são automatizados. Encargos precisam de lançamentos separados, com pagamentos correspondentes sem duplicar os valores.

## Benefício e transferências

Saldo do benefício = saldo inicial + créditos − consumos + ajustes assinados do extrato ativo. Ele nunca entra na soma de contas bancárias. Quando um pagamento de lançamento usa benefício, há um movimento vinculado no extrato; o saldo lê somente o extrato, sem contar o pagamento de novo. O estorno desfaz os dois estados atomicamente.

Consumo requer categoria elegível ou confirmação explícita de exceção. Alterar retroativamente a elegibilidade de uma categoria já usada é bloqueado; crie uma nova categoria para um novo enquadramento. Saldo acumulado não representa dinheiro livre.

Transferência entre contas próprias altera origem e destino, com efeito total zero e sem receita/despesa. Transferência envolvendo benefício é bloqueada. Estorno não cria uma segunda transferência ativa.

## Recorrências e duplicidades

Cada regra tem UUID. Cada ocorrência materializada tem UUID e chave única regra + data original; os lançamentos possuem vínculo bidirecional com essa ocorrência. Reabrir ou sincronizar previsões não gera novas cópias.

Datas mensais/anuais preservam âncora (31/jan → fim de fevereiro → 31/mar). Há recorrência semanal e por intervalo. Data final limita a geração. Consultas materializam até 24 meses por lote; sincronização completa usa lotes até o horizonte dos próximos 12 meses. Cálculo puro consegue considerar previsões ainda não materializadas.

Edição da regra usa data de efeito hoje ou posterior. Ocorrências com pagamento ativo e cancelamentos manuais são preservados. Cancelamentos automáticos da regra podem ser reativados; histórico continua no banco. Editar uma ocorrência usa seu lançamento individual e não reescreve outras datas.

Cada confirmação financeira tem UUID de operação e fingerprint do comando. Reenvio do mesmo comando devolve o mesmo resultado; reutilização do token com outro conteúdo é rejeitada. A transação inclui registros, vínculos e histórico. Dois pagamentos concorrentes não conseguem gastar o mesmo saldo pendente além do total. Compras intencionalmente iguais, confirmadas em novos formulários, são registros distintos; não adivinhamos duplicidade apenas pelo texto/valor.

## Projeções e orçamento

Abertura da projeção é o saldo real de hoje. Pagamentos já feitos estão nesse saldo e não são subtraídos novamente. Só valores restantes de receitas/despesas e faturas entram no futuro. Obrigações vencidas ainda abertas são consideradas no primeiro mês; contas/faturas com pagamentos parciais usam o restante.

Transferências próprias não mudam o total bancário. Benefício segue uma projeção separada. Aberturas futuras explicitamente informadas entram no mês de referência. Meses sem receita cadastrada mostram zero entradas, mesmo que o planejamento tenha salário sugerido.

Cenários ajustam receitas previstas e estimativas adicionais, sem mudar dados reais. Estimativa variável é gasto adicional ainda não lançado. Quando desconhecida, a projeção é incompleta. Orçamento não é pagamento; orçamento de ticket pode estimar apenas a parte mensal ainda não consumida nem prevista. Não repetimos orçamentos automaticamente em todos os meses.

Potencial de poupança é fluxo projetado positivo, não alocação para metas nem garantia de sobra. Saldo em poupança é informado separadamente, sem contar ticket ou limite de cartão como reserva.

## Backup e privacidade

Backup contém snapshot consistente de todas as tabelas de dados, com versão, schema e checksum SHA-256 do conteúdo canônico (ordem de campos de objetos não altera o conteúdo). Validação e normalização não tornam uma cópia legítima inválida na segunda leitura. Checksum não autentica autor e não criptografa dados.

Restauração requer validação, pré-visualização e confirmação literal. É substituição explícita, sem mescla. A cópia anterior e a substituição ficam na mesma transação; erro de escrita reverte tudo. Cópias de segurança internas ficam fora do próprio export para evitar recursão.

Não há rede para dados pessoais, logs de saldos, analytics ou armazenamento de backup em cache HTTP. A trilha de alterações é dado privado local do próprio banco, com antes/depois auditáveis e incluída no backup. JSON e IndexedDB são legíveis; criptografia por senha permanece para a Fase 5.

## Fase 4 — reservas, projetos e tarefas

- Reserva é a soma das alocações menos retiradas por meta/conta/data. Não é novo saldo, receita ou despesa. Não existe tabela de saldo de reserva editável.
- A soma de todas as metas em cada conta não pode superar seu saldo confirmado em nenhuma fronteira de data do histórico. Cada par meta/conta também não pode ficar negativo. A validação percorre eventos ordenados por data, consolidando a posição ao final de cada dia.
- Comandos financeiros continuam usando a mesma transação/idempotência; seu escopo inclui as novas entidades e confere o lastro antes do commit. Pagamentos, estornos, transferências ou correções que descobririam reservas são rejeitados com rollback, inclusive operações retroativas.
- Transferir e reservar exige saldo livre na origem; não cria reserva via saldo negativo artificial. Usa o serviço de transferências existente. Transação externa mantém a composição inteira atômica; hashes assíncronos usam Dexie.waitFor para manter a transação viva.
- ID de operação/payload e ID do movimento evitam reenvio duplicado. Índices únicos protegem transferências de contribuição e vínculos entry/payment dos projetos.
- Retirada libera a alocação e mantém histórico, sem movimentar dinheiro no banco. Arquivar não libera dinheiro silenciosamente.
- Recebimentos e custos reais dos projetos criam entry/payment com o serviço da Fase 3 na mesma transação; valores estimados/contratados não postam caixa. Estornos não apagam o vínculo. Métricas usam somente pagamentos ativos.
- Valores desconhecidos são null. Resultado líquido de caixa exige custos completos confirmados; receita recebida por hora exige tempo completo confirmado e minutos > 0. Previsões abertas não entram no recebido.
- Projeção da meta: janela de 90 dias observados, aportes líquidos positivos, excluindo a primeira data de alocação. Alvo atingido é mostrado diretamente. Sem dados suficientes, não se inventa prazo.
- Tarefas vinculadas persistem em tasks/taskRecords, com a mesma chave e recorrência virtual da Fase 2. futureTaskLinks só relaciona cada tarefa ao objetivo/projeto.
- Backup v4 inclui as sete tabelas novas; valida relações, unicidade e lastro. Backup v3 normaliza com novas tabelas vazias; restauração guarda uma cópia do estado anterior e é transacional.

## Fase 5 — recuperação e integridade

Os comandos monetários e o motor de tarefas continuam os mesmos. Reenvios são protegidos por IDs de operação/payload, IDs dos movimentos, revisões e transações; não apenas por botões desabilitados. Testes adicionais exercitam pagamento concorrente de fatura e reabertura, além dos testes anteriores de transferências, estornos, metas e recebimentos.

O registro central inclui todas as 35 tabelas. Importação verifica schemas, campos desconhecidos inclusive aninhados, unicidade, chaves estrangeiras, ligações de operações/histórico, parcelas, faturas, pagamentos, ticket, reservas e projetos antes de qualquer substituição. Auditoria recalcula saldos derivados e relata limites numéricos inválidos, sem corrigi-los ou fazer consulta bancária.

Restauração preserva e relê o estado anterior e escreve o conjunto na mesma transação. Testes simulam quota no ponto de recuperação, falha depois de limpar tabelas e conflito de snapshots; o banco anterior é comparado integralmente após rollback. Reenvios do mesmo conteúdo são deduplicados enquanto os registros permanecerem iguais, inclusive após reabrir.

Confirmação de backup externo e exclusão usam hash do conjunto atual, excluindo apenas o próprio estado administrativo de backup. Senhas e chaves não entram nas tabelas. A criptografia do arquivo não modifica saldos, reservas, regras ou dados de saúde, e não cifra o IndexedDB.
