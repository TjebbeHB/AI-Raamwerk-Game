"""Create a ready-to-run local distribution without sessions or hosting credentials."""
import json
import pathlib
import tempfile
import zipfile
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'share' / 'Het-Gewelf-3.0-Partner-Pack.zip'
NAME = 'Het Gewelf 3.0'

GUIDE = '''HET GEWELF 3.0 — PARTNEREDITIE

Een Nederlandstalige 3D-afdaling door het AI-raamwerk.
Eén persoon loopt in first person door het Gewelf op het grote scherm;
maximaal 15 anderen denken mee via hun telefoon. Samen besluiten jullie
of de gemeente AI moet inzetten: niet doen, eerst onderzoeken, een
begrensde pilot of invoeren met waarborgen.

EERSTE KEER
1. Download de ZIP en pak de HELE map uit op je computer.
   Speel niet vanuit een preview en open index.html niet rechtstreeks.
2. Installeer Node.js als dat nog niet aanwezig is (versie 22.13 of hoger):
   https://nodejs.org/en/download
3. Start de launcher voor jouw systeem:
   Windows: Start Game - Windows.bat
   Mac: Start Game - Mac.command
   Linux: sh 'Start Game - Linux.sh'

Opent een launcher niet, open dan Terminal / Opdrachtprompt in de uitgepakte
map en voer uit:
    npm start

Geen npm install, build, account of API-sleutel nodig.
Open daarna http://localhost:5173 in een moderne browser met WebGL.
Houd het terminalvenster open tijdens het spelen. Ctrl+C stopt de server.

SPELEN
Kies 'Begin de afdaling'. Klik in de wereld om rond te kijken met de muis.
WASD of pijltjestoetsen: lopen. Shift: rennen. Spatie: springen.
E (of klikken): praten, een bron lezen of het zegel aanraken. M: kaart.
Esc geeft de muis weer vrij. Pip, de lantaarngolem, wijst de weg.

De afdaling:
- Diepte 0, de Ontvangsthal: de brief van de wethouder.
- Diepte 1, de Kamer van de Vraag: is AI hier wel het antwoord?
- Diepte 2, de Hal der Fundamenten: governance, cultuur, kennis, data.
- Diepte 3, de Galerij der Domeinen: tien domeinen; kies wat telt.
- Diepte 4, de Zegelkamer: het besluit.

Per kamer: spreek de bewoner aan, lees naar behoefte de drie bronnen,
kies samen alle passende maatregelen en bespreek de uitleg.
Elke kamer komt in het dossier als Stevig, Open punten of Blinde vlek.
In de Zegelkamer kiezen jullie een besluit. Daarna laat het dossier zien
welk besluit het kon dragen en waarom. Er is geen score.
Leg tot slot eigenaar, eerste stap, evaluatiedatum en stopcriterium vast
en download het besluitdossier.

Reken op 45 tot 90 minuten. Via de Kaart kun je direct naar een kamer
reizen als de tijd dringt. Dit is een leergesprek, geen juridische toets
of goedkeuring van een AI-toepassing.

DE ADVIESRAAD UITNODIGEN
Klik op 'Adviesraad'. Laat deelnemers de QR-code scannen of de link openen.
Computer en telefoons moeten hetzelfde netwerk gebruiken. Alleen de computer
heeft Node.js en dit pakket nodig; op telefoons volstaat een browser.
Deelnemers lezen de casus en bronnen op hun telefoon en stemmen daar.
Hun stemmen zijn advies; de speler beslist.

Gebruik voor telefoons het netwerkadres, bijvoorbeeld http://192.168.1.84:5173.
Een localhost-link werkt alleen op de computer waarop de server draait.
Gastnetwerken of een VPN kunnen onderlinge verbindingen blokkeren.

VOORTGANG EN DELEN
Sessies worden bewaard in de data-map naast server.js. De browser onthoudt
jouw toegangspas. Gebruik dezelfde browser en hetzelfde adres om verder te gaan.
De meegeleverde ZIP bevat geen gespeelde sessies. Deel deze originele ZIP.

PROBLEMEN OPLOSSEN
- Node wordt niet herkend: installeer Node.js en heropen de terminal.
- Poort bezet: start met een andere poort, bijvoorbeeld PORT=5184 node server.js
  (Windows: set PORT=5184 en daarna node server.js). Open http://localhost:5184.
- Geen 3D: zet hardwareversnelling aan. Via de Kaart blijven alle kamers bereikbaar.
- Telefoons verbinden niet: controleer wifi, netwerkadres, VPN en firewall.

Er worden geen antwoorden door een AI-model gegenereerd. Internet wordt alleen
gebruikt voor optionele lettertypen en verdiepende bronlinks.
Licenties staan in THIRD-PARTY-NOTICES.txt.
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
    with tempfile.TemporaryDirectory(prefix='gewelf-package-') as temporary:
        package = pathlib.Path(temporary) / NAME
        package.mkdir()
        shutil.copy2(ROOT / 'server.js', package / 'server.js')
        shutil.copytree(ROOT / 'public', package / 'public',
                        ignore=shutil.ignore_patterns('.DS_Store', '*.map'))
        (package / 'game').mkdir()
        for filename in ['engine.cjs', 'descent.cjs', 'descent.json', 'local-api.cjs', 'topics.cjs', 'topics.json']:
            shutil.copy2(ROOT / 'game' / filename, package / 'game' / filename)
        (package / 'package.json').write_text(json.dumps({
            'name': 'het-gewelf-partner-edition', 'version': '3.0.0',
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
