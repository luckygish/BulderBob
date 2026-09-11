class_name Worker
extends RefCounted

## Наёмный рабочий с типом, почасовой ставкой, эффективностью и навыками.

enum WorkerType {
	HANDYMAN,       ## Разнорабочий — дешёвый, медленный.
	SPECIALIST,     ## Специалист — средний.
	FOREMAN,        ## Бригадир — дорогой, даёт бонус бригаде.
}

static var _id_counter: int = 0

## Вилки почасовой оплаты по типу: [минимум, максимум].
const RATE_RANGES: Dictionary = {
	WorkerType.HANDYMAN: [800, 1200],
	WorkerType.SPECIALIST: [1200, 1600],
	WorkerType.FOREMAN: [1800, 2300],
}

var id: String = ""
var name: String = ""
var type: WorkerType = WorkerType.HANDYMAN
var rate_per_hour: int = 0
var efficiency: float = 1.0
var team_bonus: float = 0.0
## Навыки рабочего (id из WorkerSkills.REGISTRY).
var skills: Array[String] = []


## Создаёт рабочего по имени и типу, назначает навыки.
func _init(p_name: String = "", p_type: WorkerType = WorkerType.HANDYMAN) -> void:
	name = p_name
	type = p_type
	_id_counter += 1
	id = "w_%d" % _id_counter
	_apply_type_stats()
	# Прораб не получает негативных навыков.
	skills = WorkerSkills.roll_skills(type == WorkerType.FOREMAN)


## Задаёт ставку в вилке и коэффициенты по типу рабочего.
func _apply_type_stats() -> void:
	match type:
		WorkerType.HANDYMAN:
			rate_per_hour = _roll_rate(WorkerType.HANDYMAN)
			efficiency = 0.8
			team_bonus = 0.0
		WorkerType.SPECIALIST:
			rate_per_hour = _roll_rate(WorkerType.SPECIALIST)
			efficiency = 1.0
			team_bonus = 0.0
		WorkerType.FOREMAN:
			rate_per_hour = _roll_rate(WorkerType.FOREMAN)
			efficiency = 1.1
			team_bonus = 0.2


## Возвращает случайную ставку внутри вилки типа рабочего.
func _roll_rate(worker_type: WorkerType) -> int:
	var range_vals: Array = RATE_RANGES.get(worker_type, [1000, 1000])
	return randi_range(int(range_vals[0]), int(range_vals[1]))


## Возвращает читаемое имя типа рабочего.
func get_type_name() -> String:
	match type:
		WorkerType.HANDYMAN:
			return "Разнорабочий"
		WorkerType.SPECIALIST:
			return "Специалист"
		WorkerType.FOREMAN:
			return "Прораб"
	return "Неизвестно"


## Возвращает имена навыков через запятую.
func get_skills_text() -> String:
	return WorkerSkills.names_of(self)


## Возвращает строковое описание рабочего для UI.
func get_summary() -> String:
	return "%s | %s | %d руб/ч | эфф. %.1f" % [name, get_type_name(), rate_per_hour, efficiency]