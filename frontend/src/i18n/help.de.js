// de — generated Help translation (validated structure).
export const helpDe = {
  "title": "PortaCheck — Benutzerhandbuch",
  "intro": "Ein lokales Werkzeug zur Überprüfung der Rufnummernportierung (SDA / DID) nach einer Migration, indem Testanrufe über ADB von einem Android-Telefon aus gesteuert werden, mit einem menschlichen, audiobasierten Urteil und einem netzbetreiberübergreifenden Vergleichsbericht.",
  "sections": [
    {
      "title": "Was dieses Werkzeug leistet",
      "blocks": [
        {
          "type": "p",
          "text": "Nachdem ein Stapel von Rufnummern portiert wurde, muss jede von zwei verschiedenen Mobilfunknetzen aus (z. B. Orange und Free) angerufen werden, um zu bestätigen, dass sie zur neuen Infrastruktur geleitet wird — eine Portierung kann von Netzbetreiber zu Netzbetreiber funktionieren und trotzdem netzbetreiberübergreifend fehlgeleitet werden."
        },
        {
          "type": "p",
          "text": "Sie hören sich die Ansage in Ihrem Headset an und entscheiden **OK** (erreicht die neue Infrastruktur) oder **NOK** (alte Infrastruktur / Fehler). Die Anwendung automatisiert alles Übrige: sequenzielles Wählen über ADB, Urteilseingabe per Tastatur, Sitzungswiederaufnahme und einen Vergleichsbericht zwischen den Durchläufen der beiden Netzbetreiber. Das Urteil bleibt menschlich — die App entscheidet es niemals für Sie."
        },
        {
          "type": "note",
          "text": "Audio (Bluetooth-Headset, \"Verknüpfung mit Windows\" usw.) liegt außerhalb des Umfangs: Die App steuert nur das Wählen; das Zuhören übernehmen Sie."
        }
      ]
    },
    {
      "title": "Voraussetzungen",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Ein Windows-10/11-PC.",
            "Ein **Android-Telefon**, das per USB angeschlossen ist, mit **aktiviertem USB-Debugging** und autorisiertem PC. (Ein iPhone kann auf diese Weise nicht gesteuert werden — iOS hat kein ADB-Äquivalent.)",
            "**ADB / platform-tools** verfügbar. Mit der eigenständigen `PortaCheck.exe` ist adb bereits enthalten — nichts zu installieren. Andernfalls lautet der Standardpfad `C:\\platform-tools\\adb.exe`, konfigurierbar in `config.json`.",
            "**Python 3.11+** und **Node.js** — nur für Entwickler, die aus dem Quellcode bauen, nicht für die gepackte exe."
          ]
        },
        {
          "type": "note",
          "text": "Ein Telefon genügt. Für eine vollständige Überprüfung benötigen Sie zwei SIM-Karten (zwei Netzbetreiber) — legen Sie eine ein, führen Sie einen Durchlauf aus, tauschen Sie die SIM-Karte, führen Sie den zweiten Durchlauf aus. Die App ist auch mit einer einzigen SIM-Karte voll nutzbar."
        }
      ]
    },
    {
      "title": "Installation & Start",
      "blocks": [
        {
          "type": "steps",
          "items": [
            "Der einfachste Weg: Doppelklick auf **PortaCheck.exe** — nichts zu installieren (Python, Abhängigkeiten, die Oberfläche und adb sind alle enthalten).",
            "Ein Konsolenfenster öffnet sich (der Server). **Lassen Sie es geöffnet**, während Sie die App nutzen — beim Schließen wird der Server gestoppt.",
            "Ihr Browser öffnet sich automatisch unter `http://localhost:8765`. Falls nicht, öffnen Sie diese Adresse manuell."
          ]
        },
        {
          "type": "note",
          "text": "Alles läuft lokal auf Ihrem Rechner — keine Daten verlassen jemals den PC, keine externen Netzwerkaufrufe, keine Telemetrie."
        }
      ]
    },
    {
      "title": "Schritt-für-Schritt-Nutzung",
      "blocks": [
        {
          "type": "steps",
          "items": [
            "**Erstellen Sie eine Kampagne** (z. B. \"Migration Standort Lyon\") auf der Kampagnen-Seite.",
            "**Importieren Sie Ihre Rufnummern.** Laden Sie eine **Excel-Datei (.xlsx)** oder CSV-/TXT-Datei, oder fügen Sie sie ein. Die App erkennt die Spalten und lässt Sie wählen, welche die Rufnummer und welche die Bezeichnung enthält; drücken Sie **Vorschau**, um die Anzahl zu prüfen, dann **Importieren**. Alle Spalten der Datei werden beibehalten und später während des Durchlaufs angezeigt. Dateien ohne Kopfzeile werden ebenfalls verarbeitet.",
            "**Starten Sie einen Durchlauf.** Wählen Sie die SIM/den Netzbetreiber (nur erreichbare SIM-Karten werden angeboten; bei einer einzigen SIM ist sie vorausgewählt), bestätigen Sie und betreten Sie das Cockpit.",
            "**Arbeiten Sie im Cockpit** (siehe die Tastaturkürzel unten). Rufen Sie die Nummer an, hören Sie zu, fällen Sie ein Urteil. Alle Dateispalten werden zur Kontext-Information angezeigt. Kommentare werden mit Zeitstempel versehen und angehängt.",
            "**Führen Sie den zweiten Durchlauf** mit der anderen SIM-Karte aus (legen Sie sie ein, klicken Sie auf \"SIM-Bestand aktualisieren\"), dann wiederholen Sie.",
            "**Öffnen Sie den Bericht.** Eine Querübersicht pro Nummer mit der automatischen Klassifizierung, Filtern und CSV-/XLSX-Export."
          ]
        }
      ]
    },
    {
      "title": "Das Cockpit (Anrufbildschirm)",
      "blocks": [
        {
          "type": "p",
          "text": "Das Herzstück des Werkzeugs, konzipiert für die vollständige Bedienung über die Tastatur:"
        },
        {
          "type": "shortcuts",
          "items": [
            {
              "keys": [
                "Leertaste"
              ],
              "label": "Die aktuelle Nummer wählen"
            },
            {
              "keys": [
                "Esc"
              ],
              "label": "Auflegen"
            },
            {
              "keys": [
                "O"
              ],
              "label": "Urteil OK"
            },
            {
              "keys": [
                "N"
              ],
              "label": "Urteil NOK"
            },
            {
              "keys": [
                "S"
              ],
              "label": "Überspringen"
            },
            {
              "keys": [
                "R"
              ],
              "label": "Erneut wählen"
            },
            {
              "keys": [
                "C"
              ],
              "label": "Kommentarfeld fokussieren"
            },
            {
              "keys": [
                "←",
                "→"
              ],
              "label": "Zwischen Datensätzen wechseln"
            }
          ]
        },
        {
          "type": "ul",
          "items": [
            "**Freie Navigation** — die Pfeiltasten bewegen sich zu jeder Nummer in der Datei, nicht nur zur nächsten unbearbeiteten. Sie können zurückgehen, um ein Urteil zu korrigieren, eine Notiz hinzuzufügen oder erneut anzurufen.",
            "**Korrektur** — bei einem bereits bearbeiteten Datensatz ersetzt ein neues Urteil das alte, während der Kommentar angehängt wird (mit Zeitstempel), sodass die Historie erhalten bleibt.",
            "**Live-Anrufstatus** — INAKTIV / KLINGELT / IM GESPRÄCH wird vom Telefon angezeigt, mit einem Gesprächstimer.",
            "**Häufige Kommentare** — Ihre vergangenen Kommentare erscheinen als anklickbare Kacheln und in einem Aufklappmenü am Kommentarfeld, um die Klassifizierung zu vereinheitlichen.",
            "**Auto-Modus** (standardmäßig aus) — nachdem Sie ihn ausdrücklich scharfgeschaltet haben, wird die nächste Nummer nach der Verzögerung automatisch gewählt. Im manuellen Modus benötigt jedes Wählen die Leertaste oder einen Klick.",
            "**STOP** pausiert den Durchlauf sauber; Sie können ihn später fortsetzen — er beginnt bei der ersten Nummer ohne Urteil erneut. Es geht niemals ein Urteil verloren.",
            "**Alle Nummern bearbeitet** — ein grünes Banner erscheint; klicken Sie auf \"Abschließen + Bericht\", um den Durchlauf zu beenden und den Bericht zu öffnen."
          ]
        }
      ]
    },
    {
      "title": "Der Vergleichsbericht",
      "blocks": [
        {
          "type": "p",
          "text": "Automatische Klassifizierung pro Nummer, über die Durchläufe der Kampagne hinweg:"
        },
        {
          "type": "legend",
          "items": [
            {
              "badge": "emerald",
              "title": "Konform",
              "text": "OK + OK — wird auf beiden Netzbetreibern korrekt geleitet."
            },
            {
              "badge": "amber",
              "title": "⚠ Netzbetreiberübergreifende Fehlleitung vermutet",
              "text": "OK beim einen, NOK beim anderen — der entscheidende zu beobachtende Fall."
            },
            {
              "badge": "rose",
              "title": "✖ Portierung fehlgeschlagen",
              "text": "NOK + NOK — die Portierung ist fehlgeschlagen."
            },
            {
              "badge": "slate",
              "title": "Teilweise",
              "text": "nur ein Durchlauf durchgeführt (einzelne SIM, oder der zweite Durchlauf noch nicht ausgeführt)."
            },
            {
              "badge": "slatedim",
              "title": "Nicht getestet",
              "text": "bei diesem Durchlauf übersprungen."
            }
          ]
        },
        {
          "type": "p",
          "text": "Filtern Sie nach Kategorie / Urteil / Text und exportieren Sie nach **CSV** oder **XLSX**. Der Bericht ist auch mit einem einzigen Durchlauf schlüssig und nutzbar."
        }
      ]
    },
    {
      "title": "Fehlerbehebung",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "**Banner \"Telefon getrennt\"** — prüfen Sie das USB-Kabel und ob das USB-Debugging auf dem Telefon autorisiert ist. Falls es weiterhin besteht, trennen/verbinden Sie erneut, oder führen Sie `adb kill-server` aus und starten Sie dann neu.",
            "**Keine SIM angezeigt** — wecken/entsperren Sie das Telefon, klicken Sie dann auf \"SIM-Bestand aktualisieren\" im SIM-Dashboard. Eine entfernte SIM-Karte wird einfach nicht angezeigt (der Einzel-SIM-Modus ist in Ordnung).",
            "**Der Wählbildschirm bleibt unter dem Sperrbildschirm verborgen** — das Telefon hat eine sichere Sperre. Die App hält den Bildschirm während eines Durchlaufs wach; entsperren Sie ihn einmal zu Beginn des Durchlaufs.",
            "**ADB-Befehlsverlauf** — die Seite \"ADB-Protokoll\" listet die letzten ADB-Befehle mit Rückgabecodes auf; das vollständige Protokoll befindet sich in `logs/adb.log`."
          ]
        }
      ]
    },
    {
      "title": "Sicherheitsgarantien",
      "blocks": [
        {
          "type": "ul",
          "items": [
            "Wählt niemals ohne eine ausdrückliche Aktion (es sei denn, der Auto-Modus ist für den aktuellen Durchlauf scharfgeschaltet).",
            "Mindestens 1 s zwischen dem Auflegen und dem nächsten Wählen (Standard 2 s), auch serverseitig erzwungen.",
            "Eine nicht erreichbare SIM-Karte blockiert niemals die andere — der Einzel-SIM-Betrieb wird vollständig unterstützt.",
            "Jedes Urteil wird sofort dauerhaft gespeichert — bei einem Absturz oder einer Trennung geht nichts verloren.",
            "Alles ist lokal: kein ausgehender Netzwerkaufruf, keine Nummer wird nach außen gesendet, keine Telemetrie."
          ]
        }
      ]
    }
  ],
  "footer": "PortaCheck — lokale Anwendung · Ihre Daten verlassen niemals diesen PC"
}
