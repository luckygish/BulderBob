class_name AppTheme
extends RefCounted

## Глобальная тема UI, собираемая в рантайме (никаких .tres / импорта редактора).
## Применяется один раз на корневом Control «Main» и каскадируется на все вкладки.
## Откат = удалить этот файл и строку `theme = AppTheme.get_theme()` в main_ui.gd.

## --- Палитра ---
const COLOR_BG: Color = Color("#2C3E50")
const COLOR_PANEL: Color = Color("#34495E")
const COLOR_BUTTON: Color = Color("#F39C12")
const COLOR_TEXT: Color = Color("#ECF0F1")
const COLOR_SUCCESS: Color = Color("#27AE60")
const COLOR_ERROR: Color = Color("#E74C3C")
const COLOR_WARNING: Color = Color("#F1C40F")

const COLOR_BUTTON_TEXT: Color = Color("#1A2530")
const COLOR_DISABLED: Color = Color("#7F8C8D")
const COLOR_BUTTON_HOVER: Color = Color("#F5B041")
const COLOR_BUTTON_PRESSED: Color = Color("#D68910")

static var _cache: Theme = null


## Возвращает закешированную собранную тему.
static func get_theme() -> Theme:
	if _cache == null:
		_cache = _build()
	return _cache


## Собирает Theme со всеми типами: панели, кнопки, текст, таблицы, прогресс, вкладки.
static func _build() -> Theme:
	var theme := Theme.new()

	_build_panel(theme)
	_build_button(theme)
	_build_label(theme)
	_build_tree(theme)
	_build_progress(theme)
	_build_tabs(theme)
	_build_dialog(theme)

	return theme


