# Parlotte

PWA de traduction en ligne avec option facultative pour le traducteur natif du navigateur. Le site ne télécharge ni n’intègre de modèle de traduction lourd.

## Démarrer

```sh
npm install
npm run dev
```

Pour vérifier le build de production : `npm run build`, puis `npm run preview`.

## Fonctionnement et confidentialité

Par défaut, les traductions passent par l’API MyMemory depuis le navigateur. Une connexion Internet est nécessaire. MyMemory indique un quota gratuit anonyme de 5 000 caractères par jour et précise que les segments envoyés peuvent être conservés. Ne pas transmettre de contenu confidentiel dans ce mode.

Le mode « Sur cet appareil » n’apparaît actif que si le navigateur expose son Translator API natif. Le navigateur gère lui-même les packs de langue et leur cache ; l’application ne manipule pas l’audio et détruit le traducteur après chaque résultat. D’après la compatibilité publiée par Chrome et MDN, cette API fonctionne dans certains navigateurs Chromium de bureau (Chrome 138+, Edge 148+), mais pas dans Safari/iOS ni Chrome Android ; sur ces appareils, le mode en ligne reste disponible. La disponibilité des paires varie. Le navigateur peut télécharger un pack de langue au premier usage ; ce téléchargement est géré par lui, pas par le site.

Le service worker met en cache uniquement l’application web, pas de modèle de traduction. La page peut s’ouvrir depuis le cache sans réseau, mais le mode en ligne nécessite Internet ; le mode natif ne fonctionne hors ligne que si le navigateur a déjà le pack de langue et prend en charge l’API. Les 20 derniers résultats exacts sont conservés localement dans le navigateur. Le bouton de recalcul force une nouvelle traduction.
