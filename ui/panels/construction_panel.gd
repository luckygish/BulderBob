extends PanelContainer

## Панель стройки с общей сметой, раскрытыми этапами и кнопкой старта у каждого этапа.
## (Восстановлена прежняя реализация; добавлен селектор объекта для мульти-объектности.)

var _project_picker: OptionButton
var _project_label: Label
var _estimate_toggle_btn: Button
var _estimate_container: VBoxContainer
var _current_stage_label: Label
var _progress_bar: ProgressBar
var _total_progress_bar: ProgressBar
var _allocate_btn: Button
var _start_full_btn: Button
var _report_btn: Button
var _report_label: Label
var _log_label: Label

var _estimate_collapsed: bool = false
var _last_completed: Project = null
var _last_profit: int = 0


## Строит UI и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.project_assigned.connect(func(_p): _reset_report(); _refresh())
	Signals.stage_ready.connect(func(_p, _i): _refresh())
	Signals.stage_started.connect(func(_p, _i): _refresh())
	Signals.stage_completed.connect(func(_p, _i): _refresh())
	Signals.construction_completed.connect(_on_construction_completed)
	Signals.construction_progress.connect(_on_progress)
	Signals.money_changed.connect(func(_m): _refresh())
	Signals.market_updated.connect(func(): _refresh())
	Signals.equipment_updated.connect(func(): _refresh())
	Signals.workers_updated.connect(func(): _refresh())
	Signals.crew_assigned.connect(func(_p, _i): _refresh())
	Signals.game_reset.connect(_reset_report)
	Signals.game_reset.connect(_refresh)


## Создаёт элементы панели.
func _build_ui() -> void:
	var vbox := VBoxContainer.new()
	add_child(vbox)

	var title := Label.new()
	title.text = "=== Строительство ==="
	vbox.add_child(title)

	var picker_row := HBoxContainer.new()
	picker_row.add_theme_constant_override("separation", 8)
	var picker_lbl := Label.new()
	picker_lbl.text = "Объект:"
	picker_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	picker_row.add_child(picker_lbl)
	_project_picker = OptionButton.new()
	_project_picker.item_selected.connect(_on_picker_selected)
	picker_row.add_child(_project_picker)
	vbox.add_child(picker_row)

	_project_label = Label.new()
	_project_label.text = "Нет активного проекта"
	vbox.add_child(_project_label)

	_current_stage_label = Label.new()
	_current_stage_label.text = "Этап: —"
	vbox.add_child(_current_stage_label)

	_estimate_toggle_btn = Button.new()
	_estimate_toggle_btn.text = "▾ Общая смета"
	_estimate_toggle_btn.pressed.connect(_on_estimate_toggle)
	vbox.add_child(_estimate_toggle_btn)

	_estimate_container = VBoxContainer.new()
	vbox.add_child(_estimate_container)

	_allocate_btn = Button.new()
	_allocate_btn.text = "Обеспечить"
	_allocate_btn.pressed.connect(_on_allocate_pressed)
	vbox.add_child(_allocate_btn)

	_progress_bar = ProgressBar.new()
	_progress_bar.max_value = 100
	_progress_bar.value = 0
	_progress_bar.custom_minimum_size = Vector2(0, 24)
	vbox.add_child(_progress_bar)

	_total_progress_bar = ProgressBar.new()
	_total_progress_bar.max_value = 100
	_total_progress_bar.value = 0
	_total_progress_bar.custom_minimum_size = Vector2(0, 24)
	vbox.add_child(_total_progress_bar)

	_start_full_btn = Button.new()
	_start_full_btn.text = "Начать стройку"
	_start_full_btn.pressed.connect(_on_start_full_pressed)
	vbox.add_child(_start_full_btn)
	_start_full_btn.hide()

	_report_btn = Button.new()
	_report_btn.text = "Отчет"
	_report_btn.pressed.connect(_on_report_pressed)
	vbox.add_child(_report_btn)
	_report_btn.visible = false

	_report_label = Label.new()
	_report_label.text = ""
	vbox.add_child(_report_label)

	_log_label = Label.new()
	_log_label.text = ""
	vbox.add_child(_log_label)


