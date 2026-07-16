# Fixtures Phase 0 — PortaCheck

Sorties brutes capturées lors du pré-vol interactif (Phase 0) le **2026-07-08**.
Appareil : **Samsung Galaxy A25 5G** (SM-A256B, serial `EMULATOR30X0`).

Ces fichiers servent de **fixtures pour les tests unitaires** des parseurs `dumpsys`
(`adb_parsers.py`). Le parsing de `dumpsys isub` et `dumpsys telephony.registry` est
fragile : il doit être isolé et testé sur ces captures réelles.

| Fichier | Étape | Contenu |
|---|---|---|
| `0.1_adb_version.txt` | 0.1 | `adb version` (v37.0.0) |
| `0.2_adb_devices_unauthorized.txt` | 0.2 | `adb devices -l` — état initial `unauthorized` |
| `0.2_adb_devices_authorized.txt` | 0.2 | `adb devices -l` — état `device` après autorisation |
| `0.3_dumpsys_isub.txt` | 0.3 | `dumpsys isub` — inventaire SIM (1 SIM Orange, slot 0 ABSENT) |
| `0.4_dumpsys_telephony_registry.txt` | 0.4 | `dumpsys telephony.registry` — état réseau par phoneId, mCallState |
| `0.5_multi_sim_voice_call.txt` | 0.5 | `settings get global multi_sim_voice_call` (= `1`) |
| `0.6_bascule_sim_methodeA.txt` | 0.6 | Test put/get multi_sim_voice_call (méthode A validée sur le canal) |
| `0.8_appel_national_deverrouille.txt` | 0.8 | Appel test national `0600000000`, mCallState 0→2→0 |
| `0.9_ecran_verrouille.txt` | 0.9 | Appel écran verrouillé — part quand même (Dozing + OFFHOOK) |
| `0.9b_keyguard_wakeup.txt` | 0.9 | État keyguard (verrou sécurisé) + test KEYCODE_WAKEUP |
| `0.10_formats_numero.txt` | 0.10 | Test format E.164 `+33600000000` (OK), national OK aussi |

## Points clés pour l'implémentation

- **Mono-SIM** : une seule SIM active (Orange, subId=1, slotIndex=1). L'app doit être
  pleinement fonctionnelle en mono-SIM (garde-fou non négociable).
- **Formats** : les deux composent (`e164` retenu, `national` en repli).
- **Écran verrouillé** : l'appel ADB part malgré le verrou sécurisé, mais prévoir
  `KEYCODE_WAKEUP` + `svc power stayon usb` en début de passe et un déverrouillage
  initial manuel (écran d'appel masqué sous le keyguard sinon).
- **mCallState** : `0`=IDLE, `2`=OFFHOOK (appel actif). Vérifié en conditions réelles.

## Numéro de test

Le numéro `0600000000` (fourni par l'utilisateur) apparaît dans les captures 0.8/0.9/0.10.
Ces fixtures ne contiennent pas d'ICCID/IMSI complets (masqués par Android en `[****]`).
