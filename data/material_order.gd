class_name MaterialOrder
extends RefCounted

## Запись о покупке материала на рынке.

var material_id: String = ""
var quantity: int = 0
var total_cost: int = 0
var location_id: String = ""


## Создаёт заказ на покупку материала.
func _init(
	p_material_id: String = "",
	p_quantity: int = 0,
	p_total_cost: int = 0,
	p_location_id: String = ""
) -> void:
	material_id = p_material_id
	quantity = p_quantity
	total_cost = p_total_cost
	location_id = p_location_id
