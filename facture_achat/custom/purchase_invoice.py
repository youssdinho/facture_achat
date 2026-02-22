"""
Purchase Invoice Customizations - Amanatem
    v1.2.0 : Suppression affichage enrichi dropdown → retour affichage par défaut
"""

import frappe
from frappe import _


def set_default_update_stock(doc, method=None):
	if doc.is_new() and not doc.amended_from:
		doc.update_stock = 1


def validate_duplicate_bill_no(doc, method=None):
	"""
	Bloque l'enregistrement si un autre Purchase Invoice
	du même fournisseur possède déjà le même N° de facture fournisseur (bill_no).
	Statuts ignorés : Cancelled.
	"""
	if not doc.bill_no or not doc.supplier:
		return

	existing = frappe.db.get_value(
		"Purchase Invoice",
		{
			"supplier": doc.supplier,
			"bill_no": doc.bill_no,
			"docstatus": ["!=", 2],
			"name": ["!=", doc.name],
		},
		["name", "bill_date"],
		as_dict=True,
	)

	if existing:
		frappe.throw(
			_(
				"⚠️ Le fournisseur <b>{0}</b> possède déjà une facture avec le N° <b>{1}</b> : "
				'<a href="/app/purchase-invoice/{2}">{2}</a>'
			).format(doc.supplier, doc.bill_no, existing.name),
			title=_("N° de Facture Dupliqué"),
		)


@frappe.whitelist()
def check_duplicate_bill_no(supplier, bill_no, current_name=""):
	"""
	Vérifie en temps réel si le N° de facture fournisseur existe déjà pour ce supplier.
	"""
	if not supplier or not bill_no:
		return {"duplicate": False}

	filters = {
		"supplier": supplier,
		"bill_no": bill_no,
		"docstatus": ["!=", 2],
	}
	if current_name:
		filters["name"] = ["!=", current_name]

	existing = frappe.db.get_value("Purchase Invoice", filters, "name")

	if existing:
		return {"duplicate": True, "existing_doc": existing}

	return {"duplicate": False}
