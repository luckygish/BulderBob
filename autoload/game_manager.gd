extends Node

## Глобальное состояние игры: деньги, время и скорость.

const START_MONEY: int = 2_000_000
const WORK_DAY_START: int = 8
const WORK_DAY_END: int = 18

var money: int = START_MONEY
var day: int = 1
var hour: int = 8
var time_speed: float = 1.0
var is_paused: bool = false
## История сданных проектов.
var completed_projects: Array = []

var _timer: Timer


## Инициализирует таймер и подключает сигналы.
func _ready() -> void:
	_timer = Timer.new()
	_timer.wait_time = 60.0
	_timer.autostart = true
	add_child(_timer)
	_timer.timeout.connect(_on_hour_tick)


## Проверяет, идёт ли сейчас рабочий день.
func is_work_hours() -> bool:
	return hour >= WORK_DAY_START and hour < WORK_DAY_END


## Списывает деньги, если хватает баланса.
func spend(amount: int) -> bool:
	if amount < 0:
		return false
	if money < amount:
		return false
	money -= amount
	Signals.money_changed.emit(money)
	return true


## Начисляет деньги игроку.
func earn(amount: int) -> void:
	if amount <= 0:
		return
	money += amount
	Signals.money_changed.emit(money)


## Устанавливает скорость времени (1, 2 или 4).
func set_time_speed(speed: float) -> void:
	time_speed = speed
	is_paused = speed <= 0.0
	_update_timer()


## Ставит игру на паузу или снимает с паузы.
func set_paused(paused: bool) -> void:
	is_paused = paused
	_update_timer()


## Сбрасывает игру в начальное состояние.
func new_game() -> void:
	money = START_MONEY
	day = 1
	hour = 8
	time_speed = 1.0
	is_paused = false
	completed_projects.clear()
	_update_timer()
	Signals.money_changed.emit(money)
	JobBoard.reset()
	Market.reset()
	EquipmentManager.reset()
	HR.reset()
	ConstructionManager.reset()
	AICompetitor.reset()
	TechnologyManager.reset()
	BankManager.reset()
	Signals.game_reset.emit()


## Записывает завершённый проект в историю.
func record_completed(project: Project) -> void:
	completed_projects.append(project)


## Обновляет интервал таймера по текущей скорости.
## База ×1 = 1 мин реального времени на игровой час; ×4 заметно ускоряет (~4 с/час).
func _update_timer() -> void:
	if is_paused or time_speed <= 0.0:
		_timer.stop()
	else:
		var speed_wait: Dictionary = {
			1.0: 40.0,
			2.0: 10.0,
			4.0: 2.0,
		}
		_timer.wait_time = speed_wait.get(time_speed, 60.0 / time_speed)
		_timer.start()


## Обрабатывает тик игрового часа.
func _on_hour_tick() -> void:
	if is_paused:
		return

	hour += 1
	if hour >= 24:
		hour = 0
		day += 1
		Signals.day_changed.emit(day)

	Signals.time_tick.emit(day, hour)
