class_name Project
extends RefCounted

## Активный строительный проект игрока с по-этапной стройкой.

enum StageStatus {
	NOT_STARTED,    ## Не начат (нет материалов).
	READY,          ## Материалы закуплены, можно начинать.
	IN_PROGRESS,    ## Строится.
	COMPLETED,      ## Завершён.
}

var job: Job
var stages: Array = []
var current_stage_index: int = 0

## Статус каждого этапа (см. StageStatus).
var stage_statuses: Array[int] = []
## Закупленное количество материалов по каждому этапу: Array[Dictionary {id: qty}].
var stage_stock: Array[Dictionary] = []
## История закупок: Array[{stage_index, material_id, quantity, unit_price, total_cost}].
var material_purchases: Array = []
## Фактическая стоимость закупленных материалов (в рублях).
var actual_material_cost: int = 0
## Прогресс текущего строящегося этапа (0..1).
var stage_progress: float = 0.0
## Суммарное отработанное время стройки (в рабочих часах).
var total_work_hours: int = 0
## При полной стройке этапы запускаются автоматически по мере завершения.
var auto_advance: bool = false

var assigned_workers: Array[Worker] = []
## Накопленные затраты на рабочие часы.
var labor_cost: float = 0.0
## Сколько из labor_cost уже списано в кошелёк.
var deducted_wages: float = 0.0
## Индекс назначенной бригады (−1 = бригада не назначена).
var crew_index: int = -1


## Создаёт проект на основе заказа и этапов строительства.
func _init(p_job: Job) -> void:
	job = p_job
	stages = Database.get_building_stages(job.building_type).duplicate(true)
	for i in stages.size():
		stage_statuses.append(StageStatus.NOT_STARTED)
		stage_stock.append({})


## Возвращает текущий этап или пустой словарь, если все завершены.
func get_current_stage() -> Dictionary:
	if current_stage_index >= stages.size():
		return {}
	return stages[current_stage_index]


## Возвращает статус этапа (см. StageStatus).
func get_stage_status(stage_index: int) -> int:
	if stage_index < 0 or stage_index >= stage_statuses.size():
		return StageStatus.NOT_STARTED
	return stage_statuses[stage_index]


## Возвращает требуемые материалы этапа.
func get_stage_required_materials(stage_index: int) -> Dictionary:
	if stage_index < 0 or stage_index >= stages.size():
		return {}
	return stages[stage_index].get("materials", {})


## Возвращает id этапа (строковый), пустая строка при неверном индексе.
func get_stage_id(stage_index: int) -> String:
	if stage_index < 0 or stage_index >= stages.size():
		return ""
	return str(stages[stage_index].get("id", ""))


## Возвращает true, если для этапа присутствует вся требуемая техника
## (в каждой группе альтернатив есть хотя бы одна единица на складе).
func has_stage_equipment(stage_index: int) -> bool:
	var groups: Array = EquipmentManager.get_stage_equipment_requirement(get_stage_id(stage_index))
	for group in groups:
		var present: bool = false
		for equipment_id in group:
			if EquipmentManager.has_equipment(equipment_id):
				present = true
				break
		if not present:
			return false
	return true


## Возвращает человекочитаемые строки требуемой техники этапа для UI.
func get_stage_equipment_display(stage_index: int) -> Array[String]:
	var out: Array[String] = []
	for group in EquipmentManager.get_stage_equipment_requirement(get_stage_id(stage_index)):
		var names: PackedStringArray = []
		for equipment_id in group:
			names.append(Equipment.get_item_name(equipment_id))
		out.append(" | ".join(names))
	return out


## Возвращает закупленное количество материалов этапа.
func _get_stage_stock(stage_index: int) -> Dictionary:
	if stage_index < 0 or stage_index >= stage_stock.size():
		return {}
	return stage_stock[stage_index]


## Возвращает словарь недостающих материалов этапа: {id: ещё_сколько_нужно}.
func get_missing_materials_for_stage(stage_index: int) -> Dictionary:
	var required: Dictionary = get_stage_required_materials(stage_index)
	var bought: Dictionary = _get_stage_stock(stage_index)
	var missing: Dictionary = {}
	for material_id in required:
		var need: int = required[material_id]
		var have: int = bought.get(material_id, 0)
		if have < need:
			missing[material_id] = need - have
	return missing


## Возвращает true, если все материалы этапа закуплены.
func has_stage_materials(stage_index: int) -> bool:
	return get_missing_materials_for_stage(stage_index).is_empty()


## Регистрирует покупку материалов для этапа и обновляет готовность.
func add_materials_to_stage(stage_index: int, material_id: String, quantity: int, total_cost: int) -> bool:
	if stage_index < 0 or stage_index >= stages.size():
		return false
	if quantity <= 0:
		return false
	stage_stock[stage_index][material_id] = _get_stage_stock(stage_index).get(material_id, 0) + quantity
	material_purchases.append({
		"stage_index": stage_index,
		"material_id": material_id,
		"quantity": quantity,
		"unit_price": int(float(total_cost) / float(quantity)),
		"total_cost": total_cost,
	})
	actual_material_cost += total_cost
	check_stage_readiness(stage_index)
	return true


## Возвращает true, если все материалы этапа доступны (на этапе или на складе игрока).
func has_materials_available(stage_index: int) -> bool:
	if stage_index < 0 or stage_index >= stages.size():
		return false
	var required: Dictionary = get_stage_required_materials(stage_index)
	var bought: Dictionary = _get_stage_stock(stage_index)
	for material_id in required:
		var total: int = bought.get(material_id, 0) + Market.player_inventory.get(material_id, 0)
		if total < required[material_id]:
			return false
	return true


