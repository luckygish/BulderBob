extends Control

## Главный контроллер UI — шапка сверху и панели в отдельных вкладках.

const HeaderPanelScript = preload("res://ui/panels/header_panel.gd")
const JobBoardPanelScript = preload("res://ui/panels/job_board_panel.gd")
const MarketPanelScript = preload("res://ui/panels/market_panel.gd")
const EquipmentPanelScript = preload("res://ui/panels/equipment_panel.gd")
const HRPanelScript = preload("res://ui/panels/hr_panel.gd")
const ConstructionPanelScript = preload("res://ui/panels/construction_panel.gd")
const TechnologyPanelScript = preload("res://ui/panels/technology_panel.gd")
const BankPanelScript = preload("res://ui/panels/bank_panel.gd")
const CompetitorsPanelScript = preload("res://ui/panels/competitors_panel.gd")
const JournalPanelScript = preload("res://ui/panels/journal_panel.gd")

var _journal_window: PanelContainer = null


## Строит layout со вкладками при загрузке сцены.
func _ready() -> void:
	theme = AppTheme.get_theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(vbox)

	var header := _create_panel(HeaderPanelScript, "HeaderPanel")
	header.journal_toggle_requested.connect(_toggle_journal)
	vbox.add_child(header)

	var tabs := TabContainer.new()
	tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(tabs)

	_add_tab(tabs, JobBoardPanelScript, "Доска заказов")
	_add_tab(tabs, MarketPanelScript, "Рынок")
	_add_tab(tabs, EquipmentPanelScript, "Техника")
	_add_tab(tabs, TechnologyPanelScript, "Технологии")
	_add_tab(tabs, HRPanelScript, "Кадры")
	_add_tab(tabs, ConstructionPanelScript, "Строительство")
	_add_tab(tabs, BankPanelScript, "Банки")
	_add_tab(tabs, CompetitorsPanelScript, "Конкуренты")

	_build_journal_overlay()


## Оверлей окна «Журнал» поверх всех вкладок, справа экрана.
func _build_journal_overlay() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 100
	layer.name = "JournalLayer"
	add_child(layer)

	var window := PanelContainer.new()
	window.name = "JournalWindow"
	window.set_script(JournalPanelScript)
	window.hide()
	layer.add_child(window)
	_journal_window = window

	# Закрепляем справа, во всю высоту экрана, с отступом.
	window.anchor_left = 1.0
	window.anchor_right = 1.0
	window.anchor_top = 0.04
	window.anchor_bottom = 0.96
	window.offset_left = -416
	window.offset_right = -12
	window.offset_top = 0
	window.offset_bottom = 0
	window.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	window.grow_vertical = Control.GROW_DIRECTION_END


## Переключает видимость окна журнала.
func _toggle_journal() -> void:
	if _journal_window != null:
		_journal_window.toggle()


## Клавиша J — показать/скрыть журнал.
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_J:
			if not event.is_command_or_control_pressed():
				_toggle_journal()
				get_viewport().set_input_as_handled()


## Создаёт панель-вкладку с русским заголовком и вертикальной прокруткой.
func _add_tab(tabs: TabContainer, script: GDScript, title: String) -> void:
	var scroll := ScrollContainer.new()
	scroll.name = "Scroll"
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED

	var panel := PanelContainer.new()
	panel.name = "Panel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.set_script(script)

	scroll.add_child(panel)
	tabs.add_child(scroll)
	tabs.set_tab_title(tabs.get_child_count() - 1, title)


## Создаёт панель с заданным скриптом.
func _create_panel(script: GDScript, node_name: String) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.name = node_name
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.set_script(script)
	return panel