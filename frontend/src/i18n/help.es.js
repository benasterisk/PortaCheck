// es — generated Help translation (validated structure).
export const helpEs = {
  "title": "PortaCheck — Guía del usuario",
  "intro": "Una herramienta local para verificar la portabilidad de números (SDA / DID) tras una migración, realizando llamadas de prueba controladas por ADB desde un teléfono Android, con un veredicto humano basado en la escucha y un informe comparativo entre operadores.",
  "footer": "PortaCheck — aplicación local · tus datos nunca salen de este PC",
  "sections": [
    {
      "title": "Qué hace esta herramienta",
      "blocks": [
        {
          "type": "p",
          "text": "Tras portar un lote de números, cada uno debe llamarse desde dos redes móviles diferentes (por ejemplo, Orange y Free) para confirmar que se enruta hacia la nueva infraestructura: una portabilidad puede funcionar entre líneas del mismo operador y, sin embargo, estar mal enrutada entre operadores distintos."
        },
        {
          "type": "p",
          "text": "Escuchas el anuncio en tus auriculares y decides **OK** (llega a la nueva infraestructura) o **NOK** (infraestructura antigua / fallo). La aplicación automatiza todo lo demás: la marcación secuencial por ADB, la introducción del veredicto con el teclado, la reanudación de la sesión y un informe comparativo entre las pasadas de los dos operadores. El veredicto sigue siendo humano: la aplicación nunca lo decide por ti."
        },
        {
          "type": "note",
          "text": "El audio (auriculares Bluetooth, «Vínculo con Windows», etc.) queda fuera del alcance: la aplicación solo controla la marcación; de la escucha te encargas tú."
        }
      ]
    },
    {
      "title": "Requisitos",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Un PC con Windows 10/11.",
            "Un **teléfono Android** conectado por USB, con la **depuración USB activada** y el PC autorizado. (Un iPhone no puede controlarse de esta forma: iOS no tiene un equivalente a ADB.)",
            "**ADB / platform-tools** disponible. Con el ejecutable independiente `PortaCheck.exe`, adb ya viene incluido: no hay nada que instalar. En caso contrario, la ruta predeterminada es `C:\\platform-tools\\adb.exe`, configurable en `config.json`.",
            "**Python 3.11+** y **Node.js**: solo para desarrolladores que compilen desde el código fuente, no para el ejecutable empaquetado."
          ]
        },
        {
          "type": "note",
          "text": "Con un solo teléfono basta. Para una verificación completa necesitas dos SIM (dos operadores): inserta una, ejecuta una pasada, cambia la SIM y ejecuta la segunda pasada. La aplicación también es totalmente utilizable con una sola SIM."
        }
      ]
    },
    {
      "title": "Instalación y arranque",
      "blocks": [
        {
          "type": "steps",
          "items": [
            "La forma más sencilla: haz doble clic en **PortaCheck.exe**; no hay nada que instalar (Python, las dependencias, la interfaz y adb vienen todos incluidos).",
            "Se abre una ventana de consola (el servidor). **Déjala abierta** mientras usas la aplicación: si la cierras, se detiene el servidor.",
            "Tu navegador se abre automáticamente en `http://localhost:8765`. Si no lo hace, abre esa dirección manualmente."
          ]
        },
        {
          "type": "note",
          "text": "Todo se ejecuta localmente en tu máquina: ningún dato sale nunca del PC, no hay llamadas a redes externas ni telemetría."
        }
      ]
    },
    {
      "title": "Uso paso a paso",
      "blocks": [
        {
          "type": "steps",
          "items": [
            "**Crea una campaña** (por ejemplo, «Migración sede Lyon») en la página de Campañas.",
            "**Importa tus números.** Carga un archivo **Excel (.xlsx)** o CSV/TXT, o pégalos. La aplicación detecta las columnas y te permite elegir cuál contiene el número y cuál la etiqueta; pulsa **Vista previa** para comprobar los totales y luego **Importar**. Se conservan todas las columnas del archivo y se muestran más tarde durante la pasada. También se admiten archivos sin fila de encabezado.",
            "**Inicia una pasada.** Elige la SIM/operador (solo se ofrecen las SIM accesibles; con una sola SIM viene preseleccionada), confirma y entra en la cabina.",
            "**Trabaja en la cabina** (consulta los atajos de teclado más abajo). Llama al número, escucha, emite un veredicto. Se muestran todas las columnas del archivo como contexto. Los comentarios llevan marca de tiempo y se añaden.",
            "**Ejecuta la segunda pasada** con la otra SIM (insértala y haz clic en «Actualizar inventario de SIM»), luego repite.",
            "**Abre el informe.** Una vista cruzada por número con la clasificación automática, filtros y exportación a CSV / XLSX."
          ]
        }
      ]
    },
    {
      "title": "La cabina (pantalla de llamada)",
      "blocks": [
        {
          "type": "p",
          "text": "El corazón de la herramienta, diseñado para manejarse por completo desde el teclado:"
        },
        {
          "type": "shortcuts",
          "items": [
            {
              "keys": [
                "Espacio"
              ],
              "label": "Marcar el número actual"
            },
            {
              "keys": [
                "Esc"
              ],
              "label": "Colgar"
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
              "label": "Saltar"
            },
            {
              "keys": [
                "R"
              ],
              "label": "Volver a marcar"
            },
            {
              "keys": [
                "C"
              ],
              "label": "Enfocar el campo de comentario"
            },
            {
              "keys": [
                "←",
                "→"
              ],
              "label": "Desplazarse entre registros"
            }
          ]
        },
        {
          "type": "ul",
          "items": [
            "**Navegación libre**: las flechas se desplazan a cualquier número del archivo, no solo al siguiente sin tratar. Puedes volver atrás para corregir un veredicto, añadir una nota o volver a llamar.",
            "**Corrección**: en un registro ya tratado, un nuevo veredicto reemplaza al anterior, mientras que el comentario se añade (con marca de tiempo) para conservar el historial.",
            "**Estado de la llamada en tiempo real**: se muestra INACTIVO / LLAMANDO / EN LLAMADA según el teléfono, con un cronómetro de llamada.",
            "**Comentarios frecuentes**: tus comentarios anteriores aparecen como fichas en las que se puede hacer clic y en un desplegable del campo de comentario, para estandarizar la clasificación.",
            "**Modo automático** (desactivado por defecto): tras armarlo explícitamente, el siguiente número se marca automáticamente después del retardo. En modo manual, cada marcación requiere Espacio o un clic.",
            "**STOP** pausa la pasada de forma limpia; puedes reanudarla más tarde: se reinicia en el primer número sin veredicto. Nunca se pierde ningún veredicto.",
            "**Todos los números tratados**: aparece un banner verde; haz clic en «Finalizar + informe» para cerrar la pasada y abrir el informe."
          ]
        }
      ]
    },
    {
      "title": "El informe comparativo",
      "blocks": [
        {
          "type": "p",
          "text": "Clasificación automática por número, a través de las pasadas de la campaña:"
        },
        {
          "type": "legend",
          "items": [
            {
              "badge": "emerald",
              "title": "Conforme",
              "text": "OK + OK: se enruta correctamente en ambos operadores."
            },
            {
              "badge": "amber",
              "title": "⚠ Sospecha de enrutamiento entre operadores",
              "text": "OK en uno, NOK en el otro: el caso clave a vigilar."
            },
            {
              "badge": "rose",
              "title": "✖ Portabilidad fallida",
              "text": "NOK + NOK: la portabilidad ha fallado."
            },
            {
              "badge": "slate",
              "title": "Parcial",
              "text": "solo se ha hecho una pasada (SIM única, o la segunda pasada aún no se ha ejecutado)."
            },
            {
              "badge": "slatedim",
              "title": "Sin probar",
              "text": "omitido en esa pasada."
            }
          ]
        },
        {
          "type": "p",
          "text": "Filtra por categoría / veredicto / texto y exporta a **CSV** o **XLSX**. El informe es coherente y utilizable incluso con una sola pasada."
        }
      ]
    },
    {
      "title": "Resolución de problemas",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "**Banner «Teléfono desconectado»**: comprueba el cable USB y que la depuración USB esté autorizada en el teléfono. Si persiste, desconecta y vuelve a conectar, o ejecuta `adb kill-server` y luego reinicia.",
            "**No se muestra ninguna SIM**: activa/desbloquea el teléfono y luego haz clic en «Actualizar inventario de SIM» en el panel de SIM. Una SIM retirada simplemente no aparecerá (el modo de SIM única funciona sin problema).",
            "**La pantalla de marcación permanece oculta bajo la pantalla de bloqueo**: el teléfono tiene un bloqueo seguro. La aplicación mantiene la pantalla activa durante una pasada; desbloquéalo una vez al comienzo de la pasada.",
            "**Historial de comandos ADB**: la página «Registro ADB» muestra los comandos ADB recientes con sus códigos de retorno; el registro completo está en `logs/adb.log`."
          ]
        }
      ]
    },
    {
      "title": "Garantías de seguridad",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Nunca marca sin una acción explícita (a menos que el modo automático esté armado para la pasada actual).",
            "Mínimo 1 s entre colgar y la siguiente marcación (por defecto 2 s), aplicado también en el servidor.",
            "Una SIM inaccesible nunca bloquea a la otra: la SIM única es totalmente compatible.",
            "Cada veredicto se guarda de inmediato: no se pierde nada ante un fallo o una desconexión.",
            "Todo es local: ninguna llamada de red saliente, ningún número enviado al exterior, sin telemetría."
          ]
        }
      ]
    }
  ]
}
