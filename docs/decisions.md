# Zorgplanner Beslissingen

Dit document legt de keuzes vast voor de eerste uitrol van de Zorgplanner.

## Doel

De app is een gedeelde familieplanner voor ziekenhuisafspraken. De app bevat bewust geen medische details. Het doel is overzicht: wanneer is een afspraak, waar is die, wie gaat mee, en wat zijn praktische notities.

## Gebruikers

- Moeder gebruikt vooral de grote leesweergave.
- Familieleden gebruiken vooral de normale beheerweergave.
- We houden het op basis van vertrouwen; we hoeven niet te weten welke persoon welke wijziging heeft gedaan.

## Interface

- De interface is Nederlands.
- De code blijft Engels.
- De app is mobile-first.
- De grote leesweergave is bedoeld voor zeer slecht zicht en maximale tekstgrootte op iPhone.
- In de grote leesweergave zijn beheerpanelen verborgen.
- In de grote leesweergave blijven afspraken en voorleesknoppen zichtbaar.
- In de normale weergave zijn beheerfuncties zichtbaar en compacter.

## Toegang

Voor versie 1 gebruiken we:

- Een unieke, lange familielink.
- Een gedeeld wachtwoord voor die planning.
- Geen individuele accounts.
- Geen vastlegging van wie een wijziging doet.

De unieke link alleen is niet genoeg beveiliging. Het wachtwoord zorgt ervoor dat iemand die de URL raadt niet direct toegang heeft.

## Hosting

- GitHub Pages host de statische website.
- De repository kan later publiek of privé worden gekozen.
- Een eigen domein is niet nodig voor versie 1.

## Backend

- Firebase wordt de backend.
- Cloud Firestore bewaart families, mensen, afspraken en aanwezigheid.
- Firebase Email/Password Authentication gebruikt per familie een verborgen gedeelde gebruiker.
- De app maakt uit de familielink automatisch het verborgen e-mailadres.

## Data

We bewaren:

- Familie-id.
- Familienaam of label.
- Familieleden/personen.
- Afspraken.
- Aanwezigheidsstatus per persoon per afspraak.
- Praktische notities.

We bewaren niet:

- Diagnose.
- Uitslagen.
- Behandelgegevens.
- Medicatie.
- Medische verslagen.

## Herinneringen

Voor versie 1 doen we nog geen push-, e-mail- of WhatsApp-herinneringen. Eerst tonen we afspraken duidelijk in de app. Later kunnen echte herinneringen worden toegevoegd.

## Eerste Technische Route

1. Firebase-project aanmaken.
2. Web app registreren in Firebase.
3. Cloud Firestore aanzetten.
4. Email/Password Authentication aanzetten.
5. App ombouwen van `localStorage` naar Firestore.
6. Familielink en wachtwoordscherm toevoegen.
7. Firestore Security Rules deployen.
8. Hosting deployen.
9. Testen op iPhone met grote tekstinstellingen.
