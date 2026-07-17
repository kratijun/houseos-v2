# HouseOS

Ein interaktives Haushalts-Betriebssystem mit Apple-inspirierter Oberfläche, gemeinsamer Datenbank und lokalen Apps für den Alltag.

## Starten

```bash
npm install
npm run dev
```

`npm run dev` startet gleichzeitig:

- die Weboberfläche mit Vite
- die lokale REST-API auf `http://127.0.0.1:3001`
- die SQLite-Datenbank unter `data/houseos.db`

Beim ersten Start zeigt HouseOS eine Bootsequenz und anschließend die Benutzerwahl. Bestehende Benutzer ohne PIN richten dort einmalig eine persönliche PIN mit 4 bis 6 Ziffern ein. PINs werden gehasht in SQLite gespeichert; die Anmeldung verwendet ein HttpOnly-Sitzungscookie.

## Smartphone-PWA

HouseOS kann auf Smartphone und Tablet zum Startbildschirm hinzugefügt und anschließend wie eine eigenständige App geöffnet werden.

- Android/Chrome: Browsermenü öffnen und „App installieren“ auswählen.
- iPhone/Safari: Teilen-Menü öffnen und „Zum Home-Bildschirm“ auswählen.
- Smartphones erhalten automatisch die kompakte Smartphone-Navigation.
- Tablets behalten die vollständige Tablet-Oberfläche.

Für die Installation und den Offline-Start muss HouseOS über HTTPS ausgeliefert werden. `localhost` ist während der Entwicklung ebenfalls erlaubt; eine unverschlüsselte lokale IP-Adresse reicht für Service Worker auf Smartphones normalerweise nicht aus.

### Push-Mitteilungen

Unter **Einstellungen → Mitteilungen** kann jedes angemeldete Gerät Push-Mitteilungen aktivieren und mit einer Testnachricht prüfen. HouseOS informiert über neue oder neu zugewiesene Aufgaben, erledigte Aufgaben, neue Einkaufsartikel sowie neue, geänderte oder entfernte Speiseplan-Einträge. Benachrichtigungen werden auch an den ausführenden Benutzer gesendet, damit Änderungen auf demselben oder einem weiteren persönlichen Gerät sichtbar werden.

HouseOS erzeugt beim ersten Serverstart automatisch ein dauerhaftes VAPID-Schlüsselpaar unter `HOUSEOS_DATA_DIR/push-vapid.json`. Alternativ können produktive Schlüssel über `HOUSEOS_VAPID_PUBLIC_KEY`, `HOUSEOS_VAPID_PRIVATE_KEY` und optional `HOUSEOS_VAPID_SUBJECT` bereitgestellt werden. Die private Schlüsseldatei darf nicht veröffentlicht werden und sollte zusammen mit den übrigen HouseOS-Daten gesichert werden.

## Raspberry Pi

Im Produktionsbetrieb lauscht HouseOS standardmäßig auf allen Netzwerkschnittstellen und ist dadurch im Heimnetz unter `http://<pi-adresse>:3001` erreichbar:

```bash
npm install
npm run build
npm start
```

Für einen lokalen Kiosk kann Chromium direkt mit `http://127.0.0.1:3001` gestartet werden. Unter **Setup → Allgemein → Wetterstadt** kann der Haushaltsadmin eine feste Stadt für Wetter und Zeitzone hinterlegen. Bleibt das Feld leer, verwendet HouseOS die Gerätezeit und fordert die Browser-Standortfreigabe an. Aus den Koordinaten werden Ortsname und Wetter geladen. Auf einem entfernten Gerät benötigt die Browser-Geolocation in der Regel HTTPS; `localhost` gilt als sicherer Kontext.

Falls der Browser auf einem Gerät ohne GPS keinen Standort liefern kann, bestimmt HouseOS den ungefähren Ort automatisch anhand der öffentlichen IP-Adresse. Bei einem fest installierten Gerät können optional genauere Koordinaten in `/etc/houseos.env` hinterlegt werden:

```ini
HOUSEOS_LATITUDE=52.5200
HOUSEOS_LONGITUDE=13.4050
```

### Automatische Pi- und Kiosk-Einrichtung

Auf Raspberry Pi OS 64-bit mit Desktop führt dieses Skript die produktive Einrichtung durch:

```bash
sudo bash deploy/install-pi.sh OWNER/REPO pi
sudo reboot
```

Dabei werden HouseOS, der überwachte Chromium-Kiosk und CUPS als Systemdienste eingerichtet und Desktop-Autologin aktiviert. HouseOS startet bereits vor der grafischen Oberfläche; `houseos-kiosk.service` wartet auf HouseOS und die grafische Sitzung und öffnet Chromium anschließend ohne Browserleisten. Beendet sich Chromium unerwartet, wird der Kiosk automatisch neu gestartet. Der Benutzername `pi` kann durch den tatsächlich verwendeten Desktop-Benutzer ersetzt werden. Node.js 20 oder neuer muss bereits installiert sein.

## Updates über GitHub Releases

Die Einstellungen-App zeigt die installierte Version, den Pi-Systemzustand und verfügbare GitHub-Releases. Das Repository wird auf dem Pi in `/etc/houseos.env` konfiguriert:

```ini
HOUSEOS_GITHUB_REPO=OWNER/REPO
```

Ein Release wird durch einen Git-Tag ausgelöst. Die Version in `package.json` muss zum Tag passen:

```bash
git tag v0.8.0
git push origin v0.8.0
```

