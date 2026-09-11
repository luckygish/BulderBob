extends Node

## Управление рынком материалов на основе FIFO-очередей лотов и складом игрока.
##
## Каждая поставка — лот с фиксированной ценой. Продажи списываются со
## старейшего (фронтового) лота по принципу FIFO. Поставки и перерасчёт цен
## идут раз в RESTOCK_INTERVAL_DAYS дней; цена и объём новых поставок считаются
## от спроса за прошедший период.

const DEFAULT_LOCATION: String = "base_north"
const RESTOCK_INTERVAL_DAYS: int = 3
const PRICE_HISTORY_WINDOW: int = 30

const BALANCE: Dictionary = {
	"sensitivity": 0.6,
	"lot_size_mult": 1.0,
	"price_floor": 0.5,
	"price_cap": 1.8,
	"qty_floor_mult": 0.25,
	"qty_cap_mult": 4.0,
	"aging_age": 9,
	"aging_threshold": 0.6,
	"aging_discount": 0.15,
}

## locations[location_id]["lot_queues"][material_id] -> Array[Dictionary]
## Лот: {"price": int, "qty": int, "initial_qty": int, "arrived_day": int}
var locations: Dictionary = {}
var player_inventory: Dictionary = {}
## demand_window[material_id] — куплено единиц всеми участниками с начала цикла.
var demand_window: Dictionary = {}
## Скользящее окно цен новых поставок (для расчета «средней» цены ботами).
var price_history: Dictionary = {}


## Инициализирует рынок и подписывается на сигналы.
func _ready() -> void:
	reset()
	Signals.day_changed.connect(_on_day_changed)


## Сбрасывает рынок и склад игрока, сеет стартовые лоты и прогревает историю цен.
func reset() -> void:
	locations.clear()
	player_inventory.clear()
	demand_window.clear()
	price_history.clear()
	for material_id in Database.get_all_material_ids():
		player_inventory[material_id] = 0
		demand_window[material_id] = 0
	for location_id in Database.MARKET_LOCATIONS:
		var queues: Dictionary = {}
		for material_id in Database.get_all_material_ids():
			queues[material_id] = []
		locations[location_id] = {"lot_queues": queues}
		_seed_initial_lots(location_id)
	for material_id in Database.get_all_material_ids():
		var base: int = Database.get_base_price(material_id)
		var hist: Array = []
		for i in PRICE_HISTORY_WINDOW:
			hist.append(base)
		price_history[material_id] = hist
	Signals.market_updated.emit()


## Сеет стартовый лот на максимальный остаток склада по базовой цене,
## чтобы в начале игры сток был полным.
func _seed_initial_lots(location_id: String) -> void:
	for material_id in Database.get_all_material_ids():
		var base: int = Database.get_base_price(material_id)
		var qty: int = Database.get_stock_max(material_id)
		_push_lot(location_id, material_id, {
			"price": base,
			"qty": qty,
			"initial_qty": qty,
			"arrived_day": 0,
		})


## Возвращает очередь лотов материала на базе (пустую, если её нет).
func _get_queue(material_id: String, location_id: String) -> Array:
	if not locations.has(location_id):
		return []
	var queues: Dictionary = locations[location_id]["lot_queues"]
	return queues.get(material_id, [])


## Добавляет лот в конец очереди.
func _push_lot(location_id: String, material_id: String, lot: Dictionary) -> void:
	_get_queue(material_id, location_id).append(lot)


## Размер лота новой поставки; масштабируется по спросу (ratio) с клампом,
## но не может быть меньше минимального остатка склада.
func _compute_lot_qty(material_id: String, ratio: float) -> int:
	var base_daily_demand: int = Database.get_base_daily_demand(material_id)
	var mult: float = float(BALANCE.get("lot_size_mult", 1.0))
	var qty_floor: float = float(BALANCE.get("qty_floor_mult", 0.25))
	var qty_cap: float = float(BALANCE.get("qty_cap_mult", 4.0))
	var qty_mult: float = clampf(ratio, qty_floor, qty_cap)
	var qty: int = maxi(1, int(round(float(base_daily_demand) * RESTOCK_INTERVAL_DAYS * mult * qty_mult)))
	return maxi(qty, Database.get_stock_min(material_id))


