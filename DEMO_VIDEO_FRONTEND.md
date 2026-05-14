# Demo Video Frontend (VS Code)

Objectif: montrer le parcours d un utilisateur qui se connecte et verifie les fonctionnalites principales.
Duree cible: 4 a 6 minutes.
URL frontend: http://localhost:5500

## Comptes de demo

- Client:
  - Identifiant: alice.client.demo
  - Mot de passe: password123
- Prestataire:
  - Identifiant: bob.presta.demo
  - Mot de passe: password123
- Admin (optionnel en fin de video):
  - URL: /_staff/console
  - Identifiant: admin.demo
  - Mot de passe: password123

## Preparation avant enregistrement

1. Ouvrir VS Code avec le workspace.
2. Verifier que Docker est lance:
   - `docker compose ps`
3. Ouvrir le navigateur sur http://localhost:5500.
4. Ouvrir DevTools reseau si tu veux montrer les appels API.
5. Mettre le zoom navigateur a 100%.

## Storyboard video (plan de tournage)

## Scene 1 - Landing et navigation (0:00 -> 0:40)

- Montrer la page d accueil.
- Dire que l app distingue les parcours Client et Prestataire.
- Cliquer sur Acces client.

Texte a dire:
"Ici, un utilisateur choisit son profil. Je vais prendre le parcours Client pour creer et suivre ses demandes."

## Scene 2 - Connexion Client (0:40 -> 1:20)

- Sur l ecran auth client, cliquer sur Connectez-vous si l ecran affiche Inscription.
- Renseigner:
  - identifiant: alice.client.demo
  - mot de passe: password123
- Cliquer sur Se connecter.

Texte a dire:
"La connexion accepte un username ou un numero. Une fois authentifie, l utilisateur arrive sur son espace client."

## Scene 3 - Verification des fonctions Client (1:20 -> 3:00)

- Dans Espace Client, verifier et montrer:
  - Carte cockpit (resume rapide).
  - Section Mes demandes avec filtres (statut + recherche texte).
  - Bouton Actualiser.
  - Bouton Se deconnecter.
- Dans Creer une demande:
  - Choisir une categorie.
  - Remplir description + localisation + disponibilite + priorite.
  - Soumettre.
- Revenir dans Mes demandes et verifier:
  - La nouvelle demande apparait.
  - Le statut et la priorite sont visibles.
  - Les actions Modifier, Annuler (si ouverte), Dupliquer sont disponibles.

Texte a dire:
"Le client peut filtrer ses demandes, suivre leur progression et creer une nouvelle demande en quelques secondes."

## Scene 4 - Bascule de role vers Prestataire (3:00 -> 4:20)

- Dans la zone d actions role, cliquer Mode prestataire.
- Verifier l arrivee sur Espace Prestataire.
- Montrer:
  - Les colonnes pipeline (Nouvelles opportunites, A confirmer, En cours, Cloturees).
  - Le filtre d affichage des cartes (5, 10, toutes).
  - Les sections repliables du pipeline.
  - Les filtres geographiques et statut.

Texte a dire:
"Un compte multi-role peut basculer sans se reconnecter. Le prestataire visualise son pipeline complet et filtre son marche."

## Scene 5 - Verification des fonctions Prestataire (4:20 -> 5:40)

- Ouvrir la creation de service.
- Montrer la selection de domaines via menu multi-selection.
- Creer un service.
- Ouvrir une mission/demande pour verifier les details.
- Changer un statut de mission (si action disponible selon l etat).

Texte a dire:
"Le prestataire peut publier ses services, filtrer ses opportunites et gerer ses missions depuis un seul espace."

## Scene 6 - Conclusion (5:40 -> 6:00)

- Revenir sur les points verifies.
- Optionnel: montrer deconnexion.

Texte a dire:
"Cette demo valide le flux principal: connexion, creation et suivi cote client, puis gestion operationnelle cote prestataire."

## Variante courte 2 minutes

1. Connexion Client.
2. Affichage Mes demandes + filtre.
3. Creation d une demande.
4. Bascule Mode prestataire.
5. Pipeline + service multi-selection.

## Check-list de validation en direct

- Connexion reussie.
- Navigation vers espace role correcte.
- Filtres actifs sans erreur UI.
- Creation demande/service fonctionnelle.
- Pipeline affichable en mode toutes missions.
- Deconnexion operationnelle.

## En cas de probleme pendant la capture

- Hard refresh: Ctrl+F5.
- Verifier services docker:
  - `docker compose ps`
- Rejouer seed comptes demo:
  - `docker compose exec -T api python -m app.scripts.seed_accounts`
