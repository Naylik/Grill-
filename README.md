# Grillé !

Jeu de soirée : mini-jeux et missions secrètes, chacun sur son téléphone (3 à 6 joueurs).
Cahier des charges : `SPEC.md`. Web app Vite + TypeScript, Firebase Realtime Database (offre gratuite Spark), GitHub Pages.

## Créer le projet Firebase (une seule fois, ~10 min, sans carte bancaire)

1. Va sur https://console.firebase.google.com et connecte-toi avec ton compte Google.
2. Clique **Créer un projet** → nom : `grille` → **Continuer** → **désactive Google Analytics** → **Créer le projet**.
3. Menu de gauche **Créer › Authentication** (ou *Build › Authentication*) → **Commencer** → onglet **Mode de connexion**
   → **Anonyme** → active l'interrupteur → **Enregistrer**.
4. Menu de gauche **Créer › Realtime Database** → **Créer une base de données** → emplacement **Belgique (europe-west1)**
   → **Démarrer en mode verrouillé** → **Activer**.
5. Dans Realtime Database, onglet **Règles** : efface tout, colle le contenu du fichier `database.rules.json`, puis **Publier**.
6. Roue dentée en haut à gauche → **Paramètres du projet** → en bas, « Vos applications » → icône **`</>`** (Web)
   → surnom `grille` → ne coche pas Hosting → **Enregistrer l'application**.
   Firebase affiche un bloc `const firebaseConfig = { apiKey: …, … }` : **copie ces valeurs dans `src/firebase-config.ts`**
   (ou envoie-les à Claude). Elles ne sont pas secrètes : ce sont les règles de l'étape 5 qui protègent les données.
7. **Authentication › Paramètres › Domaines autorisés** → **Ajouter un domaine** → `naylik.github.io`.

L'offre Spark (gratuite) est celle par défaut : ne clique jamais sur « Passer à Blaze ».

## Publier sur GitHub Pages

Dans le dépôt GitHub : **Settings › Pages › Source : GitHub Actions**. Ensuite, chaque envoi sur `main` publie le site
(onglet **Actions** pour suivre). Adresse : `https://naylik.github.io/<nom-du-dépôt>/`.

## Tester sans téléphone (développeur)

```bash
npm install
npm run emulateur          # Firebase local (Java requis)
VITE_EMULATEUR=1 npm run dev
npm test                   # règles de sécurité (si l'émulateur tourne) + logique
```
Ouvre plusieurs fenêtres de navigation privée : chacune compte comme un joueur.

## Décisions

- 16/11/2026 · Pari détective : pas de propositions à choix multiple (trop facile). Chacun écrit sa supposition
  librement sur son téléphone, puis le groupe valide à la révélation.
- 16/11/2026 · Missions vraiment secrètes : chaque téléphone tire ses propres missions ; même l'hôte ne peut pas les lire
  (vérifié par `tests/regles.test.ts`). Le téléphone de l'hôte connaît en revanche l'imposteur et les mises du Parieur
  (sans les afficher) : l'offre gratuite n'a pas de serveur pour faire ces calculs à sa place.
- 16/11/2026 · Le déroulé complet tourne (missions, manches, classement + vanne, mi-partie, pari détective, révélation,
  podium et titres) avec un seul mini-jeu pour l'instant : « Combien ont dit oui ? » (3 questions par partie de ce jeu).
  Le « oui » est compté sans dire qui l'a donné : même l'hôte ne sait pas qui a répondu oui.
- 16/11/2026 · L'hôte peut « Continuer sans attendre » (joueur absent au choix des missions ou au pari) et
  « Passer ce joueur » à la révélation si son téléphone ne répond pas.
- 16/11/2026 · Les 4 mini-jeux de la V1 sont en place : Combien ont dit oui ? (3 questions), Le Juste Prix (4 manches,
  2 culture + 2 fun), Le Parieur (un défi par joueur, jamais dans les 2 premiers jeux) et L'Imposteur (2 manches,
  retiré à 3 joueurs). Imposteur : en cas d'égalité au vote, l'imposteur survit. Les mises du Parieur restent
  secrètes jusqu'au résultat (rangées dans `prive/`, lisible par l'hôte seul).
- 16/11/2026 · Direction artistique « Électrique » validée : fond nuit avec lueurs violettes et corail, cartes en verre
  dépoli, boutons lumineux, polices Unbounded (titres) et Plus Jakarta Sans (texte). Mascotte : Mallow, un chamallow
  (src/mallow.ts). Version « grillé » : corps clair, seul le dessus carbonisé et fumant (jamais de visage noir).
  Accueil : cartes secrètes « TOP SECRET ». Pas de slogan (choix du fondateur) : le logo et Mallow suffisent.
- 16/11/2026 · Bug trouvé au premier test sur téléphone : impossible de défiler au doigt (écran des mises du Parieur).
  Cause : overflow-x et overscroll-behavior posés à la fois sur html et body. Corrigé (html seulement). L'affichage ne
  remplace plus tout l'écran à chaque changement : seules les parties modifiées sont mises à jour (ui.ts, harmoniser).
- 16/11/2026 · La mascotte s'appelle Mallow (et non plus Chamal).
- 16/11/2026 · Suite validée : saisons entre potes (sans durée pendant la phase de test, nom du groupe choisi par
  l'hôte), partage (image du podium et lien d'invitation, puis vidéo « grillé »), 2 jeux d'action (Réflexe Mallow,
  Le bon timing), sons activés par défaut. Ordre : partage, sons et animations, jeux d'action, groupe et saison,
  contenus perso.
- 16/11/2026 · Partage : bouton « Inviter des amis » dans le salon (menu de partage du téléphone, sinon lien copié) avec
  un aperçu illustré pour WhatsApp (public/apercu.png) ; bouton « Partager le podium » à la fin, qui dessine une image
  au format story (src/partage.ts). Le gagnant « règne sur la soirée » (formule valable pour tout le monde).
- 16/11/2026 · Bouton « Quitter » en haut de l'écran pendant toute la partie (avec confirmation dans l'appli).
  On revient à l'accueil ; on peut revenir plus tard avec le code et retrouver missions et points.
