extends Node

## Статические справочники материалов и типов зданий.

const MATERIALS: Dictionary = {
	"concrete": {"name": "Бетон", "base_price": 4500, "stock_min": 100, "stock_max": 1500, "base_daily_demand": 150},
	"rebar": {"name": "Арматура", "base_price": 650, "stock_min": 50, "stock_max": 2000, "base_daily_demand": 80},
	"lumber": {"name": "Доска", "base_price": 1200, "stock_min": 200, "stock_max": 4500, "base_daily_demand": 40},
	"insulation": {"name": "Утеплитель", "base_price": 800, "stock_min": 50, "stock_max": 1500, "base_daily_demand": 50},
	"metal_roof": {"name": "Металлочерепица", "base_price": 950, "stock_min": 50, "stock_max": 2000, "base_daily_demand": 150},
	"brick": {"name": "Кирпич", "base_price": 8, "stock_min": 200, "stock_max": 4000, "base_daily_demand": 600},
	"gas_block": {"name": "Газоблок", "base_price": 16, "stock_min": 100, "stock_max": 4000, "base_daily_demand": 50},
}

const DEFAULT_DAILY_DEMAND: int = 10

const BUILDINGS: Dictionary = {
	"frame_house": {
		"name": "Каркасный дом",
		"budget_min": 1800000,
		"budget_max": 2800000,
		"stages": [
			{
				"id": "foundation",
				"name": "Фундамент",
				"materials": {"concrete": 30, "rebar": 10},
				"man_hours": 30,
			},
			{
				"id": "walls",
				"name": "Стены и каркас",
				"materials": {"lumber": 500, "insulation": 40},
				"man_hours": 70,
			},
			{
				"id": "roof",
				"name": "Кровля",
				"materials": {"metal_roof": 120, "lumber": 20},
				"man_hours": 34,
			},
			{
				"id": "finish",
				"name": "Отделка",
				"materials": {"insulation": 20, "lumber": 30},
				"man_hours": 42,
			},
		],
	},
	"brick_house": {
		"name": "Кирпичный дом",
		"budget_min": 3200000,
		"budget_max": 5200000,
		"stages": [
			{
				"id": "foundation",
				"name": "Фундамент",
				"materials": {"concrete": 100, "rebar": 40},
				"man_hours": 40,
			},
			{
				"id": "walls",
				"name": "Кладка стен",
				"materials": {"brick": 800, "concrete": 40},
				"man_hours": 90,
			},
			{
				"id": "roof",
				"name": "Кровля",
				"materials": {"metal_roof": 180, "lumber": 40, "insulation": 30},
				"man_hours": 40,
			},
			{
				"id": "finish",
				"name": "Отделка",
				"materials": {"insulation": 60, "lumber": 50},
				"man_hours": 78,
			},
		],
	},
	"reconstruction": {
		"name": "Реконструкция",
		"budget_min": 500000,
		"budget_max": 900000,
		"stages": [
			{
				"id": "foundation",
				"name": "Фундамент",
				"materials": {"concrete": 9, "rebar": 3},
				"man_hours": 12,
			},
			{
				"id": "walls",
				"name": "Стены и каркас",
				"materials": {"lumber": 150, "insulation": 12},
				"man_hours": 20,
			},
			{
				"id": "roof",
				"name": "Кровля",
				"materials": {"metal_roof": 36, "lumber": 6},
				"man_hours": 7,
			},
			{
				"id": "finish",
				"name": "Отделка",
				"materials": {"insulation": 6, "lumber": 9},
				"man_hours": 10,
			},
		],
	},
	"gas_block_house": {
		"name": "Дом из газоблоков",
		"budget_min": 3000000,
		"budget_max": 4800000,
		"stages": [
			{
				"id": "foundation",
				"name": "Фундамент",
				"materials": {"concrete": 100, "rebar": 40},
				"man_hours": 40,
			},
			{
				"id": "walls",
				"name": "Кладка стен",
				"materials": {"gas_block": 800, "concrete": 40},
				"man_hours": 60,
			},
			{
				"id": "roof",
				"name": "Кровля",
				"materials": {"metal_roof": 180, "lumber": 40, "insulation": 30},
				"man_hours": 40,
			},
			{
				"id": "finish",
				"name": "Отделка",
				"materials": {"insulation": 60, "lumber": 50},
				"man_hours": 35,
			},
		],
	},
}

