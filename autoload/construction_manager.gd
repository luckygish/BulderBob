extends Node

## Управление активным проектом, этапами стройки и оплатой.

const LATE_PENALTY_PERCENT: float = 0.05

## Все активные проекты игрока (до max_parallel_projects).
var active_projects: Array = []
## Индекс выбранного проекта в панели «Строительство».
var selected_project_index: int = 0
## Выбранный проект (совместимость с прежним кодом) — ссылка на активный по selected.
var active_project: Project = null


## Инициализирует менеджер строительства.
func _ready() -> void:
	reset()
	Signals.time_tick.connect(_on_time_tick)
	Signals.day_changed.connect(_on_day_changed)
	Signals.worker_hired.connect(_on_crew_changed)
	Signals.worker_fired.connect(_on_crew_changed)
	Signals.market_updated.connect(_on_market_updated)


## Сбрасывает активный проект.
func reset() -> void:
	active_projects.clear()
	active_project = null
	selected_project_index = 0


## Устанавливает активный проект игрока.
func set_active_project(project: Project) -> void:
	if active_projects.has(project):
		return
	active_projects.append(project)
	selected_project_index = active_projects.size() - 1
	active_project = project
	_assign_free_crew_if_any(project)
	for i in project.stages.size():
		project.check_stage_readiness(i)
	Signals.project_assigned.emit(project)


## Возвращает индекс свободной бригады (−1, если свободных нет).
func get_free_crew_index() -> int:
	var count: int = HR.get_crew_count()
	for i in count:
		if not _is_crew_busy(i):
			return i
	return -1


## True, если бригада назначена на какой-либо активный объект.
func _is_crew_busy(crew_index: int) -> bool:
	for p in active_projects:
		if p.crew_index == crew_index:
			return true
	return false


## Назначает бригаду на объект; освобождает её от старого объекта.
func assign_crew(project: Project, crew_index: int) -> void:
	if project == null:
		return
	if crew_index < 0 or crew_index >= HR.get_crew_count():
		return
	if not active_projects.has(project):
		return
	for p in active_projects:
		if p != project and p.crew_index == crew_index:
			p.crew_index = -1
	project.crew_index = crew_index
	HR.assign_crew_to_project(project, crew_index)
	Signals.crew_assigned.emit(project, crew_index)
	Signals.projects_updated.emit()
	Signals.workers_updated.emit()


## Назначает свободную бригаду на объект, если её ещё нет.
func _assign_free_crew_if_any(project: Project) -> void:
	if project == null:
		return
	if project.has_crew():
		return
	var free: int = get_free_crew_index()
	if free >= 0:
		assign_crew(project, free)


## Выбирает проект для панели «Строительство».
func select_project(index: int) -> void:
	if index < 0 or index >= active_projects.size():
		return
	selected_project_index = index
	active_project = active_projects[index]
	Signals.projects_updated.emit()


## Обеспечивает этап материалами со склада игрока.
func allocate_stage_from_inventory(stage_index: int, project: Project = null) -> bool:
	if project == null:
		project = active_project
	if project == null:
		return false
	return Market.allocate_stage_from_inventory(project, stage_index)


## Запускает текущий этап.
func start_current_stage() -> bool:
	if active_project == null:
		return false
	return active_project.start_stage(active_project.current_stage_index)


## Запускает этап по индексу (только если он текущий и готов).
func start_stage(stage_index: int) -> bool:
	if active_project == null:
		return false
	return active_project.start_stage(stage_index)


## Проверяет, можно ли запустить всю стройку сразу, и возвращает строку-причину,
## иначе пустую строку. Единый источник правды для состояния кнопки «Начать стройку».
## Учитывает материалы на складе игрока и уже размещённые на этапах, бригаду,
## технику текущего этапа и обязательное обеспечение — ровно то, что требуется
## функции start_stage() при запуске, чтобы кнопка не была активна без успеха.
func get_start_full_fail_reason(project: Project = null) -> String:
	if project == null:
		project = active_project
	if project == null:
		return "Нет активного проекта"
	if HR.get_total_crew_count() == 0:
		return "В бригадах нет рабочих — наймите на вкладке «Кадры»"
	if project.has_construction_started():
		return "Стройка уже начата"
	if project.current_stage_index < project.stages.size():
		var stage: Dictionary = project.stages[project.current_stage_index]
		if not project.has_stage_equipment(project.current_stage_index):
			return "Нет техники для этапа «%s» — возьмите на вкладке «Техника»" % stage.get("name", "")
		if project.current_stage_index == 0 and not EquipmentManager.has_required_provisions():
			return "Нет обязательного обеспечения (бытовка, туалет, вода и т.п.)"
	var remaining: Dictionary = {}
	for i in project.stages.size():
		var missing: Dictionary = project.get_missing_materials_for_stage(i)
		for material_id in missing:
			remaining[material_id] = remaining.get(material_id, 0) + missing[material_id]
	for material_id in remaining:
		var on_warehouse: int = Market.player_inventory.get(material_id, 0)
		if on_warehouse < remaining[material_id]:
			var name: String = Database.get_material_name(material_id)
			var short: int = remaining[material_id] - on_warehouse
			return "Недостаточно %s: на складе %d, нужно ещё %d" % [name, on_warehouse, short]
	return ""


