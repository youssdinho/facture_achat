"""
Purchase Invoice Customizations - Amanatem
	v1.3.2 : Sync titre depuis fournisseur (before_save)
"""

import frappe
from frappe import _

logger = frappe.logger("facture_achat")


def sync_title_from_supplier(doc, method=None):
	if doc.supplier:
		supplier_name = frappe.db.get_value("Supplier", doc.supplier, "supplier_name")
		logger.info(f"sync_title_from_supplier | supplier={doc.supplier} | fetched={supplier_name} | current_title={doc.title}")
		if supplier_name:
			doc.supplier_name = supplier_name
			doc.title = supplier_name


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
def migrate_sync_titles():
	"""Migration : synchronise le titre de toutes les Purchase Invoice existantes."""
	invoices = frappe.db.sql("""
		SELECT pi.name, pi.title, s.supplier_name
		FROM `tabPurchase Invoice` pi
		LEFT JOIN `tabSupplier` s ON s.name = pi.supplier
		WHERE pi.supplier IS NOT NULL AND pi.supplier != ''
	""", as_dict=True)

	updated = 0
	skipped = 0
	for inv in invoices:
		if inv.supplier_name and inv.title != inv.supplier_name:
			frappe.db.set_value("Purchase Invoice", inv.name, {
				"title": inv.supplier_name,
				"supplier_name": inv.supplier_name
			}, update_modified=False)
			updated += 1
		else:
			skipped += 1

	frappe.db.commit()
	return f"Terminé : {updated} mises à jour, {skipped} déjà correctes."


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


@frappe.whitelist()
def search_item(doctype, txt, searchfield, start, page_len, filters):
	"""
	Recherche multi-mots sur item_code + item_name.
	Exemple : "BB C AA" → articles contenant BB ET C ET AA (ordre libre).
	"""
	txt = txt or ""
	words = [w.strip() for w in txt.split() if w.strip()]
	if not words:
		words = [txt] if txt else []

	if not words:
		results = frappe.db.sql(
			"""
			SELECT item_code, item_name
			FROM `tabItem`
			WHERE disabled = 0
			ORDER BY item_code
			LIMIT %s OFFSET %s
			""",
			(int(page_len), int(start)),
		)
		return results

	conditions = []
	values = []
	for word in words:
		conditions.append("(item_code LIKE %s OR item_name LIKE %s)")
		values.extend([f"%{word}%", f"%{word}%"])

	where_clause = " AND ".join(conditions)

	results = frappe.db.sql(
		f"""
		SELECT item_code, item_name
		FROM `tabItem`
		WHERE disabled = 0
		  AND ({where_clause})
		ORDER BY
			CASE WHEN item_code LIKE %s THEN 0 ELSE 1 END,
			item_code
		LIMIT %s OFFSET %s
		""",
		values + [f"{txt}%", int(page_len), int(start)],
	)
	return results
