extends PanelContainer

## Панель «Техника»: покупка/аренда/лизинг техники и покупка обеспечения.

var _equipment_status: Dictionary = {}
var _provision_count: Dictionary = {}
var _payoff_buttons: Dictionary = {}


## Строит UI и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.equipment_updated.connect(_refresh)
	Signals.money_changed.connect(func(_m): _refresh())


## Создаёт элементы панели.
func _build_ui() -> void:
	var vbox := VBoxContainer.new()
	add_child(vbox)

	var title := Label.new()
	title.text = "=== Техника ==="
	vbox.add_child(title)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("h_separation", 8)
	header.add_child(_make_label("Техника", 180))
	header.add_child(_make_label("Цена", 140))
	header.add_child(_make_label("Склад", 240))
	header.add_child(_make_label("", 80))
	header.add_child(_make_label("", 80))
	header.add_child(_make_label("", 80))
	header.add_child(_make_label("", 80))
	vbox.add_child(header)

	for equipment_id in Equipment.get_all_ids():
		var row := HBoxContainer.new()
		row.add_theme_constant_override("h_separation", 8)
		var name_label := _make_label(Equipment.get_item_name(equipment_id), 180)
		name_label.tooltip_text = Equipment.get_desc(equipment_id)
		var price_label := _make_label(_format_money(Equipment.get_price(equipment_id)), 140)
		var status_label := _make_label("—", 240)

		var buy_btn := Button.new()
		buy_btn.text = "Купить"
		buy_btn.pressed.connect(_on_buy_equipment.bind(equipment_id))

		var rent_btn := Button.new()
		rent_btn.text = "Аренда"
		rent_btn.pressed.connect(_open_rent_dialog.bind(equipment_id))

		var lease_btn := Button.new()
		lease_btn.text = "Лизинг"
		lease_btn.pressed.connect(_open_lease_dialog.bind(equipment_id))

		var payoff_btn := Button.new()
		payoff_btn.text = "Погасить"
		payoff_btn.pressed.connect(_open_payoff_dialog.bind(equipment_id))

		row.add_child(name_label)
		row.add_child(price_label)
		row.add_child(status_label)
		row.add_child(buy_btn)
		row.add_child(rent_btn)
		row.add_child(lease_btn)
		row.add_child(payoff_btn)
		vbox.add_child(row)

		_equipment_status[equipment_id] = status_label
		_payoff_buttons[equipment_id] = payoff_btn

	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 16)
	vbox.add_child(spacer)

	var ptitle := Label.new()
	ptitle.text = "=== Обеспечение ==="
	vbox.add_child(ptitle)

	var pheader := HBoxContainer.new()
	pheader.add_theme_constant_override("h_separation", 8)
	pheader.add_child(_make_label("Товар", 180))
	pheader.add_child(_make_label("Цена", 140))
	pheader.add_child(_make_label("В наличии", 100))
	pheader.add_child(_make_label("", 80))
	vbox.add_child(pheader)

	for provision_id in Provision.get_all_ids():
		var prow := HBoxContainer.new()
		prow.add_theme_constant_override("h_separation", 8)
		var pname := _make_label(Provision.get_item_name(provision_id), 180)
		pname.tooltip_text = Provision.get_desc(provision_id)
		var pprice := _make_label(_format_money(Provision.get_price(provision_id)), 140)
		var pcount := _make_label("0", 100)
		var pbuy := Button.new()
		pbuy.text = "Купить"
		pbuy.pressed.connect(_on_buy_provision.bind(provision_id))

		prow.add_child(pname)
		prow.add_child(pprice)
		prow.add_child(pcount)
		prow.add_child(pbuy)
		vbox.add_child(prow)

		_provision_count[provision_id] = pcount


## Обновляет статусы на складе.
func _refresh() -> void:
	for equipment_id in _equipment_status:
		var status: Dictionary = EquipmentManager.get_equipment_status(equipment_id)
		var text := "—"
		if not status.is_empty():
			match status["status"]:
				"owned":
					text = "Своя"
				"leased":
					text = "Лизинг (до дня %d)" % int(status["expires_day"])
				"rented":
					text = "Аренда (ост. %d ч)" % int(status["remaining_hours"])
		_equipment_status[equipment_id].text = text
		_payoff_buttons[equipment_id].disabled = status.get("status", "") != "leased"
	for provision_id in _provision_count:
		_provision_count[provision_id].text = str(EquipmentManager.get_provision_count(provision_id))


## Покупает технику целиком.
func _on_buy_equipment(equipment_id: String) -> void:
	if not EquipmentManager.buy_equipment(equipment_id):
		print("Не удалось купить %s" % Equipment.get_item_name(equipment_id))


