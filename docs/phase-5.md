# Minha Virada — Fase 5 · versão 0.5.0

## Resultado e escopo

Segurança, backup completo/criptografado, integridade, recuperação transacional, armazenamento e atualização controlada foram implementados preservando as Fases 1–4. Não há WhatsApp, sincronização, backend novo ou implementação da Fase 6.

## Auditoria inicial e problemas

A [auditoria inicial](phase-5-audit.md) registra arquitetura, tabelas, relações, migrations v1–v4, dependências, cálculos financeiros, PWA/cache, permissões, resultados e plano antes de alterações.

Lint, typecheck, build e os 152 testes anteriores passaram na baseline. O E2E apontou um seletor instável: o primeiro recibo vinha de ordenação por UUID e nem sempre era o recebimento esperado. A seleção agora usa o recebimento exato de R$ 200, mantendo as mesmas verificações de saldo.

Problemas tratados:

- JSON sem proteção por senha e ausência de metadados completos.
- Exclusão de recoverySnapshots da exportação e risco de recursão ao incluí-la sem planejamento.
- Schemas que removiam campos futuros desconhecidos.
- Falta de relatório de integridade, diagnóstico de escrita/quota e pedido explícito de persistência.
- Ausência de CSP e de confirmação ligada ao conteúdo antes da exclusão local.
- Restauração sem deduplicação persistente e sem conferência de leitura do ponto recém-gravado.
- Caso observado no upgrade: o helper podia ativar um worker externo sem reabrir a tela. A versão 0.5.0 trata controllerchange com autorização explícita e impede recarregar rascunhos quando outra aba ativa a atualização.

A auditoria npm atual não identificou vulnerabilidades de produção. A auditoria completa registrou 17 alertas de desenvolvimento, 2 baixos e 15 moderados. Nenhuma dependência foi adicionada/atualizada e nenhuma mudança incompatível foi forçada.

## Funcionalidades e arquitetura

Configurações → Seus dados e segurança reúne:

- Diagnóstico de leitura e escrita, estimativa de uso/quota e persistência informada pelo navegador.
- Solicitação explícita de armazenamento persistente, com limites explicados.
- Data do último backup externo informado e aviso de cópia pendente.
- Exportação JSON e criptografada; senhas efêmeras com confirmação.
- Importação com autenticação, validação, prévia e confirmação destrutiva.
- Relatório de integridade não destrutivo, também baixável sem conteúdo pessoal.
- Pontos de recuperação locais preservados/baixáveis.
- Privacidade e exclusão de dados com cópia externa atual e confirmação APAGAR.

O schema Dexie continua **v4**, com as mesmas 35 tabelas. Não foi necessária migração; backupState recebe apenas campos opcionais para confirmações/hashes. Não há rewrite de registros existentes.

backup-registry centraliza cobertura, schemas e rótulos. A checagem confronta o banco real e bloqueia uma nova tabela esquecida. backup.ts preserva o fluxo e os validadores existentes; backup-crypto usa Web Crypto; integrity-checks/integrity fazem diagnóstico sem escrita; storage trata disponibilidade/quota/persistência. Componentes e formulários existentes continuam utilizando seus serviços, com mensagens de armazenamento seguras.

## Formato e criptografia

O [contrato de backup](backup-format.md) detalha estrutura, conversões, limites e confiança.

O envelope atual tem formatVersion 1, appVersion 0.5.0, schemaVersion 4, UUID, data e contagens das 35 tabelas, além de SHA-256 canônico. Formatos anteriores com schema 3/4 são verificados antes da conversão, com IDs e relações mantidos. Formatos futuros, metadados incompletos e campos desconhecidos são rejeitados.

A opção .mvbackup usa AES-256-GCM, tag de 128 bits, IV aleatório de 96 bits e salt aleatório de 128 bits por operação. PBKDF2-HMAC-SHA-256 usa 600 mil iterações, chave não extraível e parâmetros versionados. Cabeçalho criptográfico é autenticado como AAD; metadados pessoais ficam dentro do ciphertext.

A escolha segue a [referência OWASP para PBKDF2-SHA-256](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), usando [parâmetros Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams). Não se implementou criptografia própria ou custo arbitrário fornecido pelo arquivo. O custo fixo não é reduzido silenciosamente em Android lento. A emulação mede exportação com a CPU do computador; desempenho físico continua pendente. A medição ilustrativa desta rodada foi de 766 ms para validar e exportar uma cópia criptografada pequena; não é um benchmark de Android físico nem garantia para arquivos maiores.

Senha é solicitada novamente para abrir o arquivo; erro de senha e adulteração não expõem conteúdo. Nenhuma senha/chave é persistida. Os campos e buffers controláveis são limpos após tentativa, sem prometer apagamento forense de strings JavaScript. Perder a senha impede a recuperação; não existe chave mestra.

JSON sem senha permanece legível e exige atenção ao aviso de privacidade. Seu checksum não autentica autor. IndexedDB e snapshots internos permanecem sem criptografia.

## Restauração e preservação

Selecionar → limites/formato → senha quando necessária → autenticar → validar checksum/contagens/schemas/relações → prévia → RESTAURAR → transação.

A prévia não escreve no banco. A substituição engloba as 35 tabelas, salva e relê um ponto plano do estado anterior, mantém pontos já existentes/importados e substitui os demais dados. Falha na preservação bloqueia a operação; falhas posteriores, inclusive conflito de pontos, revertem tudo. Não há continuação destrutiva após erro de quota.