## Проверяет готовность этапа: если материалы доступны (на этапе или складе) — статус READY.
func check_stage_readiness(stage_index: int) -> void:
	if stage_index < 0 or stage_index >= stage_statuses.size():
		return
	if stage_statuses[stage_index] != StageStatus.NOT_STARTED:
		return
	if has_materials_available(stage_index):
		stage_statuses[stage_index] = StageStatus.READY
		Signals.stage_ready.emit(self, stage_index)


## Начинает этап: только текущий, только если материалы доступны и есть бригада.
func start_stage(stage_index: int) -> bool:
	if stage_index != current_stage_index:
		return false
	if get_stage_status(stage_index) != StageStatus.READY:
		return false
	if get_crew().is_empty():
		return false
	if not has_materials_available(stage_index):
		return false
	if not has_stage_equipment(stage_index):
		return false
	# Без обязательного обеспечения нельзя начать стройку (этап 1).
	if stage_index == 0 and not EquipmentManager.has_required_provisions():
		return false
	# Списываем материалы со склада на этап при старте.
	Market.allocate_stage_from_inventory(self, stage_index)
	stage_statuses[stage_index] = StageStatus.IN_PROGRESS
	stage_progress = 0.0
	if has_crew():
		HR.assign_crew_to_project(self, crew_index)
	Signals.stage_started.emit(self, stage_index)
	return true


## Обрабатывает один рабочий час строительства текущего этапа.
func process_construction_hour() -> void:
	if current_stage_index >= stages.size():
		return
	if get_stage_status(current_stage_index) != StageStatus.IN_PROGRESS:
		return

	var efficiency: float = get_crew_efficiency_per_hour()
	labor_cost += get_crew_hourly_rate()
	total_work_hours += 1

	var work_hours: float = float(get_current_stage().get("man_hours", 1.0))
	if work_hours <= 0.0:
		work_hours = 1.0
	stage_progress += efficiency / work_hours
	Signals.construction_progress.emit(self, "", get_stage_progress())
	if stage_progress >= 1.0:
		_complete_stage()


## Завершает текущий этап и переходит к следующему или завершает проект.
func _complete_stage() -> void:
	if current_stage_index >= stages.size():
		return
	stage_statuses[current_stage_index] = StageStatus.COMPLETED
	var completed_index: int = current_stage_index
	current_stage_index += 1
	Signals.stage_completed.emit(self, completed_index)

	if current_stage_index >= stages.size():
		ConstructionManager.complete_project(self)
		return

	stage_progress = 0.0
	# Если материалы следующего этапа уже закуплены — он сразу готов.
	if has_stage_materials(current_stage_index) and stage_statuses[current_stage_index] == StageStatus.NOT_STARTED:
		stage_statuses[current_stage_index] = StageStatus.READY
		Signals.stage_ready.emit(self, current_stage_index)
	# При полной стройке следующий готовый этап начинается автоматически.
	if auto_advance and has_stage_materials(current_stage_index):
		start_stage(current_stage_index)


## Возвращает рабочую бригаду (пустая, если бригада не назначена).
func get_crew() -> Array:
	return HR.get_crew(crew_index)


## True, если на проект назначена непустая бригада.
func has_crew() -> bool:
	return crew_index >= 0 and not HR.get_crew(crew_index).is_empty()


## Возвращает суммарную часовую ставку бригады.
func get_crew_hourly_rate() -> float:
	var total: float = 0.0
	for worker in get_crew():
		total += float(worker.rate_per_hour)
	return total


## Возвращает суммарную эффективность бригады за час (с бонусом бригадира и технологий).
func get_crew_efficiency_per_hour() -> float:
	return HR.calculate_team_efficiency(get_crew(), true)


## Считает стоимость материалов проекта (с учётом «Вора» в бригаде).
func calculate_material_cost() -> int:
	var cost: int = actual_material_cost
	if WorkerSkills.has_thief(get_crew()):
		cost = int(float(cost) * 1.05)
	return cost


## Считает стоимость труда: фактическую либо плановую (до старта).
func calculate_labor_cost() -> int:
	if labor_cost > 0.0:
		return int(labor_cost)
	if get_crew().is_empty():
		return 0
	var hourly: float = get_crew_hourly_rate()
	var total_man_hours: float = 0.0
	for stage in stages:
		total_man_hours += float(stage.get("man_hours", 0.0))
	var eff: float = get_crew_efficiency_per_hour()
	if eff <= 0.0:
		eff = 1.0
	return int(hourly * total_man_hours / eff)


## Считает прогнозируемую прибыль проекта.
func calculate_margin() -> int:
	return job.budget - calculate_material_cost() - calculate_labor_cost()


## Возвращает прогресс текущего строящегося этапа от 0 до 1.
func get_stage_progress() -> float:
	return clampf(stage_progress, 0.0, 1.0)


## Возвращает общий прогресс всей стройки от 0 до 1 (по суммарным man_hours).
func get_total_progress() -> float:
	var total: float = 0.0
	var done: float = 0.0
	for i in stages.size():
		var man_hours: float = float(stages[i].get("man_hours", 0.0))
		total += man_hours
		if get_stage_status(i) == StageStatus.COMPLETED:
			done += man_hours
		elif i == current_stage_index and get_stage_status(i) == StageStatus.IN_PROGRESS:
			done += man_hours * clampf(stage_progress, 0.0, 1.0)
	if total <= 0.0:
		return 0.0
	return clampf(done / total, 0.0, 1.0)


## Возвращает true, если хотя бы один этап уже строили (начат или завершён).
func has_construction_started() -> bool:
	for status in stage_statuses:
		if status == StageStatus.IN_PROGRESS or status == StageStatus.COMPLETED:
			return true
	return false