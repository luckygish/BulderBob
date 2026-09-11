extends PanelContainer

## Панель найма рабочих: пул + таблица выбранной бригады. При «Профстандартах» доступна
## Бригада №2. Строка подсвечивается по ховеру и показывает карточку работника.

var _available_tree: Tree
var _crew_tree: Tree
var _crew_selector: OptionButton
var _detail_label: Label
var _info_label: Label

var _selected_crew: int = 0


## Строит UI и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.workers_updated.connect(_refresh)
	Signals.worker_hired.connect(func(_w): _refresh())
	Signals.worker_fired.connect(func(_w): _refresh())
	Signals.tech_state_changed.connect(func(): _refresh())
	Signals.game_reset.connect(_refresh)


## Создаёт элементы панели HR.
func _build_ui() -> void:
	var vbox := VBoxContainer.new()
	add_child(vbox)

	var title := Label.new()
	title.text = "=== Кадры ==="
	vbox.add_child(title)

	var hbox := HBoxContainer.new()
	vbox.add_child(hbox)

	var left_vbox := VBoxContainer.new()
	left_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(left_vbox)

	left_vbox.add_child(_make_label("Доступные"))
	_available_tree = _make_tree()
	_available_tree.item_selected.connect(_show_detail)
	left_vbox.add_child(_available_tree)

	var hire_btn := Button.new()
	hire_btn.text = "Нанять"
	hire_btn.pressed.connect(_on_hire_pressed)
	left_vbox.add_child(hire_btn)

	var right_vbox := VBoxContainer.new()
	right_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(right_vbox)

	right_vbox.add_child(_make_label("Бригада"))
	_crew_selector = OptionButton.new()
	_crew_selector.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_crew_selector.item_selected.connect(func(i: int): _selected_crew = i; _refresh())
	right_vbox.add_child(_crew_selector)

	_crew_tree = _make_tree()
	_crew_tree.item_selected.connect(_show_detail)
	right_vbox.add_child(_crew_tree)

	var fire_btn := Button.new()
	fire_btn.text = "Уволить"
	fire_btn.pressed.connect(_on_fire_pressed)
	right_vbox.add_child(fire_btn)

	_detail_label = Label.new()
	_detail_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(_detail_label)

	_info_label = Label.new()
	vbox.add_child(_info_label)


## Обновляет селектор бригад и заполняет таблицы.
func _refresh() -> void:
	_rebuild_crew_selector()
	_fill_tree(_available_tree, HR.available_workers)
	var crew: Array = HR.get_crew(_selected_crew)
	_fill_tree(_crew_tree, crew)
	var cap: int = HR.MAX_CREW
	_info_label.text = "Бригада №%d: %d/%d чел. | Ставка: %d руб/ч" % [
		_selected_crew + 1,
		crew.size(),
		cap,
		HR.get_crew_hourly_rate(_selected_crew),
	]


## Перестраивает выбор активной бригады в соответствии с числом доступных.
func _rebuild_crew_selector() -> void:
	if _crew_selector == null:
		return
	var prev: int = _crew_selector.selected
	_crew_selector.clear()
	var count: int = HR.get_crew_count()
	if count <= 0:
		_crew_selector.add_item("Бригада недоступна")
		_crew_selector.selected = 0
		_crew_selector.disabled = true
		_selected_crew = 0
		return
	for i in count:
		_crew_selector.add_item("Бригада №%d" % (i + 1))
	_crew_selector.selected = clampi(prev, 0, count - 1)
	_selected_crew = _crew_selector.selected
	_crew_selector.disabled = false


## Создаёт таблицу Tree с колонками Имя | Квалификация | Ставка и подсветкой строки по ховеру.
func _make_tree() -> HoverTree:
	var tree := HoverTree.new()
	tree.custom_minimum_size = Vector2(0, 140)
	tree.columns = 3
	tree.set_column_title(0, "Имя")
	tree.set_column_title(1, "Квалификация")
	tree.set_column_title(2, "Ставка")
	tree.set_column_expand(1, true)
	tree.select_mode = Tree.SELECT_ROW
	tree.hide_root = true
	tree.row_hovered.connect(func(_item): _on_row_hover(_item))
	return tree


## Обработчик ховера строки: показывает характеристику работника.
func _on_row_hover(item: TreeItem) -> void:
	if item == null:
		_show_detail()
		return
	var worker: Worker = item.get_metadata(0)
	_show_worker(worker)


## Заполняет таблицу рабочими из списка. Ставит tooltip на каждую строку.
func _fill_tree(tree: Tree, workers: Array) -> void:
	tree.clear()
	var root := tree.create_item()
	for worker in workers:
		var item := tree.create_item(root)
		item.set_text(0, worker.name)
		item.set_text(1, worker.get_type_name())
		item.set_text(2, "%d руб/ч" % worker.rate_per_hour)
		item.set_metadata(0, worker)


## Показывает карточку выбранного/наведённого рабочего под таблицами.
func _show_detail() -> void:
	var worker: Worker = _selected_worker(_available_tree)
	if worker == null:
		worker = _selected_worker(_crew_tree)
	_show_worker(worker)


## Выводит характеристику конкретного рабочего.
func _show_worker(worker: Worker) -> void:
	if worker == null:
		_detail_label.text = ""
		return
	_detail_label.text = "Имя: %s\nНавыки: %s\nКоэффициент: %.1f\n%s" % [
		worker.name,
		worker.get_skills_text(),
		worker.efficiency,
		WorkerSkills.describe(worker),
	]


## Тултип строки рабочего.
func _worker_tooltip(worker: Worker) -> String:
	return "Имя: %s\nКвалификация: %s\nСтавка: %d руб/ч\nЭффективность: %.1f\nНавыки: %s\n%s" % [
		worker.name,
		worker.get_type_name(),
		worker.rate_per_hour,
		worker.efficiency,
		worker.get_skills_text(),
		WorkerSkills.describe(worker),
	]


## Возвращает рабочего, связанного с выбранной строкой таблицы, или null.
func _selected_worker(tree: Tree) -> Worker:
	var selected: TreeItem = tree.get_selected()
	if selected == null:
		return null
	return selected.get_metadata(0)


## Нанимает выбранного рабочего в активную бригаду.
func _on_hire_pressed() -> void:
	var worker: Worker = _selected_worker(_available_tree)
	if worker != null:
		HR.hire(worker, _selected_crew)


## Увольняет выбранного рабочего из активной бригады.
func _on_fire_pressed() -> void:
	var worker: Worker = _selected_worker(_crew_tree)
	if worker != null:
		HR.fire(worker, _selected_crew)


## Создаёт метку.
func _make_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	return label
