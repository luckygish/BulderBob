extends Node

## Управление технологиями: справочник, исследование, ежедневный прогресс и эффекты.
## Исследование одно за раз; стоимость списывается сразу; длительность в игровых днях.

## Состояние исследования: id -> {"state": "done"|"researching", "progress": int}
var _research: Dictionary = {}

## Справочник технологий.
const TECHNOLOGIES: Dictionary = {
	"planning_1": {
		"name": "Планирование I",
		"branch": "Управление проектами",
		"cost": 300000,
		"days": 2,
		"requires": "",
		"requires_money": 0,
		"desc": "Позволяет вести до 2 активных объектов параллельно (в Строительстве появляются карточки объектов).",
	},
	"planning_2": {
		"name": "Планирование II",
		"branch": "Управление проектами",
		"cost": 1500000,
		"days": 4,
		"requires": "planning_1",
		"requires_money": 0,
		"desc": "Повышает лимит активных объектов до 3.",
	},
	"planning_3": {
		"name": "Планирование III",
		"branch": "Управление проектами",
		"cost": 2500000,
		"days": 7,
		"requires": "planning_2",
		"requires_money": 5000000,
		"desc": "Повышает лимит активных объектов до 4 (требуется капитал 5 млн).",
	},
	"worker_training": {
		"name": "Обучение рабочих",
		"branch": "Персонал",
		"cost": 200000,
		"days": 2,
		"requires": "",
		"requires_money": 0,
		"desc": "+0.2 к эффективности всех рабочих в бригаде.",
	},
	"prof_standards": {
		"name": "Профстандарты",
		"branch": "Персонал",
		"cost": 800000,
		"days": 4,
		"requires": "worker_training",
		"requires_money": 0,
		"desc": "+0.4 к эффективности рабочих; открывает вторую бригаду (Бригада №2) в «Кадрах».",
	},
	"automation": {
		"name": "Автоматизация",
		"branch": "Персонал",
		"cost": 2000000,
		"days": 7,
		"requires": "prof_standards",
		"requires_money": 3000000,
		"desc": "Разрешает ночные смены — стройка идёт круглосуточно.",
	},
	"bank_account": {
		"name": "Банковский счет",
		"branch": "Финансы",
		"cost": 250000,
		"days": 1,
		"requires": "",
		"requires_money": 0,
		"desc": "Открывает меню «Банки» и доступ к кредитам.",
	},
	"good_leasing": {
		"name": "Выгодный лизинг",
		"branch": "Финансы",
		"cost": 500000,
		"days": 3,
		"requires": "bank_account",
		"requires_money": 0,
		"desc": "Скидка 5% на общую сумму лизинга техники.",
	},
	"factoring": {
		"name": "Факторинг",
		"branch": "Финансы",
		"cost": 100000,
		"days": 5,
		"requires": "good_leasing",
		"requires_money": 0,
		"desc": "Аванс 30% бюджета сразу при взятии заказа.",
	},
}


## Подписывается на смену дня для прогресса исследования.
func _ready() -> void:
	Signals.day_changed.connect(_on_day_changed)


## Сбрасывает исследования (новая игра).
func reset() -> void:
	_research.clear()
	Signals.tech_state_changed.emit()


## Возвращает true, если технология изучена.
func is_researched(tech_id: String) -> bool:
	var rec: Dictionary = _research.get(tech_id, {})
	return rec.get("state", "") == "done"


## Возвращает true, если технология сейчас исследуется.
func is_researching(tech_id: String) -> bool:
	var rec: Dictionary = _research.get(tech_id, {})
	return rec.get("state", "") == "researching"


## Возвращает название технологии.
func get_tech_name(tech_id: String) -> String:
	return (TECHNOLOGIES.get(tech_id, {}) as Dictionary).get("name", tech_id)


## Возвращает название ветки технологии.
func get_tech_branch(tech_id: String) -> String:
	return (TECHNOLOGIES.get(tech_id, {}) as Dictionary).get("branch", "")


## Возвращает стоимость технологии.
func get_cost(tech_id: String) -> int:
	return int((TECHNOLOGIES.get(tech_id, {}) as Dictionary).get("cost", 0))


## Возвращает длительность исследования в днях.
func get_days(tech_id: String) -> int:
	return int((TECHNOLOGIES.get(tech_id, {}) as Dictionary).get("days", 1))


