extends Node

## Доска заказов: генерация, истечение и выдача работ.

const MIN_JOBS: int = 3
const MAX_JOBS: int = 5
## Заказ пропадает с доски, если до срока сдачи осталось меньше этого количества дней.
const EXPIRE_THRESHOLD_DAYS: int = 3

var available_jobs: Array[Job] = []


## Инициализирует доску заказов.
func _ready() -> void:
	reset()
	Signals.day_changed.connect(_on_day_changed)


## Сбрасывает список заказов.
func reset() -> void:
	available_jobs.clear()
	for i in MIN_JOBS:
		_add_random_job()
	Signals.jobs_updated.emit()


## Генерирует и добавляет случайный заказ.
func _add_random_job() -> void:
	if available_jobs.size() >= MAX_JOBS:
		return

	var building_types: Array = Database.get_all_building_types()
	var building_type: String = building_types[randi() % building_types.size()]
	var budget: int = Database.generate_budget(building_type)
	var deadline_day: int = GameManager.day + randi_range(14, 30)

	var job := Job.new(
		Database.get_random_client_name(),
		building_type,
		budget,
		deadline_day,
		{}
	)
	available_jobs.append(job)


## Игрок берёт заказ — создаётся проект (до лимита параллельных).
func take_job(job: Job) -> Project:
	if job == null:
		return null
	var index: int = available_jobs.find(job)
	if index < 0:
		return null
	if ConstructionManager.active_projects.size() >= TechnologyManager.max_parallel_projects():
		return null

	available_jobs.remove_at(index)
	var project := Project.new(job)
	ConstructionManager.set_active_project(project)

	# Факторинг: аванс части бюджета сразу при взятии.
	var advance: int = roundi(float(job.budget) * BankManager.advance_payment())
	if advance > 0:
		GameManager.earn(advance)
		Signals.journal_log("День %d · Факторинг: аванс %s руб. по заказу %s." % [
			GameManager.day, _format_money(advance), job.get_building_display_name(),
		])

	Signals.job_taken.emit(job)
	Signals.jobs_updated.emit()
	return project


## Удаляет заказ с доски (для ИИ-конкурента).
func remove_job_by_index(index: int) -> Job:
	if index < 0 or index >= available_jobs.size():
		return null
	var job: Job = available_jobs[index]
	available_jobs.remove_at(index)
	Signals.jobs_updated.emit()
	return job


## Убирает заказы, до срока которых осталось меньше EXPIRE_THRESHOLD_DAYS дней.
func _expire_jobs(current_day: int) -> void:
	var kept: Array[Job] = []
	var changed: bool = false
	for job in available_jobs:
		if job.deadline_day - current_day < EXPIRE_THRESHOLD_DAYS:
			changed = true
		else:
			kept.append(job)
	if changed:
		available_jobs = kept
		Signals.jobs_updated.emit()


## Реагирует на смену дня: убирает просроченные заказы и добавляет новые.
func _on_day_changed(current_day: int) -> void:
	_expire_jobs(current_day)
	var to_add: int = randi_range(1, 2)
	for i in to_add:
		_add_random_job()


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
