extends Node

## Управление техникой и обеспечением: покупка, лизинг, аренда и склад игрока.

var player_equipment: Dictionary = {}
var player_provision: Dictionary = {}

## Обеспечение, обязательное для начала стройки (этап 1).
const REQUIRED_PROVISION: Array[String] = ["cabins", "toilet", "water", "generator", "hand_tool"]

## Техника, обязательная для старта этапа: stage_id -> список групп,
## в каждой группе достаточно иметь хотя бы одну единицу.
const STAGE_REQUIRED_EQUIPMENT: Dictionary = {
	"foundation": [["mixer"], ["tractor"]],
}


## Подписывается на тики времени.
func _ready() -> void:
	Signals.time_tick.connect(_on_time_tick)


## Сбрасывает склад техники и обеспечения.
func reset() -> void:
	player_equipment.clear()
	player_provision.clear()
	for provision_id in Provision.get_all_ids():
		player_provision[provision_id] = 0
	Signals.equipment_updated.emit()


## Покупает технику целиком. Возвращает true при успехе.
func buy_equipment(equipment_id: String) -> bool:
	if player_equipment.has(equipment_id):
		return false
	if not GameManager.spend(Equipment.get_price(equipment_id)):
		return false
	player_equipment[equipment_id] = {"status": "owned"}
	Signals.equipment_updated.emit()
	return true


## Полная сумма к оплате по лизингу (с процентами и скидкой технологии).
func get_lease_total(equipment_id: String) -> int:
	var base: int = Equipment.get_price(equipment_id)
	return roundi(float(base) * (1.0 + Equipment.get_lease_interest(equipment_id)) * (1.0 - BankManager.leasing_discount()))


## Итоговая переплата по лизингу.
func get_lease_overpay(equipment_id: String) -> int:
	return get_lease_total(equipment_id) - Equipment.get_price(equipment_id)


## Ежедневный платёж по лизингу.
func get_lease_daily(equipment_id: String) -> int:
	return ceili(float(get_lease_total(equipment_id)) / float(Equipment.get_lease_days(equipment_id)))


## Оставшаяся сумма к оплате по лизингу (дни до конца срока × дневной платёж).
func get_lease_remaining(equipment_id: String) -> int:
	var rec: Dictionary = player_equipment.get(equipment_id, {})
	if rec.get("status", "") != "leased":
		return 0
	var remaining_days: int = int(rec["expires_day"]) - int(rec["last_paid_day"])
	return maxi(0, remaining_days) * int(rec["lease_daily"])


## Досрочно погашает лизинг: после оплаты остатка техника переходит в «Своя».
func pay_off_lease(equipment_id: String) -> bool:
	var rec: Dictionary = player_equipment.get(equipment_id, {})
	if rec.get("status", "") != "leased":
		return false
	var remaining: int = get_lease_remaining(equipment_id)
	if remaining > 0 and not GameManager.spend(remaining):
		return false
	player_equipment[equipment_id] = {"status": "owned"}
	Signals.equipment_updated.emit()
	return true


## Оформляет технику в лизинг (рассрочка по дням). Без первоначального взноса.
func start_lease(equipment_id: String) -> bool:
	if player_equipment.has(equipment_id):
		return false
	var days: int = Equipment.get_lease_days(equipment_id)
	player_equipment[equipment_id] = {
		"status": "leased",
		"expires_day": GameManager.day + days,
		"lease_total": get_lease_total(equipment_id),
		"lease_daily": get_lease_daily(equipment_id),
		"last_paid_day": GameManager.day,
	}
	Signals.equipment_updated.emit()
	return true


## Оформляет технику в аренду на указанное число часов (предоплата за срок).
func start_rental(equipment_id: String, hours: int) -> bool:
	if player_equipment.has(equipment_id):
		return false
	if hours < Equipment.get_rent_min_hours(equipment_id):
		return false
	var cost: int = hours * Equipment.get_rent_per_hour(equipment_id)
	if not GameManager.spend(cost):
		return false
	player_equipment[equipment_id] = {
		"status": "rented",
		"remaining_hours": hours,
	}
	Signals.equipment_updated.emit()
	return true


## Покупает единицу обеспечения. Возвращает true при успехе.
func buy_provision(provision_id: String) -> bool:
	if not GameManager.spend(Provision.get_price(provision_id)):
		return false
	player_provision[provision_id] = player_provision.get(provision_id, 0) + 1
	Signals.equipment_updated.emit()
	return true


## Количество обеспечения на складе.
func get_provision_count(provision_id: String) -> int:
	return player_provision.get(provision_id, 0)


## Статус техники на складе (пустой словарь, если её нет).
func get_equipment_status(equipment_id: String) -> Dictionary:
	return player_equipment.get(equipment_id, {})


## Есть ли техника на складе (своя, лизинг или активная аренда).
func has_equipment(equipment_id: String) -> bool:
	return player_equipment.has(equipment_id)


## Есть ли на складе всё обязательное обеспечение для взятия заказа.
func has_required_provisions() -> bool:
	for provision_id in REQUIRED_PROVISION:
		if get_provision_count(provision_id) < 1:
			return false
	return true


## Группы требуемой техники для этапа (пустой массив — требований нет).
func get_stage_equipment_requirement(stage_id: String) -> Array:
	return STAGE_REQUIRED_EQUIPMENT.get(stage_id, [])


## Тик игрового часа: уменьшает аренду и ведёт платежи по лизингу.
func _on_time_tick(day: int, _hour: int) -> void:
	var changed: bool = false
	for equipment_id in player_equipment.keys():
		var rec: Dictionary = player_equipment[equipment_id]
		if rec["status"] == "rented":
			rec["remaining_hours"] = int(rec["remaining_hours"]) - 1
			if int(rec["remaining_hours"]) <= 0:
				player_equipment.erase(equipment_id)
			changed = true
		elif rec["status"] == "leased":
			var last_paid: int = rec["last_paid_day"]
			if last_paid < day:
				if not GameManager.spend(rec["lease_daily"]):
					player_equipment.erase(equipment_id)
				else:
					rec["last_paid_day"] = day
					if day >= int(rec["expires_day"]):
						player_equipment[equipment_id] = {"status": "owned"}
				changed = true
	if changed:
		Signals.equipment_updated.emit()