## [1.3.2] — 2026-04-04

### Ajouté
- **Précision 6 décimales sur le prix unitaire** : le champ `rate` (prix unitaire) dans les lignes de facture achat accepte désormais jusqu'à 6 chiffres après la virgule
  - Implémenté via Property Setter (`Purchase Invoice Item-rate-precision = 6`)
  - Effet limité à la Facture Achat uniquement — aucun impact sur le reste du système

## [1.3.1] — 2026-03-11

### Corrigé
- **Fix décorateur** : suppression de `@frappe.validate_and_sanitize_search_input` non disponible sur cette version de Frappe
- Fonction `search_item` opérationnelle sans ce décorateur (sécurité gérée par Frappe en amont)

## [1.3.0] — 2026-03-11

### Ajouté
- **Recherche multi-mots** : réintégration de `search_item` (Python whitelisted)
  - Exemple : taper "BB C AA" retrouve les articles contenant BB ET C ET AA (ordre libre)
  - Recherche sur `item_code` ET `item_name` simultanément
- **get_query** rebranché sur `item_code` dans le JS (refresh)

### Supprimé (depuis v1.2.0, corrigé ici)
- La suppression de `search_item` en v1.2.0 avait cassé la recherche intelligente multi-mots

## [1.2.0] — 2026-02-22

### Modifié
- **Dropdown Article** : suppression de l'affichage enrichi (Stock coloré, PA, PMP)
  → retour à l'affichage par défaut ERPNext (item_code + item_name)
- **Suppression** de la fonction `search_item` (Python) et de `setup_html_rendering` (JS)
- **Suppression** de la `get_query` personnalisée sur `item_code`

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
