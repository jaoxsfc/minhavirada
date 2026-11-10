# Design system · Minha Virada

Tom acolhedor, direto e sem julgamento. Não representar dados inexistentes como zero ou progresso. Preferir “ainda não apurado” e estados vazios explícitos.

## Tokens

| Token       | Claro     | Escuro    | Uso                 |
| ----------- | --------- | --------- | ------------------- |
| `--bg`      | `#F6F3EB` | `#101F1A` | Fundo               |
| `--surface` | `#FFFEFA` | `#192C24` | Cards e formulários |
| `--ink`     | `#173E34` | `#E9EFE5` | Texto principal     |
| `--muted`   | `#6F7971` | `#B1BEB2` | Texto secundário    |
| `--border`  | `#DEDFD5` | `#34483B` | Contornos           |
| `--soft`    | `#E7EEE3` | `#2A4235` | Fundos de apoio     |
| `--gold`    | `#C6A56B` | `#C6A56B` | Foco e detalhes     |

Manrope local, pesos 400/500/600/700. Títulos de página entre 28 e 38 px; corpo de leitura com entrelinha confortável. Verde profundo nas ações, dourado apenas em detalhes. Ícones Lucide. Marca vegetal original desenhada com formas simples nos ícones do PWA.

## Componentes e estados

- `SettingsForm`: labels explícitos, erro textual por campo, status de gravação e botão desabilitado durante envio.
- `PwaStatus`: conectividade, instalação, erro de registro, offline pronto e nova versão. Atualização exige clique.
- Cards de domínio: destino, estado vazio e fase de disponibilidade, sem números inventados.
- Painel vazio: ícone, título, explicação e caminho de retorno.
- Shell: sidebar desktop, barra inferior mobile e link para pular navegação.
- Erro de armazenamento: explicação e recarregamento sem limpeza automática dos dados.

Breakpoints principais em 760 e 1100 px. Formulários passam de duas para uma coluna em mobile. A navegação respeita `env(safe-area-inset-bottom)`. Links e botões têm foco de alto destaque; animações são removidas em `prefers-reduced-motion`. Todos os estados devem permanecer legíveis nos dois temas.

## Componentes da Fase 2

Os tokens anteriores permanecem a fonte de cores nos dois temas. `routines.css` acrescenta cartões de rotina, calendário, resumo estatístico, filtros e painéis de gráficos, sem alterar a estrutura do shell.

- `RoutineUI`: estado de leitura/erro, feedback de ação, erro de campo e dias da semana selecionáveis.
- Check-in: seções curtas de humor/energia, registro pessoal e tempo dedicado; consumo exige escolha explícita, e nunca é inferido pelo formulário.
- Hábitos e tarefas: cartões com ação principal, edição e histórico; arquivar preserva registros. Não há punição visual por pendências.
- Calendário: texto acessível por dia, seleção destacada e marcas distintas para registrado, atividade e ausência. Cor não é o único indicador.
- Relatórios: lacunas `null`, linhas sem unir dias ausentes, tabela com “Sem registro”, cores compatíveis com os dois temas e animações desabilitadas.
- Indicadores sensíveis: ocultos no dashboard por padrão; notas e gatilhos permanecem fora da tela inicial. Feedback de PWA é sempre genérico.

Formulários passam a uma coluna no mobile; ações quebram linha e calendários preservam sete colunas. Componentes mantêm foco visível e respeitam as áreas seguras da navegação inferior.

## Componentes da Fase 3

A identidade e os tokens anteriores foram mantidos. `finance.css` acrescenta resumo verde profundo, cartões de conta com cor, abas financeiras horizontais com rolagem contida, formulários em painel, aviso de backup, faturas e meses projetados. A navegação inferior continua com cinco destinos.

- Resumo compacto no início, sem substituir check-ins/tarefas ou expor gatilhos.
- Saldo real, ticket e projeção recebem rótulos distintos. Limite não aparece como dinheiro.
- Ações de previsão e confirmação são separadas; os formulários explicam quando o saldo muda.
- Formulários reutilizam RHF/Zod, labels explícitos, validação de domínio, feedback e bloqueio durante envio. Premissas avançadas ficam em disclosure.
- Calendário de vencimentos tem labels por data e seleção visível; não depende apenas de cor.
- Gráficos financeiros têm tooltips em BRL, dados em listas/tabela e animações desabilitadas.
- Risco de saldo negativo é acompanhado de texto. Não há julgamento por despesas ou orçamento excedido.
- Backup usa aviso persistente, pré-visualização por grupos com nomes legíveis e confirmação literal antes de substituir registros.

Clareza contábil é parte da experiência: previsão não é saldo disponível, parcela não é outro gasto além da compra e crédito de cartão não é devolução automática ao banco.

## Fase 4

Meu futuro usa navegação interna horizontal, cartões de objetivos com progresso nativo acessível, área de detalhes e formulários por ação. Renda extra apresenta etapas e resultados reais, sem layout de planilha. Componentes FutureForm, LinkedTasks e ReservationSummary reutilizam tipografia, painéis, estados, RHF, Zod e o motor existente. Verde profundo, dourado e superfícies usam os tokens atuais; o banner mantém contraste em ambos os temas. Layout fluido evita rolagem horizontal no Pixel 7. A home só ganha um cartão compacto, sem títulos/observações de metas nem valores de reserva sem consentimento.

## Fase 5

Seus dados e segurança fica dentro de Configurações e também no menu Mais. Painéis existentes organizam estado local, cópia protegida, JSON legível, recuperação, integridade e exclusão recolhida. Senhas são pedidas por operação e os campos são limpos após cada tentativa. Mensagens distinguem gerar download, confirmar cópia externa e ter um ponto apenas local. A prévia mostra compatibilidade, data, versões, entidades e contagens. RESTAURAR e APAGAR têm confirmações proporcionais ao impacto.

A linguagem evita prometer segurança absoluta, recuperação de senha, nuvem ou proteção contra perda do aparelho. Os mesmos tokens, tipografia local, componentes de feedback e temas foram preservados. Uma atualização ativada em outra aba mantém o formulário até confirmação explícita; a solicitação de persistência também depende de ação do usuário.

## Refinamento da candidata 1.0

`refinement.css` estende o sistema, sem trocar sua identidade. Verde profundo #173E34, off-white #F6F3EB, dourado #C6A56B e verde claro #DCE9DE permanecem. `--muted` passa a #59695F no claro e #B8C8BD no escuro; `--focus`, `--danger` e `--success` são semânticos por tema. O dourado de marca não é a única indicação de foco/estado.

Controles principais têm 44 px; checkbox/radio têm alvo visual de 24 px com label clicável. Textos de formulário usam 16 px, layout quebra ações e títulos e a navegação respeita área segura. Movimento reduzido continua sem transições. Diálogo nativo protege navegação e retorno do foco. Fontes Manrope WOFF2 ficam locais. Não há competição de pontuação em saúde nem indicadores privados liberados por ausência de perfil.

Contraste testado nos pares semânticos; certificação WCAG e revisão física com TalkBack ainda não concluídas. Consulte o relatório e checklist da Fase 6.
