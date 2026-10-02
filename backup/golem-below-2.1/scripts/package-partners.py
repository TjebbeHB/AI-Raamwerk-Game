"""Create a ready-to-run local distribution without sessions or hosting credentials."""
import json
import pathlib
import tempfile
import zipfile
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'share' / 'The-Golem-Below-2.1-Partner-Pack.zip'
NAME = 'The Golem Below 2.1'

GUIDE = '''THE GOLEM BELOW 2.1 — PARTNEREDITIE

Een Nederlandstalige voxel-expeditie door het AI-raamwerk.
Eén persoon speelt op het grote scherm; maximaal 15 anderen denken mee
via hun telefoon. Begin bij het onderwerp dat voor jullie relevant is.

EERSTE KEER
1. Download de ZIP uit Drive en pak de HELE map uit op je computer.
   Speel niet vanuit de Drive-preview en open index.html niet rechtstreeks.
2. Installeer Node.js als dat nog niet aanwezig is (versie 22.13 of hoger):
   https://nodejs.org/en/download
   Vraag zo nodig jullie IT-beheerder om hulp.
3. Start de launcher voor jouw systeem:
   Windows: Start Game - Windows.bat
   Mac: Start Game - Mac.command
   Linux: sh 'Start Game - Linux.sh'

Opent een launcher niet, open dan Terminal / Opdrachtprompt in de uitgepakte
map en voer uit:
    npm start

Geen npm install, build, account, API-sleutel of Codex-installatie nodig.
Open daarna http://localhost:5173 in een moderne browser.
Houd het terminalvenster open tijdens het spelen. Ctrl+C stopt de server.

SPELEN
Kies 'Start de expeditie'. Het beginportaal heeft 14 poorten:
4 fundamenten en 10 domeinen. Er is geen vaste volgorde.
Loop met WASD of de pijltjestoetsen. Spatie springt, C kruipt, E bekijkt.
De knoppen Spring en Kruip / Sta op werken ook zonder toetsenbord.
Spring over kisten, kruip onder balken en ontwijk de bewegende rolsteen.
Je kunt ook om de obstakels heen lopen. Een botsing zet je terug bij de
ingang; jullie antwoorden en stemmen blijven bewaard.
Je kunt ook op een poort, bron of onderwerp in het zijpaneel klikken.

Per ruimte:
- Lees de overheidscasus. Vraag, antwoorden en adviesronde zijn direct open.
- Open naar behoefte een bron naast de vraag; bronnen zijn niet verplicht.
  Iedere bron geeft uitleg, praktische aandachtspunten en een casusvoorbeeld.
- Meerdere antwoorden kunnen passen.
- De raad adviseert; de speler kiest zelf welke maatregelen passend zijn.
- Bespreek de uitleg: kernmaatregel, nuttige aanvulling of hier niet passend.
- Bewaar een inzicht of actie voor jullie eigen project en kies een nieuwe poort.

Reken op circa vijf minuten per onderwerp. Jullie hoeven niet alles te spelen.
Herhalen kan: eerdere besprekingen blijven bewaard in het logboek.
Via Logboek kun je keuzes, stemmen, toelichtingen en notities downloaden.
Dit is een educatief leergesprek, geen juridische toets of goedkeuring.

DE ADVIESRAAD UITNODIGEN
Klik op 'Adviesraad'. Laat deelnemers de QR-code scannen of de link openen.
Computer en telefoons moeten hetzelfde netwerk gebruiken. Alleen de computer
heeft Node.js en dit pakket nodig; op telefoons volstaat een browser.
Deelnemers lezen de casus en bronnen op hun telefoon en stemmen daar.
Ze hoeven de 3D-wereld niet te zien. Hun stemmen zijn advies, geen besluit.

Gebruik voor telefoons het netwerkadres, bijvoorbeeld http://192.168.1.84:5173.
Een localhost-link werkt alleen op de computer waarop de server draait.
Bij meerdere netwerkverbindingen: kies het serveradres voor de gedeelde wifi.
Gastnetwerken of een VPN kunnen onderlinge verbindingen blokkeren.
Laat de Node-server zo nodig door de firewall op het gedeelde private netwerk.

Deze editie draait lokaal. Een deelnemer op een andere locatie kan niet via
jouw lokale link deelnemen. Partners kunnen het pakket wel afzonderlijk
uitproberen. Een gedeelde sessie op afstand vraagt een gehoste versie.

VOORTGANG EN DELEN
Sessies worden bewaard in de data-map naast server.js. De browser onthoudt
jouw toegangspas. Gebruik dezelfde browser, computer en hetzelfde adres
om verder te gaan. Wis je de browseropslag, dan verdwijnt de toegangspas.

De meegeleverde ZIP bevat geen gespeelde sessies. Deel deze originele ZIP.
Een map waarin al is gespeeld kan namen, notities en toegangspassen bevatten;
maak daarvan niet zomaar een nieuwe ZIP om met partners te delen.

EERDERE SPELVORMEN
Engelstalig avontuur met vijf kamers: http://localhost:5173/?story
Oorspronkelijke Nederlandse workshop: http://localhost:5173/workshop.html

PROBLEMEN OPLOSSEN
- Node wordt niet herkend: installeer Node.js en heropen de terminal.
- Poort al bezet of een andere website verschijnt: stop de andere server
  of kies een andere poort. Bijvoorbeeld in Mac/Linux Terminal:
      PORT=5184 node server.js
  In Windows Opdrachtprompt (twee afzonderlijke regels):
      set PORT=5184
      node server.js
  Open vervolgens http://localhost:5184.
- Geen 3D: probeer een browser met WebGL/hardwareversnelling. Onderwerpen
  en bronnen blijven bij ontbrekende 3D via knoppen beschikbaar.
- Telefoons verbinden niet: controleer wifi, netwerkadres, VPN en firewall.

Er worden geen antwoorden door een AI-model gegenereerd. De browserbibliotheken
zijn inbegrepen; internet wordt gebruikt voor optionele lettertypen en
verdiepende bronlinks. Licenties staan in THIRD-PARTY-NOTICES.txt.
'''