const CLIENT_NAMES: Array[String] = [
	"Иванов А.В.",
	"Петрова М.С.",
	"Сидоров К.Л.",
	"Козлова Е.Н.",
	"Морозов Д.И.",
	"Волкова О.П.",
	"Новиков Р.Г.",
	"Федорова Т.А.",
]

const WORKER_NAMES: Array[String] = [
	"Алексей",
	"Борис",
	"Виктор",
	"Григорий",
	"Дмитрий",
	"Егор",
	"Женя",
	"Илья",
	"Кирилл",
	"Лёха",
]

const MARKET_LOCATIONS: Dictionary = {
	"base_north": {"name": "База Север"},
	"base_south": {"name": "База Юг"},
}

const DEFAULT_STOCK_MIN: int = 100
const DEFAULT_STOCK_MAX: int = 200


## Возвращает эталонный дневной спрос (единиц в день) для материала.
func get_base_daily_demand(material_id: String) -> int:
	if MATERIALS.has(material_id):
		return int(MATERIALS[material_id].get("base_daily_demand", DEFAULT_DAILY_DEMAND))
	return DEFAULT_DAILY_DEMAND


## Возвращает минимальный остаток склада (ед.) для материала.
func get_stock_min(material_id: String) -> int:
	if MATERIALS.has(material_id):
		return int(MATERIALS[material_id].get("stock_min", DEFAULT_STOCK_MIN))
	return DEFAULT_STOCK_MIN


## Возвращает максимальный остаток склада (ед.) для материала.
func get_stock_max(material_id: String) -> int:
	if MATERIALS.has(material_id):
		return int(MATERIALS[material_id].get("stock_max", DEFAULT_STOCK_MAX))
	return DEFAULT_STOCK_MAX


## Инициализация справочника.
func _ready() -> void:
	pass


## Возвращает отображаемое имя материала.
func get_material_name(material_id: String) -> String:
	if MATERIALS.has(material_id):
		return MATERIALS[material_id]["name"]
	return material_id


## Возвращает базовую цену материала.
func get_base_price(material_id: String) -> int:
	if MATERIALS.has(material_id):
		return MATERIALS[material_id]["base_price"]
	return 0


## Возвращает отображаемое имя типа здания.
func get_building_name(building_type: String) -> String:
	if BUILDINGS.has(building_type):
		return BUILDINGS[building_type]["name"]
	return building_type


## Возвращает этапы строительства для типа здания.
func get_building_stages(building_type: String) -> Array:
	if BUILDINGS.has(building_type):
		return BUILDINGS[building_type]["stages"]
	return []


## Возвращает список всех id материалов.
func get_all_material_ids() -> Array:
	return MATERIALS.keys()


## Возвращает список всех типов зданий.
func get_all_building_types() -> Array:
	return BUILDINGS.keys()


## Возвращает случайное имя клиента.
func get_random_client_name() -> String:
	return CLIENT_NAMES[randi() % CLIENT_NAMES.size()]


## Возвращает случайное имя рабочего.
func get_random_worker_name() -> String:
	return WORKER_NAMES[randi() % WORKER_NAMES.size()]


## Генерирует бюджет для типа здания.
func generate_budget(building_type: String) -> int:
	if not BUILDINGS.has(building_type):
		return 2000000
	var data: Dictionary = BUILDINGS[building_type]
	return randi_range(data["budget_min"], data["budget_max"])