- 16/11/2026 · Bouton « Masquer vite » retiré de « Mes missions » (écart avec le cahier des charges, choix du fondateur) :
  la mission n'est lisible que pendant l'appui long, il suffit de lever le doigt pour la cacher.
- 16/11/2026 · Mises à jour automatiques : l'appli installée gardait l'ancienne version en mémoire. Elle vérifie désormais
  les nouvelles versions à chaque retour sur l'écran et se recharge toute seule. Bouton « Revenir à l'accueil » sur
  l'écran de connexion au salon.
- 16/11/2026 · Accueil : bouton « Liste des jeux » (principe, barème en bref, règles de chaque mini-jeu). Chaque jeu
  porte son explication et son icône (champs explication et icone de l'interface MiniJeu).
- 17/11/2026 · Sons (src/son.ts, fabriqués par le navigateur, activés par défaut, bouton pour couper sur l'accueil et
  dans le bandeau) : roue, ding à chaque réponse, tic des 5 dernières secondes, pschhh + musique « grillé »,
  arpège de mission réussie, jingle du podium. Animations : confettis (podium, mission réussie), Mallow couronné qui
  danse au podium, vibration quand quelqu'un se fait griller. Déclenchés une seule fois par moment (effets.ts).
- 17/11/2026 · Tableau de relecture des missions (Claude Sheets) : https://claude.ai/artifact/FeDVbTmg11JXWhvpGTmbm1
  Colonnes : N°, Mission, Mon avis (J'aime / À modifier / À supprimer / Nouvelle), Ma version, Type, Difficulté, Niveau,
  Catégorie, Commentaire. Quand le fondateur le demande, relire le tableau et reporter les changements dans
  src/data/missions.json (garder 2 types × 2 difficultés équilibrés, {cible} pour la personne visée).
- 17/11/2026 · Missions relues par le fondateur (tableau) : 7 supprimées, 8 réécrites, 24 nouvelles gardées → 77 missions
  (vie réelle 23 faciles / 16 difficiles, mini-jeux 17 faciles / 21 difficiles). Objectif : environ 120 pour la phase
  de test. En attente : ligne 99 du tableau (« Réponds en dernier à chaque question d'un mini-jeu », à reformuler).
- 17/11/2026 · Relecture des missions (suite) : v36 et j18 supprimées, v32 et j13 réécrites (vote secret invérifiable),
  v21 et v30 passées en Épicé, j42 ajoutée (« Sois le premier à répondre… ») → 76 missions. Pas de règle de tirage
  pendant la phase de test : toutes les missions peuvent sortir. Le classement provisoire affiche la place de chacun
  au dernier jeu (au Parieur : selon les points gagnés) pour pouvoir juger les missions de classement.
- 18/11/2026 · Cap du fondateur : pas de nouvelle mécanique pour l'instant (missions flash, pouvoirs, traître… mis de côté).
  Le cœur du jeu = des missions secrètes vraiment drôles + des mini-jeux vraiment cool à jouer. Priorités : enrichir
  les missions et ajouter / améliorer les mini-jeux.
- 18/11/2026 · Deux mini-jeux d'action : Réflexe Mallow (5 manches, toucher dès que Mallow prend feu, pièges
  « atchoum », faux départ = 1 s de pénalité) et Le bon timing (3 manches, chrono invisible à arrêter à 5, 7 puis 10 s).
  Le feu et le départ du chrono sont fixés à l'heure du serveur (même instant sur tous les téléphones), et le toucher est
  pris dès que le doigt touche l'écran (data-immediat). Les manches s'enchaînent seules. 6 mini-jeux au total.
- 18/11/2026 · Réflexe Mallow et Le bon timing passent au style « Arène » (choisi parmi 3 maquettes) : écran d'intro
  avec les règles, barre des manches, arène qui s'embrase (Mallow surpris quand il prend feu, yeux fermés quand il
  éternue), note du temps (Éclair, Très rapide…), cadran à graduations et gros bouton STOP. Après chaque manche, une piste
  en couloirs de course montre qui a touché (ou arrêté) avant qui, avec la ligne du temps visé pour Le bon timing
  (idée reprise de la 3e maquette). À la fin du jeu, classement en barres. Éléments partagés : `src/games/arene.ts`.
- 18/11/2026 · Bouton GRILLÉ ! (`src/accusations.ts`, `src/ecrans/accusation.ts`) : pendant la partie, 1 accusation par
  joueur et par manche (jeu). L'accuseur écrit ce qu'il croit être la mission ; seul l'accusé la compare à ses vraies
  missions et répond « Il m'a eu » (sa mission s'affiche, le groupe vote : grillée = mission ratée, vol de 4/6 pts) ou
  « Raté » (l'accuseur perd 2 pts, la mission reste secrète, tout le monde voit la proposition). À la révélation, chaque
  « Raté » est vérifié : menteur = −3 pts et l'accuseur récupère son dû. Une seule accusation à la fois ; pendant une
  manche de Réflexe ou de Timing, le bouton est caché, le procès devient un bandeau et ses délais sont repoussés.
  Nouvelles règles Firebase (nœud `accusations`) : à republier dans la console.
- 18/11/2026 · Nouveau jeu « La Patate » (`src/games/patate.ts`, geste dans `src/glisser.ts`) : la patate-bombe arrive
  avec une consigne (« Un animal en B »), on dit un mot à voix haute (le groupe juge) puis on la lance en la faisant
  glisser vers un joueur (ou en touchant son nom). Elle explose entre 15 s et 1 min, moment connu de l'hôte seulement
  (`prive/patate`). Élimination jusqu'au dernier survivant ; points de place selon l'ordre d'élimination. 3 joueurs minimum.
- 18/11/2026 · Saisons (`src/saison.ts`) : l'hôte crée ou reprend une saison dans le salon (nom libre, sans durée).
  À chaque fin de partie, la saison cumule les points, les missions réussies et les parties jouées. Classement de saison
  sur l'écran final, avec la cuisson de chaque Mallow (seul le dessus dore, jamais le visage) selon les missions
  réussies : Cru 0, Tiède 3, Doré 8, Caramel 15, Flambé 25.
- 18/11/2026 · Vengeance : on retient qui a découvert ta mission (bouton GRILLÉ !, pari détective, mensonge démasqué).
  Au lancement de la partie suivante, au plus UNE personne, tirée au hasard parmi les grillés présents, se voit proposer
  de se venger : si elle accepte, sa 1re mission vise son « grilleur » (au choix s'il y en a plusieurs) et vaut ×2 ;
  la cible est prévenue par une fenêtre (« X a juré de se venger de toi ce soir »), sans connaître la mission.
  Nouvelles règles Firebase (`saisons`, `vengeance`) : à republier dans la console.
- 18/11/2026 · « La Patate » devient « Colis piégé » (choisi parmi plusieurs pistes) : un carton « FRAGILE » avec un
  réveil, qui tremble de plus en plus et dont le couvercle se bombe à chaque passe (la tension monte sans révéler
  le moment de l'explosion). Explosion « KABOOM » : le colis gonfle, flash blanc, l'écran tremble, le carton vole,
  le réveil part en l'air. Pas de carte à la fin, juste « X est éliminé ». Identifiant interne inchangé (`patate`).
- 18/11/2026 · Correctif « bloqué sur Chargement du jeu » : un téléphone resté sur une ancienne version ne connaissait
  pas Colis piégé. Désormais chaque téléphone publie sa version (`joueurs/{uid}/version`, heure de construction) et se
  met à jour tout seul si un autre joueur a plus récent (une fois par version). Si un jeu reste inconnu, l'écran
  affiche « Ton appli n'est pas à jour » avec un bouton « Mettre à jour » (la partie reprend après).
- 18/11/2026 · Écran « Règles » avant chaque mini-jeu (nouvelle étape `regles` après la roue ou le vote) : chacun lit
  à son rythme et appuie sur « Je suis prêt » ; le jeu démarre quand tous les joueurs connectés sont prêts (l'hôte peut
  « Lancer sans attendre »). Les jeux d'action montrent leurs règles illustrées (`regles()` du jeu) et commencent
  directement par la 1re manche : plus de décompte automatique de 7 s.
- 18/11/2026 · Le format du salon fixe aussi le nombre de tours de chaque jeu (`selonFormat` dans `games/interface.ts`) :
  Combien ont dit oui ? 4 / 6 / 8 questions, Juste Prix 4 / 6 / 8 manches, Imposteur 2 / 3 / 4, Réflexe 5 / 8 / 10,
  Le bon timing 3 / 5 / 6 (Courte / Normale / Longue). Le Parieur (un défi par joueur) et Colis piégé (élimination)
  durent déjà selon le nombre de joueurs. L'écran des règles affiche « Ce soir : 6 questions ».
- 18/11/2026 · Jeux de réflexes raccourcis (trop répétitifs et épuisants) : Réflexe Mallow 3 / 4 / 5 manches,
  Le bon timing 2 / 3 / 4 (Courte / Normale / Longue). Colis piégé se joue en 2 tours : élimination jusqu'au dernier
  survivant, écran de fin de tour, puis tout le monde repart en vie ; le classement additionne les places des 2 tours.
- 18/11/2026 · Réserves doublées après relecture du tableau par Kilyan (5 contenus retirés) : Combien ont dit oui ?
  80 questions, Juste Prix 78 (dont 38 culture et 40 fun), Imposteur 60 paires, défis du Parieur 47.
- 18/11/2026 · Mémoire du groupe : les missions, questions (Combien, Juste Prix), paires de l'Imposteur et défis du
  Parieur déjà joués ne reviennent pas tant qu'il en reste de nouveaux (`fraisDabord` dans `outils.ts`, `contenus()` de
  chaque jeu). Gardée dans la saison si l'hôte en a choisi une (`saisons/{id}/memoire`, d'une soirée à l'autre), sinon
  dans le salon (`infos/memoire`, parties enchaînées avec « Rejouer »). Les missions sont mémorisées en fin de partie,
  une fois révélées. Pas de nouvelles règles Firebase.
- 18/11/2026 · Nouveau jeu « Quitte ou Double » (fusion avec le Quiz express du cahier des charges,
  `src/games/quitteOuDouble.ts`, questions dans `src/data/quiz.json`) : questions à 4 choix, du facile au très difficile
  (5 / 6 / 7 selon le format). Bonne réponse : la cagnotte passe à 1 puis double ; erreur : tout perdu. Après chaque
  bonne réponse, choix secret : encaisser ou doubler (sans réponse : on encaisse). La bonne réponse reste chez l'hôte
  (`prive/quitte`) jusqu'au résultat. 40 questions (10 par niveau), avec la mémoire du groupe.
- 18/11/2026 · Nouveau jeu « Dessin à la chaîne » (`src/games/telephone.ts`, dessin au doigt dans `src/dessin.ts`,
  40 phrases dans `src/data/dessins.json`), façon Gartic Phone : phrase → dessin (60 s) → devinette (35 s) → dessin…,
  chacun passe sur une chaîne différente à chaque étape et ne voit jamais la sienne (3 / 4 / 5 étapes selon le format,
  jamais plus que de joueurs). 6 couleurs, gomme, annuler, effacer, 3 épaisseurs ; envoi automatique à la fin du temps.
  Révélation : l'hôte dévoile chaque chaîne étape par étape (« Suivant », petit son), puis chacun vote pour le dessin le
  plus drôle et dit si le sens est resté. Points internes : 3 au dessin le plus drôle, 1 par chaîne qui garde le sens.
  Dessins en traits légers (points 0-999, 3 000 points max). Bouton GRILLÉ ! caché pendant qu'on dessine. 3 joueurs min.
- 18/11/2026 · Quitte ou Double : animation « fusée » (choisie parmi 3 pistes, `src/fusee.ts`) façon jeu à multiplicateur,
  avec des points et jamais d'argent. Courbe qui grimpe avec la cagnotte (×1, ×2, ×4…) et vire du vert au rouge avec
  le risque. Au résultat : elle monte (bonne réponse, petit arpège) ou « CRASH ! » (courbe qui s'effondre, écran qui
  tremble, vibration). Au choix secret : la fusée en grand ; encaisser = « +X PTS » et pluie de jetons.
- 18/11/2026 · Dessin à la chaîne : chacun écrit d'abord sa propre phrase (40 s, bouton « Une idée au hasard » ;
  sans phrase, le jeu en met une), comme Gartic Phone ; on dessine/devine ensuite sur n − 1 étapes au plus, donc
  personne ne retombe sur sa phrase. À la révélation, chaque dessin se redessine trait par trait en accéléré
  (1,5 à 4 s). Seules les phrases du jeu vont dans la mémoire du groupe. Le saboteur est gardé pour plus tard
  (intéressant surtout à 5-6 joueurs).
- 18/11/2026 · Dessin à la chaîne, refonte visuelle « atelier papier » : feuille texturée scotchée qui arrive en
  glissant, feuille de cahier pour écrire la phrase, trousse de 12 feutres, sablier qui se vide ; quand on envoie, la
  feuille s'envole « chez Kilyan ». Révélation façon album : chaque chaîne défile comme une conversation (avatar à la
  couleur du joueur, bulles, dessins encadrés rejoués trait par trait), réactions 😂 🔥 💀 👏 qui s'envolent chez tout
  le monde (compteurs partagés). Les textes tapés sont gardés si l'écran se met à jour.
