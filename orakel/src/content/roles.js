// Roles for the online council. Every advisor on a phone gets a seat at the table: a
// perspective to argue from, a catchphrase and a playful secret agenda. Voting turns into a
// discussion, because the privacy officer and the alderwoman rarely read a chamber the same way.
// Pure data and small pure helpers: the host, the phone app and the tests all import this.

export const ROLES = [
  {id: 'inwoner', name: 'Inwoner', short: 'Inwoner', icon: '🏠', color: '#8fe0a0',
    mission: 'Je bent Dalwijk zelf: je wilt snel, eerlijk en begrijpelijk geholpen worden, ook als je niet zo digitaal bent.',
    agenda: 'Je lantaarnpaal knippert al sinds maart. Probeer hem bij elke afweging ter sprake te brengen, hoe dan ook.',
    line: 'En wie neemt er dan op?'},
  {id: 'bestuurder', name: 'Bestuurder', short: 'Bestuurder', icon: '🏛️', color: '#f2d36b',
    mission: 'Je draagt de bestuurlijke verantwoordelijkheid en wilt een besluit dat je kunt uitleggen aan de raad, de pers en de inwoners.',
    agenda: 'Je wilt dolgraag een besluit vóór de verkiezingen. En een foto met een lintje voor de Dalwijkse Courant zou ook fijn zijn.',
    line: 'Wat zeg ik straks tegen de raad?'},
  {id: 'klantcontact', name: 'Medewerker klantcontact', short: 'Klantcontact', icon: '🎧', color: '#5ccfc0',
    mission: 'Je staat elke dag aan de telefoon en achter de balie. Jij weet welke vragen er echt binnenkomen, en waar ze vastlopen.',
    agenda: 'Je wilt vooral minder telefoontjes over de afvalpas. Het antwoord hangt al op een post-it aan je scherm, in drie kleuren.',
    line: 'Dat telefoontje krijg ík straks, hè.'},
  {id: 'privacy', name: 'Privacy-officer (FG)', short: 'Privacy', icon: '🛡️', color: '#8fb8ff',
    mission: 'Je bewaakt dat persoonsgegevens alleen worden gebruikt als het nodig is, als het mag en als het veilig gebeurt.',
    agenda: 'Je wilt één keer in je loopbaan aan het begin van een project worden uitgenodigd, en niet een week voor de livegang.',
    line: 'Hebben we die gegevens daar echt voor nodig?'},
  {id: 'data', name: 'Data-analist', short: 'Data', icon: '📊', color: '#f7a64a',
    mission: 'Je wilt het zien voordat je het gelooft: welke cijfers, welke meting, en hoe weet je of het beter wordt?',
    agenda: 'Je droomt van één schone dataset zonder lege kolommen. En stiekem van een dashboard met een héél mooie grafiek.',
    line: 'Leuk verhaal. Wat zeggen de cijfers?'},
  {id: 'jurist', name: 'Jurist', short: 'Jurist', icon: '⚖️', color: '#b99cff',
    mission: 'Je toetst of het mag, of het klopt met de regels, en of de gemeente het kan verantwoorden als iemand bezwaar maakt.',
    agenda: 'Je wilt dat iemand de verwerkersovereenkomst écht leest, tot en met bijlage 7. Jij deed dat al. Twee keer.',
    line: 'Dat hangt ervan af.'},
  {id: 'beveiliger', name: 'Informatiebeveiliger', short: 'Beveiliging', icon: '🔐', color: '#ff8a70',
    mission: 'Je denkt als een aanvaller: wie kan erbij, wat kan er misgaan, en hoe groot is de schade als het gebeurt?',
    agenda: 'Je hoopt stiekem dat iemand om een oefenaanval vraagt, zodat je eindelijk je hoodie met ‘red team’ mag dragen.',
    line: 'Wie heeft er allemaal een sleutel?'},
  {id: 'ethicus', name: 'Ethicus', short: 'Ethicus', icon: '🧭', color: '#ff9ccf',
    mission: 'Je vraagt voor wie het beter wordt, voor wie niet, en wie er niet aan tafel zit maar wel de gevolgen voelt.',
    agenda: 'Je zet bij elk overleg een lege stoel neer voor wie er niet bij is. Je wacht tot iemand ernaar vraagt.',
    line: 'Voor wie wordt het beter, en voor wie niet?'},
];

// Lookups that never fall through to Object.prototype: role ids arrive from the network.
export const ROLE = Object.assign(Object.create(null), Object.fromEntries(ROLES.map(r => [r.id, r])));
export const roleById = id => (typeof id === 'string' && ROLE[id]) || null;

