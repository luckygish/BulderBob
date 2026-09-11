extends PanelContainer

## Панель «Конкуренты»: отслеживание активности ботов-строителей.
## Использует GridContainer — колонки выравниваются по самой широкой ячейке,
## поэтому шапка и значения совпадают по каждой колонке.

const COLUMNS: int = 5

var _rows: Array = []


## Строит UI и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.bots_updated.connect(_refresh)
	Signals.day_changed.connect(func(_d): _refresh())
	Signals.game_reset.connect(_refresh)


## Создаёт таблицу ботов c выровненными колонками.
func _build_ui() -> void:
	var vbox := VBoxContainer.new()
	add_child(vbox)

	var title := Label.new()
	title.text = "=== Конкуренты ==="
	vbox.add_child(title)

	var grid := GridContainer.new()
	grid.columns = COLUMNS
	grid.add_theme_constant_override("h_separation", 8)
	vbox.add_child(grid)

	var headers: Array[String] = ["Бот", "Заказ", "Состояние", "Прогресс", "Капитал"]
	for h in headers:
		grid.add_child(_make_cell(h, true))

	for i in 3:
		var name_cell: Label = _make_cell("...")
		var job_cell: Label = _make_cell("...")
		var state_cell: Label = _make_cell("...")
		var prog := ProgressBar.new()
		prog.min_value = 0.0
		prog.max_value = 1.0
		prog.value = 0.0
		prog.custom_minimum_size = Vector2(120, 0)
		prog.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		prog.show_percentage = false
		var capital_cell: Label = _make_cell("0")

		grid.add_child(name_cell)
		grid.add_child(job_cell)
		grid.add_child(state_cell)
		grid.add_child(prog)
		grid.add_child(capital_cell)

		_rows.append({
			"name": name_cell,
			"job": job_cell,
			"state": state_cell,
			"progress": prog,
			"capital": capital_cell,
		})


## Обновляет данные ботов.
func _refresh() -> void:
	var bots: Array = AICompetitor.bots
	for i in _rows.size():
		var row_data: Dictionary = _rows[i]
		if i >= bots.size():
			row_data["name"].text = "—"
			row_data["job"].text = "—"
			row_data["state"].text = "—"
			row_data["progress"].value = 0.0
			row_data["capital"].text = "0"
			continue
		var bot: Bot = bots[i]
		row_data["name"].text = "%s (%s)" % [bot.name, bot.get_level_label()]
		row_data["job"].text = bot.get_current_job_name()
		row_data["state"].text = bot.get_state_text()
		row_data["progress"].value = bot.project.get_total_progress() if bot.project != null else 0.0
		row_data["capital"].text = _format_money(bot.money)


## Создаёт ячейку-Label. Заголовок — жирный.
func _make_cell(text: String, is_header: bool = false) -> Label:
	var label := Label.new()
	label.text = text
	label.clip_text = false
	label.custom_minimum_size = Vector2(60, 0)
	if is_header:
		label.add_theme_color_override("font_color", Color(0.9, 0.9, 1.0))
	return label


## Форматирует сумму с разделителями тысяч.
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