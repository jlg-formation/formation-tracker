Ajouter une page React (Geocache) :

- La page liste le cache de géocodage (appels effectués au service de géocodage) et affiche, pour chaque entrée :
  - le payload (l’adresse textuelle)
  - les coordonnées GPS

- Chaque enregistrement du cache de géocodage doit être éditable :
  1. Cliquer sur « éditer » :
     - une carte s’affiche avec un pin aux coordonnées GPS (si déjà existantes)
     - l’utilisateur repositionne manuellement les coordonnées GPS
  2. Cliquer sur le bouton « valider les nouvelles coordonnées GPS » :
     - la carte n’est alors plus affichée

- Un bouton général permet de réappliquer les données du cache à toutes les formations.