## Универсальный плоский StyleBoxFlat панели.
static func _flat(bg: Color, radius: int, border_color: Color = COLOR_BG, border_width: int = 0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(radius)
	sb.border_color = border_color
	sb.set_border_width_all(border_width)
	return sb


## Панели (PanelContainer): тёмный фон, скруглённые углы, отступы, лёгкая обводка.
static func _build_panel(theme: Theme) -> void:
	var panel := _flat(COLOR_PANEL, 6, COLOR_BG, 1)
	panel.content_margin_left = 10
	panel.content_margin_right = 10
	panel.content_margin_top = 10
	panel.content_margin_bottom = 10
	theme.set_stylebox(&"panel", &"PanelContainer", panel)


## Кнопки: оранжевые скруглённые, тёмный текст, hover/pressed/disabled/focus.
static func _build_button(theme: Theme) -> void:
	theme.set_stylebox(&"normal", &"Button", _button_style(COLOR_BUTTON))
	theme.set_stylebox(&"hover", &"Button", _button_style(COLOR_BUTTON_HOVER))
	theme.set_stylebox(&"pressed", &"Button", _button_style(COLOR_BUTTON_PRESSED))
	theme.set_stylebox(&"disabled", &"Button", _button_style(COLOR_DISABLED))

	var focus := StyleBoxFlat.new()
	focus.bg_color = Color(0, 0, 0, 0)
	focus.border_color = Color("#FFFFFF")
	focus.set_border_width_all(1)
	focus.expand_margin_left = 2
	focus.expand_margin_right = 2
	focus.expand_margin_top = 2
	focus.expand_margin_bottom = 2
	theme.set_stylebox(&"focus", &"Button", focus)

	theme.set_color(&"font_color", &"Button", COLOR_BUTTON_TEXT)
	theme.set_color(&"font_hover_color", &"Button", COLOR_BUTTON_TEXT)
	theme.set_color(&"font_pressed_color", &"Button", COLOR_BUTTON_TEXT)
	theme.set_color(&"font_disabled_color", &"Button", Color("#DCE0E4"))
	theme.set_font_size(&"font_size", &"Button", 15)
	theme.set_constant(&"h_separation", &"Button", 8)
	theme.set_constant(&"v_separation", &"Button", 4)


static func _button_style(bg: Color) -> StyleBoxFlat:
	var sb := _flat(bg, 8, bg, 0)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	return sb


## Текст: светлый, крупнее дефолта для читаемости.
static func _build_label(theme: Theme) -> void:
	theme.set_color(&"font_color", &"Label", COLOR_TEXT)
	theme.set_font_size(&"font_size", &"Label", 15)


## Таблицы (Tree / HoverTree): панель, заголовки, выделение строки, высота строки.
static func _build_tree(theme: Theme) -> void:
	var panel := _flat(COLOR_PANEL, 6, COLOR_BG, 1)
	panel.content_margin_left = 8
	panel.content_margin_right = 8
	panel.content_margin_top = 8
	panel.content_margin_bottom = 8
	theme.set_stylebox(&"panel", &"Tree", panel)

	var selection := StyleBoxFlat.new()
	selection.bg_color = Color(COLOR_BUTTON, 0.25)
	selection.set_corner_radius_all(4)
	selection.content_margin_top = 2
	selection.content_margin_bottom = 2
	theme.set_stylebox(&"selection", &"Tree", selection)
	theme.set_stylebox(&"selected_focus", &"Tree", selection)
	theme.set_stylebox(&"selected_hover", &"Tree", selection)

	theme.set_color(&"font_color", &"Tree", COLOR_TEXT)
	theme.set_color(&"font_selected_color", &"Tree", COLOR_TEXT)
	theme.set_color(&"title_button_color", &"Tree", COLOR_TEXT)
	theme.set_font_size(&"font_size", &"Tree", 14)
	theme.set_font_size(&"font_selected_size", &"Tree", 14)
	theme.set_font_size(&"title_button_font_size", &"Tree", 14)
	theme.set_constant(&"v_separation", &"Tree", 4)
	theme.set_constant(&"h_separation", &"Tree", 8)


## Прогресс-бары: тёмный фон и оранжевая заливка, скруглённые.
static func _build_progress(theme: Theme) -> void:
	var bg := _flat(COLOR_PANEL, 6, Color(0, 0, 0, 0), 0)
	var fill := _flat(COLOR_BUTTON, 6, Color(0, 0, 0, 0), 0)
	theme.set_stylebox(&"background", &"ProgressBar", bg)
	theme.set_stylebox(&"fill", &"ProgressBar", fill)


## Вкладки TabContainer — единообразный тёмный фон и оранжевая выбранная вкладка.
static func _build_tabs(theme: Theme) -> void:
	theme.set_stylebox(&"tab_selected", &"TabContainer", _tab_style(COLOR_BUTTON, COLOR_BUTTON_TEXT))
	theme.set_stylebox(&"tab_unselected", &"TabContainer", _tab_style(COLOR_PANEL, COLOR_TEXT))
	theme.set_stylebox(&"tab_hover", &"TabContainer", _tab_style(COLOR_BUTTON_HOVER, COLOR_BUTTON_TEXT))
	theme.set_color(&"font_selected_color", &"TabContainer", COLOR_BUTTON_TEXT)
	theme.set_color(&"font_unselected_color", &"TabContainer", COLOR_TEXT)
	theme.set_color(&"font_hover_color", &"TabContainer", COLOR_TEXT)
	theme.set_font_size(&"font_size", &"TabContainer", 15)
	theme.set_constant(&"tab_separation", &"TabContainer", 4)


static func _tab_style(bg: Color, _fg: Color) -> StyleBoxFlat:
	var sb := _flat(bg, 6, COLOR_BG, 1)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 4
	sb.content_margin_bottom = 4
	return sb


## ConfirmationDialog (окно-попап): панель, кнопки, текст наследуют тему от диалога.
static func _build_dialog(theme: Theme) -> void:
	var panel := _flat(COLOR_PANEL, 6, COLOR_BG, 1)
	panel.content_margin_left = 12
	panel.content_margin_right = 12
	panel.content_margin_top = 12
	panel.content_margin_bottom = 12
	theme.set_stylebox(&"panel", &"ConfirmationDialog", panel)
	theme.set_stylebox(&"panel", &"Window", panel)
	theme.set_color(&"title_color", &"AcceptDialog", COLOR_TEXT)
