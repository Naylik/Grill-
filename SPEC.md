# Grillé ! --- cahier des charges

Nov 16, 2026 · \@Kilyan Eloy

## Concept

Grillé ! est un jeu de soirée où chacun joue sur son propre téléphone :
des mini-jeux s\'enchaînent pendant que chaque joueur essaie
d\'accomplir des missions secrètes. À la fin, on révèle les missions, le
groupe vote, et le classement tombe.

-   **Joueurs** : 3 à 6, entre amis

-   **Durée** : environ 45 minutes pour une partie normale (6 mini-jeux)

-   **Support** : chacun son téléphone. Un joueur crée le salon, les
    autres le rejoignent avec un code ou un QR code, directement dans le
    navigateur, sans rien installer.

-   **Missions** : toujours consultables sur son propre téléphone, dans
    un onglet « Mes missions »

-   **Appli** : séparée du hub de jeux de soirée

-   **Le twist** : on peut gagner les mini-jeux et rater sa mission, ou
    l\'inverse. Saboter, bluffer et manipuler fait partie du jeu.

## Style graphique et ambiance

L\'appli est cartoon et colorée sur fond sombre, avec un narrateur
gentiment moqueur.

-   **Look** : formes rondes, couleurs vives, gros boutons, façon
    Jackbox. Thème sombre uniquement, pour ne pas éblouir en soirée.

-   **Identité des joueurs** : chacun reçoit un nom de code et une
    couleur tirés au hasard (« Agent Faucon », orange), affichés à côté
    de son prénom.

-   **Animations et sons** : modérés, aux moments clés seulement
    (nouvelle mission, résultats, podium, roue).

-   **Narrateur** : l\'appli commente avec des vannes gentilles (« Pas
    ouf ce score, Kilyan », « Manon, 0 point, ça devient gênant »).
    Jamais méchant, quel que soit le niveau choisi.

## Déroulé d\'une partie

Une partie compte 4, 6 ou 8 mini-jeux (courte, normale ou longue), en
deux manches, avec une nouvelle mission entre les deux.

1.  **Salon** : l\'hôte crée la partie, choisit la durée (courte /
    normale / longue) et le mode de choix des jeux, puis un code et un
    QR code s\'affichent. Chaque joueur rejoint avec son prénom et
    reçoit son nom de code. Lancement à partir de 3 joueurs. À 3,
    L\'Imposteur est retiré du tirage automatiquement.

2.  **Missions** : chacun reçoit 2 missions au choix, une facile et une
    difficile, et en garde une en secret.

3.  **Manche 1** : la moitié des mini-jeux. Avant chaque jeu, selon le
    mode choisi : une **roue** tourne pour tirer le jeu au hasard, ou le
    groupe **vote** entre 2 jeux proposés.

4.  **Entre deux jeux** : classement provisoire avec une vanne du
    narrateur, petit rappel « N\'oublie pas ta mission 👀 », puis pause
    libre. L\'hôte lance le jeu suivant quand le groupe est prêt.

5.  **Mi-partie** : nouveau choix entre une mission facile et une
    difficile, signalé par une vibration et un badge sur « Mes missions
    ».

6.  **Manche 2** : l\'autre moitié des mini-jeux.

7.  **Pari détective** : chacun, en secret, choisit un joueur et devine
    une de ses missions parmi 4 propositions.

8.  **Révélation** : joueur par joueur, les missions s\'affichent sur
    tous les écrans, le joueur a 15 s pour raconter comment il s\'y est
    pris, puis chacun vote réussi ou raté (le joueur concerné ne vote
    pas).

9.  **Fin** : podium, titres fun, moments forts de la soirée, image du
    podium à partager, bouton « Rejouer ».

L\'onglet « Mes missions » reste accessible à tout moment pendant la
partie, avec un bouton pour masquer l\'écran vite si quelqu\'un regarde.
Si un joueur perd la connexion, il rejoint la partie en cours avec le
même code et retrouve ses missions et ses points.

## Missions secrètes

Chaque joueur accomplit deux missions : une au début, une à mi-partie. À
chaque fois, il choisit entre une facile (6 pts) et une difficile (10
pts). L\'appli les tire de sa banque et remplace {cible} par le prénom
d\'un autre joueur.

**Règles de tirage**

-   Deux joueurs n\'ont jamais la même mission dans une partie.

