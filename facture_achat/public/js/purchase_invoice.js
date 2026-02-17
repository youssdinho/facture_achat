// Facture Achat Customizations - Amanatem
// v1.0.0 : Toutes les fonctionnalités de facture_vente adaptées pour Purchase Invoice
// Navigation clavier robuste via délégation d'événements
// Fonctionne dans TOUS les cas : nouveau doc, après enregistrement,
// après réorganisation des colonnes, retour sur doc existant, etc.

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

		if (frm.is_new() && !frm.doc.amended_from) {
			frm.set_value('update_stock', 1);
			// Si pas encore de fournisseur → focus sur supplier
			if (!frm.doc.supplier) {
				setTimeout(function() {
					frm.fields_dict.supplier.set_focus();
				}, 500);
			}
		}

		// Configuration de la recherche personnalisée
		frm.fields_dict['items'].grid.get_field('item_code').get_query = function() {
			return {
				query: 'facture_achat.custom.purchase_invoice.search_item',
				page_len: 50
			};
		};

		// Setup HTML rendering pour awesomplete
		setup_html_rendering(frm);

		// (Ré)attacher la délégation à chaque refresh
		attach_grid_delegation(frm);
	},

	// Événement sur le champ fournisseur (équivalent de "customer" dans facture_vente)
	supplier: function(frm) {
		if (frm.doc.supplier) {
			setup_html_rendering(frm);
			setTimeout(() => focusOnInlineItemCode(frm), 600);
		}
	}
});

frappe.ui.form.on('Purchase Invoice Item', {
	items_add: function(frm, cdt, cdn) {
		// Rien à faire, la délégation gère les nouvelles lignes automatiquement
	}
});

// ─────────────────────────────────────────────────────────────────
// DÉLÉGATION D'ÉVÉNEMENTS — cœur de la solution
// Un seul listener sur le conteneur stable du grid.
// Capte les keydown peu importe si les inputs sont recréés.
// ─────────────────────────────────────────────────────────────────

function attach_grid_delegation(frm) {
	const grid = frm.fields_dict.items && frm.fields_dict.items.grid;
	if (!grid || !grid.wrapper) return;

	const $wrapper = $(grid.wrapper);

	// Supprimer l'ancien listener pour éviter les doublons
	$wrapper.off('keydown.fa_navigation');

	// Attacher UN listener délégué sur tout le grid
	$wrapper.on('keydown.fa_navigation', 'input', function(e) {
		if (e.keyCode !== 13 && e.which !== 13) return;

		const $input = $(this);
		const $cell = $input.closest('[data-fieldname]');
		const fieldname = $cell.attr('data-fieldname');
		const $row = $input.closest('.grid-row[data-idx]');
		if (!$row.length) return;

		const rowIndex = parseInt($row.attr('data-idx')) - 1; // 0-based

		// Ignorer si le dropdown awesomplete est ouvert et visible
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
				// Si une ligne suivante existe → aller sur son item_code
				// Sinon → ajouter une nouvelle ligne
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
// FOCUS ROBUSTE sur un champ d'une ligne donnée
// Essaie d'abord via l'API Frappe, puis via jQuery/DOM
// ─────────────────────────────────────────────────────────────────

function focusField(frm, rowIndex, fieldname) {
	const grid = frm.fields_dict.items.grid;
	let done = false;

	// Tentative 1 : via grid_rows de Frappe
	if (grid && grid.grid_rows && grid.grid_rows[rowIndex]) {
		const row = grid.grid_rows[rowIndex];
		if (row.on_grid_fields_dict && row.on_grid_fields_dict[fieldname]) {
			const field = row.on_grid_fields_dict[fieldname];
			if (field && field.$input) {
				field.$input.focus();
				setTimeout(() => {
					field.$input.select();
					flash_border(field.$input);
				}, 20);
				done = true;
			}
		}
	}

	// Tentative 2 : via DOM
	if (!done) {
		const $input = $(`.grid-body .grid-row[data-idx="${rowIndex + 1}"] [data-fieldname="${fieldname}"] input`);
		if ($input.length) {
			$input.focus();
			setTimeout(() => {
				$input.select();
				flash_border($input);
			}, 20);
			done = true;
		}
	}

	return done;
}

// ─────────────────────────────────────────────────────────────────
// SAUVEGARDER la valeur d'un champ si elle a changé
// ─────────────────────────────────────────────────────────────────

function save_field_value(frm, rowIndex, fieldname, inputVal) {
	const currentRow = frm.doc.items && frm.doc.items[rowIndex];
	if (!currentRow) return;

	const val = flt(inputVal);
	if (val && val !== flt(currentRow[fieldname])) {
		frappe.model.set_value(currentRow.doctype, currentRow.name, fieldname, val);
	}
}

// ─────────────────────────────────────────────────────────────────
// AJOUTER une nouvelle ligne et focus sur item_code
// ─────────────────────────────────────────────────────────────────

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
					if ($input.length) {
						$input.focus().select();
						flash_border($input);
					}
				}, 50);
			} else {
				focusField(frm, newIndex, 'item_code');
			}
		}, 120);
	} catch (err) {
		console.error('Erreur ajout nouvelle ligne:', err);
	}
}

