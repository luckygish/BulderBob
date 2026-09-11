extends Node

## Глобальная шина событий игры, а также хранилище журнала событий.

signal money_changed(new_amount: int)
signal time_tick(day: int, hour: int)
signal day_changed(day: int)
signal job_taken(job: Job)
signal job_completed(job: Job)
signal material_purchased(material_id: String, qty: int)
signal worker_hired(worker: Worker)
signal worker_fired(worker: Worker)
signal construction_progress(project: Project, stage: String, progress: float)
signal construction_completed(project: Project, profit: int)
signal stage_ready(project: Project, stage_index: int)
signal stage_started(project: Project, stage_index: int)
signal stage_completed(project: Project, stage_index: int)
signal projects_updated()
signal market_updated()
signal bots_updated()
signal equipment_updated()
signal project_assigned(project: Project)
signal jobs_updated()
signal workers_updated()
signal game_reset()

## Технологии
signal tech_researched(tech_id: String)
signal tech_progress(tech_id: String, progress: float)
signal tech_state_changed()

## Кредиты
signal loan_state_changed()

## Бригады
signal crew_assigned(project: Project, crew_index: int)

## Журнал игровых событий (окно «Журнал»). Ограничен по длине.
signal journal_updated

const JOURNAL_MAX := 200

var journal_messages: Array[String] = []


func _ready() -> void:
	game_reset.connect(journal_clear)


## Добавляет запись в журнал и оповещает подписчиков.
func journal_log(text: String) -> void:
	if text.is_empty():
		return
	journal_messages.append(text)
	if journal_messages.size() > JOURNAL_MAX:
		journal_messages.remove_at(0)
	journal_updated.emit()


## Подчищает журнал (новая игра).
func journal_clear() -> void:
	journal_messages.clear()
	journal_updated.emit()
