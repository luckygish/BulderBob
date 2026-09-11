class_name BotProject
extends RefCounted

## Проект бота: упрощённая по-этапная стройка с дневным прогрессом.
## Прогресс идёт день-за-днём: `advance(man_hours)` добавляет выполненное
## количество человеко-часов по текущему (и последующим) этапам.

enum StageStatus {
	NOT_STARTED,
	IN_PROGRESS,
	COMPLETED,
}

var job: Job
var stages: Array = []
var current_stage_index: int = 0

## Статус 每个 этапа (см. StageStatus).
var stage_statuses: Array[int] = []
## Закупленное количество материалов по каждому этапу: Array[Dictionary {id: qty}].
var stage_stock: Array[Dictionary] = []
## Прогресс текущего этапа (0..1).
var stage_progress: float = 0.0
## Суммарное отработанное количество человеко-часов.
var total_man_hours_done: float = 0.0

## Финансовые накопленные затраты бота по проекту.
var material_spent: int = 0
var wages_paid: int = 0
var rental_paid: int = 0


## Создаёт проект бота на основе заказа и этапов строительства.
func _init(p_job: Job) -> void:
	job = p_job
	stages = Database.get_building_stages(job.building_type).duplicate(true)
	for i in stages.size():
		stage_statuses.append(StageStatus.NOT_STARTED)
		stage_stock.append({})


## Возвращает требуемые материалы этапа.
func get_stage_required_materials(stage_index: int) -> Dictionary:
	if stage_index < 0 or stage_index >= stages.size():
		return {}
	return stages[stage_index].get("materials", {})


## Возвращает id этапа (строковый).
func get_stage_id(stage_index: int) -> String:
	if stage_index < 0 or stage_index >= stages.size():
		return ""
	return str(stages[stage_index].get("id", ""))


## Возвращает человеко-часы этапа.
func get_stage_man_hours(stage_index: int) -> float:
	if stage_index < 0 or stage_index >= stages.size():
		return 0.0
	return float(stages[stage_index].get("man_hours", 0.0))


## Словарь недостающих материалов этапа: {id: ещё_сколько_нужно}.
func get_missing_materials_for_stage(stage_index: int) -> Dictionary:
	var required: Dictionary = get_stage_required_materials(stage_index)
	var bought: Dictionary = stage_stock[stage_index] if stage_index < stage_stock.size() else {}
	var missing: Dictionary = {}
	for material_id in required:
		var need: int = required[material_id]
		var have: int = bought.get(material_id, 0)
		if have < need:
			missing[material_id] = need - have
	return missing


## True, если все материалы этапа закуплены.
func has_stage_materials(stage_index: int) -> bool:
	return get_missing_materials_for_stage(stage_index).is_empty()


## Регистрирует закупку материалов для этапа.
func add_materials_to_stage(stage_index: int, material_id: String, quantity: int, total_cost: int) -> void:
	if stage_index < 0 or stage_index >= stages.size():
		return
	if quantity <= 0:
		return
	stage_stock[stage_index][material_id] = stage_stock[stage_index].get(material_id, 0) + quantity
	material_spent += total_cost


## True, если все материалы всех оставшихся этапов уже на месте.
func has_all_materials() -> bool:
	for i in stages.size():
		if stage_statuses[i] != StageStatus.COMPLETED and not has_stage_materials(i):
			return false
	return true


## Продвигает стройку на `man_hours` человеко-часов сегодняшнего дня.
## Возвращает true, если был какой-то продвижение.
func advance(man_hours: float) -> bool:
	if man_hours <= 0.0 or is_complete():
		return false
	var progressed: bool = false
	var hours_left: float = man_hours
	while hours_left > 0.0 and not is_complete():
		var man_hours_stage: float = get_stage_man_hours(current_stage_index)
		if man_hours_stage <= 0.0:
			man_hours_stage = 1.0
		var target: float = stage_progress * man_hours_stage + hours_left
		if target >= man_hours_stage:
			hours_left -= (man_hours_stage - stage_progress * man_hours_stage)
			stage_progress = 1.0
			total_man_hours_done += man_hours_stage
			_complete_stage()
			progressed = true
		else:
			stage_progress = target / man_hours_stage
			total_man_hours_done += hours_left
			hours_left = 0.0
			progressed = true
	return progressed


## Завершает текущий этап и переходит к следующему.
func _complete_stage() -> void:
	if current_stage_index >= stages.size():
		return
	stage_statuses[current_stage_index] = StageStatus.COMPLETED
	current_stage_index += 1
	stage_progress = 0.0


## True, если все этапы завершены.
func is_complete() -> bool:
	for status in stage_statuses:
		if status != StageStatus.COMPLETED:
			return false
	return true


## Возвращает суммарные человеко-часы всех этапов.
func get_total_man_hours() -> float:
	var total: float = 0.0
	for stage in stages:
		total += float(stage.get("man_hours", 0.0))
	return total


## Оставшиеся человеко-часы до завершения.
func remaining_man_hours() -> float:
	return maxf(0.0, get_total_man_hours() - total_man_hours_done)


## Возвращает общий прогресс стройки от 0 до 1.
func get_total_progress() -> float:
	var total: float = get_total_man_hours()
	if total <= 0.0:
		return 0.0
	return clampf(total_man_hours_done / total, 0.0, 1.0)
