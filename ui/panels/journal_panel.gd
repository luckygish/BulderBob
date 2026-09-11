extends PanelContainer

## Плавающее окно «Журнал»: отображается поверх всех вкладок, справа экрана.
## Показывает последние записи Signals.journal_messages (взятие и сдача заказов ботами).

const MAX_DISPLAY := 300

var _list: RichTextLabel


## Строит окно и подписывается на обновления журнала.
func _ready() -> void:
	custom_minimum_size = Vector2(400, 260)
	_build_ui()
	Signals.journal_updated.connect(_refresh)
	_refresh()


## Собирает содержимое окна.
func _build_ui() -> void:
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	add_child(vbox)

	var title_bar := HBoxContainer.new()
	var title := Label.new()
	title.text = "Журнал"
	title.add_theme_font_size_override("font_size", 16)
	title_bar.add_child(title)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_bar.add_child(spacer)

	var collapse := Button.new()
	collapse.text = "—"
	collapse.tooltip_text = "Свернуть"
	collapse.pressed.connect(func(): visible = false)
	title_bar.add_child(collapse)

	vbox.add_child(title_bar)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_list = RichTextLabel.new()
	_list.bbcode_enabled = false
	_list.scroll_following = true
	_list.fit_content = true
	_list.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var sep := StyleBoxEmpty.new()
	sep.content_margin_left = 6.0
	sep.content_margin_top = 2.0
	sep.content_margin_bottom = 6.0
	_list.add_theme_stylebox_override("normal", sep)
	scroll.add_child(_list)
	vbox.add_child(scroll)


## Перерисовывает список записей журнала.
func _refresh() -> void:
	var msgs: Array[String] = Signals.journal_messages
	var text := ""
	var start: int = maxi(0, msgs.size() - MAX_DISPLAY)
	for i in range(start, msgs.size()):
		text += msgs[i] + "\n"
	_list.text = text


## Показывает/скрывает окно.
func toggle() -> void:
	visible = not visible