// What each role pays attention to, per chamber (the ids of CHAMBERS in framework.js) and for
// the final verdict. A perspective to bring into the discussion, never the answer itself.
export const ROLE_NOTES = {
  necessity: {
    inwoner: 'Jij bent degene die negen dagen wacht. Waarom bel je eigenlijk: is het de brief, de website, of dat er niemand opneemt? En zou een computer die terugpraat jou dan helpen?',
    bestuurder: 'Je wilt graag iets vernieuwends laten zien, en de leverancier kan over zes weken live. Maar wat wil je over een jaar als succes melden, en kun je het ook uitleggen als het antwoord nee is?',
    klantcontact: 'Jij krijgt de vragen elke dag binnen. Welke komen het vaakst terug, en waarom blijven ze liggen? Misschien weet jij al dat er iets veel eenvoudigers aan de hand is.',
    privacy: 'Een oplossing met AI verwerkt al snel vragen met persoonlijke details. Een probleem dat ook zonder die gegevens op te lossen is, is voor jou de mooiste uitkomst. Is dat alternatief bekeken?',
    data: 'Negen dagen is één getal. Welke vragen zitten erachter, hoeveel zijn het er en waar lopen ze vast? Zonder nulmeting weet je later nooit of iets beter werd.',
    jurist: 'Een overheidsbesluit moet je kunnen motiveren. ‘De demo was indrukwekkend’ houdt geen stand bij een bezwaarcommissie. Welk probleem en welk doel leg je vast, en welke afweging?',
    beveiliger: 'Elk nieuw systeem is nieuw aanvalsoppervlak. Voordat je een assistent binnenhaalt die overal bij kan, wil je weten of het probleem ook eenvoudiger op te lossen is.',
    ethicus: 'Wie wacht er het langst, en wie belt al niet meer omdat het toch niet lukt? Een oplossing die vooral de digitale inwoner sneller helpt, kan de rest verder achterop zetten.',
  },
  governance: {
    inwoner: 'Jij kreeg het foute antwoord over je vergunning. Bij wie kun je terecht, wie zegt sorry en wie lost het op? ‘Dat ligt bij de leverancier’ is voor jou geen antwoord.',
    bestuurder: 'Als het misgaat, vraagt de raad aan jou wie er aanspreekbaar is. Kun je dan een naam noemen, of alleen een afdeling die naar een andere afdeling wijst?',
    klantcontact: 'Bij een fout antwoord sta jij als eerste aan de telefoon. Jij wilt weten waar je de fout meldt en wie hem echt herstelt, zodat hij volgende week niet terugkomt.',
    privacy: 'Wie bepaalt welke bronnen de assistent mag gebruiken, en wie pakt een verkeerde verwerking op? Zonder eigenaar is er ook niemand die een datalek afhandelt.',
    data: 'Een fout die niemand registreert, kun je niet verbeteren. Jij wilt dat fouten ergens samenkomen en dat iemand de patronen ziet: eenmalig, of al de tiende keer?',
    jurist: 'Een antwoord van een assistent kan voor een inwoner voelen als een besluit. Wie is er eigenlijk bevoegd, en wie neemt het besluit echt?',
    beveiliger: 'Logboeken zijn mooi, maar wie kijkt ernaar en wie mag ingrijpen? Jij wilt weten wie de assistent tijdelijk mag uitzetten als het misgaat.',
    ethicus: 'Verantwoordelijkheid die over zes stempels is verspreid, is in de praktijk van niemand. Wie voelt zich aangesproken als een inwoner door een fout tussen wal en schip valt?',
  },
  culture: {
    inwoner: 'Aan de balie merk je het verschil: de ene medewerker vertrouwt de assistent blind, de andere negeert hem. Voor jou telt dat je overal hetzelfde goede antwoord krijgt.',
    bestuurder: 'Een dure assistent die bijna niemand gebruikt, is slecht nieuws voor je begroting. Een gebruiksdoel voor elk team klinkt lekker daadkrachtig. Maar weet je eigenlijk waarom collega’s afhaken?',
    klantcontact: 'Misschien ben jij zelf een van de twijfelaars. Waarom eigenlijk? Geen tijd om antwoorden te controleren, geen idee wanneer hij fout zit, of gewoon geen zin in nog een systeem?',
    privacy: 'Wie de officiële assistent te lastig vindt, plakt soms gegevens in een gratis tool. Uitleggen wat wel en niet mag hoort voor jou ook bij adoptie.',
    data: 'Gebruikscijfers vertellen wie de assistent opent, niet waarom de rest dat niet doet. Wat weet je eigenlijk van de collega’s die afhaken?',
    jurist: 'De sceptische jurist, dat ben jij. Je wilt bronnen kunnen controleren voordat je een antwoord vertrouwt. Wat zou jou overtuigen, en geldt dat ook voor de collega aan de balie?',
    beveiliger: 'Een prompttraining is handig, maar herkennen collega’s ook wanneer de assistent iets vreemds doet? Een team dat durft te melden, is je beste beveiliging.',
    ethicus: 'Als alleen de voorlopers de assistent gebruiken, worden sommige inwoners beter geholpen dan andere. En collega’s die twijfelen, hebben vaak een punt. Wie luistert naar hun zorgen?',
  },
  capacity: {
    inwoner: 'Je merkt het meteen als het morgen anders werkt dan vandaag en niemand weet waarom. Wie bij de gemeente begrijpt dit systeem goed genoeg om jouw klacht te snappen?',
    bestuurder: 'Inkopen voelt als uitbesteden, maar de verantwoordelijkheid blijft bij jou. Wat kost het om zelf genoeg kennis in huis te houden, en wat kost het als je dat niet doet?',
    klantcontact: 'Als de assistent na een update ineens anders antwoordt, wil jij iemand in je eigen organisatie kunnen bellen. Niet de servicedesk van de leverancier, met wachtmuziek.',
    privacy: 'Wie weet nog welke gegevensbron ooit is uitgesloten, en waarom? Als die kennis in één hoofd zit, sluipt een gevoelige bron er bij de volgende update zo weer in.',
    data: 'De leverancier stuurt bij elke update testresultaten mee. Maar wie bij de gemeente kan die cijfers lezen, en weet of ze iets zeggen over de vragen van Dalwijk?',
    jurist: 'Kun je over twee jaar nog uitleggen waarom een keuze is gemaakt? Bij een bezwaar of een Woo-verzoek wil jij een beter antwoord dan ‘dat wist Henk, maar die is op vakantie’.',
    beveiliger: 'Een leverancier die alles beheert, kan ook alles wijzigen. Wie bij de gemeente merkt het, als een update iets openzet dat dicht hoorde te zitten?',
    ethicus: 'Kennis die alleen bij de leverancier ligt, maakt de gemeente afhankelijk en stil. Wie kan er nog zeggen: ‘nee, dit past niet bij ons’, en heeft daar ook tijd voor?',
  },
  infrastructure: {
    inwoner: 'Jouw dossier en de openingstijden van het zwembad zijn niet hetzelfde soort informatie. Jij wilt weten waar jouw gegevens terechtkomen, en of iemand dat heeft uitgezocht.',
    bestuurder: 'Snel opschalen klinkt goed in de raad, tot de rekening stijgt en je niet meer weg kunt. Wat is jouw plan B als de leverancier de voorwaarden verandert?',
    klantcontact: 'Je wilt een assistent die vlot werkt, maar je wilt ook niet uitleggen waarom klantgegevens ineens bij een onbekende partij staan. Welke vragen mogen via welke route?',
    privacy: 'Openbare informatie en gevoelige dossiers op één hoop: daar word jij onrustig van. Welke gegevens gaan waarheen, en wat mag de leverancier ermee doen?',
    data: 'Krijg je de data er straks ook weer uit, in een bruikbare vorm? Jij wilt dat iemand het echt heeft geprobeerd, niet alleen dat het in de offerte staat.',
    jurist: 'Wat staat er in het contract over datagebruik, zeggenschap en vertrek? ‘Dat regelen we na de livegang’ is voor jou het begin van een heel lange brief.',
    beveiliger: 'Jij denkt meteen aan de zwakste schakel: een snelle koppeling waar niemand goed naar heeft gekeken. Wat gebeurt er met de gevoelige dossiers als juist die schakel het begeeft?',
    ethicus: 'Wie heeft straks de zeggenschap over de digitale basis van een gemeente: de gemeente zelf, of een bedrijf ver weg? Afhankelijkheid is ook een vraag over publieke waarden.',
  },
  evaluation: {
    inwoner: 'Een snel en vriendelijk antwoord is fijn, maar ben je daarna ook echt geholpen? Jij wilt dat ze meten of je vraag is opgelost, niet alleen of je op ‘tevreden’ klikte.',
    bestuurder: 'Jij krijgt het liefst één mooi cijfer op een dashboard, voor in de raadsbrief. Maar welk cijfer laat echt zien dat inwoners beter worden geholpen?',
    klantcontact: 'Jij ziet de echte vragen voorbijkomen, ook de rare. Als die niet in de test zitten, test iedereen alleen de makkelijke vragen.',
    privacy: 'Evalueren met echte gesprekken van inwoners? Jij wilt weten welke gegevens daarvoor nodig zijn, hoe lang ze bewaard blijven en of het ook met nagemaakte voorbeelden kan.',
    data: 'Dit is jouw kamer. Drie groepen kijken naar drie verschillende cijfers. Hoe maak je daar een meting van die je bij elke nieuwe versie eerlijk kunt herhalen?',
    jurist: 'Kun je bij een klacht aantonen welke versie er toen draaide, en hoe die was getest? Jij wilt dat de evaluatie bewijs oplevert, geen onderbuikgevoel.',
    beveiliger: 'Een update die de antwoorden verbetert, kan zomaar een oude fout terugbrengen. Hoe merk jij dat, voordat een inwoner het merkt?',
    ethicus: 'Een gemiddelde kan verbergen dat een kleine groep steeds slechter wordt geholpen. Jij wilt weten welke groepen in de meting zitten, en welke ontbreken.',
  },
  quality: {
    inwoner: 'Jij kreeg gisteren een ander antwoord dan je buurvrouw vandaag. Welke klopt er nou? Je wilt kunnen zien waar een antwoord vandaan komt, en kunnen melden dat het niet klopt.',
    bestuurder: 'Een assistent die zichzelf tegenspreekt over een gemeentelijke regeling, haalt de krant. Zit het probleem bij de bronnen of bij de techniek? Dat vraagt om heel verschillende oplossingen.',
    klantcontact: 'Jij weet welke regeling vorig jaar is veranderd, want jij kreeg de telefoontjes. Wie bepaalt wat het juiste antwoord is, en hoe komt jouw kennis in de kennisbank?',
    privacy: 'Als er oude versies in de kennisbank staan, wat staat er dan nog meer in dat er niet hoort? Jij wilt weten welke documenten de assistent kan ophalen.',
    data: 'Twee antwoorden op één vraag: dat is meetbaar. Maar meten tegen wat? Wie bepaalt eigenlijk wat het goede antwoord is?',
    jurist: 'Een antwoord op basis van een vervallen regeling kan een inwoner echt schade doen. Welke versie is gezaghebbend, en wie bepaalt dat?',
    beveiliger: 'Wie mag documenten in de kennisbank zetten of wijzigen? Een bron die iedereen kan aanpassen, is ook een bron die iemand kan vervuilen.',
    ethicus: 'Een vloeiend antwoord klinkt betrouwbaar, ook als het niet klopt. Wie de gemeente het meest vertrouwt, wordt het hardst geraakt door een overtuigend fout antwoord.',
  },
  interaction: {
    inwoner: 'Dit ben jij, aan de digitale balie. Wat wil je weten voordat je iets intypt? En hoe kom je bij een mens als je er niet uitkomt?',
    bestuurder: 'Een assistent die klinkt alsof hij beslist, wekt verwachtingen die de gemeente misschien niet waarmaakt. Wat belooft jouw gemeente eigenlijk, als een computer namens haar praat?',
    klantcontact: 'Als de inwoner toch bij jou uitkomt, wil je niet opnieuw beginnen bij ‘goedemorgen, waarmee kan ik u helpen?’. Wat zou jij dan graag al weten?',
    privacy: 'De inwoner weet niet wat er van het gesprek wordt bewaard. Voor jou is dat de kern: wat wordt er onthouden, waarom, en hoe lang?',
    data: '‘Ik begrijp u’ telt niet als opgelost. Jij wilt weten hoe vaak gesprekken rondjes draaien, en op welk moment mensen afhaken of toch maar gaan bellen.',
    jurist: 'Informeren, adviseren of beslissen: juridisch is dat een groot verschil. Als de assistent klinkt alsof hij een aanvraag goedkeurt, kan een inwoner zich daar later op beroepen.',
    beveiliger: 'Bewaarde gesprekken zijn handig, maar ook een bron van gevoelige informatie. Wie kan ze inzien, en wat gebeurt er als iemand anders op dezelfde computer verdergaat?',
    ethicus: 'Wanneer voelt een gesprek met een computer eerlijk? Denk aan iemand die de taal nog leert, of aan iemand die net slecht nieuws heeft gekregen.',
  },
  performance: {
    inwoner: 'Je wilt alleen weten hoe laat het stadhuis opengaat, en je kijkt naar een draaiend rondje. Moet een simpele vraag echt net zo lang duren als een ingewikkelde?',
    bestuurder: 'Jij lanceert de campagne, en de assistent zakt in. Dat wil je niet in de krant lezen. Is zo’n piek ooit geoefend, en wat kost het om altijd de zwaarste route te nemen?',
    klantcontact: 'Als de assistent in de piek vastloopt, gaan al die inwoners alsnog bellen. Precies op het moment dat jij het ook al druk hebt. Wat gebeurt er als het te druk wordt?',
    privacy: 'Antwoorden hergebruiken scheelt tijd. Maar een antwoord over iemands persoonlijke dossier mag nooit bij een andere inwoner terechtkomen. Welke antwoorden zijn echt algemeen?',
    data: 'Waar zit de bottleneck eigenlijk: het model, de koppeling met de dossiers of de wachtrij? Jij wilt de hele keten meten voordat iemand roept dat er een groter model moet komen.',
    jurist: 'Een inwoner die door uitval een termijn mist, kan de gemeente daarop aanspreken. Welke beschikbaarheid is er afgesproken, en wat gebeurt er als die niet wordt gehaald?',
    beveiliger: 'Niet elke piek komt door een campagne: soms is het een aanval die zich als drukte vermomt. Jij wilt kunnen zien wat er door de keten gaat, juist als het druk is.',
    ethicus: 'In de piek wacht iedereen, maar niet iedereen kán wachten. Wie heeft dringend hulp nodig, en hoe voorkom je dat die achteraan de rij belandt?',
  },
  functionality: {
    inwoner: 'De assistent zei ‘geregeld’, dus jij stond vrijdag voor een dichte deur. Wanneer mag je erop vertrouwen dat iets echt geregeld is?',
    bestuurder: 'Eén keer ‘geregeld’ zeggen terwijl het niet zo is, kost meer vertrouwen dan tien trage antwoorden. Wat mag een assistent namens de gemeente toezeggen?',
    klantcontact: 'Jij vangt de bezoekers op die vrijdag voor een dichte deur stonden. Wat wil jij dat de assistent doet op het moment dat hij twijfelt welke afspraak er bedoeld is?',
    privacy: 'Twee aanvragen verwisseld: dan ziet de ene inwoner misschien gegevens van de andere. Voor jou is dat geen foutje, maar een datalek.',
    data: 'Hoe vaak gaat het eigenlijk mis: bij één op de honderd verzette afspraken, of bij één op de tien? Zonder dat getal weet niemand of een oplossing iets uithaalt.',
    jurist: 'Een bevestiging van de gemeente is een toezegging. Als die niet klopt, wie is er dan verantwoordelijk voor de gemiste afspraak?',
    beveiliger: 'Een assistent die zelf dingen doet in een ander systeem, is meer dan een kletspraatje. Welke acties mag hij eigenlijk uitvoeren, en wat als hij de verkeerde aanvraag te pakken heeft?',
    ethicus: 'Wie vaak afspraken verzet, heeft vaak een ingewikkeld leven: mantelzorg, wisseldiensten, een ziek kind. Juist die mensen worden het hardst geraakt door een verwisseling.',
  },
  sustainability: {
    inwoner: 'Je wilt gewoon weten wanneer de milieustraat open is. Daar hoeft geen enorme computer voor te zoemen, als het antwoord maar klopt.',
    bestuurder: 'De gemeente heeft klimaatdoelen, en deze assistent hoort daar ook bij. Kun jij uitleggen wat hij verbruikt, en waarvoor?',
    klantcontact: 'De afvalpas, alwéér. Duizenden keren dezelfde vraag. Jij weet welke vragen altijd hetzelfde antwoord hebben, en welke echt maatwerk vragen.',
    privacy: 'Elke vraag met de volledige gesprekshistorie naar het grootste model sturen, is niet alleen zonde van de energie. Er gaan ook veel meer gegevens rond dan nodig is.',
    data: 'Jij wilt eerst weten wat er nu eigenlijk wordt verbruikt, en waarvoor. Een dashboard met een héél mooie grafiek lonkt al. Maar welke cijfers horen daar dan op?',
    jurist: 'De raad en inwoners vragen steeds vaker naar de milieu-impact van digitale diensten. Jij wilt dat de gemeente daar een onderbouwd antwoord op heeft, geen ‘geen idee’.',
    beveiliger: 'Elke extra stap in de keten is voor jou ook een extra plek waar iets mis kan gaan. Jij houdt van saaie oplossingen die gewoon werken.',
    ethicus: 'Klimaatgevolgen raken iedereen, ook wie de assistent nooit gebruikt. Wanneer is een zwaar model het verbruik waard, en wanneer niet?',
  },
  sovereignty: {
    inwoner: 'Jij merkt het pas als de dienst verdwijnt, of duurder wordt via je gemeentelijke belastingen. Kan de gemeente nog zelf kiezen, of heeft de leverancier dat al voor haar gedaan?',
    bestuurder: 'De tarieven gaan omhoog en jij moet uitleggen waarom de gemeente niet weg kan. Wat had je vooraf willen regelen, zodat je nu wél een keuze had?',
    klantcontact: 'Als de gemeente overstapt, wil je niet dat alle goede antwoorden, afspraken en testvragen verloren gaan. Wat is eigenlijk van ons, en wat zit vast in het platform?',
    privacy: 'Servers in Europa klinkt geruststellend, maar wie heeft er toegang voor beheer en ondersteuning? Jij kijkt naar alle partijen die bij de gegevens kunnen, niet alleen naar de plek van de server.',
    data: 'Bij een andere leverancier wil jij kunnen aantonen dat de kwaliteit gelijk blijft. Waarmee zou je dat nu eigenlijk meten, en van wie is die meetlat?',
    jurist: 'Zijn wij de baas over onze eigen gegevens? Het echte antwoord staat zelden in de folder, wel in de kleine lettertjes. Die lees jij graag, vooral de bijlagen.',
    beveiliger: 'Een overstap is zelf ook een risico: data verhuizen, nieuwe koppelingen, nieuwe toegang. Wat kan er dan allemaal misgaan, en heeft iemand dat ooit uitgezocht?',
    ethicus: 'Afhankelijkheid van één partij is ook een kwestie van macht. Wie bepaalt straks wat de assistent wel en niet zegt tegen de inwoners van Dalwijk?',
  },
  ethics: {
    inwoner: 'Jij schrijft zoals je praat, met een tikfout hier en daar. Krijg je dan dezelfde hulp als iemand die een keurige brief schrijft? Daar wil je zeker van zijn.',
    bestuurder: 'Een gemiddelde tevredenheid van een acht staat mooi in het jaarverslag. Wat zeg je als later blijkt dat juist de kwetsbaarste inwoners vastliepen?',
    klantcontact: 'Jij neemt het advies van de assistent vaak over, want de wachtrij groeit. Wanneer zei jij voor het laatst: dit klopt niet? En wat gebeurde er toen?',
    privacy: 'Vragen over ondersteuning bevatten vaak gevoelige informatie, over gezondheid, geld of de situatie thuis. Jij wilt weten hoe zorgvuldig daarmee wordt omgegaan.',
    data: 'Het gemiddelde ziet er goed uit. Maar jij weet dat een gemiddelde precies de groep kan verbergen die het slechtst wordt geholpen. Hoe zou je die verschillen zichtbaar maken?',
    jurist: 'Gelijke behandeling is geen wens maar een plicht. Als de manier waarop je schrijft bepaalt welke hulp je krijgt, wil jij weten of iemand dat heeft onderzocht.',
    beveiliger: 'Korte zinnen, spelfouten, boze berichten: daar test jij ook mee. Afwijkende invoer is precies waar systemen verrassend gedrag laten zien.',
    ethicus: 'Dit is jouw kamer. Denk aan de inwoner die kort en boos schrijft, en aan de collega die het advies overneemt omdat de rij groeit. Wie van hen hoort de luisterhoorn eigenlijk?',
  },
  compliance: {
    inwoner: 'Straks leest er een computer mee in jouw dossier. Zou je dat eigenlijk merken, en bij wie kun je terecht als je het er niet mee eens bent?',
    bestuurder: 'Er ligt al een goedkeuring, dus kan het door? Jij wilt vaart maken, maar ook geen verrassingen. Geldt die stempel nog voor wat de toepassing nu gaat doen?',
    klantcontact: 'Straks ziet de assistent ook dossiers. Jij wilt weten wat je wel en niet mag vragen, en of een samenvatting een hulpmiddel is of iets waar je blind op mag varen.',
    privacy: 'Van openbare informatie naar persoonlijke dossiers: voor jou is dat een heel andere verwerking. Klopt alles wat er eerder over deze assistent is afgesproken dan nog wel?',
    data: 'Als iemand over een jaar vraagt hoe deze assistent is getest, wat laat je dan zien? Jij wilt het antwoord kunnen opzoeken, niet reconstrueren uit oude mails.',
    jurist: 'Dit is jouw kamer. Een stempel hoort bij een bepaalde toepassing, niet bij alles wat die later nog gaat doen. Wat verandert er juridisch nu de assistent ook dossiers ziet?',
    beveiliger: 'Logboeken zijn nodig om incidenten te onderzoeken, maar een logboek vol persoonlijke dossiers is zelf een risico. Wie kan erin kijken, en hoe wordt het beschermd?',
    ethicus: 'Medewerkers die aanvragen voorbereiden met AI, beïnvloeden de uitkomst voor inwoners. Wie heeft gekeken wat dat betekent voor de mensen achter die dossiers?',
  },
  security: {
    inwoner: 'Jouw vergunningaanvraag ligt ook in die bibliotheek. Je wilt niet dat één slimme bijlage van iemand anders genoeg is om jouw gegevens naar buiten te sturen.',
    bestuurder: 'Een datalek via de assistent is de nachtmerrie van elke bestuurder. Jij hoopt op een snelle oplossing: kan de leverancier hem niet gewoon opdragen zulke bijlagen te negeren?',
    klantcontact: 'Jij krijgt dagelijks bijlagen van inwoners. Zou jij merken dat er iets in verstopt zit? En wat doe je als de assistent ineens iets vreemds voorstelt?',
    privacy: 'Voor jou is de vraag niet alleen óf het misgaat, maar hoeveel dossiers er dan op straat liggen. Waar kan deze assistent eigenlijk allemaal bij?',
    data: 'Eén geslaagde weigering in een demo is voor jou één datapunt. Hoe groot is de kans dat het bij de duizendste bijlage misgaat, en wat weet je daar nu eigenlijk van?',
    jurist: 'Als de assistent zelf berichten kan versturen, handelt hij dan namens de gemeente? Jij wilt weten welke handelingen hij zelfstandig mag doen, en welke niet.',
    beveiliger: 'Dit is jouw kamer. Denk als de afzender van die bijlage: wat zou jij de assistent laten doen, en wat staat er dan nog tussen jou en de dossiers?',
    ethicus: 'Inwoners geven hun gegevens aan de gemeente omdat het moet, niet omdat ze dat zo graag willen. Dat vertrouwen bewaken is een morele plicht, niet alleen een technische.',
  },
  verdict: {
    inwoner: 'Wat er ook besloten wordt: jij wilt dat het eerlijk wordt uitgelegd, en dat er iemand opneemt als je belt. Welk besluit helpt jou volgend jaar echt, en welk alleen op papier?',
    bestuurder: 'Dit is jouw moment. Kun je dit besluit verdedigen in de raad, ook als het tegenvalt? Kijk naar wat het dossier kan dragen, niet naar wat de leverancier beloofde.',
    klantcontact: 'Jij moet straks met dit besluit werken. Wat verandert er morgen aan de telefoon, en is het team daar klaar voor? En wie herschrijft eindelijk die brief over de afvalpas?',
    privacy: 'Kijk wat het dossier zegt over gegevens, beveiliging en de kritische domeinen. Een besluit dat verder gaat dan wat er is onderzocht, laat jou achter met de open vragen.',
    data: 'Hoeveel kamers staan stevig, welke zijn open en welke zijn nooit bekeken? Jij kiest het besluit dat de feiten dragen, en wilt weten hoe het volgend jaar wordt gemeten.',
    jurist: 'Een besluit moet je kunnen motiveren. Welk besluit kun je onderbouwen met wat er in het dossier staat, en welk besluit vraagt om bewijs dat er niet is?',
    beveiliger: 'Blinde vlekken in het dossier zijn voor jou geen details, maar onbekende risico’s. Welk besluit past bij wat er wél is onderzocht?',
    ethicus: 'Denk aan wie dit besluit het meest raakt: de inwoner die niet digitaal is, de medewerker onder tijdsdruk. Ook ‘nee’ en ‘nog niet’ kunnen verantwoorde besluiten zijn.',
  },
};

