class_name HoverTree
extends Tree

## Tree, который выделяет всю строку (SELECT_ROW) при наведении курсора.

## Строка под курсором (для подсветки до первого клика).
var hovered_row: TreeItem = null
## Строка, зафиксированная кликом мыши. Ховер по другим строкам её не меняет.
var _locked_row: TreeItem = null
## Сигнал при наведении на строку.
signal row_hovered(item: TreeItem)


## Настраивает Tree на выделение всей строки.
func _init() -> void:
	select_mode = Tree.SELECT_ROW


## Обрабатывает ввод: одиночный клик фиксирует строку; до клика ховер подсвечивает.
## Переопределение _gui_input отключает встроенное выделение Tree, поэтому клик
## обрабатываем вручную, чтобы выделение сохранялось.
func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		# Клик фиксирует строку — после этого ховер по другим строкам её не меняет.
		var item := get_item_at_position(event.position)
		_locked_row = item
		hovered_row = item
		if item != null:
			set_selected(item, 0)
			row_hovered.emit(item)
			item_selected.emit()
	elif event is InputEventMouseMotion:
		# Если закреплённая строка исчезла (таблица пересобрана через clear) — разблокируем.
		if _locked_row != null and not _is_locked_valid():
			_locked_row = null
		# Пока строка не зафиксирована кликом, ховер подсвечивает строку под курсором.
		if _locked_row == null:
			var item := get_item_at_position(event.position)
			hovered_row = item
			if item != null:
				set_selected(item, 0)
				row_hovered.emit(item)


## Сбрасывает ховер при выходе курсора.
func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_EXIT:
		hovered_row = null


## True, если закреплённая строка всё ещё существует в текущей таблице.
func _is_locked_valid() -> bool:
	var root := get_root()
	if root == null or _locked_row == null:
		return false
	for i in root.get_child_count():
		if root.get_child(i) == _locked_row:
			return true
	return false