## Возвращает id требуемой технологии (пусто, если нет требований).
func get_requires(tech_id: String) -> String:
	return str((TECHNOLOGIES.get(tech_id, {}) as Dictionary).get("requires", ""))


## Возвращает требуемый капитал (минимальный баланс) в ₽.
func get_requires_money(tech_id: String) -> int:
	return int((TECHNOLOGIES.get(tech_id, {}) as Dictionary).get("requires_money", 0))


## Возвращает краткое описание технологии.
func get_tech_desc(tech_id: String) -> String:
	return str((TECHNOLOGIES.get(tech_id, {}) as Dictionary).get("desc", ""))


## Текущее исследование (id) или пустая строка.
func get_current_research() -> String:
	for tech_id in _research:
		if is_researching(tech_id):
			return tech_id
	return ""


## Прогресс текущего исследования (0..1).
func get_research_progress() -> float:
	var current: String = get_current_research()
	if current.is_empty():
		return 0.0
	var days: int = get_days(current)
	if days <= 0:
		return 1.0
	var rec: Dictionary = _research[current]
	return clampf(float(rec.get("progress", 0)) / float(days), 0.0, 1.0)


## Статус технологии: "researched" | "researching" | "available" | "locked".
func get_tech_status(tech_id: String) -> String:
	if is_researched(tech_id):
		return "researched"
	if is_researching(tech_id):
		return "researching"
	if _can_start(tech_id):
		return "available"
	return "locked"


## Список доступных для изучения технологий.
func get_available_techs() -> Array:
	var out: Array = []
	for tech_id in TECHNOLOGIES:
		if get_tech_status(tech_id) == "available":
			out.append(tech_id)
	return out


## Причина, по которой нельзя начать исследование; пустая строка — можно.
func get_block_reason(tech_id: String) -> String:
	if not TECHNOLOGIES.has(tech_id):
		return "Неизвестная технология"
	if is_researched(tech_id):
		return "Уже изучена"
	if is_researching(tech_id):
		return "Уже исследуется"
	var req: String = get_requires(tech_id)
	if not req.is_empty() and not is_researched(req):
		return "Требуется: %s" % get_tech_name(req)
	if GameManager.money < get_requires_money(tech_id):
		return "Требуется капитал: %s ₽" % _format_money(get_requires_money(tech_id))
	if not get_current_research().is_empty():
		return "Сейчас исследуется другая технология"
	return ""


## Начинает исследование. Возвращает true при успехе.
func start_research(tech_id: String) -> bool:
	if not _can_start(tech_id):
		return false
	if not GameManager.spend(get_cost(tech_id)):
		return false
	_research[tech_id] = {"state": "researching", "progress": 0}
	Signals.tech_state_changed.emit()
	return true


## Начинает исследование, если возможно.
func _can_start(tech_id: String) -> bool:
	return get_block_reason(tech_id).is_empty()


## Завершает изучение и применяет эффект.
func unlock(tech_id: String) -> void:
	var rec: Dictionary = _research.get(tech_id, {})
	rec["state"] = "done"
	rec["progress"] = get_days(tech_id)
	_research[tech_id] = rec
	Signals.tech_researched.emit(tech_id)
	Signals.tech_state_changed.emit()


## Ежедневный (по смене дня) шаг исследования.
func _on_day_changed(_day: int) -> void:
	process_day()


## Двигает прогресс текущего исследования на 1 день.
func process_day() -> void:
	var current: String = get_current_research()
	if current.is_empty():
		return
	var rec: Dictionary = _research[current]
	rec["progress"] = int(rec.get("progress", 0)) + 1
	if int(rec["progress"]) >= get_days(current):
		unlock(current)
	else:
		_research[current] = rec
		Signals.tech_progress.emit(current, get_research_progress())
		Signals.tech_state_changed.emit()


## --- Эффекты исследованных технологий ---

## Максимум параллельных проектов.
func max_parallel_projects() -> int:
	if is_researched("planning_3"):
		return 4
	if is_researched("planning_2"):
		return 3
	if is_researched("planning_1"):
		return 2
	return 1


## Бонус к эффективности рабочих.
func worker_bonus() -> float:
	if is_researched("prof_standards"):
		return 0.4
	if is_researched("worker_training"):
		return 0.2
	return 0.0


## Число доступных бригад.
func max_crews() -> int:
	return 2 if is_researched("prof_standards") else 1


## Разрешена ли работа ночью вне навыка «Сова».
func night_work_enabled() -> bool:
	return is_researched("automation")


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