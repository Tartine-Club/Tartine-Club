# Tartine Club

Site du collectif de graphistes Tartine Club (Léa Dutarte & Maël Belviso, Toulouse).

## Voir les maquettes

- **Accueil actuel** (d'après la maquette UI Figma) : `explorations/accueil-v3.html`
- Anciennes versions : `explorations/accueil-b-carte.html` (piste B), `explorations/accueil-v2.html`
- Autres pistes explorées : `explorations/accueil-a-etiquette.html`, `explorations/accueil-c-table.html`
- Réglage du rendu de la tartine 3D : `explorations/test-grain.html`

En local, la 3D a besoin d'un petit serveur (elle ne se charge pas en double-cliquant sur le fichier) :

```bash
cd explorations && python3 -m http.server 8765
```

puis ouvrir http://127.0.0.1:8765/accueil-v3.html

## Où sont les choses

- `CLAUDE.md` : brief, direction artistique, décisions prises et ce qui reste à remplir
- `explorations/` : maquettes HTML/CSS/JS, la tartine 3D (three.js) et les visuels dans `assets/`
- La tartine 3D vient du fichier Blender `explorations/tartine_confiture.blend`, exportée en `explorations/assets/tartine.glb`
