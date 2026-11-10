# Fase 5 — auditoria inicial e plano

Antes de editar arquivos foram inspecionados as 35 tabelas, schemas/migrations v1–v4, relações, comandos financeiros idempotentes, cálculos de caixa/ticket/reservas, backup/restauração, React/RHF/Zod, rotas, PWA, manifest, cache e permissões do workflow. Dependências instaladas foram inventariadas por npm ls. Não há AGENTS.md aplicável fora de node_modules. O projeto local não tem remoto Git.

Baseline: lint, typecheck, build e 152 testes unitários/de integração aprovados. E2E: 12 passaram e um falhou por selecionar o primeiro estorno em histórico ordenado por UUID aleatório. O cenário será estabilizado selecionando o recebimento exato, sem relaxar a expectativa de saldo.

Riscos e plano:

1. JSON expõe dados pessoais; incluir opção AES-256-GCM/Web Crypto e senha efêmera, mantendo JSON com aviso.
2. Recuperações internas eram excluídas do backup; registrar todas as tabelas e exportar pontos de recuperação de forma plana, sem recursão.
3. Schemas Zod removem chaves desconhecidas; rejeitar campos desconhecidos inclusive aninhados antes de normalizar backups antigos.
4. Metadados insuficientes; acrescentar versão do formato/aplicativo/schema, UUID, contagens e conversores v3/v4.
5. Restauração já transacional, mas sem deduplicação persistente; preservar recuperação com verificação de leitura, comprovar rollback e deduplicar reenvio consecutivo do mesmo conteúdo.
6. Falta auditoria não destrutiva; reutilizar validações e adicionar relatório por tipo/gravidade/entidade, sem dados pessoais ou correções automáticas.
7. Falta estado de armazenamento/quota/persistência; adicionar diagnóstico, ação explícita e distinção entre cópia interna e backup externo informado.
8. Ausência de CSP; restringir scripts, conexões e recursos locais em produção, sem comprometer estilos React/Recharts necessários.
9. Atualização é por prompt; proteger edição com confirmação adicional e testar upgrade real do build 0.4.0 para 0.5.0.
10. IndexedDB continua legível e vulnerável ao acesso ao dispositivo, exclusão manual e perda do aparelho; não confundir criptografia de arquivo com criptografia do banco.

Não é necessária migração de schema: novos estados de segurança usam o registro backupState existente com campos opcionais. Nenhuma tabela ou registro de usuário será recriado.
