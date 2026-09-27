# Parlotte

PWA de traduction en ligne. Aucun modèle local lourd n’est téléchargé.

## Démarrer

```sh
npm install
npm run dev
```

Pour vérifier le build de production : `npm run build`, puis `npm run preview`.

## Fonctionnement et confidentialité

Les traductions passent par l’API MyMemory depuis le navigateur. Une connexion Internet est nécessaire. MyMemory indique un quota gratuit anonyme de 5 000 caractères par jour et précise que les segments envoyés peuvent être conservés. Ne pas transmettre de contenu confidentiel.

Le service worker met en cache uniquement l’application web, pas de modèle de traduction. La page peut s’ouvrir depuis le cache sans réseau, mais la traduction ne fonctionnera pas hors connexion. Les 20 derniers résultats exacts sont conservés localement dans le navigateur pour éviter les requêtes répétées. Le bouton de recalcul force une nouvelle requête en ligne.