- 18/11/2026 · Nouveau jeu « Champ de mines » (`src/games/mines.ts`), codes visuels des jeux de mines (tuiles
  ardoise, gemme verte, bombe rouge ; sans logo ni charte d'un site réel) : chacun pose une mine en secret (connue de
  l'hôte seul, `prive/mines`), puis chacun son tour ouvre des colis : le k-ième colis sûr du tour rapporte k pts ;
  on encaisse ou on continue. Sauter sur une mine fait perdre le tour et rapporte au poseur au moins 3 pts.
  Bluff à voix haute encouragé. 2 / 2 / 3 tours chacun selon le format. 3 joueurs min.
- 18/11/2026 · Nouveau jeu « Roue des territoires » (`src/games/territoires.ts`, roue dans `src/roue.ts`), style
  « roue de la fortune » néon choisi sur maquette : une part par joueur ; à chaque manche, action secrète Agrandir
  (+1 part, 1 pt dans la cagnotte), Voler (gratuit ; si la cible s'est protégée, le voleur lui donne 1 pt) ou Protéger
  (par défaut). Révélation avec badges carte par carte et parts qui changent de taille, puis la roue tourne : 32 crans,
  curseur qui claque avec un « tic », ralentissement ; l'hôte tire le gagnant avant (selon les parts) et la rotation
  suit l'heure du serveur, identique sur tous les téléphones. 4 / 6 / 8 manches selon le format. 3 joueurs min.
- 18/11/2026 · Nouvelle catégorie « Jeu d'équipe » avec Télépathie : duos tirés au sort. Manche 1, chacun écrit un mot
  en secret ; ensuite chaque duo voit ses deux mots et cherche un mot « entre les deux », jusqu'à écrire le même
  (majuscules, accents et articles ignorés). L'équipe qui trouve en le moins de manches gagne (8 max). Nombre impair :
  un arbitre parie au début sur l'équipe gagnante (+2) et son nombre de manches (+2 exact, +1 à une manche près).
  4 joueurs min. Visuel : deux ampoules aux couleurs du duo, l'arc entre elles s'allume quand ils se connectent.
- 18/11/2026 · Télépathie refaite, ambiance voyance (choix C) : boule de cristal multicolore et cartes de tarot qui se
  retournent. Chaque manche : 3-2-1 « CRIEZ ! », les duos crient leur mot à table puis le tapent en 12 s (l'appli
  compare et garde le « film » du chemin parcouru). Pluriels ignorés ; mots presque pareils : le duo conteste et le
  groupe vote (pas de vote = accepté). Sabotage : une fois par partie, une équipe impose un mot interdit à une autre
  pour la manche suivante ; s'il est prononcé, la manche est ratée.
- 18/11/2026 · Correctif d'affichage : la grille du Champ de mines (classe `champ`) écrasait le style des champs
  « Ton prénom » et « Code » de l'accueil (étiquette et case côte à côte). Renommée `champ-mines`.
- 18/11/2026 · Nouveau système de missions, validé par Kilyan dans le document « Missions à valider » :
  une seule grosse mission pour toute la soirée (plus de 2e mission à la mi-partie), facile 8 pts / difficile 12 pts
  (vengeance ×2). 12 grosses missions ajoutées, 7 retirées (doublons ou impossibles), 6 réécrites. Missions flash :
  à chaque jeu, 1 joueur (2 à partir de 5) reçoit en secret une mission liée à CE jeu (90 missions, 5 à 10 par jeu,
  toutes repérables par les autres). L'hôte publie seulement une graine ; chaque téléphone en déduit s'il est porteur
  et laquelle (jamais la même pour deux porteurs, jamais son coéquipier comme cible). Après le jeu : révélation,
  vote du groupe, +3 pts si réussie. Grillée avant avec GRILLÉ ! = ratée et l'accuseur vole 2 pts. Titre « Éclair ».
  Aucune règle Firebase à republier pour ce changement.
- 18/11/2026 · Missions flash plus discrètes : plus de vibration ni de son à la réception (ça trahissait le porteur).
  Le tirage se fait dès l'écran des règles, où TOUT LE MONDE voit le même encart flouté « Mission flash » : le porteur
  y lit sa mission, les autres « Pas de mission pour toi ». 1 ou 2 porteurs tirés au hasard à chaque jeu (dès 3 joueurs).
- 18/11/2026 · Grosses missions et équilibre du classement. Trois niveaux : facile (un coup simple) 6 pts, difficile
  (un coup difficile) 10 pts, longue durée (toute la soirée, ou plusieurs fois) 15 pts, pour 6 jeux ; ×4/6 en court,
  ×8/6 en long (une mission longue ≈ gagner la moitié des jeux). Au début, on choisit entre une longue et une plus
  courte. Vol GRILLÉ ! : 3 / 5 / 8. Vengeance ×1,5 (×2 rendait une mission longue plus forte que 4 victoires).
  Parieur borné entre −6 et +8 sur le jeu (avant : jusqu'à ±15 à 6 joueurs). Validé dans le document : 14 missions
  longues ajoutées (H), 8 dans le style de Kilyan (N), ses 5 missions (K),
  16 faciles retirées.
- 18/11/2026 · « Termine 2e au classement final » devenait impossible (ses propres points le faisaient passer 1er) :
  elle se juge sur le classement affiché à la fin du dernier jeu, avant les points des grosses missions. 3 missions de
  Kilyan (message privé, sortir de la pièce, raconter sa semaine) passent en « difficile » (un seul coup).
- 18/11/2026 · « Dernière chance ! » après chaque jeu (25 s) : un écran rappelle à tout le monde qu'on peut appuyer
  sur GRILLÉ ! (mission flash du jeu qui vient de finir, ou grosse mission) avant la révélation des missions flash.
  « Rien à signaler » pour passer ; on attend la fin d'une accusation en cours. Mission flash grillée : vol de 2 pts.
- 18/11/2026 · Vidéos « Grillé ! » à partager (maquettes validées par Kilyan) : récap de la soirée (≈ 22 s, écran de
  fin : podium avec Mallow grillés, 3 grosses missions révélées avec tampon, titres) et moment GRILLÉ ! (≈ 8 s, au
  classement et à la fin, pour chaque accusation réussie). Fabriquées sur le téléphone : toile dessinée image par image
  et filmée (MediaRecorder) avec les bruitages de l'appli (pschhh, ding, mèche, boum, tampon), mp4 de préférence,
  puis « Partager » (WhatsApp, Instagram…) ou téléchargement. Pas de serveur, pas de vraie photo.
- 18/11/2026 · Vidéos plus lentes et plus sobres (retour de Kilyan) : récap ≈ 32 s (4,5 s par mission révélée),
  moment GRILLÉ ! ≈ 12 s ; un seul bruitage par mission (tampon) et l'explosion du GRILLÉ !, moitié moins forts.
- 19/11/2026 · Trois nouveautés validées sur maquette :
  · Champ de mines · Détecteur : chaque colis sûr ouvert affiche le nombre de mines dans les 8 cases autour (comme au
    démineur, calculé par l'hôte qui seul connaît les mines) ; ta mine est marquée en pointillés sur ton écran.
  · Réflexe Mallow · Leurre du vainqueur : le gagnant d'une manche choisit en secret une victime ; à la manche
    suivante, sur son écran seulement, Mallow « chauffe » 0,65 s (lueur, flammes) avant le vrai feu.
  · Roue des territoires · Pacte : 4e action « Pacte avec X ». Réciproque : une seule part rayée aux deux couleurs,
    cagnotte partagée. Trahison (X te vole) : il te prend 2 parts. Double vol mutuel : chacun perd 1 part, cagnotte +2.
- 19/11/2026 · Le bon timing : le « bonus de fierté » promis par les règles existe enfin. À moins de 0,05 s du temps
  demandé : « PILE ! » sur tous les écrans, confettis pour le joueur, et l'écart de la manche compte zéro.
  Télépathie : le sabotage reste visible (choix de Kilyan) ; Quitte ou Double gagnait déjà à la plus grosse cagnotte.
- 19/11/2026 · Quitte ou Double passe au cumul (choix de Kilyan) : tout le monde joue toutes les questions.
  Encaisser met la cagnotte dans sa banque, à l'abri, et on repart de 0 ; une erreur ne fait perdre que la cagnotte
  en cours. À la dernière question, ce qui est en jeu est encaissé. La plus grosse banque gagne.
- 19/11/2026 · Quitte ou Double : 8 / 10 / 12 questions selon le format (au lieu de 5 / 6 / 7), pour avoir le temps
  d'encaisser plusieurs fois ou de tout risquer. 40 questions ajoutées au quiz (80 au total, 20 par niveau).
- 19/11/2026 · Mission flash Quitte ou Double : « Atteins 16 points ou plus » (au lieu de 8, trop facile avec 8 à 12 questions).
- 19/11/2026 · Champ de mines : le Détecteur devient secret (choix de Kilyan : un bon joueur de démineur gagnait trop
  facilement). 2 détecteurs par joueur et par jeu ; activé avant d'ouvrir un colis, le chiffre n'apparaît que sur
  l'écran de ce joueur (publié brouillé avec une clé que seul son téléphone connaît) ; les autres voient une loupe 🔍.
- 20/11/2026 · Slogan choisi par Kilyan : « Qui va se faire griller ? » (accueil sous le logo, description du lien
  partagé, fin de la vidéo récap, présentation du concept).
- 20/11/2026 · Finition (étape 1 validée par Kilyan) : transition d'écran à chaque changement d'écran (glissement de
  14 px depuis le bas + fondu, 0,3 s), rejouée seulement quand l'écran change, jamais coupée par un rafraîchissement.
- 20/11/2026 · Finition 2 : animations harmonisées. Deux courbes communes (`--rebond` pour ce qui apparaît, `--doux`
  pour le reste) et trois vitesses (`--t-rapide`, `--t-normal`, `--t-lent`) dans `style.css`, au lieu de 40 réglages
  différents. Les longues séquences synchronisées (vidéos, révélations) gardent leur rythme.
- 20/11/2026 · Finition 3 (validée par Kilyan) : 7 tailles de texte pour toute l'appli (`--txt-xs` 12 px à `--txt-3xl`
  36 px) au lieu de 25, rien sous 12 px. Seuls les très grands chiffres (40 px et plus) gardent leur taille.
- 20/11/2026 · Finition 4 (validée par Kilyan) : couleurs rangées en jetons dans `style.css`. Les 6 couleurs du jeu
  ont chacune leur clair / base / fort / ombre (`--rose-clair`, `--rose`, `--rose-fort`, `--rose-ombre`…), plus
  `--feu` (logo, bouton GRILLÉ), 4 fonds et 3 voiles de carte (`--voile-1`, `--voile-2`, `--bord`). Les nuances presque
  identiques ont été fusionnées. Les décors propres à un jeu (mines, tarot, boule de cristal) restent à part.
- 20/11/2026 · Finition 5 (validée par Kilyan) : 6 arrondis communs (`--r-xs` 8 px à `--r-xl` 26 px, `--r-rond`) au
  lieu de 17, et 3 hauteurs de bouton : 44 px (petit, minimum conseillé pour le doigt), 54 px (moyen), 60-64 px
  (principal). Tous les champs de saisie ont le même arrondi.
- 20/11/2026 · Nouveau visuel (validé par Kilyan) : un seul bouton plein par écran, le jaune (action principale) ; les
  autres sont sombres avec un contour de couleur. Cartes de jeu (règles, choix du jeu, liste des jeux) à contour dégradé
  et halo à la couleur du jeu, avec son icône. Boutons « sticker » (`src/stickers.ts`) : panneau STOP du Bon timing et
  flamme GRILLÉ (sans point d'exclamation, plus lisible en petit).
- 20/11/2026 · Rechargement de page (validé par Kilyan) : les choix secrets des jeux (ma mine, clé du détecteur, piège,
  sabotage, mise pas encore envoyée) sont gardés sur le téléphone du joueur (`src/memoireJeu.ts`, localStorage), jamais
  envoyés en ligne, effacés en quittant la partie. Une mémoire d'un autre salon est ignorée.
- 20/11/2026 · Batterie (validé par Kilyan) : l'horloge des jeux ne tourne à chaque image que si un élément animé est
  affiché (sinon toutes les 150 ms). Halo de la boule de cristal sur une couche à part dont seule l'opacité change.
  Mesuré : boule 166 ms → 7 ms de travail sur 5 s ; boucle de l'accueil 15 ms → 4 ms. Rendu identique.
- 20/11/2026 · Ouverture plus rapide (validé par Kilyan) : polices hébergées avec l'appli (`@fontsource`, alphabet latin,
  plus d'appel à Google, marchent hors connexion), QR code et module vidéo chargés à la demande, connexion Firebase sans
  le code des fenêtres Google/Facebook (`initializeAuth`). Mesuré en 4G moyenne : accueil 4,5 s → 4,0 s, 715 → 662 Ko.
- 20/11/2026 · Nettoyage (validé par Kilyan) : code de l'ancienne 2e mission (mi-partie) retiré, 8 styles inutilisés
  supprimés, vérificateur ESLint ajouté (`npm run lint`, à passer avec les tests après chaque changement).
- 20/11/2026 · Règles Firebase vérifiées par Kilyan dans la console : la version en ligne contient bien `accusations`,
  `vengeance` et `saisons` (dernière modification des règles : 18/11).
- 20/11/2026 · Salon « feu de camp » (validé par Kilyan) : les Mallow des joueurs arrivent autour du feu (qui grandit
  avec le groupe), réglages repliés derrière « Réglages · Modifier ». Cuisson de chaque Mallow = missions réussies dans
  la saison (sans saison, tout le monde est cru : avec un autre groupe, on repart de zéro). Couronne au premier du
  classement de la saison, s'il est là et a des points (plus à l'hôte).
- 20/11/2026 · Tutoriel « Comment jouer » (validé par Kilyan) : 3 écrans (mission secrète, mini-jeux, bouton GRILLÉ),
  montrés une fois sur chaque téléphone à la première arrivée sur le site (`grille:tuto-vu`), avec « Passer ».
- 20/11/2026 · Fin de soirée (validé par Kilyan) : la vidéo « Moment GRILLÉ ! » se joue automatiquement sur tous les
  téléphones après le verdict (après la manche si un jeu d'action est en cours) ; le récap se lance comme un générique
  10 s après l'arrivée sur le podium (une fois par téléphone, puis bouton Partager). Récit de la révélation sans chrono :
  le joueur révélé lance le vote (« J'ai fini »), l'hôte peut aussi. Le jeu de dessin s'appelle « Dessin à la chaîne ».
- 20/11/2026 · Pari détective : il porte sur la grosse mission seulement (missions flash du joueur affichées barrées),
  vote « Oui, c'est sa grosse mission / À côté », points affichés depuis le barème (`VOL_DETECTIVE`, `PARI_RATE`).
- 20/11/2026 · Barème : simulation de 20 000 soirées (4 joueurs, 6 jeux). Pistes notées (missions 9 / 12 / 15 pour que
  facile, difficile et longue restent équitables si les missions réussissent souvent), mais Kilyan attend la soirée de
  test pour décider : les vrais taux de réussite trancheront. Barème actuel inchangé.
- 20/11/2026 · Missions flash : au moins un porteur par jeu (1 ou 2), tiré parmi les joueurs présents au moment du
  tirage (`flashTirage.joueurs`) : un téléphone déconnecté ne peut plus être le seul porteur. Présentation du concept :
  « Dessin à la chaîne ».
- 20/11/2026 · Dévoilement des missions flash (validé par Kilyan) : roulement de tambour 2,2 s, puis chaque carte se
  retourne toutes les 1,8 s avec un « ding » ; le chrono du vote (30 s) ne démarre qu'après la dernière carte.
- 20/11/2026 · Missions revues par Kilyan (tableau « Missions à vérifier ») : j17 « Finis dernier à un mini-jeu, puis gagne
  le suivant » ; g15 à 3 joueurs différents ; n02 un SMS à chaque joueur ; n04 changer de place 2 fois ; flash
  combien-04 « à au moins 3 questions ». n10 (selfie de groupe) gardée telle quelle.
- 20/11/2026 · Missions longues qui tenaient en une seule action, passées à 2 fois : g13 (2 débats absurdes gagnés),
  g17 (2 joueurs accusés à tort), n05 (toute la table debout à 2 moments), n11 (2 joueurs racontent leur rencontre).
- 20/11/2026 · Missions flash : 13 nouvelles validées par Kilyan (103 au total). Il en manque 17 pour atteindre 10 par
  mini-jeu (combien, justeprix, parieur, imposteur, reflexe, quitte, mines, telepathie) : 2e série proposée dans le
  tableau « Missions à vérifier ».
- 20/11/2026 · Missions flash : 8 de plus validées (2e série), 111 au total. Il en manque 9 (combien 3, justeprix 2,
  parieur, imposteur, quitte, telepathie 1 chacun) : 3e série proposée dans le tableau.
- 20/11/2026 · Missions flash : 1 de plus validée (3e série), 112 au total. Manquent : combien 3, justeprix 2, imposteur 1,
  quitte 1, telepathie 1 (quand elles sont toutes jouées, le jeu les reprend en commençant par les plus anciennes).
- 20/11/2026 · Champ de mines (validé par Kilyan) : 1 seul détecteur par joueur et par jeu (au lieu de 2), pour qu'il
  reste un vrai choix avec 2 tours par joueur. Mission flash mines-08 adaptée (« Utilise ton détecteur… »).
- 20/11/2026 · Dessin à la chaîne, nouveaux points (option 1 choisie par Kilyan) : au déroulé, chacun touche 👍 sous
  les devinettes justes (sauf la sienne et celle qui suit son dessin) ; une devinette jugée juste par la majorité
  rapporte 1 pt au devineur et 1 pt au dessinateur. Le dessin le plus drôle de chaque chaîne rapporte 1 pt (au lieu de
  3 pour toute la partie). Le vote « le sens est resté jusqu'au bout » disparaît.
- 20/11/2026 · Champ de mines, nouveau déroulé (validé par Kilyan, simulation de 30 000 parties) : en manches, les
  joueurs encore en lice ouvrent UN colis chacun à tour de rôle ; à son tour on peut encaisser et sortir de la manche ;
  une mine fait perdre la manche (le poseur gagne). Le 1er joueur tourne à chaque manche. Avant : le 1er à jouer gagnait
  42 % des parties à 4 ; maintenant 30 / 30 / 27 / 24 %. 2 manches (3 en Longue). Missions flash mines-02/03/04 adaptées.
- 23/11/2026 · Retours de la 1re partie de test (validés par Kilyan) :
  - narrateur : nouvelles phrases taquines mais jamais méchantes (Juste Prix, Combien, Imposteur), la même sur tous les
    téléphones (`parmi()` dans outils.ts) ;
  - roue des jeux : noms courts qui tiennent dans les parts ;
  - mission flash sur l'écran des règles : le même texte flou chez tous (sa longueur ne trahit plus le porteur) ;
  - vote des missions flash sans chrono : on passe quand tout le monde a voté ; si l'hôte force, les votes manquants
    sont des votes blancs ; aucun vote exprimé = ratée ;
  - Colis piégé : explosion entre 10 et 55 s ; Combien : « a dit 2 · +3 · total » ;
  - fin de mini-jeu : podium du jeu, et la mission flash réussie (⚡+3) affichée dans le classement provisoire ;
  - Réflexe Mallow : le gagnant a 15 s pour choisir sa victime ; une manche sur trois, Mallow prend feu tard (9-14 s) ;
  - pari détective : points volés affichés ; titres de fin : un titre par joueur et un joueur par titre (nouveaux :
    Le Parano, L'Intouchable, La Poisse, Le Mystérieux) ;
  - GRILLÉ : grosse mission ou mission flash ; accusations sans limite (une à la fois, −2 si erreur), stockées dans
    accusations/3, puis 3_2, 3_3… (règles Firebase inchangées) ;
  - Champ de mines : 2 manches, grille neuve et nouvelle mine à chaque manche ;
  - Dessin à la chaîne : on attend tous les joueurs jusqu'au bout du chrono (un téléphone en veille n'est plus sauté) ;
    message clair : c'est l'hôte qui tourne les pages de l'album.
- 23/11/2026 · Combien ont dit oui ? : résultat de chaque question en toutes lettres (« a deviné 2 oui · ✔ exact : +3 ·
  total : 5 pts »).
- 23/11/2026 · Combien ont dit oui ? : jauge de suspense (version A choisie par Kilyan). Un cran par joueur, qui se
  remplissent un par un de plus en plus lentement, le cran suivant hésite puis s'éteint, puis le chiffre tombe
  (3 à 4 s ; `minutageJauge`). Un « tic » par cran, un son et une vibration sur tous les téléphones au chiffre final.
- 23/11/2026 · Jauge de suspense variée : à chaque question, un rythme différent (départ, vitesse, ralentissement) et une
  feinte tirée au hasard (cran suivant qui hésite, qui se remplit puis se vide, qui clignote, long silence avant le
  dernier cran, ou pas de feinte). Tirage à partir de l'étape : la même jauge sur tous les téléphones.
- 23/11/2026 · Petites animations de suspens par mini-jeu (validées par Kilyan) : Juste Prix (le prix défile en
  compteur, `src/animations.ts`, puis les estimations) ; Parieur (une pièce ✔/✘ tourne avant le verdict, sans feinte) ;
  Réflexe Mallow (« PHOTO-FINISH » quand les 2 premiers sont à moins de 40 ms) ; Bon timing (les pastilles partent de
  la ligne cible) ; Colis piégé (le colis gonfle avec la tension, la mèche accélère, fausses alertes 1 passe sur 3) ;
  Dessin à la chaîne (les feuilles de l'album se retournent, tampon « CHEF-D'ŒUVRE » sur le dessin le plus voté) ;
  Champ de mines (le colis ouvert tremble 0,4 s avant de se dévoiler, grille qui pulse en rouge quand il reste peu de
  colis) ; Télépathie (les deux cartes se rencontrent au milieu : éclair si connectés, sinon elles rebondissent).
  L'Imposteur : maquette (cartes qui se retournent, la dernière s'enflamme) en attente de validation.
- 23/11/2026 · L'Imposteur (validé par Kilyan, sans flamme) : les cartes des joueurs se retournent une à une (les moins
  soupçonnés d'abord), « Plus qu'une carte… 🥁 », puis la carte de l'imposteur rougit, un tampon « IMPOSTEUR »
  s'écrase dessus et l'écran tremble ; ensuite le verdict et les points (`minutageImposteur`).
- 23/11/2026 · Juste Prix et Parieur validés tels quels par Kilyan. Réflexe Mallow : la phrase « X gagne la manche »
  n'apparaît qu'une fois la course finie ; en photo-finish (moins de 40 ms d'écart), flash blanc d'appareil photo
  sur tout l'écran avec un « clic », puis le bandeau, puis le gagnant. Résultat de manche allongé à 6 s.
- 23/11/2026 · Le Bon timing : « PILE ! » tombe comme un tampon (avec son son) une fois la glissade finie, et « X est le
  plus proche » n'apparaît qu'après, pour ne pas gâcher le suspens.
- 23/11/2026 · Réflexe Mallow (validé par Kilyan, version « même vitesse ») : le résultat devient une course rejouée au
  ralenti. Tout le monde part quand Mallow prend feu et avance au rythme du chrono ; chaque pastille s'arrête net au
  temps du joueur (un « tic »), le premier arrêté gagne la couronne. Arrivée serrée (≤ 40 ms) : badge RALENTI entre les
  deux premiers, puis « 📸 X ms d'écart ! ». Couloirs dans l'ordre des joueurs, rien de dévoilé avant l'arrêt. Le flash
  blanc est supprimé (`src/course.ts`, `animerCourses`). Le Bon timing : la piste zoome autour de la cible.
- 23/11/2026 · Colis piégé (validé par Kilyan) : à l'explosion, il ne reste que le KABOOM (le réveil qui s'envolait
  et la fumée sont supprimés). Texte, fausse alerte et taille du colis inchangés.
- 23/11/2026 · Dessin à la chaîne et Champ de mines validés par Kilyan. Champ de mines : « KABOOM ! » ne touche plus
  les bords de l'écran, et l'encadré « Ta manche / Prochain colis » ne coupe plus les points sur deux lignes.
- 23/11/2026 · Télépathie validée : toutes les animations de résultat sont faites. Animations pendant le jeu : Kilyan
  valide idée par idée (chaque jeu peut avoir son univers). Écartées : chrono du Juste Prix qui rougit, chrono brouillé du
  Bon timing, cagnotte de Quitte ou Double. Combien ont dit oui ? : tampon « OUI ✔ / NON ✘ » sur le bouton touché (sur
  son téléphone seulement, petite vibration), puis la question suivante glisse. Silhouettes d'attente : refusées.
- 23/11/2026 · Le Juste Prix : une étiquette de magasin se balance au-dessus du champ, recopie chaque chiffre tapé et
  sursaute (ui.ts, `data-etiquette-de`). Le Parieur : tapis de casino, un jeton tombe par point misé ; une fois la mise
  envoyée, la pile file vers le camp choisi et un badge « +N » s'y pose.
- 23/11/2026 · L'Imposteur : le mot est caché sous une carte « TOP SECRET » qu'on soulève du doigt (elle suit le doigt,
  retombe dès qu'on lâche ; remplace le flou à appui long). Pendant le vote, une loupe passe d'un joueur à l'autre
  tant qu'on n'a pas voté, puis se pose sur son choix (`animerLoupes`, seulement sur son téléphone).
- 23/11/2026 · Réflexe Mallow : pendant l'attente, le vrai Mallow cligne des yeux, puis tremble et transpire (dès 3 s),
  de plus en plus (dès 6 s). Le stress suit le temps d'attente, jamais l'heure du feu. Colis piégé : toucher un nom
  fait voler le colis en tournoyant vers ce nom ; chez celui qui le reçoit, il tombe du haut et rebondit.
  (Première maquette refusée : Mallow et colis redessinés hors DA. Règle : toujours partir des dessins du jeu.)
- 23/11/2026 · Dessin à la chaîne : la feuille glisse depuis la gauche comme une page de carnet, puis les deux bouts de
  scotch se posent. Champ de mines : à la pose, la bombe tombe dans le colis, qui tressaute avec un peu de poussière.
- 23/11/2026 · Télépathie : pendant qu'on tape son mot, le duo s'affiche, l'étoile pulse et une onde rose/bleue fait la
  navette sous les prénoms. Roue des territoires : anneaux de cible rouges sur la pastille des joueurs visés.
- 23/11/2026 · Au lancement de chaque mini-jeu, sa carte (icône, numéro, nom, « C'est parti ! ») arrive en grand puis
  s'envole (2,4 s). À chaque nouvelle manche, un rideau de la couleur du jeu traverse l'écran (« Manche 2 » ;
  « Question 2 » pour Combien ont dit oui ?). Une seule fois par téléphone, même après un rechargement.
  Toutes les idées d'animation de la liste (1 à 17) ont été passées en revue.
- 23/11/2026 · Table virtuelle (`table.html`, en ligne) : 2 à 8 téléphones de test dans une seule page, pour tester sans
  vrais téléphones. Chaque cadre charge le vrai jeu avec `?joueur=N` : mémoire séparée (localStorage préfixé,
  `src/joueurTest.ts`) et connexion Firebase séparée (une appli Firebase nommée par joueur). Dès que le 1er téléphone a
  un salon, les autres le rejoignent par le lien d'invitation. Son seulement sur le 1er. Sans `?joueur`, rien ne change.
- 23/11/2026 · Grosse mission : les 2 propositions sont réservées dès le tirage (avant, seulement au moment de garder),
  donc deux joueurs ne se voient plus proposer la même. La proposition non gardée sort du jeu pour la soirée.
  Vérifié sur la table virtuelle : 6 joueurs, 12 propositions toutes différentes, missions gardées enregistrées.
- 23/11/2026 · Rideau de manche : il sortait juste au bord de l'écran (penché, un coin et sa lueur restaient visibles à
  droite). Il sort maintenant plus loin, s'efface en fondu et devient invisible à la fin.
- 23/11/2026 · Podium des mini-jeux : le 1er en grand à gauche (bordure dorée, grande pastille, médaille, points en
  gros), le 2e et le 3e plus petits, l'un sur l'autre à droite.
