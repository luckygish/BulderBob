extends PanelContainer

## Вкладка «Технологии»: исследования по 3 веткам, кнопка «Исследовать», прогресс.

var _branch_box: VBoxContainer
var _research_label: Label
var _research_bar: ProgressBar
var _rows: Dictionary = {}


## Строит UI и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.tech_state_changed.connect(_refresh)
	Signals.tech_progress.connect(func(_id, _p): _refresh())
	Signals.money_changed.connect(func(_m): _refresh())


## Создаёт элементы панели.
func _build_ui() -> void:
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	add_child(vbox)

	var title := Label.new()
	title.text = "=== Технологии ==="
	vbox.add_child(title)

	var research_row := HBoxContainer.new()
	vbox.add_child(research_row)
	_research_label = Label.new()
	_research_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	research_row.add_child(_research_label)
	_research_bar = ProgressBar.new()
	_research_bar.max_value = 100.0
	_research_bar.custom_minimum_size = Vector2(0, 18)
	vbox.add_child(_research_bar)

	_branch_box = VBoxContainer.new()
	_branch_box.add_theme_constant_override("separation", 4)
	vbox.add_child(_branch_box)


## Собирает список веток в заданном порядке.
func _branches() -> Array:
	return ["Управление проектами", "Персонал", "Финансы"]


## Перестраивает содержимое по состоянию технологий.
func _refresh() -> void:
	_refresh_research_info()
	_rebuild_branches()


## Показывает текущее исследование и прогресс.
func _refresh_research_info() -> void:
	var current: String = TechnologyManager.get_current_research()
	if current.is_empty():
		_research_label.text = "Свободно"
		_research_bar.value = 0.0
		return
	var name := TechnologyManager.get_tech_name(current)
	var days: int = TechnologyManager.get_days(current)
	var frac: float = TechnologyManager.get_research_progress()
	var progress_days: int = int(round(frac * float(days)))
	_research_label.text = "Исследуется: %s (%d/%d дн., %s ₽)" % [name, progress_days, days, _format_money(TechnologyManager.get_cost(current))]
	_research_bar.show()
	_research_bar.value = frac * 100.0


## Строит три секции веток.
func _rebuild_branches() -> void:
	for child in _branch_box.get_children():
		child.queue_free()
	for branch in _branches():
		var sec := VBoxContainer.new()
		sec.add_theme_constant_override("separation", 2)
		var head := Label.new()
		head.text = "• %s" % branch
		head.add_theme_font_size_override("font_size", 16)
		sec.add_child(head)
		for tech_id in TechnologyManager.TECHNOLOGIES:
			if TechnologyManager.get_tech_branch(tech_id) != branch:
				continue
			sec.add_child(_make_tech_row(tech_id))
		_branch_box.add_child(sec)


## Создаёт строку технологии.
func _make_tech_row(tech_id: String) -> Control:
	var row := HBoxContainer.new()
	var info := Label.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.text = "%s — %s ₽, %d дн." % [
		TechnologyManager.get_tech_name(tech_id),
		_format_money(TechnologyManager.get_cost(tech_id)),
		TechnologyManager.get_days(tech_id),
	]
	var req: String = TechnologyManager.get_requires(tech_id)
	if not req.is_empty():
		var req_name: String = TechnologyManager.get_tech_name(req)
		info.text += " (треб.: %s)" % req_name
	row.add_child(info)

	var status := Label.new()
	status.custom_minimum_size = Vector2(120, 0)
	row.add_child(status)

	var btn := Button.new()
	btn.text = "Исследовать"
	btn.pressed.connect(func(): TechnologyManager.start_research(tech_id); _refresh())
	row.add_child(btn)

	var st: String = TechnologyManager.get_tech_status(tech_id)
	var tip: String = TechnologyManager.get_tech_desc(tech_id)
	match st:
		"researched":
			status.text = "Изучено"
			btn.disabled = true
			btn.tooltip_text = tip
		"researching":
			status.text = "Исследуется"
			btn.disabled = true
			btn.tooltip_text = tip
		"available":
			status.text = "Доступна"
			btn.disabled = not TechnologyManager.get_block_reason(tech_id).is_empty()
			btn.tooltip_text = tip
			if btn.disabled:
				var reason: String = TechnologyManager.get_block_reason(tech_id)
				btn.tooltip_text = tip + ("\n\n" + reason if not tip.is_empty() else reason)
		_:
			status.text = "Заблокирована"
			btn.disabled = true
			var reason: String = TechnologyManager.get_block_reason(tech_id)
			btn.tooltip_text = tip + ("\n\n" + reason if not tip.is_empty() else reason)
	return row


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
