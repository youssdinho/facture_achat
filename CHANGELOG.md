## [1.1.1] — 2026-02-21

### Modifié
- **Curseur bill_no** : le curseur ne quitte plus le champ N° Facture Fournisseur automatiquement — il attend explicitement la touche **ENTRÉE** avant de passer à l'Article (fix bug déclenchement prématuré via événement Frappe)
- **Validation unicité N° Facture** : un même fournisseur ne peut pas avoir deux factures avec le même N° de Facture Fournisseur (bill_no) — vérification en temps réel (JS) et blocage à l'enregistrement (Python)
- **Flux curseur complet** : Fournisseur → N° Facture Fournisseur → [ENTRÉE] → Article → Qté → Prix → ligne suivante


## [1.0.0] — 2026-02-17

### Ajouté
- **Purchase Invoice — Toutes les fonctionnalités de facture_vente adaptées** :
  - `update_stock` coché par défaut sur nouvelle Facture d'Achat
  - Curseur automatique sur `supplier` à l'ouverture
  - Fournisseur sélectionné → curseur sur `item_code` de la ligne 1
  - Navigation clavier : item_code → qty → rate → ligne suivante / nouvelle ligne
  - Délégation d'événements robuste (fonctionne après enregistrement, réorganisation colonnes)
  - Recherche article multi-mots (Python whitelisted)
  - Affichage enrichi : item_name, Stock (coloré), PA (prix achat Standard Buying), PMP
  - Dropdown awesomplete élargi : 600px–900px, 85vh, 50 articles
  - HTML rendering dans awesomplete (couleurs stock)
  - Indicateur visuel bordure verte sur champ actif