## Открывает окно лизинга.
func _open_lease_dialog(equipment_id: String) -> void:
	var total: int = EquipmentManager.get_lease_total(equipment_id)
	var overpay: int = EquipmentManager.get_lease_overpay(equipment_id)
	var daily: int = EquipmentManager.get_lease_daily(equipment_id)
	var days: int = Equipment.get_lease_days(equipment_id)
	var interest: int = roundi(Equipment.get_lease_interest(equipment_id) * 100.0)

	var dialog := _make_dialog("Лизинг — %s" % Equipment.get_item_name(equipment_id))
	dialog.dialog_text = "Полная сумма: %s руб.\nПроцент: %d%%\nИтоговая переплата: %s руб.\nЕжедневный платёж: %s руб.\nСрок: %d дней" % [
		_format_money(total),
		interest,
		_format_money(overpay),
		_format_money(daily),
		days,
	]
	dialog.confirmed.connect(func(): _on_lease_confirmed(equipment_id, dialog))
	dialog.popup_centered()


func _on_lease_confirmed(equipment_id: String, dialog: ConfirmationDialog) -> void:
	if not EquipmentManager.start_lease(equipment_id):
		print("Не удалось оформить лизинг на %s" % Equipment.get_item_name(equipment_id))
	if is_instance_valid(dialog):
		dialog.queue_free()


## Открывает окно досрочного погашения лизинга.
func _open_payoff_dialog(equipment_id: String) -> void:
	var remaining: int = EquipmentManager.get_lease_remaining(equipment_id)
	var dialog := _make_dialog("Погасить лизинг — %s" % Equipment.get_item_name(equipment_id), "Оплатить")
	dialog.dialog_text = "Остаток по лизингу: %s руб.\nПосле оплаты техника станет вашей (статус «Своя»)." % [
		_format_money(remaining),
	]
	dialog.confirmed.connect(func(): _on_payoff_confirmed(equipment_id, dialog))
	dialog.popup_centered()


func _on_payoff_confirmed(equipment_id: String, dialog: ConfirmationDialog) -> void:
	if not EquipmentManager.pay_off_lease(equipment_id):
		print("Не удалось погасить лизинг на %s" % Equipment.get_item_name(equipment_id))
	if is_instance_valid(dialog):
		dialog.queue_free()


## Открывает окно аренды.
func _open_rent_dialog(equipment_id: String) -> void:
	var min_hours: int = Equipment.get_rent_min_hours(equipment_id)
	var rate: int = Equipment.get_rent_per_hour(equipment_id)

	var dialog := _make_dialog("Аренда — %s" % Equipment.get_item_name(equipment_id))

	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 6)

	var min_label := Label.new()
	min_label.text = "Минимальный срок: %d ч" % min_hours
	content.add_child(min_label)

	var rate_label := Label.new()
	rate_label.text = "Цена за час: %s руб." % _format_money(rate)
	content.add_child(rate_label)

	var row := HBoxContainer.new()
	var row_label := Label.new()
	row_label.text = "Срок аренды (ч):"
	row_label.custom_minimum_size = Vector2(140, 0)
	row.add_child(row_label)

	var spin := SpinBox.new()
	spin.min_value = min_hours
	spin.max_value = 999
	spin.step = 1
	spin.value = min_hours
	spin.custom_minimum_size = Vector2(120, 0)
	row.add_child(spin)
	content.add_child(row)

	var summary := Label.new()
	summary.text = "Итог: %s руб." % _format_money(min_hours * rate)
	content.add_child(summary)

	dialog.add_child(content)
	dialog.confirmed.connect(func(): _on_rent_confirmed(equipment_id, int(spin.value), dialog))
	spin.value_changed.connect(func(v: float):
		summary.text = "Итог: %s руб." % _format_money(int(v) * rate)
	)
	dialog.popup_centered()


func _on_rent_confirmed(equipment_id: String, hours: int, dialog: ConfirmationDialog) -> void:
	if not EquipmentManager.start_rental(equipment_id, hours):
		print("Не удалось арендовать %s" % Equipment.get_item_name(equipment_id))
	if is_instance_valid(dialog):
		dialog.queue_free()


## Создаёт модальное окно подтверждения.
func _make_dialog(title_text: String, ok_text: String = "Оформить") -> ConfirmationDialog:
	var dialog := ConfirmationDialog.new()
	dialog.theme = AppTheme.get_theme()
	dialog.title = title_text
	dialog.ok_button_text = ok_text
	dialog.cancel_button_text = "Отмена"
	dialog.exclusive = true
	dialog.min_size = Vector2(460, 0)
	dialog.size = Vector2(460, 0)
	add_child(dialog)
	return dialog


## Создаёт метку фиксированной ширины.
func _make_label(text: String, width: int) -> Label:
	var label := Label.new()
	label.text = text
	label.clip_text = false
	label.custom_minimum_size = Vector2(width, 0)
	return label


## Форматирует сумму денег с разделителями.
func _format_money(amount: int) -> String:
	var s := str(amount)
	var result := ""
	var count := 0
	for i in range(s.length() - 1, -1, -1):
		if count > 0 and count % 3 == 0:
			result = " " + result
		result = s[i] + result
		count += 1
	return result


## Покупает единицу обеспечения.
func _on_buy_provision(provision_id: String) -> void:
	if not EquipmentManager.buy_provision(provision_id):
		print("Не удалось купить %s" % Provision.get_item_name(provision_id))
