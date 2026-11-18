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