// ─────────────────────────────────────────────────────────────────
// FOCUS initial sur item_code après sélection du fournisseur
// ─────────────────────────────────────────────────────────────────

function focusOnInlineItemCode(frm) {
	if (!frm.fields_dict.items) return;

	const hasItems = frm.doc.items && frm.doc.items.length > 0;

	if (!hasItems) {
		frm.add_child('items');
		frm.refresh_field('items');
		setTimeout(() => {
			clickAndFocusCell(frm, 0, 'item_code');
		}, 120);
	} else {
		setTimeout(() => {
			clickAndFocusCell(frm, 0, 'item_code');
		}, 80);
	}
}

function clickAndFocusCell(frm, rowIndex, fieldname) {
	const $cell = $(`.grid-body .grid-row[data-idx="${rowIndex + 1}"] [data-fieldname="${fieldname}"]`);
	if ($cell.length) {
		$cell.click();
		setTimeout(() => {
			const $input = $cell.find('input');
			if ($input.length) {
				$input.focus().select();
				flash_border($input);
			}
		}, 40);
	} else {
		focusField(frm, rowIndex, fieldname);
	}
}

// ─────────────────────────────────────────────────────────────────
// INDICATEUR VISUEL — bordure verte temporaire
// ─────────────────────────────────────────────────────────────────

function flash_border($el) {
	$el.css('border', '2px solid #4CAF50');
	setTimeout(() => $el.css('border', ''), 600);
}

// ─────────────────────────────────────────────────────────────────
// STYLES CSS — dropdown awesomplete élargi
// ─────────────────────────────────────────────────────────────────

function inject_dropdown_styles() {
	const style_id = 'facture-achat-dropdown-style';
	if (document.getElementById(style_id)) return;

	const style = document.createElement('style');
	style.id = style_id;
	style.innerHTML = `
		.grid-row .awesomplete ul,
		.awesomplete ul {
			min-width: 600px !important;
			max-width: 900px !important;
			max-height: 85vh !important;
			overflow-y: auto !important;
			z-index: 9999 !important;
			box-shadow: 0 6px 24px rgba(0,0,0,0.18) !important;
			border-radius: 6px !important;
			border: 1px solid #d1d8dd !important;
			background: #fff !important;
		}
		.grid-row .awesomplete ul li,
		.awesomplete ul li {
			padding: 7px 14px !important;
			line-height: 1.6 !important;
			border-bottom: 1px solid #f0f0f0 !important;
			cursor: pointer !important;
			white-space: nowrap !important;
		}
		.grid-row .awesomplete ul li:hover,
		.grid-row .awesomplete ul li[aria-selected="true"],
		.awesomplete ul li:hover,
		.awesomplete ul li[aria-selected="true"] {
			background: #f0f4ff !important;
		}
		.grid-row .awesomplete ul li mark,
		.awesomplete ul li mark {
			background: #fff3cd !important;
			font-weight: bold !important;
			padding: 0 !important;
		}
	`;
	document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────
// HTML RENDERING — awesomplete avec HTML + page_len 50
// ─────────────────────────────────────────────────────────────────

function setup_html_rendering(frm) {
	setTimeout(function() {
		let item_field = frm.fields_dict['items'].grid.get_field('item_code');
		if (!item_field) return;

		let original_setup = item_field.setup_awesomplete;

		item_field.setup_awesomplete = function() {
			if (original_setup) {
				original_setup.call(this);
			}
			let me = this;
			if (me.awesomplete) {
				me.awesomplete.item = function(text, input) {
					let html = input.trim() === ""
						? text
						: text.replace(RegExp(input.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"), "<mark>$&</mark>");
					return $.parseHTML("<li>" + html + "</li>")[0];
				};
				me.awesomplete.maxItems = 50;
			}
		};

		if (item_field.awesomplete) {
			item_field.awesomplete.maxItems = 50;
			item_field.setup_awesomplete();
		}
	}, 500);
}
