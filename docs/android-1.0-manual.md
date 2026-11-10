# Roteiro Android — candidata 1.0.0-rc.1

**Pendente: nenhum aparelho físico foi usado nesta fase.** Emulação Chromium/Pixel 7 verifica layout e fluxos, não instalação, teclado, TalkBack, suspensão do Android nem durabilidade do armazenamento. Usar dados de teste; não apagar o perfil pessoal para executar este roteiro.

## Registrar evidência

Preencher: modelo/fabricante, versão Android, navegador/versão, data, URL HTTPS, versão do app, espaço livre, testador, resultado e captura de cada falha. Se usar dados reais, não anexar valores, consumo ou arquivos de backup em issues públicas.

## Preparação e instalação

1. Publicar somente após autorização em origem HTTPS de homologação. Conferir versão, base path, manifesto e escopo do worker. Verificar que não há avisos de certificado.
2. Abrir no Chrome atualizado, completar apenas nome/aparência ou pular. Confirmar que nenhum saldo/movimento foi criado. Retomar em Mais → Primeiros passos.
3. Aguardar “Aplicativo pronto para uso offline”. Instalar pelo menu. Abrir pelo ícone; conferir nome, ícones normal/maskable, orientação vertical, standalone e splash oferecida pelo sistema.
4. Alternar tema do dispositivo, temas explícitos e tamanho de fonte/acessibilidade. Conferir contraste, foco, recortes, barras do sistema, área segura e navegação inferior.

## Uso e teclado

1. Abrir check-in; preencher todos os campos, inclusive observações longas. Abrir teclado numérico/decimal, data e selects. O controle focado e a ação de salvar precisam continuar alcançáveis por rolagem. A barra inferior deve voltar ao fechar o teclado.
2. Tentar navegar com edição; cancelar, usar botão voltar e confirmar descarte. Cancelar deve manter o texto; salvar e sair deve permitir navegação sem novo bloqueio. Repetir com tarefa, hábito, finanças, meta e projeto. Fechar um formulário alterado deve pedir confirmação.
3. Testar navegação com TalkBack: título da página, labels, erro de nome, status de salvamento, seleção de dias, calendário, tabela de dados dos gráficos e confirmação de saída. Nenhuma função deve depender só de cor.
4. Aumentar texto a 200%, revisar telas de 320–400 CSS px e rolar com uma mão. Conferir alvos de toque, retorno do foco e leitura de diálogos. Repetir em outro navegador Android se for suportá-lo; não presumir comportamento idêntico.

## Registros e finanças

1. Salvar e editar check-in; deixar um dia sem registro, registrar dia com consumo e recomeçar acompanhamento. Lacunas devem permanecer lacunas; não apagar histórico.
2. Confirmar sugestões de hábitos/metas, reabrir e confirmar que não duplicam. Concluir/editar/arquivar hábito e tarefa recorrente; verificar histórico e calendário.
3. Criar banco e ticket com saldos confirmados. Registrar receita/despesa pendente: saldo real não muda. Pagar parcialmente e estornar; conferir centavos e saldo.
4. Transferir entre contas; não criar receita ou patrimônio. Registrar compra parcelada, pagamento parcial e total de fatura; não duplicar despesa. Manter benefício separado do banco.
5. Alocar/retirar de uma meta, testar limite de lastro e confirmar que a reserva não cria dinheiro. Receber projeto parcialmente e estornar. Comparar projeção identificada como prevista com saldo real.
6. Voltar ao início com indicadores ocultos e com consentimento explícito. Consumo, notas privadas, títulos de metas e saldos não devem aparecer indevidamente.

## Offline, persistência e atualização

1. Após cache pronto, ativar modo avião. Abrir rotas de todos os módulos, salvar registros, fechar pela tela de recentes e abrir pelo ícone. Comparar registros e saldos.
2. Reiniciar o aparelho em modo avião e repetir. Voltar online, sem perder registros locais.
3. Em Seus dados e segurança, verificar armazenamento e solicitar persistência explicitamente. Registrar se o navegador concedeu, negou ou não suporta; não prometer imunidade a limpeza manual/perda do aparelho.
4. Disponibilizar versão nova de homologação enquanto houver rascunho aberto. Confirmar que a atualização espera; cancelar mantém texto; salvar e confirmar atualiza uma vez. Ativar worker em outra aba e repetir. Conferir dados antes/depois e offline após atualização.

## Backup, recuperação e limites

1. Exportar cópia criptografada com frase longa. Medir tempo do KDF e fluidez no aparelho. Guardar o arquivo fora do navegador e marcar confirmação. Senha e dados não devem aparecer em notificações, console ou cache HTTP.
2. Em perfil de teste limpo, abrir arquivo, tentar senha incorreta, depois a correta. Conferir prévia antes de RESTAURAR; comparar check-ins, hábitos, tarefas, saldos, metas, projetos e histórico. Testar também fixture legado v3/v4.
3. Restaurar novamente: não duplicar registros. Verificar ponto anterior e auditoria de integridade. Truncamento, arquivo futuro, senha errada e falta de espaço não devem substituir dados.
4. Para testar quota/remoção, usar perfil descartável e arquivo externo já conferido. Nunca limpar dados do perfil pessoal como etapa de diagnóstico.
5. Medir base representativa e conjunto grande até os limites documentados (20 MiB de conteúdo, 28 MiB de entrada). Se houver congelamento, falha ou perda, marcar bloqueador antes de uso real.

## Aprovação

Anexar resultados por item ao checklist. Qualquer perda, saldo incorreto, exposição sensível, atualização que descarta edição ou falha que impede backup/restauração é **bloqueador**. Instalação, teclado, TalkBack e reinicialização ainda sem evidência também impedem declarar validação Android concluída. Só promover a versão final após resolver e repetir os fluxos afetados.
