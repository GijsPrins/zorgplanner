# Firebase Setup

Deze checklist beschrijft wat er in Firebase nodig is voor de eerste gedeelde versie.

## 1. Project Aanmaken

1. Ga naar de Firebase Console: https://console.firebase.google.com/
2. Kies **Add project**.
3. Geef het project een naam, bijvoorbeeld `zorgplanner`.
4. Google Analytics mag voor versie 1 uit blijven.
5. Maak het project aan.

## 2. Web App Toevoegen

1. Open het Firebase-project.
2. Klik op het web-icoon `</>`.
3. Registreer een web app, bijvoorbeeld met de naam `zorgplanner-web`.
4. Firebase Hosting hoeft niet aan, omdat we GitHub Pages willen gebruiken.
5. Kopieer de `firebaseConfig`. Die hebben we nodig om de app te koppelen.

## 3. Firestore Aanzetten

1. Ga links naar **Build**.
2. Kies **Firestore Database**.
3. Klik **Create database**.
4. Kies een regio dichtbij Nederland/Europa als die optie beschikbaar is.
5. Start bij voorkeur in test mode tijdens ontwikkeling.
6. Voor echte uitrol moeten de security rules aangescherpt worden.

## 4. Email/Password Authentication Aanzetten

1. Ga links naar **Build**.
2. Kies **Authentication**.
3. Ga naar **Sign-in method**.
4. Zet **Email/Password** aan.
5. Sla op.

## 5. Gegevens Die Codex Nodig Heeft

Plak later de Firebase web config in de chat, bijvoorbeeld:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Deze config is bedoeld voor de frontend en is op zichzelf geen geheim. De beveiliging komt uit Firebase Authentication en Firestore Security Rules.

## 6. Wachtwoordtoegang

De app gebruikt Firebase Email/Password Authentication zonder dat de gebruiker een e-mailadres hoeft te weten.
De app maakt uit de familielink zelf een verborgen e-mailadres.

Voorbeeld:

```text
?family=development-family
```

wordt:

```text
development-family@zorgplanner.local
```

Maak in Firebase Authentication een gebruiker aan met dat e-mailadres en het gedeelde wachtwoord:

1. Ga naar **Authentication**.
2. Ga naar **Users**.
3. Klik **Add user**.
4. Vul het verborgen familie-e-mailadres in.
5. Vul het gedeelde wachtwoord in.

## 7. Deploy

Rules:

```bash
npx firebase deploy --only firestore:rules
```

Website:

```bash
npm run build
npx firebase deploy --only hosting
```

## Huidige Status

De app gebruikt nu Firebase via npm modules:

- `firebase-config.js` bevat de Firebase web config.
- `app.js` meldt aan met Firebase Email/Password Authentication.
- Mensen en afspraken worden gelezen en geschreven in Cloud Firestore.
- Een familielink kan via `?family=...` of `#/familie/...`.
- Het wachtwoordscherm gebruikt een verborgen familie-e-mailadres op basis van de family-id.
- `firestore.rules` staat alleen toegang toe aan de juiste familiegebruiker.
- De standaard familie-id is voorlopig `development-family`.

Voorbeeld:

```text
http://127.0.0.1:4173/?family=testfamilie
```

Voordat dit echt gedeeld wordt, moet de verborgen familiegebruiker bestaan en moeten `firestore.rules` live gedeployed zijn.
