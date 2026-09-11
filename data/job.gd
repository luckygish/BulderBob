class_name Job
extends RefCounted

## Заказ на строительство от клиента.

var client_name: String = ""
var building_type: String = ""
var budget: int = 0
var deadline_day: int = 0
var requirements: Dictionary = {}


## Создаёт новый заказ с заданными параметрами.
func _init(
	p_client_name: String = "",
	p_building_type: String = "",
	p_budget: int = 0,
	p_deadline_day: int = 0,
	p_requirements: Dictionary = {}
) -> void:
	client_name = p_client_name
	building_type = p_building_type
	budget = p_budget
	deadline_day = p_deadline_day
	requirements = p_requirements


## Возвращает читаемое название типа здания.
func get_building_display_name() -> String:
	return Database.get_building_name(building_type)


## Возвращает строковое описание заказа для UI.
func get_summary() -> String:
	return "%s | %s | %d руб. | до дня %d" % [
		client_name,
		get_building_display_name(),
		budget,
		deadline_day,
	]