## Обновляет селектор объектов и все элементы панели.
func _refresh() -> void:
	_rebuild_picker()
	var project: Project = ConstructionManager.active_project
	if project == null:
		_project_label.text = "Нет активного проекта"
		_estimate_toggle_btn.hide()
		_clear_estimate()
		_current_stage_label.text = "Этап: —"
		_progress_bar.value = 0
		_total_progress_bar.value = 0
		_allocate_btn.disabled = true
		_start_full_btn.hide()
		if _last_completed != null:
			_project_label.text = "Проект сдан: %s | Прибыль: %d руб." % [
				_last_completed.job.get_building_display_name(),
				_last_profit,
			]
			_report_btn.visible = true
		return

	_project_label.text = "Проект: %s | Бюджет: %d | Срок: день %d" % [
		project.job.get_building_display_name(),
		project.job.budget,
		project.job.deadline_day,
	]
	_report_btn.visible = false
	_estimate_toggle_btn.show()
	_estimate_toggle_btn.text = "▾ Общая смета" if not _estimate_collapsed else "▸ Общая смета"

	_rebuild_estimate(project)

	_update_progress(project)

	_allocate_btn.disabled = project.has_construction_started() or project.current_stage_index >= project.stages.size() or project.get_crew().is_empty()

	var started: bool = project.has_construction_started()
	_start_full_btn.visible = not started
	if not started:
		_start_full_btn.disabled = not ConstructionManager.can_start_full_construction()


## Заполняет селектор активных объектов.
func _rebuild_picker() -> void:
	var projects: Array = ConstructionManager.active_projects
	var prev: int = ConstructionManager.selected_project_index
	_project_picker.clear()
	if projects.is_empty():
		_project_picker.add_item("— нет активных объектов —")
		_project_picker.disabled = true
		return
	_project_picker.disabled = false
	for i in projects.size():
		var project: Project = projects[i]
		var item := "%s (#%d)" % [project.job.get_building_display_name(), i + 1]
		if GameManager.day > project.job.deadline_day:
			item += " ⚠"
		_project_picker.add_item(item, i)
	var sel: int = clampi(prev, 0, projects.size() - 1)
	_project_picker.selected = sel


## Обработчик выбора объекта в селекторе.
func _on_picker_selected(index: int) -> void:
	var id: int = _project_picker.get_item_id(index)
	if id >= 0:
		ConstructionManager.select_project(id)
	_reset_report()


## Обновляет сведения/содержимое после смены выбранного объекта.
func _reset_report() -> void:
	_last_completed = null
	_last_profit = 0
	_report_label.text = ""
	_refresh()


## Обновляет полоски прогресса (этап + вся стройка) и название текущего этапа.
func _update_progress(project: Project) -> void:
	if project.current_stage_index >= project.stages.size():
		_current_stage_label.text = "Этап: все завершены"
		_progress_bar.value = 100.0
		_total_progress_bar.value = project.get_total_progress() * 100.0
		return

	var current_status: int = project.get_stage_status(project.current_stage_index)
	_current_stage_label.text = "Этап: %s" % project.get_current_stage().get("name", "—")
	if current_status == Project.StageStatus.IN_PROGRESS:
		_progress_bar.value = project.get_stage_progress() * 100.0
	else:
		_progress_bar.value = 0.0
	_total_progress_bar.value = project.get_total_progress() * 100.0


## Обработчик сигнала construction_progress — лёгкое обновление прогресса без пересборки.
func _on_progress(project: Project, _stage_name: String, _progress: float) -> void:
	if project != ConstructionManager.active_project:
		return
	_update_progress(project)


## Сворачивает/разворачивает общую смету.
func _on_estimate_toggle() -> void:
	_estimate_collapsed = not _estimate_collapsed
	_refresh()


## Запускает конкретный этап.
func _on_stage_start(stage_index: int) -> void:
	if ConstructionManager.start_stage(stage_index):
		_log_label.text = "Этап %d начат!" % (stage_index + 1)
	else:
		_log_label.text = "Этап %d нельзя начать" % (stage_index + 1)
	_refresh()


## Обеспечивает текущий этап материалами со склада.
func _on_allocate_pressed() -> void:
	var project: Project = ConstructionManager.active_project
	if project == null:
		return
	if ConstructionManager.allocate_stage_from_inventory(project.current_stage_index):
		_log_label.text = "Этап %d обеспечен материалами" % (project.current_stage_index + 1)
	else:
		_log_label.text = "Материалов на складе не хватает — докупите на рынке"
	_refresh()


## Запускает всю стройку сразу, если материалов хватает на все этапы.
func _on_start_full_pressed() -> void:
	if ConstructionManager.start_full_construction():
		_log_label.text = "Стройка запущена на все этапы!"
	else:
		_log_label.text = "Не хватает материалов на складе для всех этапов"
	_refresh()


## Показывает отчёт по последнему сданному объекту.
func _on_report_pressed() -> void:
	_report_label.text = _build_report(_last_completed, _last_profit)


## Формирует текст отчёта по сданному объекту.
func _build_report(project: Project, profit: int) -> String:
	if project == null:
		return ""
	var hours: int = project.total_work_hours
	var days: int = int(ceil(float(hours) / 10.0))
	return "Отчет по объекту (%s)\nВремя стройки: %d ч (~%d раб. дня)\nЗатраты на материалы: %d руб.\nЗатраты на рабочих: %d руб.\nИтоговая прибыль: %d руб." % [
		project.job.get_building_display_name(),
		hours,
		days,
		project.calculate_material_cost(),
		project.calculate_labor_cost(),
		profit,
	]


