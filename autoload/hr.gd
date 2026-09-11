extends Node

## Управление наймом рабочих (максимум 3) и бригадой игрока.

const MIN_AVAILABLE_WORKERS: int = 5
const MAX_AVAILABLE_WORKERS: int = 8
const MAX_CREW: int = 3

var available_workers: Array[Worker] = []
## Бригады игрока: crews[0] = Бригада №1, crews[1] = Бригада №2 (вторая активна при max_crews>=2).
var crews: Array[Array] = [[], []]


## Инициализирует HR и подписывается на сигналы.
func _ready() -> void:
	reset()
	Signals.day_changed.connect(_on_day_changed)


## Сбрасывает списки рабочих.
func reset() -> void:
	available_workers.clear()
	crews = [[], []]
	_generate_workers(randi_range(MIN_AVAILABLE_WORKERS, MAX_AVAILABLE_WORKERS))
	Signals.workers_updated.emit()


## Генерирует пул доступных рабочих случайного типа.
func _generate_workers(count: int) -> void:
	var used_names: Array[String] = []
	for i in count:
		var worker_name: String = Database.get_random_worker_name()
		while worker_name in used_names:
			worker_name = Database.get_random_worker_name()
		used_names.append(worker_name)
		available_workers.append(Worker.new(worker_name, _random_worker_type()))


## Возвращает случайный тип рабочего с весами.
func _random_worker_type() -> Worker.WorkerType:
	var roll: float = randf()
	if roll < 0.5:
		return Worker.WorkerType.HANDYMAN
	elif roll < 0.85:
		return Worker.WorkerType.SPECIALIST
	return Worker.WorkerType.FOREMAN


## Возвращает и убирает из общего пула рабочего, подходящего под фильтр.
## Фильтр: унарная функция Worker -> bool (null = любой). Возвращает null, если подходящих нет.
func pop_available_worker(filter: Callable = Callable()) -> Worker:
	for i in available_workers.size():
		var worker: Worker = available_workers[i]
		if filter.is_valid() and not filter.call(worker):
			continue
		available_workers.remove_at(i)
		Signals.workers_updated.emit()
		return worker
	return null


## Возвращает рабочего в общий пул.
func return_worker(worker: Worker) -> void:
	if worker == null:
		return
	if available_workers.has(worker):
		return
	available_workers.append(worker)
	Signals.workers_updated.emit()


## Нанимает рабочего в указанную бригаду (не более MAX_CREW на бригаду).
func hire(worker: Worker, crew_index: int = 0) -> bool:
	if worker == null:
		return false
	if crew_index < 0 or crew_index >= get_crew_count():
		return false
	if crews[crew_index].size() >= MAX_CREW:
		return false
	var index: int = available_workers.find(worker)
	if index < 0:
		return false
	available_workers.remove_at(index)
	crews[crew_index].append(worker)
	Signals.worker_hired.emit(worker)
	Signals.workers_updated.emit()
	return true


## Увольняет рабочего из указанной бригады.
func fire(worker: Worker, crew_index: int = 0) -> bool:
	if worker == null:
		return false
	if crew_index < 0 or crew_index >= crews.size():
		return false
	var index: int = crews[crew_index].find(worker)
	if index < 0:
		return false
	crews[crew_index].remove_at(index)
	available_workers.append(worker)
	Signals.worker_fired.emit(worker)
	Signals.workers_updated.emit()
	return true


## Назначает бригаду на проект по её индексу.
func assign_crew_to_project(project: Project, crew_index: int = 0) -> void:
	project.crew_index = crew_index
	project.assigned_workers.clear()
	for worker in get_crew(crew_index):
		project.assigned_workers.append(worker)


## Возвращает бригаду по индексу (пустая, если индекс вне диапазона).
func get_crew(crew_index: int = 0) -> Array:
	if crew_index < 0 or crew_index >= crews.size():
		return []
	return crews[crew_index]


## Число доступных бригад (1 или 2 — зависит от технологий).
func get_crew_count() -> int:
	return TechnologyManager.max_crews()


## Суммарная почасовая ставка бригады.
func get_crew_hourly_rate(crew_index: int = 0) -> int:
	var total: int = 0
	for worker in get_crew(crew_index):
		total += worker.rate_per_hour
	return total


## Общий список всех рабочих игрока (по всем бригадам) для UI/совместимости.
func all_player_workers() -> Array:
	var out: Array = []
	for crew in crews:
		for worker in crew:
			out.append(worker)
	return out


## Общее число рабочих игрока по всем бригадам.
func get_total_crew_count() -> int:
	var total: int = 0
	for crew in crews:
		total += crew.size()
	return total


## Считает суммарную эффективность бригады за час с учётом бонуса бригадира, навыков
## и (для бригады игрока) бонуса технологий.
func calculate_team_efficiency(workers: Array, apply_bonus: bool = false) -> float:
	var bonus: float = TechnologyManager.worker_bonus() if apply_bonus else 0.0
	var total: float = 0.0
	var foreman_count: int = 0
	var bonus_sum: float = 0.0
	for worker in workers:
		total += (worker.efficiency + bonus) * WorkerSkills.speed_multiplier(worker)
		if worker.type == Worker.WorkerType.FOREMAN:
			foreman_count += 1
			bonus_sum += worker.team_bonus
	var others: int = workers.size() - foreman_count
	if others > 0 and bonus_sum > 0.0:
		total += bonus_sum * float(others)
	return total


## Зарплата за отработанные часы списывается в ConstructionManager._on_day_changed.
## Здесь только пополняем пул доступных рабочих при смене дня.
func _on_day_changed(_current_day: int) -> void:
	if available_workers.size() < MIN_AVAILABLE_WORKERS:
		var to_add: int = MIN_AVAILABLE_WORKERS - available_workers.size()
		_generate_workers(to_add)
		Signals.workers_updated.emit()