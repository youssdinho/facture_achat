"""
Purchase Invoice Customizations - Amanatem
    v1.1.1 : Fix curseur bill_no → item uniquement sur ENTRÉE
"""

import frappe
from frappe import _
from frappe.utils import cstr


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


@frappe.whitelist()
def search_item(doctype, txt, searchfield, start, page_len, filters):
	search_text = cstr(txt).strip().lower()
	words = [w for w in search_text.split() if len(w) >= 1]

	page_len = max(int(page_len or 50), 50)

	base_query = """
		SELECT
			i.name,
			CONCAT(
				i.item_name,
				', ',
				CASE
					WHEN COALESCE(SUM(b.actual_qty), 0) > 0 THEN
						CONCAT('<span style="color:#00a65a;font-weight:bold;">Stock: ', ROUND(COALESCE(SUM(b.actual_qty), 0), 2), '</span>')
					WHEN COALESCE(SUM(b.actual_qty), 0) < 0 THEN
						CONCAT('<span style="color:#dd4b39;font-weight:bold;">Stock: ', ROUND(COALESCE(SUM(b.actual_qty), 0), 2), '</span>')
					ELSE
						CONCAT('Stock: ', ROUND(COALESCE(SUM(b.actual_qty), 0), 2))
				END,
				', PA: ',
				ROUND(COALESCE(
					(SELECT ip.price_list_rate
					 FROM `tabItem Price` ip
					 WHERE ip.item_code = i.name
					   AND ip.buying = 1
					   AND ip.price_list = 'Standard Buying'
					 LIMIT 1),
					0
				), 2),
				', PMP: ',
				ROUND(COALESCE(i.valuation_rate, 0), 2)
			) as display_text
		FROM `tabItem` i
		LEFT JOIN `tabBin` b ON b.item_code = i.name
		WHERE i.disabled = 0
	"""

	if not words:
		sql = (
			base_query
			+ """
			AND (LOWER(i.name) LIKE %s OR LOWER(i.item_name) LIKE %s)
			GROUP BY i.name
			ORDER BY i.name
			LIMIT %s OFFSET %s
		"""
		)
		return frappe.db.sql(sql, (f"%{txt}%", f"%{txt}%", page_len, start))

	conditions = []
	params = []

	for word in words:
		conditions.append(
			"(LOWER(i.name) LIKE %s OR LOWER(i.item_name) LIKE %s OR LOWER(IFNULL(i.description,'')) LIKE %s)"
		)
		params.extend([f"%{word}%", f"%{word}%", f"%{word}%"])

	where_clause = " AND ".join(conditions)
	sql = (
		base_query
		+ f"""
		AND {where_clause}
		GROUP BY i.name
		ORDER BY i.name
		LIMIT %s OFFSET %s
	"""
	)
	params.extend([page_len, start])

	return frappe.db.sql(sql, params)