Pontos de origem já danificada preservam seus JSONs, mas precisam passar novamente pela validação completa para serem importados. Não são considerados cópia externa e também se perdem ao limpar o navegador.

Checksum e hash do conteúdo restaurado permitem deduplicar reenvio concorrente e após reabrir. Se registros forem alterados depois, restaurar intencionalmente a mesma cópia continua possível. Exclusão exige cópia externa informada de até 7 dias, ainda correspondente ao conteúdo atual, além de reconhecimento e APAGAR. Qualquer mudança posterior exige nova exportação/confirmação. Exclusão também foi testada com rollback.

## Integridade, privacidade e PWA

A auditoria relata tipo, gravidade, quantidade, entidade e orientação, sem IDs/textos pessoais ou valores privados. Confere estruturas, duplicidades, referências, parcelas, pagamentos, ticket, metas, recebimentos e limites de saldos derivados. Não faz correção automática nem verifica fatos junto a bancos.

CSP é aplicada no build: scripts/conexões/fontes/recursos da própria origem, sem eval ou scripts inline. Estilos inline continuam necessários a React/Recharts. A política em meta não substitui cabeçalhos como frame-ancestors ou HSTS do host. Não há analytics, rastreadores ou caches de dados pessoais. Importações são JSON; conteúdo não é executado nem renderizado como HTML.

O Service Worker continua versionando recursos estáticos por revisão, com prompt e limpeza de caches antigos. O upgrade real usa uma fixture estática do build 0.4.0 e o build atual, sem dados pessoais, em servidor/contexto isolados. A transição preserva perfil, check-in e schema nativo 40. Se a tela 0.4.0 não reabrir automaticamente após a ativação, salvar/reabrir é o caminho testado. No código novo, ativação em outra aba mantém rascunho e pede confirmação; a confirmação também funciona quando o worker já foi ativado.

## Arquivos novos

- src/db/backup-registry.ts
- src/db/security-state.ts
- src/services/backup-crypto.ts
- src/services/integrity-checks.ts
- src/services/integrity.ts
- src/services/storage.ts
- src/features/settings/StoragePanel.tsx
- src/tests/security-backup.test.ts
- src/tests/storage-security.test.tsx
- e2e/security.spec.ts
- e2e/pwa-update.spec.ts
- e2e/fixtures/backup-v3.json
- e2e/fixtures/backup-v4.json
- e2e/fixtures/pwa-0.4.0.json.gz
- docs/phase-5-audit.md
- docs/backup-format.md
- docs/phase-5.md

## Arquivos atualizados

- src/db/database.ts: apenas tipagem de backupState, sem migração.
- src/services/backup.ts
- src/features/settings/BackupPage.tsx
- src/components/RoutineUI.tsx
- src/components/PwaStatus.tsx
- src/features/finance/FinanceForm.tsx
- src/features/future/FutureForm.tsx
- src/app/App.tsx
- src/hooks/useProfile.ts
- src/styles/finance.css
- vite.config.ts
- src/tests/finance-backup.test.ts
- src/tests/future-backup.test.ts
- e2e/future.spec.ts
- package.json
- package-lock.json
- README.md
- docs/financial-invariants.md
- docs/design-system.md

## Verificação

Rodada final aprovada no workspace:

- Lint e typecheck aprovados.
- Build de produção aprovado, com PWA, CSP e 46 recursos estáticos em precache.
- 192 testes unitários/de integração aprovados em 15 arquivos, incluindo os 152 anteriores e 40 novos.
- 17 E2E aprovados, incluindo os 13 anteriores e 4 novos.
- Fixtures legadas v3/v4, criptografia real, senha incorreta, salt/IV distintos, adulteração, truncamento, limites, versão futura e campos desconhecidos.
- Restauração concorrente/reabertura, restauração intencional após alteração, recuperação plana, conflito de pontos e rollback antes/depois da limpeza.
- Auditoria sem escrita, referências/duplicidades, recibos, saldos e pagamento concorrente de fatura.
- Falha de leitura, quota de escrita, solicitação explícita e persistência negada/indisponível e guardas de atualização.
- E2E exporta dados criados e os recupera em contexto limpo, valida banco/ticket/metas/projetos, recusa senha errada/arquivos inválidos e falha de quota sem perda.
- Atualização real 0.4.0 → 0.5.0, worker ativado externamente, rascunho, confirmação, offline e CSP.
- Revisão visual de segurança mobile/temas; bancos e contextos de teste isolados, sem tocar dados reais.

## Limitações e próxima fase

Android físico ainda precisa validar duração do KDF, responsividade, instalação HTTPS, teclado, quota real, suspensão/reabertura e modo avião. Emulação não substitui aparelho real. A concessão de persistência depende do navegador.

Conteúdo é limitado a 20 MiB, entrada a 28 MiB e 100 mil registros por entidade. Grandes conjuntos/snapshots podem atingir limites; não são cortados silenciosamente. Não há mescla de backups, recuperação de senha, criptografia do IndexedDB, proteção contra malware/extensões ou garantia de sobrevivência do armazenamento.

A auditoria não prova completude/veracidade financeira nem corrige problemas. Um snapshot de banco danificado pode exigir revisão. Cópias locais não substituem um arquivo externo guardado. Confirmações externas são declarações do usuário, não verificação de nuvem/dispositivo.

17 alertas de desenvolvimento permanecem para avaliação em manutenção própria; a auditoria de produção retornou zero. Não houve deploy, remoto novo ou sincronização. A próxima fase é a Fase 6, após nova definição/autorização de escopo; ela não foi implementada.
