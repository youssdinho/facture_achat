// Facture Achat Customizations - Amanatem
// v1.3.0
// Navigation : Fournisseur → N° Facture Fournisseur → Article → Qté → Prix → ligne suivante
// Recherche multi-mots sur item_code / item_name

frappe.ui.form.on('Purchase Invoice', {
	setup: function(frm) {
		if (frm.is_new() && !frm.doc.amended_from) {
			frm.doc.update_stock = 1;
		}
	},

	onload: function(frm) {
		inject_dropdown_styles();
		attach_grid_delegation(frm);
	},

	refresh: function(frm) {
		inject_dropdown_styles();

		// Recherche multi-mots sur item_code
		frm.fields_dict['items'].grid.get_field('item_code').get_query = function() {
			return {
				query: 'facture_achat.custom.purchase_invoice.search_item'
			};
		};

		if (frm.is_new() && !frm.doc.amended_from) {
			frm.set_value('update_stock', 1);
			if (!frm.doc.supplier) {
				setTimeout(function() {
					frm.fields_dict.supplier.set_focus();
				}, 500);
			}
		}

		attach_grid_delegation(frm);
		attach_bill_no_enter(frm);
	},

	// Fournisseur sélectionné → focus sur N° Facture Fournisseur
	supplier: function(frm) {
		if (frm.doc.supplier) {
			setTimeout(function() {
				if (frm.fields_dict.bill_no) {
					frm.fields_dict.bill_no.set_focus();
					attach_bill_no_enter(frm);
				}
			}, 400);
		}
	},

	validate: function(frm) {
		if (!frm.doc.bill_no) {
			frappe.msgprint({
				title: __('Champ obligatoire'),
				indicator: 'orange',
				message: __('Veuillez saisir le N° de Facture Fournisseur.')
			});
		}
	}
});

frappe.ui.form.on('Purchase Invoice Item', {
	items_add: function(frm, cdt, cdn) {}
});

// ─────────────────────────────────────────────────────────────────
// KEYDOWN SUR BILL_NO — navigation uniquement sur ENTRÉE
// ─────────────────────────────────────────────────────────────────

function attach_bill_no_enter(frm) {
	const $field = frm.fields_dict.bill_no && frm.fields_dict.bill_no.$input;
	if (!$field || !$field.length) return;

	$field.off('keydown.fa_bill_no');

	$field.on('keydown.fa_bill_no', function(e) {
		if (e.keyCode !== 13 && e.which !== 13) return;

		const bill_no = $field.val().trim();
		if (!bill_no) return;

		e.preventDefault();
		e.stopPropagation();

		validate_bill_no_unique(frm, bill_no, function() {
			setTimeout(() => focusOnInlineItemCode(frm), 300);
		});
	});
}

// ─────────────────────────────────────────────────────────────────
// VALIDATION UNICITÉ N° FACTURE FOURNISSEUR
// ─────────────────────────────────────────────────────────────────

function validate_bill_no_unique(frm, bill_no, on_success) {
	if (!bill_no || !frm.doc.supplier) {
		if (on_success) on_success();
		return;
	}

	frappe.call({
		method: 'facture_achat.custom.purchase_invoice.check_duplicate_bill_no',
		args: {
			supplier: frm.doc.supplier,
			bill_no: bill_no,
			current_name: frm.doc.name || ''
		},
		callback: function(r) {
			if (r.message && r.message.duplicate) {
				frappe.msgprint({
					title: __('N° de Facture Dupliqué'),
					indicator: 'red',
					message: __(
						'⚠️ Le fournisseur <b>{0}</b> a déjà une facture avec le N° <b>{1}</b> : {2}',
						[frm.doc.supplier, bill_no, r.message.existing_doc]
					)
				});
				frm.set_value('bill_no', '');
				setTimeout(function() {
					if (frm.fields_dict.bill_no) {
						frm.fields_dict.bill_no.set_focus();
						attach_bill_no_enter(frm);
					}
				}, 300);
			} else {
				frm.set_value('bill_no', bill_no);
				if (on_success) on_success();
			}
		}
	});
}

// ─────────────────────────────────────────────────────────────────
// DÉLÉGATION D'ÉVÉNEMENTS GRID
// ─────────────────────────────────────────────────────────────────

function attach_grid_delegation(frm) {
	const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
	if (!grid || !grid.wrapper) return;

	const $wrapper = $(grid.wrapper);
	$wrapper.off('keydown.fa_navigation');

	$wrapper.on('keydown.fa_navigation', 'input', function(e) {
		if (e.keyCode !== 13 && e.which !== 13) return;

		const $input = $(this);
		const $cell = $input.closest('[data-fieldname]');
		const fieldname = $cell.attr('data-fieldname');
		const $row = $input.closest('.grid-row[data-idx]');
		if (!$row.length) return;

		const rowIndex = parseInt($row.attr('data-idx')) - 1;

		const $awesomplete = $input.siblings('ul.awesomplete, ul');
		if ($awesomplete.length && $awesomplete.is(':visible')) return;

		switch (fieldname) {
			case 'item_code':
				e.preventDefault();
				e.stopPropagation();
				setTimeout(() => focusField(frm, rowIndex, 'qty'), 200);
				break;

			case 'qty':
				e.preventDefault();
				e.stopPropagation();
				save_field_value(frm, rowIndex, 'qty', $input.val());
				setTimeout(() => focusField(frm, rowIndex, 'rate'), 150);
				break;

			case 'rate':
				e.preventDefault();
				e.stopPropagation();
				save_field_value(frm, rowIndex, 'rate', $input.val());
				if (frm.doc.items && frm.doc.items[rowIndex + 1]) {
					setTimeout(() => clickAndFocusCell(frm, rowIndex + 1, 'item_code'), 150);
				} else {
					setTimeout(() => addNewRowAndFocusItemCode(frm), 150);
				}
				break;
		}
	});
}

