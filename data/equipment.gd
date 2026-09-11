class_name Equipment
extends RefCounted

## Справочник строительной техники и её стоимости. Статические помощники.

## Справочник техники: id -> {name, desc, base_price, rent, lease}.
const REGISTRY: Dictionary = {
	"excavator": {
		"name": "Экскаватор",
		"desc": "Земляные работы и рытьё котлованов",
		"base_price": 3000000,
		"rent_per_hour": 1500,
		"rent_min_hours": 8,
		"lease_days": 7,
		"lease_interest": 0.25,
	},
	"crane": {
		"name": "Кран",
		"desc": "Подъём и монтаж тяжёлых конструкций",
		"base_price": 5000000,
		"rent_per_hour": 2500,
		"rent_min_hours": 8,
		"lease_days": 7,
		"lease_interest": 0.25,
	},
	"manipulator": {
		"name": "Манипулятор",
		"desc": "Погрузка и доставка материалов",
		"base_price": 2500000,
		"rent_per_hour": 1250,
		"rent_min_hours": 8,
		"lease_days": 7,
		"lease_interest": 0.25,
	},
	"tractor": {
		"name": "Трактор",
		"desc": "Планировка участка и вспомогательные работы",
		"base_price": 1800000,
		"rent_per_hour": 900,
		"rent_min_hours": 8,
		"lease_days": 7,
		"lease_interest": 0.25,
	},
	"mixer": {
		"name": "Бетономешалка",
		"desc": "Приготовление бетонной смеси на объекте",
		"base_price": 120000,
		"rent_per_hour": 60,
		"rent_min_hours": 8,
		"lease_days": 7,
		"lease_interest": 0.25,
	},
}


## Возвращает название техники.
static func get_item_name(equipment_id: String) -> String:
	if REGISTRY.has(equipment_id):
		return REGISTRY[equipment_id]["name"]
	return equipment_id


## Возвращает описание техники.
static func get_desc(equipment_id: String) -> String:
	if REGISTRY.has(equipment_id):
		return REGISTRY[equipment_id]["desc"]
	return ""


## Возвращает базовую цену техники.
static func get_price(equipment_id: String) -> int:
	if REGISTRY.has(equipment_id):
		return REGISTRY[equipment_id]["base_price"]
	return 0


## Возвращает список всех id техники.
static func get_all_ids() -> Array:
	return REGISTRY.keys()


## Возвращает стоимость аренды за час.
static func get_rent_per_hour(equipment_id: String) -> int:
	if REGISTRY.has(equipment_id):
		return REGISTRY[equipment_id].get("rent_per_hour", 0)
	return 0


## Возвращает минимальный срок аренды в часах.
static func get_rent_min_hours(equipment_id: String) -> int:
	if REGISTRY.has(equipment_id):
		return REGISTRY[equipment_id].get("rent_min_hours", 8)
	return 8


## Возвращает срок лизинга в днях.
static func get_lease_days(equipment_id: String) -> int:
	if REGISTRY.has(equipment_id):
		return REGISTRY[equipment_id].get("lease_days", 7)
	return 7


## Возвращает процент переплаты по лизингу за весь срок (дробь).
static func get_lease_interest(equipment_id: String) -> float:
	if REGISTRY.has(equipment_id):
		return REGISTRY[equipment_id].get("lease_interest", 0.0)
	return 0.0