app_name = "facture_achat"
app_title = "Facture Achat Customizations"
app_publisher = "Amanatem"
app_description = "Customizations for Purchase Invoice - Amanatem"
app_email = "me@gmail.com"
app_license = "mit"

# ─────────────────────────────────────────────────────────────────
# DOC EVENTS
# ─────────────────────────────────────────────────────────────────
doc_events = {
    "Purchase Invoice": {
        "onload": "facture_achat.custom.purchase_invoice.set_default_update_stock",
        "validate": "facture_achat.custom.purchase_invoice.validate_duplicate_bill_no",
    }
}

# ─────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────
fixtures = [
    {
        "dt": "Custom Field",
        "filters": [["module", "=", "Facture Achat"]]
    },
    {
        "dt": "Property Setter",
        "filters": [["module", "=", "Facture Achat"]]
    },
    {
        "dt": "Client Script",
        "filters": [["module", "=", "Facture Achat"]]
    },
]

# ─────────────────────────────────────────────────────────────────
# JAVASCRIPT PERSONNALISÉ
# ─────────────────────────────────────────────────────────────────
doctype_js = {
    "Purchase Invoice": "public/js/purchase_invoice.js"
}
