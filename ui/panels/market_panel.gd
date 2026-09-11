extends PanelContainer

## Панель рынка материалов.

var _rows: Dictionary = {}


## Строит UI и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.market_updated.connect(_refresh)
	Signals.material_purchased.connect(func(_id, _qty): _refresh())
	Signals.game_reset.connect(_refresh)


## Создаёт таблицу материалов.
func _build_ui() -> void:
	var vbox := VBoxContainer.new()
	add_child(vbox)

	var title := Label.new()
	title.text = "=== Рынок (База Север) ==="
	vbox.add_child(title)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("h_separation", 8)
	header.add_child(_make_label("Материал", 150))
	header.add_child(_make_label("Цена", 140))
	header.add_child(_make_label("Остаток", 100))
	header.add_child(_make_label("Склад", 120))
	header.add_child(_make_label("Кол-во", 80))
	header.add_child(_make_label("", 80))
	vbox.add_child(header)

	for material_id in Database.get_all_material_ids():
		var row := HBoxContainer.new()
		row.add_theme_constant_override("h_separation", 8)
		var name_label := _make_label(Database.get_material_name(material_id), 150)
		var price_label := _make_label("0", 140)
		var stock_label := _make_label("0", 100)
		var inv_label := _make_label("0", 120)
		var qty_spin := SpinBox.new()
		qty_spin.min_value = 1
		qty_spin.max_value = 999
		qty_spin.value = 10
		qty_spin.custom_minimum_size = Vector2(80, 0)

		var buy_btn := Button.new()
		buy_btn.text = "Купить"
		buy_btn.pressed.connect(_on_buy_pressed.bind(material_id, qty_spin))

		row.add_child(name_label)
		row.add_child(price_label)
		row.add_child(stock_label)
		row.add_child(inv_label)
		row.add_child(qty_spin)
		row.add_child(buy_btn)
		vbox.add_child(row)

		_rows[material_id] = {
			"price": price_label,
			"stock": stock_label,
			"inventory": inv_label,
			"spin": qty_spin,
			"buy": buy_btn,
		}


## Обновляет цены и остатки.
func _refresh() -> void:
	for material_id in _rows:
		var row_data: Dictionary = _rows[material_id]
		var price: int = Market.get_price(material_id)
		var stock: int = Market.get_stock(material_id)
		var inv: int = Market.player_inventory.get(material_id, 0)
		row_data["price"].text = str(price)
		row_data["stock"].text = str(stock)
		row_data["inventory"].text = str(inv)
		row_data["buy"].disabled = stock <= 0
		row_data["price"].tooltip_text = "Лотов: %d" % Market.get_lot_count(material_id)


## Покупает материал в указанном количестве.
func _on_buy_pressed(material_id: String, qty_spin: SpinBox) -> void:
	var quantity: int = int(qty_spin.value)
	var order: MaterialOrder = Market.buy(material_id, quantity)
	if order == null:
		print("Не удалось купить %s" % Database.get_material_name(material_id))


## Создаёт метку фиксированной ширины.
func _make_label(text: String, width: int) -> Label:
	var label := Label.new()
	label.text = text
	label.clip_text = false
	label.custom_minimum_size = Vector2(width, 0)
	return label
