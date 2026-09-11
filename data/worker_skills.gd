class_name WorkerSkills
extends RefCounted

## Реестр навыков рабочих и их механики. Статические помощники.

## Негативные навыки (id -> true). Не назначаются Прорабу.
const NEGATIVE: Dictionary = {
	"alcohol": true,
	"thief": true,
}

## Справочник навыков: id -> {name, desc, speed, material_mul, flags}.
const REGISTRY: Dictionary = {
	"alcohol": {
		"name": "Алкоголизм",
		"desc": "-15% к скорости стройки",
		"speed": -0.15,
	},
	"tudyaga": {
		"name": "Трудяга",
		"desc": "+20% к скорости стройки",
		"speed": 0.2,
	},
	"owl": {
		"name": "Сова",
		"desc": "Стройка не останавливается ночью",
		"owl": true,
	},
	"thief": {
		"name": "Вор",
		"desc": "+5% к себестоимости материалов",
		"material_mul": 1.05,
		"thief": true,
	},
}


## Назначает рабочему от 1 до 3 случайных уникальных навыков.
## При exclude_negative=true берутся только позитивные навыки.
static func roll_skills(exclude_negative: bool = false) -> Array[String]:
	var ids: Array = []
	for id in REGISTRY:
		if not (exclude_negative and is_negative(id)):
			ids.append(id)
	var result: Array[String] = []
	var count: int = randi_range(1, mini(3, ids.size()))
	while result.size() < count:
		var pick: String = ids[randi() % ids.size()]
		if not result.has(pick):
			result.append(pick)
	return result


## Возвращает true, если навык считается негативным.
static func is_negative(skill_id: String) -> bool:
	return NEGATIVE.has(skill_id)


## Возвращает персональный множитель скорости рабочего от его навыков.
static func speed_multiplier(worker: Worker) -> float:
	var mul: float = 1.0
	for skill_id in worker.skills:
		if REGISTRY.get(skill_id, {}).has("speed"):
			mul += float(REGISTRY[skill_id]["speed"])
	return mul


## Есть ли в бригаде рабочий с навыком «Сова».
static func has_owl(workers: Array) -> bool:
	for worker in workers:
		if worker.skills.has("owl"):
			return true
	return false


## Есть ли в бригаде рабочий с навыком «Вор».
static func has_thief(workers: Array) -> bool:
	for worker in workers:
		if worker.skills.has("thief"):
			return true
	return false


## Возвращает название навыка.
static func get_name(skill_id: String) -> String:
	if REGISTRY.has(skill_id):
		return REGISTRY[skill_id]["name"]
	return skill_id


## Возвращает описание (эффект) навыка.
static func get_desc(skill_id: String) -> String:
	if REGISTRY.has(skill_id):
		return REGISTRY[skill_id]["desc"]
	return ""


## Собирает имена навыков рабочим через запятую.
static func names_of(worker: Worker) -> String:
	var out: PackedStringArray = []
	for skill_id in worker.skills:
		out.append(get_name(skill_id))
	return ", ".join(out)


## Собирает краткое описание работника: тип + каждый навык с эффектом.
static func describe(worker: Worker) -> String:
	var lines: PackedStringArray = []
	lines.append(worker.get_type_name())
	for skill_id in worker.skills:
		var name: String = get_name(skill_id)
		var desc: String = get_desc(skill_id)
		if desc.is_empty():
			lines.append("- %s" % name)
		else:
			lines.append("- %s: %s" % [name, desc])
	return "\n".join(lines)