-   Une même personne n\'est pas la cible de plus de 2 missions.

-   La deuxième mission est d\'un autre type que la première (vie réelle
    ou mini-jeu).

-   Tout se fait **autour de la table**, sans se lever ni utiliser
    d\'objet.

-   Chaque mission doit pouvoir être jugée par le groupe à la fin : on
    évite ce qui est invisible.

-   Chaque mission porte deux tags : difficulté (facile, difficile) et
    niveau (soft, épicé, hot).

**Exemples --- vie réelle**

-   *Faire faire un geste* --- Fais en sorte que {cible} te check sans
    que tu le demandes. (facile)

-   *Faire faire un geste* --- Obtiens un high five de chaque joueur
    avant la fin de la manche. (difficile)

-   *Faire dire* --- Fais dire « t\'as raison » à {cible}. (facile)

-   *Faire avouer* --- Fais avouer à {cible} son pire râteau.
    (difficile)

-   *Faire dire* --- Fais en sorte que quelqu\'un te dise « t\'es
    bizarre ce soir ». (facile)

-   *Taquinerie* --- Fais un compliment exagéré à {cible} sur son style,
    et qu\'il ou elle te remercie. (facile)

-   *Drague pour rire* --- Fais semblant d\'être jaloux de {cible}
    pendant un mini-jeu, sans que personne ne comprenne que c\'est une
    mission. (difficile)

-   *Taquinerie* --- Fais rougir ou rire {cible} au moins 3 fois.
    (difficile)

**Exemples --- dans les mini-jeux**

-   Fais finir {cible} dernier à au moins un mini-jeu.

-   Termine 2e d\'un mini-jeu, pas 1er.

-   Fais voter le groupe contre {cible} dans un jeu d\'ambiance.

-   Ne gagne aucun point pendant une manche entière sans te faire
    griller.

Objectif V1 : environ 60 missions (30 vie réelle, 30 mini-jeux, moitié
faciles, moitié difficiles), dans un fichier JSON facile à compléter.

**Éditeur perso** (après la V1) : un écran dans l\'appli pour ajouter
les missions, questions de quiz et questions « Qui de nous ? » du
groupe, blagues internes comprises. Elles sont mélangées à la banque
dans les parties suivantes.

## Mini-jeux

**Liste validée pour l\'instant** : on garde tous les jeux ci-dessous et
on les code petit à petit, en commençant par ceux de la V1. Tout le
monde joue en même temps, chacun sur son téléphone ; les résultats
s\'affichent sur tous les écrans.

  ---------------------------------------------------------------------------------
  Mini-jeu       Statut      Catégorie     Comment on joue           Score interne
                                                                     (sert au
                                                                     classement du
                                                                     jeu)
  -------------- ----------- ------------- ------------------------- --------------
  Le Parieur     Gardé, V1   Paris         Chacun est défié une fois Pas de points
                 (remplace                 (« Kilyan doit citer 5    de place :
                 les                       joueurs du PSG en 15 s    pari mutuel en
                 Enchères)                 »). Les autres misent 1 à vrais points
                                           3 vrais points en secret  (voir Score)
                                           sur sa réussite ou son    
                                           échec, puis le groupe     
                                           valide par vote           

  Le Juste Prix  Gardé, V1   Estimation    Chacun saisit son         Le plus proche
                                           estimation en secret.     gagne la
                                           Questions de culture («   manche ;
                                           Combien mesure la tour    classement au
                                           Eiffel ? ») et questions  nombre de
                                           fun                       manches
                                                                     gagnées

  Combien ont    Gardé, V1   Estimation,   Une question gênante («   3 pts si
  dit oui ?                  piquant       As-tu déjà stalké un ex ? chiffre exact,
                                           »). Chacun répond oui ou  1 pt à un près
                                           non anonymement, puis     
                                           devine combien ont dit    
                                           oui. Seul le total est    
                                           révélé                    

  L\'Imposteur   Gardé, V1   Bluff         Chacun voit son mot en    3 pts à
                                           secret, sauf l\'imposteur l\'imposteur
                                           qui en a un autre. Mots   s\'il survit,
                                           fun et actuels : jeux     1 pt à chaque
                                           vidéo, foot, cinéma,      bon vote sinon
                                           séries. Indices à         
                                           l\'oral, puis vote secret 

  Quitte ou      Gardé       Quiz, risque  Questions de plus en plus Cagnotte
  Double                                   dures, la cagnotte double encaissée ;
                                           à chaque bonne réponse    une erreur
                                           (1, 2, 4, 8...). Avant    fait tout
                                           chaque question, on       perdre
                                           choisit en secret         
                                           d\'encaisser ou de        
                                           continuer                 

  Plus ou Moins  Gardé       Estimation    Deux films, joueurs de    1 pt par bonne
                                           foot ou jeux vidéo :      réponse, +2 à
                                           lequel a le plus de       la plus longue
                                           box-office, de buts, de   série
                                           ventes... 8 duels rapides 

  Quiz express   Gardé       Quiz          5 questions à 4 choix,    1 pt par bonne
                                           tout le monde répond en   réponse, +1 au
                                           même temps, 10 s par      plus rapide
                                           question                  

  Qui de nous ?  Gardé       Ambiance      « Qui est le plus         1 pt à chaque
                                           susceptible de... » :     vote dans la
                                           chacun vote en secret     majorité

  Le plus        Gardé       Ambiance      On parie sur ce que le    2 pts si on
  probable                                 groupe va voter           devine la
                                                                     majorité

  Dessin         Gardé       Dessin        Phrase, dessin,           3 pts au
  téléphone                                devinette, dessin...      dessin le plus
  arabe                                    chacun sur son écran, on  drôle (vote),
                                           déroule les chaînes à la  1 pt par
                                           fin                       chaîne qui
                                                                     garde le sens
  ---------------------------------------------------------------------------------

