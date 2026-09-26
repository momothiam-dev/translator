# Parlotte

PWA de traduction locale, propulsée par le modèle multilingue NLLB-200 via Transformers.js.

## Démarrer

Installez les dépendances avec `npm install`, puis lancez `npm run dev`. Pour tester l’application installable et son app shell hors ligne, utilisez `npm run build` puis `npm run preview`.

## Traduction hors ligne

La première utilisation télécharge le modèle quantifié NLLB-200 (~700 Mo). Cette étape nécessite une connexion Internet et de l’espace de stockage disponible dans le navigateur. Transformers.js conserve les fichiers du modèle dans le cache du navigateur ; les traductions suivantes s’exécutent localement. Les textes saisis ne sont pas envoyés à un serveur. Le navigateur peut toutefois effacer les données de cache si son stockage est sous pression.

L’interface expose les 204 entrées de langue et de variante de script du catalogue FLORES-200 couvert par NLLB. La disponibilité et la qualité varient selon les paires. Une connexion sécurisée (HTTPS, ou localhost en développement) est nécessaire pour les service workers et l’installation PWA.