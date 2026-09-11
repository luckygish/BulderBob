extends PanelContainer

## Панель заголовка: деньги, время, управление скоростью, кнопка «Журнал».

signal journal_toggle_requested

var _money_label: Label
var _time_label: Label
var _status_label: Label


## Строит элементы панели и подписывается на сигналы.
func _ready() -> void:
	_build_ui()
	_refresh()
	Signals.money_changed.connect(func(_m): _refresh())
	Signals.time_tick.connect(func(_d, _h): _refresh())
	Signals.game_reset.connect(_refresh)


## Создаёт UI-элементы панели.
func _build_ui() -> void:
	var hbox := HBoxContainer.new()
	add_child(hbox)

	_money_label = Label.new()
	_money_label.text = "Деньги: 0"
	hbox.add_child(_money_label)

	_time_label = Label.new()
	_time_label.text = "День 1, 08:00"
	hbox.add_child(_time_label)

	_status_label = Label.new()
	_status_label.text = ""
	hbox.add_child(_status_label)

	hbox.add_child(_make_spacer())

	var pause_btn := Button.new()
	pause_btn.text = "Пауза"
	pause_btn.pressed.connect(func():
		GameManager.set_paused(not GameManager.is_paused)
		pause_btn.text = "Продолжить" if GameManager.is_paused else "Пауза"
	)
	hbox.add_child(pause_btn)

	var speed1_btn := Button.new()
	speed1_btn.text = "×1"
	speed1_btn.pressed.connect(func(): GameManager.set_time_speed(1.0))
	hbox.add_child(speed1_btn)

	var speed2_btn := Button.new()
	speed2_btn.text = "×2"
	speed2_btn.pressed.connect(func(): GameManager.set_time_speed(2.0))
	hbox.add_child(speed2_btn)

	var speed4_btn := Button.new()
	speed4_btn.text = "×4"
	speed4_btn.pressed.connect(func(): GameManager.set_time_speed(4.0))
	hbox.add_child(speed4_btn)

	var journal_btn := Button.new()
	journal_btn.text = "Журнал"
	journal_btn.pressed.connect(func(): journal_toggle_requested.emit())
	hbox.add_child(journal_btn)

	var new_game_btn := Button.new()
	new_game_btn.text = "Новая игра"
	new_game_btn.pressed.connect(func(): GameManager.new_game())
	hbox.add_child(new_game_btn)


## Обновляет отображение денег и времени.
func _refresh() -> void:
	_money_label.text = "Деньги: %s руб." % _format_money(GameManager.money)
	_time_label.text = "День %d, %02d:00" % [GameManager.day, GameManager.hour]
	if GameManager.is_paused:
		_status_label.text = "[ПАУЗА]"
	elif GameManager.is_work_hours():
		_status_label.text = "[Рабочий день]"
	else:
		_status_label.text = "[Ночь]"


## Форматирует сумму денег с разделителями.
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


## Создаёт растягивающийся спacer.
func _make_spacer() -> Control:
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return spacer
