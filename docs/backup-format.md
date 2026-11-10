# Formato e estratégia de segurança — 0.5.0

## Dados e compatibilidade

O schema Dexie permanece **4**. O formato de transporte atual adiciona **formatVersion: 1**; não confundir a versão do envelope com o schema.

JSON externo:

- format: minha-virada.
- formatVersion: 1.
- appVersion: 0.5.0.
- schemaVersion: 4.
- backupId: UUID aleatório.
- createdAt: timestamp UTC.
- recordCounts: contagem por tabela.
- data: 35 arrays definidos no registro central.
- checksum: SHA-256 canônico do envelope sem esse campo.

A canonicalização ordena chaves de objetos e preserva a ordem dos arrays. Checksum de JSON sem senha não autentica o autor. O registro central confronta os nomes dos schemas e das tabelas reais do Dexie; uma tabela nova esquecida bloqueia exportação/restauração e falha no teste.

Backups anteriores suportados têm format minha-virada, schemaVersion 3 ou 4, createdAt, data e checksum, sem formatVersion. Primeiro verifica-se o checksum original, depois estrutura/campos/relações; só então são acrescentadas tabelas novas vazias e metadados. O ID convertido é estável e derivado do checksum original, preservando idempotência. appVersion anterior é indicada como desconhecida, não presumida. IDs dos registros não são regenerados. Tabelas e campos futuros são rejeitados explicitamente.

recoverySnapshots é exportada. Seus JSONs são planos, sem outros snapshots embutidos. A integridade do envelope desses pontos é validada; eles podem preservar um estado de origem já danificado, portanto a validação completa das entidades ocorre novamente antes de qualquer restauração desse ponto. Não são executados como código.

## Arquivo criptografado

O arquivo .mvbackup também é JSON, contendo somente:

- format: minha-virada-encrypted.
- formatVersion: 1.
- kdf: nome PBKDF2, hash SHA-256, iterations 600000, salt em base64.
- cipher: AES-GCM, keyBits 256, tagBits 128, iv em base64.
- ciphertext: conteúdo criptografado e tag em base64.

Web Crypto deriva uma chave não extraível com PBKDF2-HMAC-SHA-256. Salt usa 16 bytes aleatórios; IV usa 12 bytes aleatórios; ambos são novos a cada exportação. AES-256-GCM usa tag de 128 bits. O header criptográfico, com formato/versão/KDF/cipher, é fornecido como additionalData (AAD); metadados pessoais e contagens permanecem dentro do ciphertext.

Nenhum algoritmo criptográfico é implementado manualmente. Base64 é apenas codificação de transporte. SHA-256 usa Web Crypto. Não há chave de recuperação, senha persistida, telemetria ou servidor. Senhas iguais e os mesmos dados produzem arquivos diferentes. Senha errada e falha de autenticação geram a mesma orientação, sem expor conteúdo.

A senha não é normalizada nem aparada: precisa ser repetida exatamente. Exportação exige pelo menos 12 caracteres; entrada é limitada a 1024 bytes UTF-8. Buffers de senha e plaintext são limpos quando possível e campos são esvaziados após tentativa; strings/garbage collection do JavaScript não permitem prometer apagamento forense da memória.

## Escolha do custo

600 mil iterações segue a referência atual para PBKDF2-HMAC-SHA-256 da [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). É uma escolha conservadora fixa e versionada, executada de forma assíncrona por Web Crypto. Não se reduz o custo silenciosamente em aparelhos lentos. O parser só aceita os parâmetros previstos nesta versão, impedindo que um arquivo force bilhões de iterações.

IV de 96 bits e additionalData seguem os parâmetros da [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) e a [especificação W3C](https://www.w3.org/TR/webcrypto/).

A emulação Pixel 7 usa a CPU do computador e não comprova desempenho em Android físico. O E2E mede a exportação completa e grava uma métrica local de teste; é preciso medir duração e responsividade em aparelho real antes de alterar o perfil KDF. O formato permite novas versões, sem reinterpretar silenciosamente arquivos atuais.

## Restauração e exclusão

Fluxo: selecionar → verificar limites/formato → solicitar senha → autenticar → conferir checksum/dados/relações → mostrar prévia → digitar RESTAURAR → transação.

A transação inclui as 35 tabelas. Guarda um snapshot plano do conjunto anterior, relê o ponto gravado, preserva snapshots anteriores/importados e substitui os demais registros. Qualquer exceção reverte o conjunto, inclusive a criação do ponto. Não há fallback que continue apagando após falha da recuperação. O erro orienta guardar uma cópia externa.

Checksum da restauração e hash do conteúdo resultante são guardados em backupState. Repetição concorrente ou após reabertura não repete efeitos enquanto o conteúdo permanecer igual. Uma restauração intencional depois de alterações continua possível.

Confirmar backup externo registra apenas UUID, hash do conteúdo e data informada. Não atesta nuvem, outro aparelho ou disponibilidade futura do arquivo. A exclusão exige uma cópia externa confirmada de até 7 dias, correspondente aos dados atuais, além da confirmação APAGAR. Não basta um ponto interno ou um download não confirmado. A transação de exclusão também tem teste de rollback.

## Limites e confiança

Conteúdo até 20 MiB, arquivo recebido até 28 MiB, até 100 mil registros por tabela. Limites são conferidos antes de tarefas caras. O formato não comprime nem corta registros. Grandes históricos e snapshots acumulados podem atingir o limite; a operação é bloqueada sem perda.

O arquivo criptografado garante confidencialidade/autenticação sob a senha fornecida, não a veracidade dos lançamentos nem a identidade de quem conhece a senha. IndexedDB, snapshots locais e JSON sem senha continuam legíveis. XSS, extensões maliciosas, malware ou acesso ao perfil/dispositivo podem ler os dados e observar senhas em uso. Criptografia de arquivo não é criptografia em repouso do banco.

Medição ilustrativa da rodada final: 766 ms para validação + exportação criptografada de um conjunto pequeno representativo, no Chromium com viewport Pixel 7 e CPU do computador. Não mede aparelho Android físico nem o tempo de arquivos grandes.

## Candidata 1.0.0-rc.1

A Fase 6 mantém formato 1, AES-GCM/PBKDF2 e schema 4/35 tabelas. Não houve migration. `appVersion` passa a registrar `1.0.0-rc.1`; backups da 0.5.0 no mesmo formato e arquivos legados v3/v4 continuam aceitos, sem descarte silencioso de campos. Onboarding usa as mesmas tabelas existentes; seu progresso é derivado de registros e não exige entidade adicional de backup.