// The note for one role in one chamber (or 'verdict'); '' when there is none.
export function roleNote(key, roleId) {
  const notes = typeof key === 'string' && Object.hasOwn(ROLE_NOTES, key) ? ROLE_NOTES[key] : null;
  return notes && typeof roleId === 'string' && Object.hasOwn(notes, roleId) ? notes[roleId] : '';
}

// ---------------------------------------------------------------- dealing
// Roles are dealt in tiers: the resident, the alderwoman and the front office come first, so even a
// council of two or three gets views that rub against each other. Within a tier the order is random.
export const DEAL_TIERS = [['inwoner', 'bestuurder', 'klantcontact'], ['privacy', 'data', 'jurist'], ['beveiliger', 'ethicus']];
export function dealOrder(rnd = Math.random) {
  return DEAL_TIERS.flatMap(tier => {
    const t = tier.slice();
    for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    return t;
  });
}
const countOf = (taken, id) => taken.reduce((s, r) => s + (r === id), 0);
// The role for a newcomer: the one the fewest people at the table have, earliest in the deal order.
// So the first N advisors get N different roles, and a role that frees up is handed out again first.
export function nextRole(taken, order = dealOrder()) {
  let best = order[0], fewest = Infinity;
  for (const id of order) {
    const n = countOf(taken, id);
    if (n < fewest) { best = id; fewest = n; }
  }
  return best;
}
// A fresh deal for n people in seat order.
export const dealAll = (n, order = dealOrder()) => Array.from({length: n}, (_, i) => order[i % order.length]);
// Someone who comes back (a reconnect, a locked screen) keeps their old role, unless that would
// double it up while other roles are free: a newcomer may have been dealt it in the meantime.
export function returningRole(old, taken, order = dealOrder()) {
  if (!roleById(old)) return nextRole(taken, order);
  const fewest = Math.min(...ROLES.map(r => countOf(taken, r.id)));
  return countOf(taken, old) <= fewest ? old : nextRole(taken, order);
}
// The host's 'deal again': a new deal in which as few people as possible keep their role (with
// three or fewer at the table: nobody), so the button never seems to do nothing. Still a normal
// deal, so the first advisors all differ and the roles stay evenly spread.
export function freshDeal(current, rnd = Math.random, tries = 48) {
  let best = null;
  for (let i = 0; i < tries && best?.kept !== 0; i++) {
    const order = dealOrder(rnd), roles = dealAll(current.length, order);
    const kept = roles.reduce((s, r, j) => s + (r === current[j]), 0);
    if (!best || kept < best.kept) best = {roles, order, kept};
  }
  return best;
}