// ─────────────────────────────────────────────────────────────────
// FOCUS ROBUSTE
// ─────────────────────────────────────────────────────────────────

function focusField(frm, rowIndex, fieldname) {
	const grid = frm.fields_dict.items.grid;
	let done = false;

	if (grid && grid.grid_rows && grid.grid_rows[rowIndex]) {
		const row = grid.grid_rows[rowIndex];
		if (row.on_grid_fields_dict && row.on_grid_fields_dict[fieldname]) {
			const field = row.on_grid_fields_dict[fieldname];
			if (field && field.$input) {
				field.$input.focus();
				setTimeout(() => { field.$input.select(); flash_border(field.$input); }, 20);
				done = true;
			}
		}
	}

	if (!done) {
		const $input = $(`.grid-body .grid-row[data-idx="${rowIndex + 1}"] [data-fieldname="${fieldname}"] input`);
		if ($input.length) {
			$input.focus();
			setTimeout(() => { $input.select(); flash_border($input); }, 20);
			done = true;
		}
	}

	return done;
}

function save_field_value(frm, rowIndex, fieldname, inputVal) {
	const currentRow = frm.doc.items && frm.doc.items[rowIndex];
	if (!currentRow) return;
	const val = flt(inputVal);
	if (val && val !== flt(currentRow[fieldname])) {
		frappe.model.set_value(currentRow.doctype, currentRow.name, fieldname, val);
	}
}

function addNewRowAndFocusItemCode(frm) {
	try {
		frm.add_child('items');
		frm.refresh_field('items');
		const newIndex = frm.doc.items.length - 1;
		setTimeout(() => {
			const $cell = $(`.grid-body .grid-row[data-idx="${newIndex + 1}"] [data-fieldname="item_code"]`);
			if ($cell.length) {
				$cell.click();
				setTimeout(() => {
					const $input = $cell.find('input');
					if ($input.length) { $input.focus().select(); flash_border($input); }
				}, 50);
			} else {
				focusField(frm, newIndex, 'item_code');
			}
		}, 120);
	} catch (err) {
		console.error('Erreur ajout nouvelle ligne:', err);
	}
}

function focusOnInlineItemCode(frm) {
	if (!frm.fields_dict.items) return;
	const hasItems = frm.doc.items && frm.doc.items.length > 0;
	if (!hasItems) {
		frm.add_child('items');
		frm.refresh_field('items');
		setTimeout(() => { clickAndFocusCell(frm, 0, 'item_code'); }, 120);
	} else {
		setTimeout(() => { clickAndFocusCell(frm, 0, 'item_code'); }, 80);
	}
}

function clickAndFocusCell(frm, rowIndex, fieldname) {
	const $cell = $(`.grid-body .grid-row[data-idx="${rowIndex + 1}"] [data-fieldname="${fieldname}"]`);
	if ($cell.length) {
		$cell.click();
		setTimeout(() => {
			const $input = $cell.find('input');
			if ($input.length) { $input.focus().select(); flash_border($input); }
		}, 40);
	} else {
		focusField(frm, rowIndex, fieldname);
	}
}

function flash_border($el) {
	$el.css('border', '2px solid #4CAF50');
	setTimeout(() => $el.css('border', ''), 600);
}

// ─────────────────────────────────────────────────────────────────
// STYLES DROPDOWN AWESOMPLETE
// ─────────────────────────────────────────────────────────────────

function inject_dropdown_styles() {
	const style_id = 'facture-achat-dropdown-style';
	if (document.getElementById(style_id)) return;
	const style = document.createElement('style');
	style.id = style_id;
	style.innerHTML = `
		.grid-row .awesomplete ul, .awesomplete ul {
			min-width: 400px !important; max-width: 700px !important;
			max-height: 85vh !important; overflow-y: auto !important;
			z-index: 9999 !important; box-shadow: 0 6px 24px rgba(0,0,0,0.18) !important;
			border-radius: 6px !important; border: 1px solid #d1d8dd !important;
			background: #fff !important;
		}
		.grid-row .awesomplete ul li, .awesomplete ul li {
			padding: 7px 14px !important; line-height: 1.6 !important;
			border-bottom: 1px solid #f0f0f0 !important;
			cursor: pointer !important;
		}
		.grid-row .awesomplete ul li:hover,
		.grid-row .awesomplete ul li[aria-selected="true"],
		.awesomplete ul li:hover, .awesomplete ul li[aria-selected="true"] {
			background: #f0f4ff !important;
		}
	`;
	document.head.appendChild(style);
}
