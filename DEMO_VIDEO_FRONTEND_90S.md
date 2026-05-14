# Demo Video Frontend - Version 90 secondes

Objectif: faire une demo courte et percutante du parcours utilisateur (connexion + verification des fonctions principales).

## Identifiants de demo

- Client: alice.client.demo / password123
- Prestataire: bob.presta.demo / password123

## Script chrono (90s)

## 0s -> 10s : Intro

Action:
- Ouvrir http://localhost:5500.
- Montrer rapidement les deux acces (Client / Prestataire).

Voix off:
"Voici l application de services a domicile. Je vais montrer en 90 secondes la connexion et les fonctions principales."

## 10s -> 30s : Connexion Client

Action:
- Cliquer Acces client.
- Cliquer Connectez-vous.
- Saisir:
  - identifiant: alice.client.demo
  - mot de passe: password123
- Cliquer Se connecter.

Voix off:
"Le client se connecte avec son username et accede directement a son espace personnel."

## 30s -> 55s : Fonctions Client

Action:
- Montrer Mes demandes.
- Changer le filtre statut.
- Utiliser la recherche texte.
- Dans Creer une demande: choisir categorie + remplir rapidement, puis soumettre.

Voix off:
"Cote client, on peut filtrer, rechercher et creer une demande en quelques clics."

## 55s -> 75s : Bascule vers Prestataire

Action:
- Cliquer Mode prestataire (bascule de role).
- Montrer Espace Prestataire et le pipeline.
- Passer l affichage sur Toutes les missions.

Voix off:
"Sans se deconnecter, on bascule vers le mode prestataire et on voit tout le pipeline de missions."

## 75s -> 90s : Fonctions Prestataire + Conclusion

Action:
- Ouvrir creation de service.
- Montrer la selection multi domaines (dropdown).
- Terminer avec Se deconnecter.

Voix off:
"Le prestataire publie ses services, suit ses opportunites et gere ses missions depuis un seul espace."

## Plan B si un ecran bloque pendant la capture

- Hard refresh: Ctrl+F5
- Verifier stack: `docker compose ps`
- Re-seed comptes demo: `docker compose exec -T api python -m app.scripts.seed_accounts`