## Показывает результат завершения проекта и готовит отчёт.
func _on_construction_completed(project: Project, profit: int) -> void:
	_last_completed = project
	_last_profit = profit
	_report_label.text = _build_report(project, profit)
	_log_label.text = "Объект сдан! Прибыль: %d руб." % profit
	_refresh()


## Строит содержимое сметы (итог + этапы + кнопки старта).
func _rebuild_estimate(project: Project) -> void:
	_clear_estimate()

	var summary := Label.new()
	summary.text = "Смета: материалы %s + труд %s = прибыль %s руб." % [
		_format_money(project.calculate_material_cost()),
		_format_money(project.calculate_labor_cost()),
		_format_money(project.calculate_margin()),
	]
	_estimate_container.add_child(summary)

	for i in project.stages.size():
		var stage_title := Label.new()
		stage_title.text = "%d. %s — %s" % [i + 1, project.stages[i].get("name", ""), _status_name(project.get_stage_status(i))]
		_estimate_container.add_child(stage_title)

		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var materials_label := Label.new()
		materials_label.text = _stage_materials_text(project, i)
		materials_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(materials_label)

		var start_btn := Button.new()
		start_btn.text = "Начать этап"
		start_btn.custom_minimum_size = Vector2(120, 0)
		start_btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		var current: int = project.current_stage_index
		var can_start: bool = i == current and project.get_stage_status(i) == Project.StageStatus.READY and not project.get_crew().is_empty() and project.has_stage_equipment(i) and (i != 0 or EquipmentManager.has_required_provisions())
		start_btn.disabled = not can_start
		start_btn.pressed.connect(_on_stage_start.bind(i))
		row.add_child(start_btn)

		_estimate_container.add_child(row)

	_add_extra_costs(project)

	_estimate_container.visible = not _estimate_collapsed


## Добавляет в смету блок «Дополнительные траты»: техника и обеспечение (показ).
func _add_extra_costs(project: Project) -> void:
	var sep := Label.new()
	sep.text = "=== Дополнительные траты ==="
	_estimate_container.add_child(sep)

	var eq_label := Label.new()
	eq_label.text = "Техника:"
	_estimate_container.add_child(eq_label)

	var any_equipment: bool = false
	for i in project.stages.size():
		var display: Array[String] = project.get_stage_equipment_display(i)
		if display.is_empty():
			continue
		any_equipment = true
		var mark: String = "есть" if project.has_stage_equipment(i) else "нет"
		_estimate_container.add_child(_make_label_control("      %s — нужно: %s (%s)" % [
			project.stages[i].get("name", ""),
			", ".join(display),
			mark,
		]))
	if not any_equipment:
		_estimate_container.add_child(_make_label_control("      — нет требований по этапам —"))

	var pr_label := Label.new()
	pr_label.text = "Обеспечение:"
	_estimate_container.add_child(pr_label)

	for provision_id in EquipmentManager.REQUIRED_PROVISION:
		var pr_mark: String = "есть" if EquipmentManager.get_provision_count(provision_id) >= 1 else "нет"
		_estimate_container.add_child(_make_label_control("      %s: %s" % [
			Provision.get_item_name(provision_id),
			pr_mark,
		]))


## Создаёт Label с заданным текстом.
func _make_label_control(text: String) -> Label:
	var label := Label.new()
	label.text = text
	return label


## Возвращает текст материалов этапа.
func _stage_materials_text(project: Project, stage_index: int) -> String:
	var required: Dictionary = project.get_stage_required_materials(stage_index)
	var parts: PackedStringArray = []
	for material_id in required:
		var need: int = required[material_id]
		var on_stage: int = project.stage_stock[stage_index].get(material_id, 0)
		var on_warehouse: int = Market.player_inventory.get(material_id, 0)
		var available: int = on_stage + on_warehouse
		var mark: String = "ок" if available >= need else "не хватает"
		parts.append("%s: нужно %d (на складе %d) [%s]" % [
			Database.get_material_name(material_id),
			need,
			on_warehouse,
			mark,
		])
	return "      " + "\n      ".join(parts)


## Очищает содержимое сметы.
func _clear_estimate() -> void:
	for child in _estimate_container.get_children():
		child.queue_free()


## Возвращает русское название статуса этапа.
func _status_name(status: int) -> String:
	match status:
		Project.StageStatus.NOT_STARTED:
			return "не начат"
		Project.StageStatus.READY:
			return "готов"
		Project.StageStatus.IN_PROGRESS:
			return "строится"
		Project.StageStatus.COMPLETED:
			return "завершён"
	return "?"


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