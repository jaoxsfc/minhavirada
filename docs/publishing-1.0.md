# Publicação autorizada no GitHub Pages

Não houve publicação nesta fase. O workspace não tem repositório Git/remoto configurado nem URL pública confirmada. A candidata é **1.0.0-rc.1**; não promover para 1.0.0 enquanto houver bloqueadores no [checklist](release-1.0-checklist.md).

## Antes de publicar

1. Concluir roteiro Android em homologação HTTPS e registrar evidências. Guardar e verificar backup externo antes de qualquer atualização no dispositivo pessoal.
2. Revisar arquivos a versionar. Publicar somente `dist` pelo artifact Pages, nunca anexos, `test-results`, `.playwright`, `.npm-cache`, arquivos pessoais ou backups exportados. `.gitignore` exclui estes diretórios de execução; fixtures artificiais ficam em `e2e`, fora de `public` e do artefato. Não há segredos necessários para a aplicação.
3. Configurar repositório e branch `main` com revisão/proteção. Em Settings → Pages, escolher GitHub Actions. Revisar o ambiente `github-pages`: limitar branch e, onde o plano permitir, exigir aprovação de responsável. A definição YAML não configura revisores por si.
4. Executar `npm ci`, lint, typecheck, testes, build, Playwright e auditoria. Rever os alertas de ferramentas e resultados reais de acessibilidade/Android.

## Base e rotas

O workflow usa `/nome-do-repositorio/` para sites de projeto e `/` para repositórios terminados em `.github.io`. Para domínio próprio, revisar a base explicitamente e configurar domínio/DNS/HTTPS; a detecção por nome não cobre todas as configurações. `BASE_PATH` aceita o caminho com barras inicial/final. O app continua usando rotas por hash, por exemplo `/minha-virada/#/habitos/check-in`; refresh não exige rewrite de rotas do Pages.

Manifest mantém `start_url` e `scope` relativos; Vite/PWA produzem assets, registro e worker sob a base. O teste local de artefato em `/minha-virada/` verifica recursos, manifest, refresh, persistência, scope e offline. Isso não equivale a um deploy real do GitHub.

## Ação de publicação

Push e pull request **somente validam**. Quando a publicação estiver autorizada, executar Actions → Validar e publicar → Run workflow em `main` e marcar `publish=true`. O job de deploy só executa nessa condição, após validação. Aguardar eventuais aprovações do ambiente e conferir o URL retornado. A configuração pode ser preparada agora; disparar a publicação exige autorização do usuário.

## Conferência na origem pública

Verificar HTTPS, cabeçalhos disponíveis, manifest/ícones, assets sem 404, worker/escopo, armazenamento por origem, reload de rota e instalação. Concluir teste offline, fechar/reabrir, exportar/restaurar cópia em perfil descartável e repetir invariantes financeiras. A CSP via meta não configura HSTS, `frame-ancestors` nem controle de cache do servidor. Pages não oferece toda a flexibilidade de cabeçalhos de um servidor próprio; registrar qualquer necessidade adicional.

Mudança de domínio, protocolo ou caminho de instalação pode separar contextos de armazenamento; nunca presumir transferência automática do IndexedDB entre origens. Exportar antes e restaurar conscientemente no destino.

## Reversão

Se houver regressão, suspender promoção e republicar artefato anteriormente validado por ação manual autorizada. O service worker usa atualização com confirmação e não apaga IndexedDB. Reverter arquivos estáticos não é rollback do banco; versões futuras com migrations precisarão de plano próprio. A candidata mantém schema v4 e backups anteriores. Não orientar limpeza de dados como correção de cache.

Referências: [workflows personalizados do Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [proteção de ambientes](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