MAC = '''#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js LTS from https://nodejs.org/en/download, then try again."
else
  echo "Open http://localhost:5173 in your browser. Keep this window open."
  node server.js
fi
echo "Press Return to close."
read -r
'''
WINDOWS = '''@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org/en/download, then try again.
  pause
  exit /b 1
)
echo Open http://localhost:5173 in your browser. Keep this window open.
node server.js
pause
'''
LINUX = '''#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js LTS from https://nodejs.org/en/download, then try again."
  exit 1
fi
echo "Open http://localhost:5173 in your browser. Keep this window open."
exec node server.js
'''

def main():
    if not (ROOT / 'public/game.bundle.js').is_file():
        raise SystemExit('Run npm run build before packaging.')
    with tempfile.TemporaryDirectory(prefix='golem-package-') as temporary:
        package = pathlib.Path(temporary) / NAME
        package.mkdir()
        shutil.copy2(ROOT / 'server.js', package / 'server.js')
        shutil.copytree(ROOT / 'public', package / 'public',
                        ignore=shutil.ignore_patterns('.DS_Store', '*.map'))
        (package / 'game').mkdir()
        for filename in ['content.cjs', 'engine.cjs', 'local-api.cjs', 'framework.cjs', 'topics.cjs', 'topics.json']:
            shutil.copy2(ROOT / 'game' / filename, package / 'game' / filename)
        (package / 'package.json').write_text(json.dumps({
            'name': 'the-golem-below-partner-edition', 'version': '2.1.0',
            'private': True, 'license': 'UNLICENSED', 'main': 'server.js',
            'engines': {'node': '>=22.13.0'}, 'scripts': {'start': 'node server.js'}
        }, indent=2) + '\n')
        (package / 'LEES EERST.txt').write_text(GUIDE)
        (package / 'START HERE.txt').write_text(GUIDE)
        (package / 'Start Game - Mac.command').write_text(MAC)
        (package / 'Start Game - Mac.command').chmod(0o755)
        (package / 'Start Game - Linux.sh').write_text(LINUX)
        (package / 'Start Game - Linux.sh').chmod(0o755)
        (package / 'Start Game - Windows.bat').write_bytes(WINDOWS.replace('\n','\r\n').encode())
        notices=['THIRD-PARTY NOTICES\n\nNotices for the included browser libraries.\n']
        lock=json.loads((ROOT/'package-lock.json').read_text())
        for relative,info in lock.get('packages',{}).items():
            if not relative or info.get('dev'):
                continue
            folder=ROOT/relative
            for source in sorted(folder.glob('*')):
                if source.is_file() and source.name.lower().startswith(('license','licence','copying')):
                    notices.append(f'\n--- {relative.removeprefix("node_modules/")} {info.get("version", "")} ---\n\n'+source.read_text(errors='replace'))
        (package / 'THIRD-PARTY-NOTICES.txt').write_text('\n'.join(notices))
        OUT.parent.mkdir(exist_ok=True)
        with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for source in sorted(package.rglob('*')):
                if source.is_file():
                    archive.write(source,source.relative_to(pathlib.Path(temporary)))
    print(f'{OUT}\n{OUT.stat().st_size / 1024 / 1024:.2f} MB')

if __name__ == '__main__':
    main()
