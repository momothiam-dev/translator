# Parlotte

PWA de traduction hybride : MyMemory en ligne par défaut, avec NLLB-200 en option hors ligne via Transformers.js.

## Démarrer

Installez les dépendances avec `npm install`, puis lancez `npm run dev`. Pour tester l’application installable et son app shell hors ligne, utilisez `npm run build` puis `npm run preview`.

## Traduction en ligne

Le mode en ligne appelle l’API MyMemory directement depuis le navigateur et n’installe aucun modèle sur le téléphone. Le service indique un quota gratuit anonyme de 5 000 caractères par jour. Ses conditions précisent que les segments envoyés peuvent être conservés ; ne pas transmettre de contenu confidentiel en mode en ligne. Les segments sont limités à moins de 500 octets, limite documentée par l’API. Certaines langues rares ne sont pas disponibles via cette API ; choisir Hors ligne pour la couverture NLLB complète.

## Traduction hors ligne

La première utilisation télécharge le modèle quantifié NLLB-200 (environ 900 Mo selon le navigateur et les fichiers retenus). Cette étape nécessite une connexion Internet et de l’espace de stockage disponible. Transformers.js conserve les poids dans le cache du navigateur ; le téléchargement ne se répète pas après fermeture normale de l’app. Le modèle est limité à un thread WASM, les longs textes sont découpés en segments et le moteur est libéré de la mémoire juste après chaque résultat ; il est rechargé depuis le cache local à la traduction suivante. Le navigateur peut toutefois effacer le cache si son stockage est sous pression.

L’interface expose les 204 entrées de langue et de variante de script du catalogue FLORES-200 couvert par NLLB. La détection automatique locale couvre 82 langues courantes et demande une sélection manuelle si la phrase est trop courte ou ambiguë. Les 20 derniers résultats exacts sont conservés localement, séparément pour chaque mode, texte et paire de langues ; le bouton de recalcul contourne ce cache. Les textes restent sur l’appareil uniquement en mode hors ligne. La qualité et la disponibilité varient selon les services et les paires ; relire les traductions importantes. Une connexion sécurisée (HTTPS ou localhost) est nécessaire pour le service worker et l’installation PWA.