Der Workflow `.github/workflows/release.yml` baut HouseOS und veröffentlicht `houseos-<version>.tar.gz`. HouseOS installiert ausschließlich ein Release-Artefakt mit von GitHub gemeldetem SHA-256-Digest. Vor der Installation wird der aktuelle Stand gesichert; schlägt die Installation fehl, stellt der Updater die vorherige Version wieder her. Nach einer erfolgreichen Installation wartet der Updater auf den HouseOS-Dienst und startet anschließend den überwachten Chromium-Kiosk neu. Der Raspberry Pi selbst läuft dabei ohne Neustart weiter. Die SQLite-Datenbank liegt separat unter `/var/lib/houseos` und wird nicht überschrieben.

Für ein privates Repository kann zusätzlich ein nur lesbares Token in `/etc/houseos.env` hinterlegt werden:

```ini
GITHUB_TOKEN=github_pat_...
```

Für Direktdruck auf dem Raspberry Pi muss CUPS einschließlich der Befehle `lp` und `lpstat` installiert und der Bondrucker als RAW-Drucker eingerichtet sein. Unter Windows bleibt der bisherige ESC/POS-Direktdruck über die Druckerwarteschlange verfügbar.

## Enthaltene Apps

- **Heute:** Wetter, Termin, offene Aufgaben und Tagesübersicht
- **Aufgaben:** Aufgaben anlegen, Personen zuweisen, abhaken und löschen
- **Haushaltspunkte:** 10 Punkte pro erledigter Aufgabe, persönliche Wochenserien und Auszeichnungen
- **Einkauf:** Gemeinsame Einkaufsliste mit frei editierbaren Mengen und Kategorien verwalten
- **Speiseplan:** Wochenweise Frühstück, Mittag- und Abendessen samt Zutaten planen und fehlende Zutaten direkt auf die Einkaufsliste setzen
- **Bärli:** Antippbares HouseOS-Tamagotchi mit Bedürfnissen, Aktionszeiten, Leveln und kombinierbarer Kleidung
- **Print Center:** Tages-, Einkaufs- und Aufgabenbons als 58-/80-mm-Vorschau und Direktdruck
- **Mitglieder:** Haushaltsmitglieder anlegen, bearbeiten und entfernen

Mitglieder, Aufgaben und Einkäufe werden dauerhaft in SQLite gespeichert. Ist die API vorübergehend nicht erreichbar, verwendet die Oberfläche automatisch den lokalen Browser-Speicher als Fallback.

Nach einer Minute ohne Eingabe wechselt HouseOS standardmäßig in den gemeinsamen Ruhe- und Sperrbildschirm. Dort bleiben Uhrzeit, Wetter und nächste Aufgaben sichtbar. Beim Hochziehen folgt der Sperrbildschirm direkt der Bewegung und gibt den darunterliegenden Profil- und PIN-Anmeldebildschirm frei; wird nicht weit genug gezogen, gleitet er wieder zurück. Die Pfeiltaste nach oben ist die Tastatur-Alternative. Wird der frühe Ruhemodus unter **Setup → Allgemein → HouseOS** deaktiviert, sperrt HouseOS das Profil nach 15 Minuten Inaktivität. Geöffnete Fenster und ihre Positionen werden je Profil gespeichert und nach der Anmeldung wiederhergestellt.

## Desktop-Fenster

Mehrere HouseOS-Apps können gleichzeitig geöffnet, frei verschoben, minimiert und über das Dock wiederhergestellt werden. Beim Ziehen an den linken oder rechten Bildschirmrand dockt ein Fenster auf 50 Prozent der verfügbaren Arbeitsfläche an. Am oberen Rand wird es maximiert. Eine Vorschau zeigt das Ziel bereits während des Ziehens.

## Direktdruck

Das Print Center erkennt unter Windows installierte Drucker und auf dem Raspberry Pi eingerichtete CUPS-Drucker. ESC/POS-Rohdaten werden direkt an den gewählten Bondrucker gesendet.

- Unterstützte Papierbreiten: **58 mm** und **80 mm**
- 58 mm werden mit 32 Zeichen pro Zeile formatiert
- 80 mm werden mit 48 Zeichen pro Zeile formatiert
- Der automatische Schneidebefehl kann ein- oder ausgeschaltet werden
- Die gewählte Konfiguration wird in SQLite gespeichert
- „Druckdaten testen“ erzeugt einen sicheren Trockenlauf ohne Papierausgabe

Der Direktdruck setzt voraus, dass HouseOS auf demselben Windows-Rechner wie der ESC/POS-kompatible Bondrucker läuft. Der Drucker muss in Windows installiert sein.

## Bluetooth und Alexa

Auf dem Raspberry Pi können Bluetooth-Geräte direkt unter **Einstellungen → Bluetooth** gesucht, gekoppelt, verbunden und wieder entfernt werden. Die Geräteverwaltung ist Haushaltsadmins vorbehalten. Die automatische Pi-Einrichtung installiert dafür BlueZ, aktiviert den Bluetooth-Systemdienst und nimmt den HouseOS-Benutzer in die Gruppe `bluetooth` auf.

Um einen Echo als Lautsprecher zu verwenden, zuerst „Alexa, Bluetooth koppeln“ sagen und anschließend den erscheinenden Echo in HouseOS mit **Verbinden** auswählen. HouseOS vertraut dem Gerät nach dem Koppeln, sodass es später ohne erneute Freigabe verbunden werden kann. Die eigentliche Musikwiedergabe und Auswahl des Bluetooth-Audioausgangs werden in einem folgenden Schritt ergänzt.

## Produktionsbetrieb

```bash
npm run build
npm start
```

Die API liefert im Produktionsbetrieb auch die gebaute Weboberfläche aus. HouseOS ist dann unter `http://127.0.0.1:3001` erreichbar.
