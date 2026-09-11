class_name Provision
extends RefCounted

## Справочник обеспечения стройплощадки и его стоимости. Статические помощники.

## Справочник обеспечения: id -> {name, desc, base_price}.
const REGISTRY: Dictionary = {
	"cabins": {
		"name": "Бытовка",
		"desc": "Модульный вагончик для отдыха и хранения",
		"base_price": 250000,
	},
	"toilet": {
		"name": "Биотуалет",
		"desc": "Автономный санузел на объекте",
		"base_price": 40000,
	},
	"water": {
		"name": "Канистра воды",
		"desc": "Запас питьевой и технической воды",
		"base_price": 1500,
	},
	"generator": {
		"name": "Генератор",
		"desc": "Автономное электроснабжение площадки",
		"base_price": 180000,
	},
	"hand_tool": {
		"name": "Ручной инструмент",
		"desc": "Отбойники, перфораторы и базовый инструмент",
		"base_price": 50000,
	},
}


## Возвращает название обеспечения.
static func get_item_name(provision_id: String) -> String:
	if REGISTRY.has(provision_id):
		return REGISTRY[provision_id]["name"]
	return provision_id


## Возвращает описание обеспечения.
static func get_desc(provision_id: String) -> String:
	if REGISTRY.has(provision_id):
		return REGISTRY[provision_id]["desc"]
	return ""


## Возвращает базовую цену обеспечения.
static func get_price(provision_id: String) -> int:
	if REGISTRY.has(provision_id):
		return REGISTRY[provision_id]["base_price"]
	return 0


## Возвращает список всех id обеспечения.
static func get_all_ids() -> Array:
	return REGISTRY.keys()