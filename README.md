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
  dépoli, boutons lumineux, polices Unbounded (titres) et Plus Jakarta Sans (texte). Mascotte : Chamal, un chamallow
  (src/chamal.ts). Version « grillé » : corps clair, seul le dessus carbonisé et fumant (jamais de visage noir).
  Accueil : cartes secrètes « TOP SECRET ». Pas de slogan (choix du fondateur) : le logo et Chamal suffisent.
- 16/11/2026 · Bug trouvé au premier test sur téléphone : impossible de défiler au doigt (écran des mises du Parieur).
  Cause : overflow-x et overscroll-behavior posés à la fois sur html et body. Corrigé (html seulement). L'affichage ne
  remplace plus tout l'écran à chaque changement : seules les parties modifiées sont mises à jour (ui.ts, harmoniser).
