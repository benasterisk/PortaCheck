// pt — generated Help translation (validated structure).
export const helpPt = {
  "title": "PortaCheck — Guia do Utilizador",
  "intro": "Uma ferramenta local para verificar a portabilidade de números (SDA / DID) após uma migração, efetuando chamadas de teste comandadas por ADB a partir de um telemóvel Android, com um veredicto humano baseado no áudio e um relatório comparativo entre operadores.",
  "sections": [
    {
      "title": "O que esta ferramenta faz",
      "blocks": [
        {
          "type": "p",
          "text": "Depois de portar um lote de números, cada um deve ser chamado a partir de duas redes móveis diferentes (por exemplo Orange e Free) para confirmar que é encaminhado para a nova infraestrutura — uma portabilidade pode funcionar de operador para operador e, ainda assim, estar mal encaminhada entre operadores."
        },
        {
          "type": "p",
          "text": "Ouve o anúncio no seu auricular e decide **OK** (chega à nova infraestrutura) ou **NOK** (infraestrutura antiga / falha). A aplicação automatiza tudo o resto: marcação sequencial por ADB, introdução do veredicto pelo teclado, retoma da sessão e um relatório comparativo entre as passagens dos dois operadores. O veredicto permanece humano — a aplicação nunca o decide por si."
        },
        {
          "type": "note",
          "text": "O áudio (auricular Bluetooth, \"Link to Windows\", etc.) está fora do âmbito: a aplicação apenas comanda a marcação; a escuta fica a seu cargo."
        }
      ]
    },
    {
      "title": "Requisitos",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Um PC com Windows 10/11.",
            "Um **telemóvel Android** ligado por USB, com a **depuração USB ativada** e o PC autorizado. (Um iPhone não pode ser comandado desta forma — o iOS não tem equivalente ao ADB.)",
            "**ADB / platform-tools** disponíveis. Com o `PortaCheck.exe` autónomo, o adb já vem incluído — nada para instalar. Caso contrário, o caminho predefinido é `C:\\platform-tools\\adb.exe`, configurável no `config.json`.",
            "**Python 3.11+** e **Node.js** — apenas para programadores que compilam a partir do código-fonte, não para o exe empacotado."
          ]
        },
        {
          "type": "note",
          "text": "Um só telemóvel é suficiente. Para uma verificação completa precisa de dois SIMs (dois operadores) — insira um, execute uma passagem, troque o SIM, execute a segunda passagem. A aplicação também é totalmente utilizável com um único SIM."
        }
      ]
    },
    {
      "title": "Instalação e arranque",
      "blocks": [
        {
          "type": "steps",
          "items": [
            "A forma mais simples: clique duas vezes em **PortaCheck.exe** — nada para instalar (Python, dependências, a interface e o adb estão todos incluídos).",
            "Abre-se uma janela de consola (o servidor). **Deixe-a aberta** enquanto utiliza a aplicação — fechá-la para o servidor.",
            "O seu navegador abre automaticamente em `http://localhost:8765`. Se não abrir, abra esse endereço manualmente."
          ]
        },
        {
          "type": "note",
          "text": "Tudo funciona localmente na sua máquina — nenhum dado sai do PC, sem chamadas de rede externas, sem telemetria."
        }
      ]
    },
    {
      "title": "Utilização passo a passo",
      "blocks": [
        {
          "type": "steps",
          "items": [
            "**Crie uma campanha** (por exemplo \"Migração Site Lyon\") na página Campanhas.",
            "**Importe os seus números.** Carregue um ficheiro **Excel (.xlsx)** ou CSV/TXT, ou cole-os. A aplicação deteta as colunas e permite escolher qual contém o número e qual é a etiqueta; prima **Pré-visualizar** para verificar as contagens e, depois, **Importar**. Todas as colunas do ficheiro são conservadas e mostradas mais tarde durante a passagem. Os ficheiros sem linha de cabeçalho são suportados.",
            "**Inicie uma passagem.** Escolha o SIM/operador (só são propostos os SIMs acessíveis; com um único SIM, fica pré-selecionado), confirme e entre no cockpit.",
            "**Trabalhe no cockpit** (veja os atalhos de teclado abaixo). Chame o número, ouça, dê um veredicto. Todas as colunas do ficheiro são mostradas para contexto. Os comentários são datados e acrescentados.",
            "**Execute a segunda passagem** com o outro SIM (insira-o, clique em \"Atualizar inventário de SIMs\") e repita.",
            "**Abra o relatório.** Uma vista cruzada por número com a classificação automática, filtros e exportação em CSV / XLSX."
          ]
        }
      ]
    },
    {
      "title": "O cockpit (ecrã de chamada)",
      "blocks": [
        {
          "type": "p",
          "text": "O coração da ferramenta, concebido para ser comandado inteiramente a partir do teclado:"
        },
        {
          "type": "shortcuts",
          "items": [
            {
              "keys": [
                "Espaço"
              ],
              "label": "Marcar o número atual"
            },
            {
              "keys": [
                "Esc"
              ],
              "label": "Desligar"
            },
            {
              "keys": [
                "O"
              ],
              "label": "Veredicto OK"
            },
            {
              "keys": [
                "N"
              ],
              "label": "Veredicto NOK"
            },
            {
              "keys": [
                "S"
              ],
              "label": "Ignorar"
            },
            {
              "keys": [
                "R"
              ],
              "label": "Remarcar"
            },
            {
              "keys": [
                "C"
              ],
              "label": "Focar o campo de comentário"
            },
            {
              "keys": [
                "←",
                "→"
              ],
              "label": "Mover entre registos"
            }
          ]
        },
        {
          "type": "ul",
          "items": [
            "**Navegação livre** — as setas movem-se para qualquer número do ficheiro, não apenas para o próximo por tratar. Pode voltar atrás para corrigir um veredicto, adicionar uma nota ou voltar a chamar.",
            "**Correção** — num registo já tratado, um novo veredicto substitui o antigo, ao passo que o comentário é acrescentado (datado) para preservar o histórico.",
            "**Estado da chamada em direto** — INATIVO / A TOCAR / EM CHAMADA é mostrado a partir do telemóvel, com um cronómetro de chamada.",
            "**Comentários frequentes** — os seus comentários anteriores aparecem como blocos clicáveis e numa lista pendente no campo de comentário, para uniformizar a classificação.",
            "**Modo automático** (desativado por predefinição) — depois de o ativar explicitamente, o número seguinte é marcado automaticamente após o atraso. No modo manual, cada marcação exige Espaço ou um clique.",
            "**STOP** pausa a passagem de forma limpa; pode retomá-la mais tarde — recomeça no primeiro número sem veredicto. Nenhum veredicto se perde.",
            "**Todos os números tratados** — surge um banner verde; clique em \"Concluir + relatório\" para encerrar a passagem e abrir o relatório."
          ]
        }
      ]
    },
    {
      "title": "O relatório comparativo",
      "blocks": [
        {
          "type": "p",
          "text": "Classificação automática por número, ao longo das passagens da campanha:"
        },
        {
          "type": "legend",
          "items": [
            {
              "badge": "emerald",
              "title": "Conforme",
              "text": "OK + OK — encaminha corretamente em ambos os operadores."
            },
            {
              "badge": "amber",
              "title": "⚠ Suspeita de encaminhamento entre operadores",
              "text": "OK num, NOK no outro — o caso-chave a vigiar."
            },
            {
              "badge": "rose",
              "title": "✖ Portabilidade falhada",
              "text": "NOK + NOK — a portabilidade falhou."
            },
            {
              "badge": "slate",
              "title": "Parcial",
              "text": "apenas uma passagem feita (SIM único, ou a segunda passagem ainda não executada)."
            },
            {
              "badge": "slatedim",
              "title": "Não testado",
              "text": "ignorado nessa passagem."
            }
          ]
        },
        {
          "type": "p",
          "text": "Filtre por categoria / veredicto / texto e exporte para **CSV** ou **XLSX**. O relatório é coerente e utilizável mesmo com uma única passagem."
        }
      ]
    },
    {
      "title": "Resolução de problemas",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "**Banner \"Telemóvel desligado\"** — verifique o cabo USB e se a depuração USB está autorizada no telemóvel. Se persistir, desligue/volte a ligar, ou execute `adb kill-server` e reinicie.",
            "**Nenhum SIM apresentado** — desperte/desbloqueie o telemóvel e depois clique em \"Atualizar inventário de SIMs\" no painel de SIMs. Um SIM que seja removido simplesmente não aparece (o modo SIM único não é problema).",
            "**O ecrã de marcação fica escondido sob o ecrã de bloqueio** — o telemóvel tem um bloqueio seguro. A aplicação mantém o ecrã ativo durante uma passagem; desbloqueie-o uma vez no início da passagem.",
            "**Histórico de comandos ADB** — a página \"Registo ADB\" lista os comandos ADB recentes com os códigos de retorno; o registo completo está em `logs/adb.log`."
          ]
        }
      ]
    },
    {
      "title": "Garantias de segurança",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Nunca marca sem uma ação explícita (a menos que o modo automático esteja ativado para a passagem atual).",
            "Mínimo de 1 s entre desligar e a marcação seguinte (predefinição 2 s), imposto também no servidor.",
            "Um SIM inacessível nunca bloqueia o outro — o SIM único é totalmente suportado.",
            "Cada veredicto é guardado de imediato — nada se perde numa falha ou desconexão.",
            "Tudo é local: sem chamada de rede de saída, sem número enviado para fora, sem telemetria."
          ]
        }
      ]
    }
  ],
  "footer": "PortaCheck — aplicação local · os seus dados nunca saem deste PC"
}