## Возвращает цену фронтового (старейшего) лота; при пустой очереди — база.
func get_price(material_id: String, location_id: String = DEFAULT_LOCATION) -> int:
	if not locations.has(location_id):
		return Database.get_base_price(material_id)
	var queue: Array = _get_queue(material_id, location_id)
	if queue.is_empty():
		return Database.get_base_price(material_id)
	return int(queue[0]["price"])


## Возвращает суммарный остаток материала по всем лотам.
func get_stock(material_id: String, location_id: String = DEFAULT_LOCATION) -> int:
	if not locations.has(location_id):
		return 0
	var total: int = 0
	for lot in _get_queue(material_id, location_id):
		total += int(lot["qty"])
	return total


## Возвращает количество лотов материала (для отладки/UI).
func get_lot_count(material_id: String, location_id: String = DEFAULT_LOCATION) -> int:
	if not locations.has(location_id):
		return 0
	var count: int = 0
	for lot in _get_queue(material_id, location_id):
		if int(lot["qty"]) > 0:
			count += 1
	return count


## Записывает цену новой поставки в скользящую историю.
func _record_price(material_id: String, price: int) -> void:
	var hist: Array = price_history.get(material_id, [])
	if hist.size() >= PRICE_HISTORY_WINDOW:
		hist.pop_front()
	hist.append(price)
	price_history[material_id] = hist


## Средняя цена за окно истории (для ботов).
func get_price_history_average(material_id: String) -> float:
	var hist: Array = price_history.get(material_id, [])
	if hist.is_empty():
		return float(Database.get_base_price(material_id))
	var total: int = 0
	for p in hist:
		total += int(p)
	return float(total) / float(hist.size())


## Покупает материал по принципу FIFO (поблотово) и кладёт на склад игрока.
func buy(material_id: String, quantity: int, location_id: String = DEFAULT_LOCATION) -> MaterialOrder:
	if quantity <= 0:
		return null
	if not locations.has(location_id):
		return null
	var queue: Array = _get_queue(material_id, location_id)
	var available: int = get_stock(material_id, location_id)
	if quantity > available:
		return null

	var total_cost: int = _fifo_cost(queue, quantity)
	if not GameManager.spend(total_cost):
		return null

	_deduct_fifo(queue, quantity)
	player_inventory[material_id] = player_inventory.get(material_id, 0) + quantity
	demand_window[material_id] = demand_window.get(material_id, 0) + quantity

	var order := MaterialOrder.new(material_id, quantity, total_cost, location_id)
	Signals.material_purchased.emit(material_id, quantity)
	Signals.market_updated.emit()
	return order


## ИИ-скупка по тому же принципу FIFO; возвращает фактическую стоимость.
func ai_buy(material_id: String, quantity: int, location_id: String = DEFAULT_LOCATION) -> int:
	if quantity <= 0:
		return 0
	if not locations.has(location_id):
		return 0
	var queue: Array = _get_queue(material_id, location_id)
	var actual_qty: int = mini(quantity, get_stock(material_id, location_id))
	if actual_qty <= 0:
		return 0
	var total_cost: int = _fifo_cost(queue, actual_qty)
	_deduct_fifo(queue, actual_qty)
	demand_window[material_id] = demand_window.get(material_id, 0) + actual_qty
	Signals.market_updated.emit()
	return total_cost


## Стоимость `need` единиц при каскаде со старейшего лота (без списания).
func _fifo_cost(queue: Array, need: int) -> int:
	var remaining: int = need
	var total: int = 0
	for lot in queue:
		if remaining <= 0:
			break
		var take: int = mini(remaining, int(lot["qty"]))
		total += take * int(lot["price"])
		remaining -= take
	return total


## Списывает `need` единиц со старейших лотов, удаляя опустевшие.
func _deduct_fifo(queue: Array, need: int) -> void:
	var remaining: int = need
	var to_remove: Array = []
	for lot_index in range(queue.size()):
		var lot: Dictionary = queue[lot_index]
		if remaining <= 0:
			break
		var take: int = mini(remaining, int(lot["qty"]))
		lot["qty"] = int(lot["qty"]) - take
		remaining -= take
		if int(lot["qty"]) <= 0:
			to_remove.append(lot_index)
	for i in range(to_remove.size() - 1, -1, -1):
		queue.remove_at(to_remove[i])


