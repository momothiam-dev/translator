# Parlotte

PWA de traduction en ligne et sur l’appareil, avec moteur de secours local pour les navigateurs qui ne prennent pas en charge les paires de langues demandées.

## Démarrer

```sh
npm install
npm run dev
```

Pour vérifier le build de production : `npm run build`, puis `npm run preview`.

## Fonctionnement et confidentialité

Par défaut, les traductions passent par l’API MyMemory depuis le navigateur. Une connexion Internet est nécessaire. MyMemory indique un quota gratuit anonyme de 5 000 caractères par jour et précise que les segments envoyés peuvent être conservés. Ne pas transmettre de contenu confidentiel dans ce mode.

Le mode « Sur cet appareil » utilise d’abord le traducteur natif du navigateur lorsqu’il est disponible. Si le navigateur ou la paire de langues ne le permet pas, l’application utilise un modèle multilingue local (environ 700 Mo). Ce modèle doit être téléchargé lors du premier usage ; les fichiers sont ensuite conservés dans le cache du navigateur et peuvent être réutilisés hors ligne. Le modèle reste chargé pendant l’utilisation de la page pour éviter un rechargement à chaque traduction.

Le service worker met en cache uniquement l’application web, pas de modèle de traduction. La page peut s’ouvrir depuis le cache sans réseau. Le mode en ligne nécessite Internet ; le mode sur l’appareil fonctionne hors ligne une fois que le pack natif ou le modèle local est disponible dans le cache. Les 20 derniers résultats exacts sont conservés localement dans le navigateur. Le bouton de recalcul force une nouvelle traduction.
