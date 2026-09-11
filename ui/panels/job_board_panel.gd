extends PanelContainer

## Панель доски заказов в виде таблицы (Заказчик | Тип объекта | Цена | Срок).

var _job_tree: Tree
var _info_label: Label
var _take_btn: Button


## Строит UI и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.jobs_updated.connect(_refresh)
	Signals.equipment_updated.connect(_refresh)
	Signals.job_taken.connect(func(_j): _refresh())
	Signals.project_assigned.connect(func(_p): _refresh())
	Signals.construction_completed.connect(func(_p, _pr): _refresh())
	Signals.tech_state_changed.connect(_refresh)
	Signals.game_reset.connect(_refresh)


## Создаёт элементы панели.
func _build_ui() -> void:
	var vbox := VBoxContainer.new()
	add_child(vbox)

	_job_tree = HoverTree.new()
	_job_tree.custom_minimum_size = Vector2(0, 140)
	_job_tree.hide_root = true
	_job_tree.hide_folding = true
	_job_tree.set_columns(4)
	_job_tree.set_column_title(0, "Заказчик")
	_job_tree.set_column_title(1, "Тип объекта")
	_job_tree.set_column_expand(0, true)
	_job_tree.set_column_expand(1, true)
	_job_tree.set_column_expand(2, false)
	_job_tree.set_column_expand(3, false)
	_job_tree.set_column_custom_minimum_width(2, 120)
	_job_tree.set_column_custom_minimum_width(3, 120)
	_job_tree.item_selected.connect(_on_job_selected)
	_job_tree.row_hovered.connect(func(_item): _on_job_selected())
	vbox.add_child(_job_tree)

	_info_label = Label.new()
	_info_label.text = "Выберите заказ из таблицы"
	vbox.add_child(_info_label)

	_take_btn = Button.new()
	_take_btn.text = "Взять заказ"
	_take_btn.pressed.connect(_on_take_pressed)
	vbox.add_child(_take_btn)


## Обновляет таблицу заказов.
func _refresh() -> void:
	_job_tree.clear()
	var root: TreeItem = _job_tree.create_item()

	for job in JobBoard.available_jobs:
		var item: TreeItem = _job_tree.create_item(root)
		item.set_text(0, job.client_name)
		item.set_text(1, job.get_building_display_name())
		item.set_text(2, _format_money(job.budget))
		item.set_text(3, "до дня %d" % job.deadline_day)
		item.set_metadata(0, job)

	var limit: int = TechnologyManager.max_parallel_projects()
	var active_count: int = ConstructionManager.active_projects.size()
	if active_count >= limit:
		_take_btn.disabled = true
		_info_label.text = "Лимит активных объектов достигнут (%d из %d)" % [active_count, limit]
	else:
		_take_btn.disabled = JobBoard.available_jobs.is_empty()
		if JobBoard.available_jobs.is_empty():
			_info_label.text = "Нет доступных заказов"


## Показывает информацию о выбранном заказе.
func _on_job_selected() -> void:
	var selected: TreeItem = _job_tree.get_selected()
	if selected == null:
		return
	var job: Job = selected.get_metadata(0) as Job
	if job == null:
		return
	_info_label.text = "Клиент: %s | %s | Бюджет: %s руб. | Срок: день %d" % [
		job.client_name,
		job.get_building_display_name(),
		_format_money(job.budget),
		job.deadline_day,
	]


## Берёт выбранный заказ.
func _on_take_pressed() -> void:
	var selected: TreeItem = _job_tree.get_selected()
	if selected == null:
		return
	var job: Job = selected.get_metadata(0) as Job
	if job == null:
		return
	if JobBoard.available_jobs.has(job):
		JobBoard.take_job(job)


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