## Обеспечивает этап материалами со склада игрока.
func allocate_stage_from_inventory(project: Project, stage_index: int) -> bool:
	if project == null:
		return false
	if stage_index < 0 or stage_index >= project.stage_stock.size():
		return false
	var bought: Dictionary = project.stage_stock[stage_index]
	var required: Dictionary = project.get_stage_required_materials(stage_index)
	var allocated_any: bool = false
	for material_id in required:
		var need: int = required[material_id]
		var have: int = bought.get(material_id, 0)
		var still: int = need - have
		if still <= 0:
			continue
		var on_hand: int = player_inventory.get(material_id, 0)
		var take: int = mini(still, on_hand)
		if take <= 0:
			continue
		bought[material_id] = have + take
		player_inventory[material_id] = on_hand - take
		project.actual_material_cost += take * get_price(material_id)
		allocated_any = true
	if allocated_any:
		Signals.market_updated.emit()
		project.check_stage_readiness(stage_index)
	return project.has_stage_materials(stage_index)


## Реагирует на смену дня: боты торгуют ежедневно, поставка/перерасчёт цен — раз в RESTOCK_INTERVAL_DAYS.
func _on_day_changed(current_day: int) -> void:
	AICompetitor.bots_daily_tick(current_day)
	if current_day % RESTOCK_INTERVAL_DAYS == 0:
		_process_supply_cycle(current_day)


## Периодическая поставка: новая партия от спроса → сброс окна → уценка старых лотов.
func _process_supply_cycle(current_day: int) -> void:
	var sensitivity: float = float(BALANCE.get("sensitivity", 0.6))
	var floor: float = float(BALANCE.get("price_floor", 0.5))
	var cap: float = float(BALANCE.get("price_cap", 1.8))

	for material_id in Database.get_all_material_ids():
		var base: int = Database.get_base_price(material_id)
		var base_demand: int = Database.get_base_daily_demand(material_id)
		var window_total: int = RESTOCK_INTERVAL_DAYS * base_demand
		var demanded: float = float(demand_window.get(material_id, 0))
		var ratio: float = demanded / float(window_total) if window_total > 0 else 1.0
		var price_mult: float = clampf(1.0 + sensitivity * (ratio - 1.0), floor, cap)
		var price: int = maxi(1, int(round(float(base) * price_mult)))
		var lot_qty: int = _compute_lot_qty(material_id, ratio)
		for location_id in locations:
			_push_lot(location_id, material_id, {
				"price": price,
				"qty": lot_qty,
				"initial_qty": lot_qty,
				"arrived_day": current_day,
			})
		_record_price(material_id, price)
		demand_window[material_id] = 0
		# Журнал: заметный сдвиг цены относительно базовой из-за спроса.
		var rise_threshold: int = maxi(1, int(round(float(base) * 1.05)))
		var fall_threshold: int = maxi(1, int(round(float(base) * 0.95)))
		var name: String = Database.get_material_name(material_id)
		if price > rise_threshold:
			Signals.journal_log("День %d · Спрос поднял цену на %s: %d руб." % [current_day, name, price])
		elif price < fall_threshold:
			Signals.journal_log("День %d · Низкий спрос снизил цену на %s: %d руб." % [current_day, name, price])

	_apply_aging(current_day)
	Signals.market_updated.emit()


## Уценка нераспроданных лотов старше aging_age дней (до пола price_floor).
func _apply_aging(current_day: int) -> void:
	var aging_age: int = int(BALANCE.get("aging_age", 9))
	var threshold: float = float(BALANCE.get("aging_threshold", 0.6))
	var discount: float = float(BALANCE.get("aging_discount", 0.15))
	var floor: float = float(BALANCE.get("price_floor", 0.5))
	var discounted: Dictionary = {}
	for location_id in locations:
		for material_id in Database.get_all_material_ids():
			var floor_price: int = maxi(1, int(round(float(Database.get_base_price(material_id)) * floor)))
			for lot in _get_queue(material_id, location_id):
				if current_day - int(lot["arrived_day"]) > aging_age:
					var remaining_ratio: float = 0.0
					if int(lot["initial_qty"]) > 0:
						remaining_ratio = float(int(lot["qty"])) / float(int(lot["initial_qty"]))
					if remaining_ratio >= threshold:
						lot["price"] = maxi(floor_price, int(round(float(lot["price"]) * (1.0 - discount))))
						if not discounted.has(material_id):
							discounted[material_id] = int(lot["price"])
	var keys: Array = discounted.keys()
	keys.sort()
	for material_id in keys:
		Signals.journal_log("День %d · Скидка на невостребованный %s: цена %d руб." % [
			current_day, Database.get_material_name(material_id), int(discounted[material_id]),
		])