// ---------------------------------------------------------------- votes
// ballots: [{picks: [option indices], role: id | null}] for a question with n options.
// Returns {counts, ballots, byRole: {roleId: {counts, ballots}}} with roles in ROLES order.
export function tallyBallots(list, n, withRoles = true) {
  const cast = list.filter(b => b && Array.isArray(b.picks) && b.picks.length);
  const count = arr => { const c = new Array(n).fill(0); for (const b of arr) for (const i of new Set(b.picks)) if (Number.isInteger(i) && i >= 0 && i < n) c[i]++; return c; };
  const out = {counts: count(cast), ballots: cast.length};
  if (withRoles) {
    out.byRole = {};
    for (const r of ROLES) {
      const mine = cast.filter(b => b.role === r.id);
      if (mine.length) out.byRole[r.id] = {counts: count(mine), ballots: mine.length};
    }
  }
  return out;
}

// A small string hash (FNV-1a, then mixed): picks that look random, but stay put while a phone
// re-renders. The mixing step matters, because the strings it ranks differ only in a few letters.
const fnv = s => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};
// After voting: one concrete difference with another role at the table, to talk about. Each phone
// ranks the other roles in its own order (seed: its seat and the round), so at a big table not
// everyone is sent to argue with the same person. mine: your picks; byRole: as readByRole returns.
// Returns {role, option, theirs} (theirs: they chose the option and you did not), {same: true}
// when every role so far chose like you, or null when there is nothing to compare yet.
export function talkPoint({mine, byRole, me, multi, seed = ''}) {
  const picks = new Set(mine);
  if (!picks.size || !byRole) return null;
  const rank = x => fnv(`${seed}|${x}`);
  const others = ROLES.filter(r => r.id !== me && byRole[r.id]?.ballots).sort((a, b) => rank(a.id) - rank(b.id));
  if (!others.length) return null;
  for (const r of others) {
    const c = byRole[r.id].counts;
    const diff = c.flatMap((v, k) => ((multi ? (v > 0) !== picks.has(k) : v > 0 && !picks.has(k)) ? [k] : []));
    if (!diff.length) continue;
    const option = diff.reduce((a, b) => (rank(`${r.id}:${b}`) < rank(`${r.id}:${a}`) ? b : a));
    return {role: r.id, option, theirs: c[option] > 0};
  }
  return {same: true};
}

// ---------------------------------------------------------------- reading what the host sends
// Anyone who knows a room code can publish to it, so the phone accepts only what it can check:
// role ids must be ours, names are short plain text, numbers are small whole numbers.
const MAX_SEATS = 40;
export function readSeats(raw) {
  if (!Array.isArray(raw)) return null;
  return raw.slice(0, MAX_SEATS).filter(s => s && typeof s === 'object').map(s => ({
    name: String(s.n ?? '').slice(0, 24).trim() || 'Adviseur',
    role: roleById(s.r)?.id || null,
    tag: typeof s.k === 'string' ? s.k.slice(0, 16) : '',
    voted: s.v === 1 || s.v === true,
  }));
}
const smallInt = v => (Number.isInteger(v) && v >= 0 && v < 1000 ? v : 0);
export function readByRole(raw, n) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const r of ROLES) {
    const t = Object.hasOwn(raw, r.id) ? raw[r.id] : null;
    if (!t || typeof t !== 'object' || !Array.isArray(t.counts)) continue;
    out[r.id] = {counts: Array.from({length: n}, (_, i) => smallInt(t.counts[i])), ballots: smallInt(t.ballots)};
  }
  return out;
}
