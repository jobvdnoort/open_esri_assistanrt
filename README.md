# Open Esri Assistant

Portaal-browser voor ArcGIS Online / Enterprise, geïnspireerd op ArcGIS Assistant — met een extra workflow om **groepen en lagen tussen webmaps te kopiëren zonder JSON te bewerken**.

## Wat kun je ermee?

- Inloggen op ArcGIS Online of een Enterprise-portal
- Content zoeken en items openen
- Item-metadata en item-data JSON bekijken
- Webmap-lagen als boom bekijken
- **Twee webmaps naast elkaar openen** en groepen/lagen over en weer kopiëren
- Wijzigingen terugschrijven naar het portaal (of lokaal in demomodus)

## Snel starten

```bash
npm install
npm run dev
```

Open de getoonde URL. Kies **Probeer demomodus** om zonder portal te testen, of log in met je portal-credentials.

## Workflow: groep verplaatsen / kopiëren

1. Ga naar **Inhoud**, selecteer één of twee Web Maps, klik **Vergelijk webmaps**
2. Of open **Vergelijk** in de navigatie en kies links/rechts een webmap
3. Selecteer een groep of laag
4. Klik **→** / **←** (of de knoppen *Links → rechts* / *Rechts → links*)
5. Optioneel: selecteer op de doelkaart een **groep** om erín te plakken; anders landt de kopie op root-niveau
6. Klik **Opslaan** op de gewijzigde kant

Layer-`id`s worden automatisch vernieuwd om conflicten te voorkomen.

## Scripts

| Command | Beschrijving |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Productie-build |
| `npm test` | Unit tests (webmap helpers) |
| `npm run lint` | Lint |

## Tech

- React + Vite + TypeScript
- [`@esri/arcgis-rest-request`](https://developers.arcgis.com/arcgis-rest-js/) + `@esri/arcgis-rest-portal`
- Token-login via `ArcGISIdentityManager.signIn`
