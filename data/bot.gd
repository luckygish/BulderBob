class_name Bot
extends RefCounted

## Строительный бот-конкурент. Владеет собственным бюджетом, бригадой и
## текущим проектом; используют общий рынок (Market.ai_buy) и общий пул
## рабочих HR. Управляется менеджером ботов (AICompetitor).

enum State {
	IDLE,        ## Нет заказа — ищет работу.
	WORKING,     ## Есть активный проект: наём, закупки, стройка.
	COOLDOWN,    ## Только что сдал заказ — краткая пауза.
}

enum Strategy {
	AGGRESSIVE,
	MODERATE,
	CONSERVATIVE,
}

var name: String = ""
var strategy: Strategy = Strategy.MODERATE

## Накопленный бюджет («копилка»). Не пополняется автоматически.
var money: int = 0
## Накопленная прибыль за все сданные заказы.
var total_profit: int = 0
## Количество сданных заказов (для расчёта «уровня» активность).
var jobs_done: int = 0

var state: State = State.IDLE
var cooldown_days: int = 0
## Ожидаемая прибыль по текущему проекту, посчитанная при взятии заказа.
var estimated_profit: int = 0

## Активный проект бота (null, если нет заказа).
var project: BotProject = null
## Бригада бота (рабочие взяты из общего пула HR.available_workers).
var crew: Array[Worker] = []
## Активный кредит бота (формат как в BankManager.compute_loan); {} — кредита нет.
var loan: Dictionary = {}


## Создаёт бота с именем и стратегией.
func _init(p_name: String = "", p_strategy: Strategy = Strategy.MODERATE) -> void:
	name = p_name
	strategy = p_strategy


## True, если у бота кончились деньги и он не может даже нанять/купить чуть-чуть.
func is_bankrupt() -> bool:
	return money <= 0


## Добавляет рабочего в бригаду.
func add_worker(worker: Worker) -> void:
	crew.append(worker)


## Возвращает рабочих в общий пул HR.
func release_crew() -> void:
	for worker in crew:
		HR.return_worker(worker)
	crew.clear()


## True, если в бригаде нет рабочих.
func has_no_crew() -> bool:
	return crew.is_empty()


## True, если у бота есть активный кредит.
func has_loan() -> bool:
	return not loan.is_empty()


## Суммарная почасовая ставка бригады.
func get_crew_hourly_rate() -> int:
	var total: int = 0
	for worker in crew:
		total += worker.rate_per_hour
	return total


## Эффективность бригады за час (с бонусом бригадира) — переиспользует HR.
func get_crew_efficiency() -> float:
	return HR.calculate_team_efficiency(crew)


## Материалы текущего этапа недокупленны?
func has_missing_materials() -> bool:
	if project == null:
		return false
	var current: Dictionary = project.get_missing_materials_for_stage(project.current_stage_index)
	if not current.is_empty():
		return true
	# Смотрим и на следующий этап, чтобы закупать заранее.
	var next: int = project.current_stage_index + 1
	if next < project.stages.size():
		return not project.get_missing_materials_for_stage(next).is_empty()
	return false


## Живая прибыль по текущему проекту (бюджет минус уже понесённые затраты).
func get_live_profit() -> int:
	if project == null:
		return 0
	return project.job.budget - project.material_spent - project.wages_paid - project.rental_paid


## Ожидаемая прибыль для UI (если есть проект — оценка при взятии, иначе 0).
func get_expected_profit() -> int:
	if project == null:
		return 0
	return estimated_profit


## Суммарно потрачено материалов по текущему проекту.
func get_materials_spent() -> int:
	if project == null:
		return 0
	return project.material_spent


## Текстовое название уровня по накопленной прибыли.
func get_level_label() -> String:
	if total_profit >= 3_000_000:
		return "Профи"
	if total_profit >= 1_000_000:
		return "Опытный"
	return "Новичок"


## Текстовое описание текущего состояния для UI.
func get_state_text() -> String:
	match state:
		State.IDLE:
			return "Ищет заказ"
		State.COOLDOWN:
			return "Заказ сдан"
		State.WORKING:
			if project == null:
				return "Подготовка"
			var current_missing: Dictionary = project.get_missing_materials_for_stage(project.current_stage_index)
			if has_no_crew() and not current_missing.is_empty():
				return "Закупка и наём"
			if not current_missing.is_empty():
				return "Закупка материалов"
			if has_no_crew():
				return "Наём рабочих"
			if project.get_total_progress() <= 0.0:
				return "Начало стройки"
			return "Строительство"
	return "Неизвестно"


## Название текущего заказа для UI (или «—» без заказа).
func get_current_job_name() -> String:
	if project == null:
		return "—"
	return project.job.get_building_display_name()


## Имя стратегии для UI.
func get_strategy_label() -> String:
	match strategy:
		Strategy.AGGRESSIVE:
			return "Агрессивный"
		Strategy.MODERATE:
			return "Умеренный"
		Strategy.CONSERVATIVE:
			return "Консервативный"
	return ""
