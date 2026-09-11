extends PanelContainer

## Вкладка «Банки»: статус ветки «Финансы» и активные бонусы.

var _body: VBoxContainer


## Строит UI и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.tech_state_changed.connect(_refresh)
	Signals.loan_state_changed.connect(_refresh)


## Создаёт элементы панели.
func _build_ui() -> void:
	_body = VBoxContainer.new()
	_body.add_theme_constant_override("separation", 6)
	add_child(_body)


## Показывает статус банка и бонусы.
func _refresh() -> void:
	for child in _body.get_children():
		child.queue_free()

	var title := Label.new()
	title.text = "=== Банки ==="
	_body.add_child(title)

	if not BankManager.bank_unlocked():
		var locked := Label.new()
		locked.text = "Банковский счёт не открыт. Изучите технологию «Банковский счет» (ветка «Финансы»)."
		_body.add_child(locked)
		return

	var open := Label.new()
	open.text = "Банковский счёт: открыт"
	_body.add_child(open)

	var discount: float = BankManager.leasing_discount()
	if discount > 0.0:
		var dl := Label.new()
		dl.text = "Скидка на лизинг: %d%%" % int(discount * 100.0)
		_body.add_child(dl)

	var advance: float = BankManager.advance_payment()
	if advance > 0.0:
		var al := Label.new()
		al.text = "Факторинг: аванс %d%% бюджета при взятии заказа" % int(advance * 100.0)
		_body.add_child(al)

	_add_loans_section()


## Секция «Кредиты»: активный кредит игрока или предложения, если его нет.
func _add_loans_section() -> void:
	var sep := HSeparator.new()
	_body.add_child(sep)

	var title := Label.new()
	title.text = "=== Кредиты ==="
	_body.add_child(title)

	if BankManager.has_active_player_loan():
		var info := Label.new()
		info.text = "Активный кредит: %s руб. под %.0f%%\nОстаток: %s руб. · платёж %s руб./дн. · дней: %d" % [
			_format_money(int(BankManager.player_loan["amount"])),
			float(BankManager.player_loan["rate"]) * 100.0,
			_format_money(BankManager.get_player_loan_remaining()),
			_format_money(BankManager.get_player_loan_daily()),
			BankManager.get_player_loan_days_left(),
		]
		_body.add_child(info)
		return

	var offer_row := HBoxContainer.new()
	offer_row.add_theme_constant_override("separation", 6)
	for amount in [500000, 800000]:
		var btn := Button.new()
		var rate: float = float(BankManager.LOAN_OPTIONS[str(amount)]["rate"])
		btn.text = "Кредит %s (под %.0f%%)" % [_format_money(amount), rate * 100.0]
		var reason: String = BankManager.get_loan_block_reason()
		if not reason.is_empty():
			btn.disabled = true
			btn.tooltip_text = reason
		else:
			btn.pressed.connect(func(): BankManager.take_player_loan(amount); _refresh())
		offer_row.add_child(btn)
	_body.add_child(offer_row)


## Форматирует число с разделителями тысяч.
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