-   **Le Parieur** : on mise 1 à 3 vrais points par tour, en pari mutuel
    (règles complètes dans Score). Ce jeu n\'arrive jamais dans les 2
    premiers mini-jeux, pour que tout le monde ait des points à miser.

-   **Quiz express** et **Quitte ou Double** sont proches : on pourra
    fusionner les deux (un quiz où l\'on choisit de doubler ou non).

-   **Plus ou Moins** : choisir des chiffres qui ne bougent pas (année
    de sortie, box-office final, buts en carrière d\'un joueur retraité)
    pour que les questions ne deviennent pas fausses avec le temps.

-   **Retirés** : Réflexe, Garde la bille, Mime ou dessin, Enchères
    secrètes (remplacé par Le Parieur).

## Score et classement

Le classement repose sur des points de place, comme en F1 : chaque
mini-jeu garde son score interne, mais seule ta place dans ce jeu compte
pour la partie. Tous les jeux pèsent donc pareil. Seule exception, Le
Parieur, où l\'on mise ses vrais points dans des limites fixées.

  -----------------------------------------------------------------------
  Source                     Points
  -------------------------- --------------------------------------------
  1re place dans un mini-jeu 5

  2e place                   3

  3e place                   2

  4e place et au-delà        1

  Le Parieur                 Vrais points gagnés ou perdus (pari mutuel,
                             voir ci-dessous)

  Mission facile réussie     6

  Mission difficile réussie  10

  Pari détective juste       Vole 4 pts (mission facile) ou 6 pts
                             (difficile) au joueur grillé

  Pari détective raté        −2
  -----------------------------------------------------------------------

Sur une partie normale (6 mini-jeux), les mini-jeux rapportent au
maximum 30 points et les deux missions jusqu\'à 20 : bien jouer compte,
mais une bonne manipulation peut faire gagner. En cas d\'égalité dans un
mini-jeu, les joueurs ex aequo reçoivent les mêmes points de place.

**Règles du Parieur**

1.  Autant de tours que de joueurs : chacun est défié une fois, dans un
    ordre tiré au hasard.

2.  À chaque tour, un défi tombe sur le joueur défié. Les autres misent
    en secret de 1 à 3 points sur sa réussite ou son échec.

3.  Le groupe vote pouce haut / pouce bas pour valider le défi.

4.  Pari mutuel : les gagnants récupèrent leur mise et se partagent les
    mises des perdants, au prorata de ce qu\'ils ont misé (arrondi à
    l\'unité). Le gain d\'un parieur est plafonné au double de sa mise ;
    le surplus est rendu aux perdants.

5.  Si tout le monde parie du même côté, personne ne gagne ni ne perd.

6.  Joueur défié : s\'il réussit, il gagne 1 pt par joueur qui a parié
    sur lui (5 pts maximum). S\'il rate, il ne gagne ni ne perd rien.

*Exemple : 3 joueurs misent 3 pts sur la réussite de Manon, Kilyan mise
3 pts sur son échec. Manon réussit : les 3 gagnants se partagent les 3
pts de Kilyan (1 pt chacun) et Manon gagne 3 pts. Manon rate : Kilyan
gagne 6 pts (plafond du double de sa mise), les 3 pts restants sont
rendus aux perdants.*

**Autres règles** : un seul pari détective par joueur, juste avant la
révélation. Un joueur grillé garde quand même les points de sa mission
si le groupe la valide : il perd seulement les points volés.

-   **Vote** : la mission est validée si plus de la moitié des votants
    dit « réussi ». Égalité = raté.

-   **Classement provisoire** : affiché après chaque mini-jeu, sans les
    points de mission (révélés à la fin seulement).

-   **Écran final** : podium du top 3, puis pour chaque joueur le détail
    mini-jeux / missions / détective.

-   **Titres fun** : « Agent secret » (2 missions réussies), « Sherlock
    » (pari juste), « Grillé » (mission devinée), « Champion des
    mini-jeux », « Casse-cou » (2 missions difficiles choisies).

-   **Moments forts** : plus gros pari au Parieur, dessin le plus voté,
    pire réponse au quiz, mission la plus vite grillée.

-   **Partage** : une image du podium à envoyer sur le groupe.

-   **Historique** : le classement de chaque partie est gardé, avec un
    tableau « qui a gagné le plus souvent » dans le groupe.

## Ton et contenu

Le ton est piquant et adulte, entre amis, sans aucun gage d\'alcool.

-   **Oui** : questions gênantes, « qui est le plus susceptible de... »
    osés, taquineries, sous-entendus, missions de drague pour rire.

-   **Non** : boire comme gage, humiliation, contact physique imposé,
    sujets qui blessent (physique, origines, santé).

-   **Réglage de niveau** : Soft / Épicé (par défaut) / Hot, qui filtre
    les questions et les missions.

-   **Narrateur** : toujours gentiment moqueur, quel que soit le niveau.

-   Chaque contenu de la banque porte un tag de niveau pour que ce
    filtre fonctionne.

## Technique

C\'est une web app mobile qu\'on ouvre dans le navigateur (installable
en PWA), synchronisée en temps réel entre les téléphones grâce à
Firebase. Coût total : 0 €, sans carte bancaire. Une connexion internet
est nécessaire pendant la partie.

-   **Stack** : Vite + TypeScript, sans framework lourd. Hébergement
    gratuit sur GitHub Pages.

-   **Temps réel** : Firebase Realtime Database, offre gratuite Spark
    (100 connexions simultanées, largement assez). Connexion anonyme
    Firebase pour identifier chaque téléphone sans créer de compte.

-   **Hôte** : le téléphone qui crée la partie pilote l\'enchaînement
    (mini-jeu suivant, fin du chrono, calcul des points). Les autres
    envoient seulement leurs réponses.

-   **Secrets** : les missions de chaque joueur sont stockées à part, et
    les règles de sécurité Firebase empêchent un téléphone de lire
    celles des autres.

-   **Reconnexion** : un joueur qui perd le réseau ou recharge la page
    retrouve sa place, ses missions et ses points. Si l\'hôte part, un
    autre joueur reprend la main.

-   **Données** : missions, questions de quiz, défis et mots en fichiers
    JSON dans src/data/, chaque entrée taguée par niveau (soft, epice,
    hot).

-   **Mini-jeux en modules** : un fichier par jeu dans src/games/, avec
    une interface commune (écran joueur, réception des réponses, calcul
    des points). On ajoute un jeu sans toucher au reste.

-   **Mobile d\'abord** : portrait, gros boutons, appui long pour
    révéler un secret, vibration aux moments clés.

```{=html}
<!-- -->
```
-   **Groupe d\'amis** : l\'historique des parties et le contenu perso
    de l\'éditeur sont rattachés à un « groupe » dans Firebase, retrouvé
    par un code, pour qu\'on les garde d\'une soirée à l\'autre.

-   **Image de partage** : le podium est dessiné en image dans le
    navigateur (canvas), puis partagé via le menu de partage du
    téléphone.

```{=html}
<!-- -->
```
-   **Mise en veille** : l\'écran reste allumé pendant la partie (Wake
    Lock), sinon un téléphone qui se verrouille se déconnecte.

