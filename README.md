# Parlotte

PWA de traduction locale, propulsée par le modèle multilingue NLLB-200 via Transformers.js.

## Démarrer

Installez les dépendances avec `npm install`, puis lancez `npm run dev`. Pour tester l’application installable et son app shell hors ligne, utilisez `npm run build` puis `npm run preview`.

## Traduction hors ligne

La première utilisation télécharge le modèle quantifié NLLB-200 (environ 900 Mo selon le navigateur et les fichiers retenus). Cette étape nécessite une connexion Internet et de l’espace de stockage disponible. Transformers.js conserve les poids dans le cache du navigateur ; le téléchargement ne se répète pas après fermeture normale de l’app. Le modèle est limité à un thread WASM, découpé en segments et libéré de la mémoire quand l’app passe en arrière-plan ; il est ensuite rechargé depuis le cache local. Le navigateur peut toutefois effacer le cache si son stockage est sous pression.

L’interface expose les 204 entrées de langue et de variante de script du catalogue FLORES-200 couvert par NLLB. La détection automatique couvre 82 langues courantes ; les textes trop courts ou les langues non reconnues demandent un choix manuel parmi la liste complète. Les 20 dernières traductions exactes (texte et langues) sont conservées localement pour une réutilisation sans calcul ; elles ne sont jamais envoyées au serveur. Une phrase nouvelle nécessite toujours une inférence locale : seul un résultat strictement identique peut être affiché sans recalcul. La disponibilité et la qualité varient selon les paires, et le résultat mérite vérification pour les textes importants. Une connexion sécurisée (HTTPS, ou localhost en développement) est nécessaire pour les service workers et l’installation PWA.