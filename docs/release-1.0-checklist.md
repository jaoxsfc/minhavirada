# Checklist de lançamento — 1.0.0-rc.1

**Status: candidata para validação final; não liberada para uso real.** Existem bloqueadores de validação física e pública. Nenhuma publicação foi executada. O banco permanece v4 e os dados pessoais existentes não foram modificados.

## Aprovado

- [x] Rodada final: ESLint, TypeScript, 202 testes unitários/de integração, 22 E2E e build de produção aprovados.

- [x] Auditoria inicial com diagnóstico priorizado: [phase-6-audit.md](phase-6-audit.md).
- [x] Arquitetura React/TypeScript/Vite/Dexie preservada, sem novas dependências ou migrations.
- [x] Onboarding opcional, retomável e editável, sem criar transações, hábitos ou metas automaticamente.
- [x] Navegação por hash, barra inferior com cinco destinos e proteção de edições nas rotas/editores principais.
- [x] Tokens de contraste, foco, áreas de toque, movimento reduzido e adaptação de viewport.
- [x] Home prioriza o dia; ausência de check-in não implica abstinência. Indicadores financeiros também respeitam privacidade da home.
- [x] Suite financeira preserva centavos, saldos reais, ticket separado, pagamentos/estornos, transferências, cartões, metas e projetos.
- [x] Backup AES-GCM/PBKDF2, restauração, rollback, integridade e compatibilidade v3/v4 mantidos.
- [x] Atualização real a partir dos artefatos 0.4.0 e 0.5.0, incluindo worker ativado em outra aba, rascunho e offline.
- [x] Artefato em subdiretório Pages testado localmente: rotas, refresh, manifest, ícones, escopo, perfil e offline.
- [x] Workflow de publicação exige disparo manual com `publish=true` em `main`; push/PR somente validam.
- [x] Recursos publicados vêm de `dist`; sem fixtures, anexos ou backups pessoais em `public`. Nenhuma telemetria introduzida.
- [x] Auditoria de dependências de produção: zero achados; 17 alertas de ferramentas classificados em [dependency-audit-1.0.md](dependency-audit-1.0.md).

Os números finais e comandos automatizados são registrados em [phase-6.md](phase-6.md). As aprovações acima se referem a código, testes locais e emulação; não substituem os itens físicos abaixo.

## Pendente

- [ ] Manutenção isolada das três causas raiz dos 17 alertas de ferramentas; repetir auditoria antes do deploy.
- [ ] Conferir concessão/negação de persistência e limites reais de quota por navegador/fabricante.
- [ ] Medir KDF, carregamento e uso prolongado com base representativa no aparelho. Não há nota Lighthouse/Core Web Vitals de produção nem promessa de tempo de resposta físico.
- [ ] Revisão humana adicional dos textos e de toda a interface com leitor de tela.
- [ ] Configurar branch protegida, ambiente Pages/revisores e política de segurança do repositório remoto quando existir.
- [ ] Repetir validações após qualquer mudança de versão, origem ou configuração de publicação.

## Bloqueador

- [ ] **Android físico não validado:** executar [android-1.0-manual.md](android-1.0-manual.md), incluindo instalação, standalone, splash quando suportada, teclado, botão voltar, TalkBack, fonte ampliada, modo avião, suspensão e reinicialização.
- [ ] **Origem pública HTTPS não verificada:** falta repositório/remoto/URL de homologação e autorização de publicação. Conferir instalação/worker/cache e dados após reabrir na origem final.
- [ ] **Recuperação no aparelho real não comprovada:** exportar arquivo externo, recuperar em perfil limpo, comparar dados/saldos e verificar resposta do dispositivo a falta de espaço. Não testar apagando dados pessoais.

Qualquer perda de dados, divergência financeira, exposição privada, descarte de rascunho sem consentimento ou falha impeditiva de backup/restauração encontrada nesses testes também é bloqueador. Promover a 1.0.0 apenas após resolver e registrar evidências.

## Riscos conhecidos

IndexedDB continua legível no perfil local, pode ser removido pelo navegador/sistema e não sincroniza entre origens/aparelhos. Persistência concedida não é backup. Senha de arquivo perdido não pode ser recuperada. O usuário precisa guardar cópias externas. Limites de 20 MiB de conteúdo/28 MiB de entrada continuam válidos. CSP via meta não substitui cabeçalhos de servidor. Rascunhos ficam somente na memória: a guarda reduz descartes acidentais, mas não recupera texto após encerramento forçado do processo/OS, e `beforeunload` depende do navegador.

## Publicação

Seguir [publishing-1.0.md](publishing-1.0.md). Não publicar automaticamente. O objetivo desta entrega é uma candidata funcional para a validação final, com pendências verificáveis, não uma alegação de aprovação Android física.