-   **Ordre de construction conseillé** : 1) salon et synchro avec un
    mini-jeu simple, testé à 2 téléphones ; 2) missions et révélation
    ; 3) les 3 autres mini-jeux ; 4) style, narrateur et finitions. Le
    temps réel est la partie la plus délicate : mieux vaut la valider
    avant tout le reste.

**V1** : style cartoon sombre, noms de code, salon avec code et QR code,
durée courte / normale / longue, roue ou vote pour choisir les jeux,
choix entre mission facile et difficile, onglet « Mes missions »,
classement provisoire et vannes du narrateur, 4 mini-jeux (Le Parieur,
Le Juste Prix, Combien ont dit oui ?, L\'Imposteur), environ 60
missions, pari détective, vote, podium et titres fun.

**Ensuite** : les autres mini-jeux, une fois la liste finalisée
ensemble, l\'éditeur perso, l\'historique du groupe, les moments forts,
l\'image de partage, le réglage de niveau, les sons, un mode « un seul
téléphone » de secours.

## Premier prompt pour Claude Code

Colle ce cahier des charges dans un fichier SPEC.md à la racine d\'un
dossier vide, ouvre Claude Code dans ce dossier, puis envoie :

On crée « Grillé ! », un jeu de soirée multijoueur où chacun joue sur
son téléphone. Lis d\'abord SPEC.md en entier : c\'est le cahier des
charges, y compris le style graphique.\
\
Objectif de cette session : la V1 décrite dans la section Technique.\
\
1. Initialise un projet Vite + TypeScript en PWA, mobile d\'abord, en
portrait, thème sombre uniquement, style cartoon coloré (formes rondes,
couleurs vives, gros boutons). Prépare le déploiement sur GitHub Pages.\
2. Branche Firebase Realtime Database (offre gratuite Spark) avec
connexion anonyme. Explique-moi pas à pas comment créer le projet
Firebase et où coller la config, je ne l\'ai jamais fait.\
3. Code le salon : l\'hôte choisit la durée (4, 6 ou 8 mini-jeux) et le
mode de choix des jeux (roue aléatoire ou vote entre 2 jeux), un code de
4 lettres et un QR code s\'affichent, les autres rejoignent avec leur
prénom et reçoivent un nom de code et une couleur. Lancement à partir de
3 joueurs (max 6).\
4. Code le déroulé complet : choix entre mission facile et difficile,
manche 1, classement provisoire avec vanne du narrateur et rappel de
mission entre chaque jeu (l\'hôte lance le suivant), nouvelle mission au
choix à mi-partie avec vibration, manche 2, pari détective, révélation
(15 s pour raconter sa mission, puis vote sur chaque téléphone), podium
et titres fun. L\'onglet « Mes missions » est consultable à tout
moment.\
5. L\'hôte pilote l\'enchaînement. Gère la reconnexion d\'un joueur et
le départ de l\'hôte, et empêche l\'écran de se mettre en veille pendant
la partie (Wake Lock).\
6. Les missions d\'un joueur doivent être illisibles par les autres :
écris les règles de sécurité Firebase en conséquence.\
7. Code 4 mini-jeux en modules séparés dans src/games/ avec une
interface commune : Combien ont dit oui ?, Le Juste Prix, Le Parieur
(jamais dans les 2 premiers jeux, réussite du défi votée par le groupe),
L\'Imposteur.\
8. Crée les banques de contenu en JSON dans src/data/ : environ 60
missions (moitié vie réelle, moitié mini-jeux, moitié faciles, moitié
difficiles, toutes faisables autour de la table, avec {cible}), 40
questions piquantes pour Combien ont dit oui ?, 40 questions de Juste
Prix (moitié culture, moitié fun), 30 défis pour Le Parieur, 30 paires
de mots fun et actuels pour L\'Imposteur (jeux vidéo, foot, cinéma,
séries), 50 vannes gentilles pour le narrateur. Ton piquant entre amis,
jamais de gage d\'alcool.\
9. Applique le barème de la section Score.\
\
Avant de coder, propose-moi l\'arborescence, la structure des données
dans Firebase (salon, joueurs, missions, état du mini-jeu, scores) et
une maquette rapide de l\'écran d\'accueil pour valider le style.
Attends ma validation. Ensuite, avance étape par étape et dis-moi
comment tester avec plusieurs téléphones.
