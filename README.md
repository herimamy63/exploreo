# Explore’O Madagascar

## Installation (Termux)
1. Décompresser le dossier `exploreo` dans votre espace Termux.
2. Ouvrir Termux puis :
   ```sh
   cd ~/exploreo
   pkg update -y
   pkg install nodejs-lts unzip -y
   npm install
   cp .env.example .env
   npm start
   ```
3. Ouvrir `http://127.0.0.1:3000` dans Chrome.
4. Administration : `http://127.0.0.1:3000/admin.html`
   - utilisateur par défaut : `admin`
   - mot de passe par défaut : `ExploreO2026!`
   - Changez impérativement le mot de passe avant toute mise en ligne.

## IA locale (optionnelle)
Démarrez llama-server dans une autre session Termux sur `127.0.0.1:8080`, puis le chat Explore’O IA utilise `/v1/chat/completions`.
Si llama-server n'est pas démarré, le site et l'administration fonctionnent quand même, mais l'IA répondra indisponible.

## Images et contenu
Le fichier `data/destinations.json` contient 100 fiches d'affichage initiales. Les URL d'images sont distantes : une connexion Internet est nécessaire pour les charger. Les noms répétés au-delà des 20 exemples sont des fiches de démonstration à remplacer par des lieux validés. Vérifiez les descriptions, droits et exactitude des photos avant publication.

## Important avant publication
- Changez le mot de passe admin dans les variables d'environnement.
- Configurez HTTPS, sauvegardes et une vraie base de données (PostgreSQL/Supabase) avant d'accepter de vraies réservations.
- Le formulaire enregistre les demandes localement dans `data/bookings.json`; il n'envoie pas encore d'e-mail ni de paiement.
- Ce starter n'intègre pas encore de paiement en ligne ni de compte client.
