# Zorgplanner

Een kleine Nederlandstalige plannapplicatie voor ziekenhuisafspraken.

## Wat werkt nu

- Afspraken toevoegen, bewerken en verwijderen.
- Genodigden toevoegen aan de planner.
- Type afspraak en ziekenhuis kiezen uit een vaste lijst.
- Datum, tijd, bronziekenhuis, locatie, behandelaar en praktische notities vastleggen.
- Per genodigde aangeven: nog niet ingevuld, gaat mee of gaat niet mee.
- Afspraken filteren op komend, geschiedenis of alle.
- Mobile-first interface: op telefoons staat het afsprakenoverzicht bovenaan.
- Een extra grote leesmodus met zwarte tekst op een lichtgele achtergrond.
- Voorleesknop voor de eerstvolgende afspraak via de browserstem.
- Elke afspraak kan ook los worden voorgelezen.
- Ontworpen voor zeer grote tekstinstellingen op iPhone: liever meer scrollen dan te kleine of afgeknelde tekst.
- Gedeelde opslag in Cloud Firestore.
- Toegang via een unieke familielink en gedeeld wachtwoord.
- In extra grote leesmodus zijn beheerpanelen verborgen, zodat de app alleen op kijken en voorlezen focust.

## Lokaal openen

Deze versie gebruikt Firebase via npm modules. Gebruik daarom niet meer direct `file://index.html`.

Installeren:

```bash
npm install
```

Productieversie bouwen:

```bash
npm run build
```

Gebouwde versie lokaal bekijken:

```bash
npm run preview
```

De preview draait standaard op een lokale URL zoals `http://127.0.0.1:4173/`.

Een familieplanning open je met een family-id in de URL:

```text
http://127.0.0.1:4173/?family=testfamilie
```

Zonder family-id gebruikt de app `development-family`.

## Toegang en beveiliging

De app gebruikt:

- Firebase Email/Password Authentication met een verborgen gedeelde familiegebruiker.
- Een gedeeld wachtwoord per familieplanning.
- Firestore Security Rules die alleen de juiste familiegebruiker toegang geven tot de eigen familieplanning.

Voor `development-family` maakt de app automatisch dit verborgen e-mailadres:

```text
development-family@zorgplanner.local
```

Voor een link zoals `?family=familie-jansen` wordt dat:

```text
familie-jansen@zorgplanner.local
```

Maak deze gebruiker aan in Firebase Console:

- Ga naar **Authentication**.
- Zet **Email/Password** aan bij **Sign-in method**.
- Ga naar **Users**.
- Klik **Add user**.
- Gebruik het verborgen familie-e-mailadres en het gedeelde wachtwoord.

Clientdata staat in:

```text
families/{familyId}
families/{familyId}/people/{personId}
families/{familyId}/appointments/{appointmentId}
```

## Firebase deploy voorbereiden

De Firebase CLI staat als dev dependency in dit project. Log in met:

```bash
npx firebase login
```

Dependencies installeren:

```bash
npm install
```

Rules deployen:

```bash
npx firebase deploy --only firestore:rules
```

## GitHub Pages deploy

De site wordt via GitHub Actions naar GitHub Pages gedeployed.

1. Push naar `master`.
2. Ga in GitHub naar **Settings**.
3. Ga naar **Pages**.
4. Kies bij **Build and deployment** voor **GitHub Actions**.
5. Wacht tot de workflow **Deploy GitHub Pages** klaar is.

De URL wordt normaal:

```text
https://gijsprins.github.io/zorgplanner/
```

Een familieplanning open je dan met:

```text
https://gijsprins.github.io/zorgplanner/?family=familie-jansen
```

Voeg in Firebase Authentication bij **Settings** > **Authorized domains** dit domein toe:

```text
gijsprins.github.io
```

## Belangrijke vervolgstappen

- Een echte family-id en gedeeld wachtwoord kiezen.
- De verborgen familiegebruiker aanmaken in Firebase Authentication.
- Firestore Rules deployen.
- De website deployen naar GitHub Pages.
- Bepalen hoe herinneringen worden verstuurd: e-mail, pushmelding, WhatsApp of alleen in de app.
- Kalenderexport of rolverdeling toevoegen.

## Naslag

- Zie `docs/decisions.md` voor de gemaakte product- en technische keuzes.
- Zie `docs/firebase-setup.md` voor de Firebase setup-stappen.