## Проверяет, хватает ли материалов на складе и прочих условий для всех этапов сразу.
func can_start_full_construction() -> bool:
	return get_start_full_fail_reason().is_empty()


## Начинает стройку всех этапов сразу, если для всех есть материалы на складе.
func start_full_construction(project: Project = null) -> bool:
	if project == null:
		project = active_project
	if project == null:
		return false
	if not get_start_full_fail_reason(project).is_empty():
		return false
	for i in project.stages.size():
		Market.allocate_stage_from_inventory(project, i)
	project.auto_advance = true
	return project.start_stage(project.current_stage_index)


## Можно ли вести стройку в текущий час (рабочее время, ночь при «Сове» или автоматизации).
func _can_work_now(project: Project) -> bool:
	if GameManager.is_work_hours():
		return true
	if TechnologyManager.night_work_enabled():
		return true
	return WorkerSkills.has_owl(project.get_crew())


## Обрабатывает тик времени: продвигает стройку активных проектов, у которых есть бригада.
func _on_time_tick(_current_day: int, _current_hour: int) -> void:
	for project in active_projects:
		if not project.has_crew():
			continue
		if not _can_work_now(project):
			continue
		project.process_construction_hour()


## Синхронизирует бригаду проекта при найме/увольнении.
func _on_crew_changed(_worker: Worker) -> void:
	for project in active_projects:
		if project.has_crew():
			HR.assign_crew_to_project(project, project.crew_index)


## При изменении рынка/склада пересчитывает готовность этапов активного проекта.
func _on_market_updated() -> void:
	if active_project == null:
		return
	for i in active_project.stages.size():
		active_project.check_stage_readiness(i)


## Списывает вновь накопленные зарплаты в конце каждого дня.
func _on_day_changed(_current_day: int) -> void:
	for project in active_projects:
		var to_pay: float = project.labor_cost - project.deducted_wages
		if to_pay <= 0.0:
			continue
		if GameManager.spend(int(to_pay)):
			project.deducted_wages = project.labor_cost


## Завершает проект и начисляет оплату с учётом штрафов и аванса (факторинг).
func complete_project(project: Project) -> void:
	if not active_projects.has(project):
		return

	var material_cost: int = project.calculate_material_cost()
	var labor_cost: int = project.calculate_labor_cost()
	var profit: int = project.job.budget - material_cost - labor_cost

	# Если заказ просрочен — штраф 5% от итоговой прибыли.
	var penalty: int = 0
	if GameManager.day > project.job.deadline_day:
		penalty = int(float(profit) * LATE_PENALTY_PERCENT)

	# При факторинге аванс уже получен при взятии заказа — доплачиваем остаток.
	var advance: int = roundi(float(project.job.budget) * BankManager.advance_payment())
	var payment: int = maxi(0, project.job.budget - penalty - advance)
	profit = maxi(0, profit - penalty)

	var unpaid_wages: float = project.labor_cost - project.deducted_wages
	if unpaid_wages > 0.0:
		GameManager.spend(int(unpaid_wages))
	GameManager.earn(payment)

	var completed_job: Job = project.job
	var released_crew: int = project.crew_index
	project.crew_index = -1
	active_projects.erase(project)
	_reconcile_selected()
	GameManager.record_completed(project)

	# Освободившаяся бригада автоназначается на первый активный объект без бригады.
	if released_crew >= 0:
		var next_project: Project = _first_uncrewed_project()
		if next_project != null and not _is_crew_busy(released_crew):
			assign_crew(next_project, released_crew)

	Signals.job_completed.emit(completed_job)
	Signals.construction_completed.emit(project, profit)
	Signals.projects_updated.emit()


## Возвращает первый активный объект без бригады, или null.
func _first_uncrewed_project() -> Project:
	for p in active_projects:
		if not p.has_crew():
			return p
	return null


## После изменения списка синхронизирует выбранный проект.
func _reconcile_selected() -> void:
	if selected_project_index >= active_projects.size():
		selected_project_index = maxi(0, active_projects.size() - 1)
	active_project = active_projects[selected_project_index] if not active_projects.is_empty() else null


## Возвращает true, если у игрока есть хотя бы один активный проект.
func has_active_project() -> bool:
	return not active_projects.is_empty()
